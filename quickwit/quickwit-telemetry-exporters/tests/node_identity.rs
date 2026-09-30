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

use std::process::Command;

use quickwit_telemetry_exporters::{
    NodeIdentity, default_tracing_registry, init_bootstrap_metrics, init_meter_provider_only,
    init_telemetry,
};

#[test]
fn node_identity_initialization() {
    const TEST_MODE: &str = "QW_TELEMETRY_IDENTITY_TEST_MODE";
    let Ok(mode) = std::env::var(TEST_MODE) else {
        // Global recorders/subscribers are singletons. Exercise each initialization path in
        // a separate process, with controlled env and no process-wide env mutation in Rust.
        for mode in ["full", "metrics-only"] {
            let output = Command::new(std::env::current_exe().unwrap())
                .args(["--exact", "node_identity_initialization", "--nocapture"])
                .env(TEST_MODE, mode)
                .env("QW_ENABLE_OPENTELEMETRY_OTLP_EXPORTER", "false")
                .env_remove("QW_METRICS_LABELS")
                .output()
                .unwrap();
            assert!(
                output.status.success(),
                "{mode}:\n{}\n{}",
                String::from_utf8_lossy(&output.stdout),
                String::from_utf8_lossy(&output.stderr),
            );
        }
        return;
    };

    tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .unwrap()
        .block_on(async {
            init_bootstrap_metrics().unwrap();
            let early_counter = quickwit_metrics::counter!(
                name: "early_counter_total",
                description: "Counter created during config loading",
                subsystem: "telemetry_identity_test",
            );
            early_counter.inc_by(100);
            let identity = Some(NodeIdentity {
                cluster_id: "resolved-cluster",
                node_id: "resolved-node",
            });
            let telemetry = match mode.as_str() {
                "full" => {
                    let (registry, _) =
                        default_tracing_registry(tracing::Level::INFO, false).unwrap();
                    init_telemetry("test-version", registry, identity).unwrap()
                }
                "metrics-only" => init_meter_provider_only("test-version", identity).unwrap(),
                _ => panic!("unexpected test mode: {mode}"),
            };
            early_counter.inc_by(3);
            let late_counter = quickwit_metrics::counter!(
                name: "late_counter_total",
                description: "Counter created after config loading",
                subsystem: "telemetry_identity_test",
            );
            late_counter.inc_by(7);
            let payload =
                quickwit_telemetry_exporters::prometheus::metrics::text_payload().unwrap();
            assert!(
                payload.contains("quickwit_telemetry_identity_test_early_counter_total 3\n"),
                "{payload}"
            );
            assert!(
                payload.contains("quickwit_telemetry_identity_test_late_counter_total 7\n"),
                "{payload}"
            );
            telemetry.shutdown().await.unwrap();
        });
}
