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

import { Box } from "@mui/material";
import React from "react";
import { ViewUnderAppBarBox } from "../components/LayoutUtils";
import Loader from "../components/Loader";
import {
  Selection,
  Snapshot,
  VeryCoolViz,
} from "../components/VeryCoolViz/VeryCoolViz";
import { useSystemSnapshot } from "../services/useSystemSnapshotMock";

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
          <dt>Group: {selected.group}</dt>
          {selected.groupMetrics &&
            selected.groupMetrics.map((metric) => (
              <div key={metric.name}>
                <dd>
                  - {metric.name}: {metric.value}
                </dd>
              </div>
            ))}
        </dl>
      </>
    );

  return null;
};

export type DebugInfo = {
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
