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
  | { type: "index"; indexName: string }
  | {
      type: "group";
      group: "indexers" | "searchers" | "metastores" | "objectStorage";
    }
  | null;
export type Snapshot = {
  indexers: { nodeId: string; ingestionRateBytePerSecond: number }[];
  indexes: {
    name: string;
    splits: {
      split_id: string;
      node_id: string;
      time_range: { start: number; end: number };
      uncompressed_docs_size_in_bytes: number;
      compressed_docs_size_in_bytes: number;
      num_docs: number;
      num_merge_ops: number;
    }[];
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
  const previousSnapshot = usePrevious(snapshot);

  const prev = new Set(
    previousSnapshot.indexes.flatMap((i) => i.splits).map((s) => s.split_id),
  );
  console.log(
    "new split",
    ...snapshot.indexes.flatMap((i) =>
      i.splits.filter((s) => !prev.has(s.split_id)),
    ),
  );

  //
  // todo
  // camera panning, via viewBox prop

  const layout = createLayout({
    nodeIndexerCount: snapshot.indexers.length,
    indexCount: snapshot.indexes.length,
    nodeSearcherCount: snapshot.searchers.length,
    nodeMetastoreCount: snapshot.metastores.length,
    nodeControlPlaneCount: snapshot.controlPlanes.length,
  });

  const viewBox = [
    layout.worldViewport.x,
    layout.worldViewport.y,
    layout.worldViewport.width,
    layout.worldViewport.height,
  ].join(" ");

  return (
    <svg
      className={styles.viz}
      viewBox={viewBox}
      onClick={() => onSelect(null)}
    >
      <title>very cool viz</title>

      <g
        onClick={(e) => {
          e.stopPropagation();
          onSelect({ type: "group", group: "indexers" });
        }}
      >
        <rect {...layout.indexersBox} rx={0.3} fill="purple" />
        <text x={layout.indexersBox.x + 0.23} y={layout.indexersBox.y - 0.1}>
          Indexers Nodes
        </text>
      </g>

      <g
        onClick={(e) => {
          e.stopPropagation();
          onSelect({ type: "group", group: "searchers" });
        }}
      >
        <rect {...layout.searchersBox} rx={0.3} fill="purple" />
        <text x={layout.searchersBox.x + 0.23} y={layout.searchersBox.y - 0.1}>
          Searcher Nodes
        </text>
      </g>

      <g
        onClick={(e) => {
          e.stopPropagation();
          onSelect({ type: "group", group: "metastores" });
        }}
      >
        <rect {...layout.metastoresBox} rx={0.3} fill="purple" />
        <text
          x={layout.metastoresBox.x + 0.23}
          y={layout.metastoresBox.y - 0.1}
        >
          Metastore Nodes
        </text>
      </g>

      <rect {...layout.indexesBox} rx={0.3} fill="blue" />
      <text x={layout.indexesBox.x + 0.23} y={layout.indexesBox.y - 0.1}>
        Blob Storage
      </text>

      {snapshot.indexes.map((index, i) => (
        <g key={index.name} transform={transform(layout.indexesPositions[i]!)}>
          <rect
            width={layout.indexesPositions[i]!.width}
            height={layout.indexesPositions[i]!.height}
            data-index
            fill="beige"
            onClick={(e) => {
              e.stopPropagation();
              onSelect({ type: "index", indexName: index.name });
            }}
          />
          <text
            y={0.2}
            x={0.05}
            textLength={layout.indexesPositions[i]!.width - 0.1}
          >
            {index.name}
          </text>
        </g>
      ))}

      {snapshot.indexers.map((node, i) => (
        <g
          key={node.nodeId}
          transform={transform(layout.indexersPositions[i]!)}
        >
          <title>{node.nodeId}</title>
          <circle
            r={0.4}
            data-node
            data-indexer
            data-selected={
              selected?.type === "node" && selected.nodeId === node.nodeId
            }
            onClick={(e) => {
              e.stopPropagation();
              onSelect({ type: "node", nodeId: node.nodeId });
            }}
          />
        </g>
      ))}

      {snapshot.searchers.map((node, i) => (
        <g
          key={node.nodeId}
          transform={transform(layout.searchersPositions[i]!)}
        >
          <title>{node.nodeId}</title>
          <circle
            r={0.4}
            data-node
            data-searcher
            data-selected={
              selected?.type === "node" && selected.nodeId === node.nodeId
            }
            onClick={(e) => {
              e.stopPropagation();
              onSelect({ type: "node", nodeId: node.nodeId });
            }}
          />
        </g>
      ))}

      {snapshot.metastores.map((node, i) => (
        <g
          key={node.nodeId}
          transform={transform(layout.metastoresPositions[i]!)}
        >
          <title>{node.nodeId}</title>
          <circle
            r={0.4}
            data-node
            data-metastore
            data-selected={
              selected?.type === "node" && selected.nodeId === node.nodeId
            }
            onClick={(e) => {
              e.stopPropagation();
              onSelect({ type: "node", nodeId: node.nodeId });
            }}
          />
        </g>
      ))}

      {/*

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
      ))}*/}
    </svg>
  );
};

const transform = ({ x, y }: Point) => `translate(${x},${y})`;

const usePrevious = <V,>(value: V) => {
  const ref = React.useRef({ previous: value, current: value });
  if (ref.current.current !== value) {
    ref.current.previous = ref.current.current;
    ref.current.current = value;
  }
  return ref.current.previous;
};
