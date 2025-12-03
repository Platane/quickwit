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
import { Box, createLayout, getSplitsLayout, Point } from "./layout";
import * as styles from "./VeryCoolViz.module.css";
import { Canvas, useFrame } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";
import { FencedBox } from "./FencedBox";
import { Indexer } from "./Indexer";

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

  const layout = createLayout({
    nodeIndexerCount: snapshot.indexers.length,
    indexCount: snapshot.indexes.length,
    nodeSearcherCount: snapshot.searchers.length,
    nodeMetastoreCount: snapshot.metastores.length,
    nodeControlPlaneCount: snapshot.controlPlanes.length,
  });
  const splitTrackMemoRef = React.useRef({});
  const splitPositions = getSplitsLayout(
    layout.indexesPositions[0],
    timeRange,
    snapshot.indexes[0]!.splits.filter((s) => s.split_state === "Published"),
    splitTrackMemoRef.current,
  );

  const maxDocMemoRef = React.useRef(0);
  maxDocMemoRef.current = Math.max(
    maxDocMemoRef.current,
    ...snapshot.indexes[0]!.splits.map((s) => s.num_docs),
  );

  const splitHiddenRef = React.useRef({});

  const tasksRef = React.useRef({});
  React.useMemo(() => {
    const newSplits = snapshot.indexes
      .flatMap((index) => index.splits)
      .filter((s) => !previousSpitIds.has(s.split_id));

    for (const split of newSplits) {
      const nodeId = split.node_id;
      const tasks = (tasksRef.current[nodeId] = tasksRef.current[nodeId] || []);

      while (tasks.at(-1)?.type === "move") tasks.pop();

      const travelTime = 1200;
      const deposeTime = 300;

      const carry = { color: getSplitColor(split.split_id) };

      splitHiddenRef.current[split.split_id] = {
        endDate: Date.now() + travelTime + deposeTime / 2,
      };

      tasks.push(
        {
          type: "move",
          to: {
            x: splitPositions[split.split_id].x,
            y: splitPositions[split.split_id].y - 0.1,
          },
          endDate: Date.now() + travelTime,
          carry,
        },
        {
          type: "wait",
          endDate: Date.now() + travelTime + deposeTime / 2,
          carry,
        },
        {
          type: "wait",
          endDate: Date.now() + travelTime + deposeTime,
        },
        {
          type: "move",
          to: layout.indexersPositions[
            snapshot.indexers.findIndex((i) => i.nodeId === nodeId)
          ],
          endDate: Date.now() + travelTime + deposeTime + travelTime * 1.2,
        },
      );
    }
  }, [snapshot, previousSnapshot]);

  return (
    <Canvas shadows camera={{ position: [1, 10, 8], fov: 80 }}>
      <OrbitControls />
      <ambientLight intensity={0.3} />
      <directionalLight
        position={[10, 10, 5]}
        intensity={1}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={50}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
      />

      {/*<mesh castShadow position={[0, 0.5, 0]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="orange" />
      </mesh>*/}

      <mesh
        name="ground"
        receiveShadow
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
      >
        <planeGeometry args={[500, 500]} />
        <meshStandardMaterial color="#4a7c3b" />
      </mesh>

      {/*<group name="indexers pillar">
        {snapshot.indexers.map((indexer, i) => {
          const pos = layout.indexersPositions[i];
          return (
            <group key={indexer.nodeId} position={[pos.x, 0, pos.y]}>
              <mesh castShadow receiveShadow position={[0, 0.05, 0]}>
                <cylinderGeometry args={[0.3, 0.3, 0.1, 16]} />
                <meshStandardMaterial color="#3b82f6" />
              </mesh>
            </group>
          );
        })}
      </group>*/}

      <group name="splits">
        {snapshot.indexes[0]?.splits.map((split) => {
          const pos = splitPositions[split.split_id];
          if (!pos) return null;

          const area = pos.width * pos.height;
          const volume = split.num_docs / maxDocMemoRef.current;

          const h = (volume / area) * 0.1 + 0.1;

          const color = getSplitColor(split.split_id);

          return (
            <group
              key={split.split_id}
              position={[pos.x + pos.width / 2, 0, pos.y + pos.height / 2]}
              onPointerEnter={() =>
                onSelect({ type: "split", nodeId: split.split_id })
              }
              onPointerLeave={() => onSelect(null)}
              visible={
                Date.now() >
                (splitHiddenRef.current[split.split_id]?.endDate ?? 0)
              }
            >
              <mesh castShadow receiveShadow position={[0, h / 2, 0]}>
                <boxGeometry args={[pos.width, h, pos.height]} />
                <meshStandardMaterial color={color} />
              </mesh>

              {selected?.type === "split" &&
                selected.nodeId === split.split_id && (
                  <Html center>
                    <div
                      style={{
                        backgroundColor: "white",
                        padding: "6px",
                      }}
                    >
                      <dl>
                        <dt>Split Id</dt>
                        <dd>{split.split_id}</dd>
                        <dt>Num docs</dt>
                        <dd>{split.num_docs}</dd>
                      </dl>
                    </div>
                  </Html>
                )}
            </group>
          );
        })}
      </group>

      <group
        position={[
          layout.indexersBox.width / 2 + layout.indexersBox.x,
          0,
          layout.indexersBox.height / 2 + layout.indexersBox.y,
        ]}
      >
        <FencedBox
          width={layout.indexersBox.width}
          height={layout.indexersBox.height}
        />
      </group>

      <group
        position={[
          layout.indexesBox.width / 2 + layout.indexesBox.x,
          0,
          layout.indexesBox.height / 2 + layout.indexesBox.y,
        ]}
      >
        <FencedBox
          width={layout.indexesBox.width}
          height={layout.indexesBox.height}
        />
      </group>

      {snapshot.indexers.map((i) => (
        <Indexer
          initialPosition={
            layout.indexersPositions[
              snapshot.indexers.findIndex((j) => i.nodeId === j.nodeId)
            ]
          }
          key={i.nodeId}
          tasks={tasksRef.current[i.nodeId] ?? []}
        />
      ))}
    </Canvas>
  );
};

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

const getSplitColor = (splitId: string) => {
  const hash = hashToInt(splitId);
  const hue = ((hash % 360) + 360) % 360;
  return `hsl(${hue}, 70%, 60%)`;
};
