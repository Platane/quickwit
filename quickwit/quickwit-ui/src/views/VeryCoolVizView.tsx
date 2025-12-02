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

import React from "react";
import { ViewUnderAppBarBox } from "../components/LayoutUtils";
import Loader from "../components/Loader";
import { IndexMetadata, Metric, SplitMetadata } from "../utils/models";
import * as styles from "./VeryCoolVizView.module.css";
import {
  Selection,
  Snapshot,
  VeryCoolViz,
} from "../components/VeryCoolViz/VeryCoolViz";
import { Box } from "@mui/material";

export const VeryCoolVizView = () => {
  const systemSnapshot = useSystemSnapshot();
  const [selected, setSelected] = React.useState<Selection>(null);

  const now = Math.round(Date.now() / 1_000);
  const timeRange = { end: now, start: now - 10 * 60 };

  const [, forceRerender] = React.useReducer(() => ({}), {});
  React.useEffect(() => {
    const i = setInterval(forceRerender, 2_000);
    return () => clearInterval(i);
  }, [systemSnapshot]);

  return (
    <ViewUnderAppBarBox sx={{ flexDirection: "row" }}>
      <Box
        sx={{
          display: "flex",
          flexDirection: "row",
        }}
      >
        <Box sx={{ minWidth: 200, padding: "10px" }}>
          <Details selected={selected} snapshot={systemSnapshot} />
        </Box>
        <Box>
          {systemSnapshot && (
            <VeryCoolViz
              timeRange={timeRange}
              snapshot={systemSnapshot}
              selected={selected}
              onSelect={setSelected}
            />
          )}
          {!systemSnapshot && <Loader />}
        </Box>
      </Box>
    </ViewUnderAppBarBox>
  );
};

const Details = ({
  selected,
  snapshot,
}: {
  selected: Selection;
  snapshot: undefined | Snapshot;
}) => {
  const selectedNode =
    selected?.type === "node" &&
    (snapshot?.indexers.find((node) => node.nodeId === selected.nodeId) ||
      snapshot?.searchers.find((node) => node.nodeId === selected.nodeId) ||
      snapshot?.metastores.find((node) => node.nodeId === selected.nodeId));

  if (selectedNode)
    return (
      <>
        <h4>node</h4>
        <dl>
          <dt>Node Id</dt>
          <dd>{selectedNode.nodeId}</dd>
        </dl>
      </>
    );

  if (selected?.type === "group")
    return (
      <>
        <h4>group</h4>
        <dl>
          <dt>Group</dt>
          <dd>{selected.group}</dd>
        </dl>
      </>
    );

  return null;
};

const useSystemSnapshot = () => {
  const [snapshot, setSnapshot] = React.useState<Snapshot>();
  React.useEffect(() => {
    const abortController = new AbortController();

    const loop = async () => {
      if (abortController.signal.aborted) return;

      const parseMetrics = (text: string): Record<string, number> =>
        Object.fromEntries(
          [...text.matchAll(/^([^#\s]+)+\s+(.*)$/gm)].map(([, key, value]) => [
            key,
            +value!.trim(),
          ]),
        );

      const [debug, indexes, metrics] = await Promise.all([
        fetch("/api/developer/debug", { signal: abortController.signal })
          .then((res) => res.json())
          .then((d: DebugInfo) => d),

        fetch("/api/v1/indexes", { signal: abortController.signal })
          .then((res) => res.json())
          .then((indexes: IndexMetadata[]) =>
            Promise.all(
              indexes.map((index) =>
                fetch(
                  `/api/v1/indexes/${index.index_config.index_id}/splits?limit=200&split_states=Published,Staged`,
                  {
                    signal: abortController.signal,
                  },
                )
                  .then((res) => res.json())
                  .then(({ splits }: { splits: SplitMetadata[] }) => ({
                    index,
                    splits,
                  })),
              ),
            ),
          ),

        fetch("/metrics", { signal: abortController.signal })
          .then((res) => res.text())
          .then(parseMetrics),
      ]);

      const nodes = Object.values(debug).sort((a, b) =>
        a.node_config.node_id.localeCompare(b.node_config.node_id),
      );

      const indexers = nodes
        .filter((node) => node.node_config.enabled_services.includes("indexer"))
        .map((node) => ({
          nodeId: node.node_config.node_id,
          ingestionRateBytePerSecond: 0,
        }));

      const searchers = nodes
        .filter((node) =>
          node.node_config.enabled_services.includes("searcher"),
        )
        .map((node) => ({
          nodeId: node.node_config.node_id,
          ingestionRateBytePerSecond: 0,
        }));

      const metastores = nodes
        .filter((node) =>
          node.node_config.enabled_services.includes("metastore"),
        )
        .map((node) => ({
          nodeId: node.node_config.node_id,
          ingestionRateBytePerSecond: 0,
        }));

      const controlPlanes = [];

      if (abortController.signal.aborted) return;

      setSnapshot({
        indexers,
        indexes: indexes
          .map(({ index, splits }) => ({
            name: index.index_config.index_id,
            splits: splits
              .map((split) => ({
                uncompressed_docs_size_in_bytes:
                  split.uncompressed_docs_size_in_bytes,
                compressed_docs_size_in_bytes: split.footer_offsets.end,
                node_id: split.node_id,
                split_id: split.split_id,
                time_range: split.time_range!,
                num_docs: split.num_docs,
                num_merge_ops: split.num_merge_ops,
              }))
              .sort((a, b) => a.time_range.start - b.time_range.start),
          }))
          .sort((a, b) => a.name.localeCompare(b.name)),
        searchers,
        metastores,
        controlPlanes,
      });

      setTimeout(loop, 5_000);
    };

    loop();

    return () => {
      abortController.abort("component unmounted");
    };
  }, []);

  return snapshot;
};

type DebugInfo = {
  [nodeId: string]: {
    buildInfo: unknown;
    control_plane?: unknown;
    node_config: {
      node_id: string;
      enabled_services: (
        | "indexer"
        | "metastore"
        | "janitor"
        | "control_plane"
        | "searcher"
      )[];
    };
  };
};

export default VeryCoolVizView;
