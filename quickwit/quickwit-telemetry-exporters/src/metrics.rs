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

use std::sync::OnceLock;

use metrics_util::layers::FanoutBuilder;
use opentelemetry_sdk::metrics::SdkMeterProvider;

use crate::NodeIdentity;
use crate::otlp::OtlpExporterConfig;

mod bootstrap;

static BOOTSTRAP_RECORDER: OnceLock<bootstrap::BootstrapRecorder> = OnceLock::new();

/// Install before loading the node config, which can create cached storage metric handles.
/// Measurements during config loading are not forwarded, but those handles bind to the real
/// exporters once telemetry is initialized with the resolved node identity.
/// Call once, then initialize telemetry before starting services.
pub fn init_bootstrap_metrics() -> anyhow::Result<()> {
    quickwit_metrics::init_metrics_labels_env_var()?;
    let recorder = bootstrap::BootstrapRecorder::default();
    metrics::set_global_recorder(recorder.clone())
        .map_err(|_| anyhow::anyhow!("failed to install bootstrap metrics recorder"))?;
    BOOTSTRAP_RECORDER
        .set(recorder)
        .map_err(|_| anyhow::anyhow!("bootstrap metrics recorder is already initialized"))
}

/// Sets up the global metrics recorder.
pub(crate) fn init_metrics_provider(
    service_version: &str,
    otlp_config: &OtlpExporterConfig,
    node_identity: Option<NodeIdentity<'_>>,
) -> anyhow::Result<Option<SdkMeterProvider>> {
    quickwit_metrics::init_metrics_labels_env_var()?;

    let prometheus_recorder = crate::prometheus::metrics::build_recorder()?;

    let (recorder, meter_provider) = if otlp_config.is_enabled() {
        let (otlp_recorder, meter_provider) =
            crate::otlp::metrics::build_recorder(service_version, otlp_config, node_identity)?;
        let recorder = FanoutBuilder::default()
            .add_recorder(prometheus_recorder)
            .add_recorder(otlp_recorder)
            .build();
        (recorder, Some(meter_provider))
    } else {
        let recorder = FanoutBuilder::default()
            .add_recorder(prometheus_recorder)
            .build();
        (recorder, None)
    };

    if let Some(bootstrap_recorder) = BOOTSTRAP_RECORDER.get() {
        bootstrap_recorder.install(recorder)?;
    } else {
        metrics::set_global_recorder(recorder)
            .map_err(|_| anyhow::anyhow!("failed to install global metrics recorder"))?;
    }
    quickwit_metrics::describe_metrics();

    Ok(meter_provider)
}
