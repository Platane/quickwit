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
import * as styles from "./VeryCoolViz.module.css";
import { createLayout, Point } from "./layout";

export type Selection =
  | { type: "node"; nodeId: string }
  | { type: "group" }
  | null;
export type Snapshot = {
  indexers: { nodeId: string; ingestionRateBytePerSecond: number }[];
  indexes: {
    name: string;
    splits: { creator_nodeId: string; startDate: number; endDate: number }[];
  }[];
  searchers: {
    nodeId: string;
    searchRateBytePerSecond: number;
  }[];
  metastores: {
    nodeId: string;
  }[];
  controlPlanes: {
    nodeId: string;
  }[];
};
export type Props = {
  selected: Selection;
  onSelect: (s: Selection) => void;
  snapshot: Snapshot;
};
export const VeryCoolViz = ({ selected, snapshot, onSelect }: Props) => {
  //
  // todo
  // detect things to animate by comparing the previous snapshot with the current one

  //
  // todo
  // camera panning, via viewBox prop

  const layout = createLayout({
    nodeIndexerCount: snapshot.indexers.length,
    indexCount: 2,
    nodeSearcherCount: snapshot.searchers.length,
    nodeMetastoreCount: snapshot.metastores.length,
    nodeControlPlaneCount: snapshot.controlPlanes.length,
  });

  return (
    <svg
      className={styles.viz}
      style={{ width: "100%", height: "100%" }}
      viewBox={[
        layout.worldViewport.x,
        layout.worldViewport.y,
        layout.worldViewport.width,
        layout.worldViewport.height,
      ].join(" ")}
      onClick={() => onSelect(null)}
    >
      <title>very cool viz</title>

      {snapshot.indexers.map((indexer, i) => (
        <g key={indexer.nodeId} transform={transform(layout.indexers[i]!)}>
          <title>{indexer.nodeId}</title>
          <circle
            r={0.4}
            data-node
            data-indexer
            data-selected={
              selected?.type === "node" && selected.nodeId === indexer.nodeId
            }
            onClick={(e) => {
              e.stopPropagation();
              onSelect({ type: "node", nodeId: indexer.nodeId });
            }}
          />
        </g>
      ))}

      {snapshot.searchers.map((searcher, i) => (
        <g key={searcher.nodeId} transform={transform(layout.searchers[i]!)}>
          <title>{searcher.nodeId}</title>
          <circle
            r={0.4}
            data-node
            data-searcher
            data-selected={
              selected?.type === "node" && selected.nodeId === searcher.nodeId
            }
            onClick={(e) => {
              e.stopPropagation();
              onSelect({ type: "node", nodeId: searcher.nodeId });
            }}
          />
        </g>
      ))}

      {snapshot.metastores.map((metastore, i) => (
        <g key={metastore.nodeId} transform={transform(layout.metastores[i]!)}>
          <title>{metastore.nodeId}</title>
          <circle
            r={0.4}
            data-node
            data-metastore
            data-selected={
              selected?.type === "node" && selected.nodeId === metastore.nodeId
            }
            onClick={(e) => {
              e.stopPropagation();
              onSelect({ type: "node", nodeId: metastore.nodeId });
            }}
          />
        </g>
      ))}

      {snapshot.controlPlanes.map((controlPlane, i) => (
        <g
          key={controlPlane.nodeId}
          transform={transform(layout.controlPlanes[i]!)}
        >
          <title>{controlPlane.nodeId}</title>
          <circle
            r={0.4}
            data-node
            data-control-plane
            data-selected={
              selected?.type === "node" &&
              selected.nodeId === controlPlane.nodeId
            }
            onClick={(e) => {
              e.stopPropagation();
              onSelect({ type: "node", nodeId: controlPlane.nodeId });
            }}
          />
        </g>
      ))}
    </svg>
  );
};

const transform = ({ x, y }: Point) => `translate(${x},${y})`;
