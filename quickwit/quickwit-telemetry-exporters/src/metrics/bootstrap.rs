// Copyright 2021-Present Datadog, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

//! Keeps metric handles created while loading the node config usable after telemetry starts.
//!
//! Config loading (notably from object storage) can register cached metrics. Registering them
//! against the default noop recorder would permanently disable those metrics. This recorder
//! defers binding each handle until the configured exporters are installed. Measurements during
//! config loading are intentionally not exported: the cluster identity is not yet known.

use std::sync::{Arc, OnceLock};

use metrics::{
    Counter, CounterFn, Gauge, GaugeFn, Histogram, HistogramFn, Key, KeyName, Level, Metadata,
    Recorder, SharedString, Unit,
};

type Backend = Arc<OnceLock<&'static (dyn Recorder + Sync)>>;

#[derive(Clone, Default)]
pub(super) struct BootstrapRecorder {
    backend: Backend,
}

impl BootstrapRecorder {
    pub(super) fn install(&self, recorder: impl Recorder + Sync + 'static) -> anyhow::Result<()> {
        let mut installed = false;
        self.backend.get_or_init(|| {
            installed = true;
            // Like metrics::set_global_recorder, the production recorder lives for the process.
            // Recorder requires Sync, not Send (notably metrics_util's Fanout).
            Box::leak(Box::new(recorder))
        });
        anyhow::ensure!(installed, "metrics exporters are already initialized");
        Ok(())
    }

    fn metric<H>(&self, key: &Key, metadata: &Metadata<'_>) -> Arc<BootstrapMetric<H>> {
        Arc::new(BootstrapMetric {
            backend: self.backend.clone(),
            handle: OnceLock::new(),
            key: key.to_retained(),
            target: metadata.target().to_string(),
            level: *metadata.level(),
            module_path: metadata.module_path().map(str::to_string),
        })
    }
}

impl Recorder for BootstrapRecorder {
    fn describe_counter(&self, key: KeyName, unit: Option<Unit>, description: SharedString) {
        if let Some(backend) = self.backend.get() {
            backend.describe_counter(key, unit, description);
        }
    }

    fn describe_gauge(&self, key: KeyName, unit: Option<Unit>, description: SharedString) {
        if let Some(backend) = self.backend.get() {
            backend.describe_gauge(key, unit, description);
        }
    }

    fn describe_histogram(&self, key: KeyName, unit: Option<Unit>, description: SharedString) {
        if let Some(backend) = self.backend.get() {
            backend.describe_histogram(key, unit, description);
        }
    }

    fn register_counter(&self, key: &Key, metadata: &Metadata<'_>) -> Counter {
        if let Some(backend) = self.backend.get() {
            return backend.register_counter(key, metadata);
        }
        Counter::from_arc(self.metric(key, metadata))
    }

    fn register_gauge(&self, key: &Key, metadata: &Metadata<'_>) -> Gauge {
        if let Some(backend) = self.backend.get() {
            return backend.register_gauge(key, metadata);
        }
        Gauge::from_arc(self.metric(key, metadata))
    }

    fn register_histogram(&self, key: &Key, metadata: &Metadata<'_>) -> Histogram {
        if let Some(backend) = self.backend.get() {
            return backend.register_histogram(key, metadata);
        }
        Histogram::from_arc(self.metric(key, metadata))
    }
}

struct BootstrapMetric<H> {
    backend: Backend,
    handle: OnceLock<H>,
    key: Key,
    target: String,
    level: Level,
    module_path: Option<String>,
}

impl<H> BootstrapMetric<H> {
    fn get(&self, register: impl FnOnce(&dyn Recorder, &Key, &Metadata<'_>) -> H) -> Option<&H> {
        if let Some(handle) = self.handle.get() {
            return Some(handle);
        }
        let backend = self.backend.get()?;
        Some(self.handle.get_or_init(|| {
            let metadata = Metadata::new(&self.target, self.level, self.module_path.as_deref());
            register(*backend, &self.key, &metadata)
        }))
    }
}

impl CounterFn for BootstrapMetric<Counter> {
    fn increment(&self, value: u64) {
        if let Some(handle) =
            self.get(|recorder, key, metadata| recorder.register_counter(key, metadata))
        {
            handle.increment(value);
        }
    }

    fn absolute(&self, value: u64) {
        if let Some(handle) =
            self.get(|recorder, key, metadata| recorder.register_counter(key, metadata))
        {
            handle.absolute(value);
        }
    }
}

impl GaugeFn for BootstrapMetric<Gauge> {
    fn increment(&self, value: f64) {
        if let Some(handle) =
            self.get(|recorder, key, metadata| recorder.register_gauge(key, metadata))
        {
            handle.increment(value);
        }
    }

    fn decrement(&self, value: f64) {
        if let Some(handle) =
            self.get(|recorder, key, metadata| recorder.register_gauge(key, metadata))
        {
            handle.decrement(value);
        }
    }

    fn set(&self, value: f64) {
        if let Some(handle) =
            self.get(|recorder, key, metadata| recorder.register_gauge(key, metadata))
        {
            handle.set(value);
        }
    }
}

impl HistogramFn for BootstrapMetric<Histogram> {
    fn record(&self, value: f64) {
        if let Some(handle) =
            self.get(|recorder, key, metadata| recorder.register_histogram(key, metadata))
        {
            handle.record(value);
        }
    }

    fn record_many(&self, value: f64, count: usize) {
        if let Some(handle) =
            self.get(|recorder, key, metadata| recorder.register_histogram(key, metadata))
        {
            handle.record_many(value, count);
        }
    }
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use metrics_util::debugging::{DebugValue, DebuggingRecorder};

    use super::*;

    #[test]
    fn test_cached_quickwit_metric_survives_config_loading() {
        static CONFIG_READS: quickwit_metrics::LazyCounter = quickwit_metrics::lazy_counter!(
            name: "config_reads_total",
            description: "Config reads during telemetry bootstrap regression test",
            subsystem: "telemetry_bootstrap_test",
        );
        let bootstrap = BootstrapRecorder::default();
        metrics::with_local_recorder(&bootstrap, || CONFIG_READS.inc());

        let recorder = DebuggingRecorder::default();
        let snapshotter = recorder.snapshotter();
        bootstrap.install(recorder).unwrap();
        // Reuse the cached handle on another thread, without the local recorder installed.
        std::thread::spawn(|| CONFIG_READS.inc()).join().unwrap();
        let snapshot = snapshotter.snapshot().into_vec();
        assert_eq!(snapshot.len(), 1);
        assert_eq!(
            snapshot[0].0.key().name(),
            "quickwit_telemetry_bootstrap_test_config_reads_total"
        );
        assert_eq!(snapshot[0].3, DebugValue::Counter(1));
    }

    #[test]
    fn test_handles_created_before_initialization_bind_to_exporters() {
        let bootstrap = BootstrapRecorder::default();
        let metadata = Metadata::new("bootstrap-test", Level::INFO, Some(module_path!()));
        let counter = bootstrap.register_counter(&Key::from_name("early_counter"), &metadata);
        let gauge = bootstrap.register_gauge(&Key::from_name("early_gauge"), &metadata);
        let histogram = bootstrap.register_histogram(&Key::from_name("early_histogram"), &metadata);

        // Config loading may touch these handles. Do not cache a noop backend.
        counter.increment(100);
        gauge.set(100.0);
        histogram.record(100.0);

        let recorder = DebuggingRecorder::default();
        let snapshotter = recorder.snapshotter();
        bootstrap.install(recorder).unwrap();
        bootstrap.describe_counter(
            "early_counter".into(),
            Some(Unit::Count),
            "early metric".into(),
        );
        counter.increment(2);
        counter.absolute(5);
        gauge.set(3.0);
        gauge.increment(4.0);
        gauge.decrement(1.0);
        histogram.record(7.0);
        histogram.record_many(8.0, 2);

        // Newly registered handles work too, and the backend is only installed once.
        let late_counter = bootstrap.register_counter(&Key::from_name("late_counter"), &metadata);
        late_counter.increment(9);
        assert!(bootstrap.install(DebuggingRecorder::default()).is_err());
        let values: HashMap<_, _> = snapshotter
            .snapshot()
            .into_vec()
            .into_iter()
            .map(|(key, _, _, value)| (key.key().name().to_string(), value))
            .collect();
        assert_eq!(values["early_counter"], DebugValue::Counter(5));
        assert_eq!(values["early_gauge"], DebugValue::Gauge(6.0.into()));
        assert_eq!(
            values["early_histogram"],
            DebugValue::Histogram(vec![7.0.into(), 8.0.into(), 8.0.into()])
        );
        assert_eq!(values["late_counter"], DebugValue::Counter(9));
    }
}
