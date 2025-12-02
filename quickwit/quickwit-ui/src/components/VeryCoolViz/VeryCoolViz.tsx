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

import React, { ReactHTMLElement } from "react";
import * as styles from "./VeryCoolViz.module.css";
import { Box, createLayout, Point } from "./layout";

export type Selection =
  | { type: "node"; nodeId: string }
  | { type: "index"; indexName: string }
  | {
      type: "group";
      group: "indexers" | "searchers" | "metastores" | "objectStorage";
      groupMetrics: {
        name: string;
        value: number;
      }[];
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
  metrics: Record<string, number>;
};
export type Props = {
  selected: Selection;
  snapshot: Snapshot;
  timeRange: { start: number; end: number };

  onSelect: (s: Selection) => void;
};
type Bucket = {
  le: number;
  count: number;
};
export const VeryCoolViz = ({
  selected,
  snapshot,
  timeRange,

  onSelect,
}: Props) => {
  //
  // todo
  // detect things to animate by comparing the previous snapshot with the current one
  const previousSnapshot = usePrevious(snapshot);

  const previousSpitIds = React.useMemo(
    () =>
      new Set(
        previousSnapshot.indexes
          .flatMap((i) => i.splits)
          .map((s) => s.split_id),
      ),
    [previousSnapshot],
  );

  console.log(
    "new splits:",
    snapshot.indexes.flatMap((i) =>
      i.splits.filter((s) => !previousSpitIds.has(s.split_id)),
    ),
  );

  const svgRef = React.useRef<SVGSVGElement>(null);
  const [zoom, setZoom] = React.useState(1);
  const [pan, setPan] = React.useState({ x: 0, y: 0 });
  const isDraggingRef = React.useRef(false);
  const positionRef = React.useRef({ x: 0, y: 0 });
  const dragDistanceRef = React.useRef(0);

  const layout = createLayout({
    nodeIndexerCount: snapshot.indexers.length,
    indexCount: snapshot.indexes.length,
    nodeSearcherCount: snapshot.searchers.length,
    nodeMetastoreCount: snapshot.metastores.length,
    nodeControlPlaneCount: snapshot.controlPlanes.length,
  });

  const baseViewport = layout.worldViewport;

  const handleMouseDown = (event: React.MouseEvent) => {
    isDraggingRef.current = true;
    positionRef.current = { x: event.clientX, y: event.clientY };
    dragDistanceRef.current = 0;
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  const handleMouseMove = (event: React.MouseEvent) => {
    if (!isDraggingRef.current || !svgRef.current) return;

    const deltaX = event.clientX - positionRef.current.x;
    const deltaY = event.clientY - positionRef.current.y;

    dragDistanceRef.current += Math.abs(deltaX) + Math.abs(deltaY);

    const worldDeltaX =
      (deltaX * (baseViewport.width / zoom)) / svgRef.current.clientWidth;
    const worldDeltaY =
      (deltaY * (baseViewport.height / zoom)) / svgRef.current.clientHeight;

    setPan((prevPan) => ({
      x: prevPan.x - worldDeltaX,
      y: prevPan.y - worldDeltaY,
    }));

    positionRef.current = { x: event.clientX, y: event.clientY };
  };

  const handleWheel = (event: React.WheelEvent) => {
    event.preventDefault();
    const zoomDelta = 1 + event.deltaY * -0.001;
    const newZoom = zoom * zoomDelta;

    const clampedZoom = Math.min(Math.max(newZoom, 0.5), 5);
    setZoom(clampedZoom);
  };

  const zoomedWidth = baseViewport.width / zoom;
  const zoomedHeight = baseViewport.height / zoom;

  const viewBox = [
    baseViewport.x + pan.x + (baseViewport.width - zoomedWidth) / 2,
    baseViewport.y + pan.y + (baseViewport.height - zoomedHeight) / 2,
    zoomedWidth,
    zoomedHeight,
  ].join(" ");

  const handleClick = () => {
    // Prevent onClick if user was dragging
    if (dragDistanceRef.current > 5) return;
    onSelect(null);
  };

  const searchBuckets = parseBuckets(
    snapshot.metrics,
    "quickwit_search_root_search_request_duration_seconds",
  );

  return (
    <svg
      ref={svgRef}
      className={styles.viz}
      style={{ cursor: isDraggingRef.current ? "grabbing" : "grab" }}
      viewBox={viewBox}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
    >
      <title>very cool viz</title>

      <g
        onClick={(e) => {
          e.stopPropagation();
          onSelect({
            type: "group",
            group: "indexers",
            groupMetrics: [
              {
                name: "In Flight Requests",
                value:
                  snapshot.metrics[
                    'quickwit_indexing_grpc_requests_in_flight{kind="client",rpc="apply_indexing_plan"}'
                  ] || 0,
              },
              {
                name: "Total Requests (success)",
                value:
                  snapshot.metrics[
                    'quickwit_indexing_grpc_requests_total{kind="client",rpc="apply_indexing_plan",status="success"}'
                  ] || 0,
              },
              {
                name: "Total Requests (error)",
                value:
                  snapshot.metrics[
                    'quickwit_indexing_grpc_requests_total{kind="client",rpc="apply_indexing_plan",status="error"}'
                  ] || 0,
              },
            ],
          });
        }}
      >
        <rect {...layout.indexersBox} rx={0.3} fill="purple" />
        <text x={layout.indexersBox.x + 0.23} y={layout.indexersBox.y - 0.1}>
          Indexers Nodes{" ("}
          {
            snapshot.metrics[
              'quickwit_indexing_grpc_requests_in_flight{kind="client",rpc="apply_indexing_plan"}'
            ]
          }
          {" requests in flight)"}
        </text>
      </g>

      <g
        onClick={(e) => {
          e.stopPropagation();
          onSelect({
            type: "group",
            group: "searchers",
            groupMetrics: [
              {
                name: "Total Requests (success)",
                value:
                  snapshot.metrics[
                    'quickwit_search_root_search_requests_total{kind="server",status="success"}'
                  ] || 0,
              },
              {
                name: "P50 Search Latency (ms)",
                value: calculateLatency(searchBuckets, 0.5),
              },
              {
                name: "P90 Search Latency (ms)",
                value: calculateLatency(searchBuckets, 0.9),
              },
              {
                name: "P99 Search Latency (ms)",
                value: calculateLatency(searchBuckets, 0.99),
              },
            ],
          });
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
          onSelect({
            type: "group",
            group: "metastores",
            groupMetrics: [],
          });
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
              onSelect({
                type: "node",
                nodeId: node.nodeId,
              });
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

      {snapshot.indexes.map((index, i) =>
        index.splits.map((split) => {
          const container = layout.indexesPositions[i]!;

          const hash = hashToInt(split.node_id);
          const h2 = (((hash % 100) + 100) % 100) / 100;

          const x = container.x + 0.1 + (container.width - 0.2) * 0.6 * h2;
          const y =
            container.y +
            0.1 +
            ((timeRange.end - split.time_range.end) /
              (timeRange.end - timeRange.start)) *
              container.height;

          const width = (container.width - 0.2) * 0.4;
          // const height = 0.1;
          const height =
            ((split.time_range.end - split.time_range.start) /
              (timeRange.end - timeRange.start)) *
            container.height;

          const justCreated =
            !previousSpitIds.has(split.node_id) && split.num_merge_ops === 0;

          const indexerIndex = snapshot.indexers.findIndex(
            (node) => node.nodeId === split.node_id,
          );

          const source =
            justCreated && layout.indexersPositions[indexerIndex]
              ? {
                  x: layout.indexersPositions[indexerIndex].x,
                  y: layout.indexersPositions[indexerIndex].y,
                }
              : undefined;

          return (
            <Split
              key={split.split_id}
              split={split}
              position={{ x, y, width, height }}
              source={source}
            />
          );
        }),
      )}

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

const Split = ({
  split,
  position,
  source,
}: {
  split: Snapshot["indexes"][number]["splits"][number];
  position: Box;
  source?: Point;
}) => {
  const hash = hashToInt(split.node_id);
  const h1 = (((hash % 15) + 15) % 15) / 15;

  const color = `hsl(220deg  50%  ${20 + h1 * 60}%)`;

  const animate = React.useCallback(
    (el: SVGRectElement) => {
      if (!source || !el) return;

      const tx = source.x - position.x;
      const ty = source.y - position.y;
      el.animate(
        [
          //
          { offset: 0, transform: `translate(${tx}px,${ty}px)` },
          { offset: 1, transform: `translate(0,0)` },
        ],
        { duration: 800 },
      );
    },
    [source?.x, source?.y],
  );

  return (
    <rect
      x={position.x}
      y={position.y}
      width={position.width}
      height={position.height}
      fill={color}
      ref={animate}
    />
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

const hashToInt = (x: string) =>
  x.split("").reduce((hash, s) => {
    const char = s.charCodeAt(0);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
    return hash;
  }, 23912095);

const parseBuckets = (
  metrics: Record<string, number>,
  metricPrefix: string,
): Bucket[] => {
  const bucketPattern = new RegExp(
    `${metricPrefix}_bucket\\{.*le="([^"]+)"\\}`,
  );
  const buckets: Bucket[] = [];

  for (const [key, value] of Object.entries(metrics)) {
    if (!key.includes(`${metricPrefix}_bucket`)) {
      continue;
    }

    const match = key.match(bucketPattern);
    if (match) {
      const leStr = match[1];
      if (leStr === "+Inf") {
        continue;
      }
      const le = parseFloat(leStr ?? "");
      const count = value;

      buckets.push({ le, count });
    }
  }

  return buckets.sort((a, b) => a.le - b.le);
};

const calculateLatency = (buckets: Bucket[], percentile: number): number => {
  if (buckets.length === 0) return 0;
  if (buckets.length === 1) return buckets[0]!.le * 1000;
  // Get total count from the last bucket (cumulative count)
  const totalCount = buckets[buckets.length - 1]!.count;

  if (totalCount === 0) return 0;

  const rank = percentile * totalCount;

  // Find bucket where cumulative count crosses the rank
  for (let i = 0; i < buckets.length; i++) {
    if (buckets[i]!.count >= rank) {
      const prevCount = i > 0 ? buckets[i - 1]!.count : 0;
      const prevLe = i > 0 ? buckets[i - 1]!.le : 0;

      // Avoid division by zero
      if (buckets[i]!.count === prevCount) {
        return buckets[i]!.le;
      }

      // Linear interpolation within bucket
      const fraction = (rank - prevCount) / (buckets[i]!.count - prevCount);
      const latencySeconds = prevLe + fraction * (buckets[i]!.le - prevLe);

      // Convert to milliseconds
      return latencySeconds * 1000;
    }
  }

  // Fallback: return last bucket boundary in milliseconds
  return buckets[buckets.length - 1]!.le * 1000;
};
