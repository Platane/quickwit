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

import React, { useEffect, useRef } from "react";
import { useGLTF, useAnimations } from "@react-three/drei";
import * as THREE from "three";
import { Point } from "./layout";
import { useFrame } from "@react-three/fiber";

type Task = (
  | { type: "move"; to: Point; endDate: number }
  | { type: "wait"; endDate: number }
) & { key: unknown } & { carry?: { type: "cube"; color: string } };

export const Indexer = ({
  tasks,
  initialPosition,
  ...props
}: {
  tasks: Task[];
  initialPosition: Point;
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF("/ui/Horse.glb");
  const clonedScene = React.useMemo(() => scene.clone(), [scene]);
  const { actions } = useAnimations(animations, groupRef);

  const [carry, setCarry] = React.useState();

  useEffect(() => {
    groupRef.current?.position.set(initialPosition.x, 0, initialPosition.y);
  }, []);

  // orientation is spring based
  const orientationSpringRef = React.useRef({ x: 0, v: 0 });

  useFrame(() => {
    const nextTask = tasks.find((task) => Date.now() < task.endDate) ?? {
      type: "wait",
      endDate: Infinity,
    };

    setCarry(nextTask.carry);

    const group = groupRef.current;
    if (!group) return;

    const runAnimation = Object.values(actions)[0];
    if (runAnimation) {
      runAnimation.setLoop(THREE.LoopRepeat, Infinity);
      runAnimation.timeScale = 2;
    }

    if (nextTask.type === "move") {
      const currentPos = group.position;
      const now = Date.now();

      const t = Math.max(0.01, nextTask.endDate - now);

      const vx = nextTask.to.x - currentPos.x;
      const vy = nextTask.to.y - currentPos.z;

      const l = Math.hypot(vx, vy);

      const speed = l / t;
      const dt = 1000 / 60;

      group.position.x = currentPos.x + (vx / l) * speed * dt;
      group.position.z = currentPos.z + (vy / l) * speed * dt;

      // Orient the model based on direction
      {
        const angle = Math.atan2(vy, vx);

        // Spring dynamics for smooth orientation
        const stiffness = 0.1;
        const damping = 0.5;

        const force =
          stiffness * (angle - orientationSpringRef.current.x) -
          damping * orientationSpringRef.current.v;
        orientationSpringRef.current.v += force;
        orientationSpringRef.current.x += orientationSpringRef.current.v;
        group.rotation.y = -orientationSpringRef.current.x + Math.PI / 2;
      }
      if (runAnimation && (!runAnimation.isRunning() || runAnimation.paused)) {
        runAnimation.play();
        runAnimation.timeScale = 2;
        runAnimation.paused = false;
      }
    }

    if (nextTask.type === "wait") {
      // Spring dynamics for smooth orientation
      const stiffness = 0.1;
      const damping = 0.5;

      const angle = Math.PI / 2;

      const force =
        stiffness * (angle - orientationSpringRef.current.x) -
        damping * orientationSpringRef.current.v;
      orientationSpringRef.current.v += force;
      orientationSpringRef.current.x += orientationSpringRef.current.v;
      group.rotation.y = -orientationSpringRef.current.x + Math.PI / 2;

      if (runAnimation && (!runAnimation.isRunning() || !runAnimation.paused)) {
        runAnimation.time = 1;
        runAnimation.play();
        runAnimation.paused = true;
        runAnimation.getMixer().update(0);
      }
    }
  });

  // useEffect(() => {
  //   const runAnimation = Object.values(actions)[0];
  //   if (runAnimation) {
  //     runAnimation.setLoop(THREE.LoopRepeat, Infinity);
  //     runAnimation.play();
  //     runAnimation.timeScale = 2;
  //   }
  // }, [actions, animations]);

  return (
    <group ref={groupRef} {...props}>
      <primitive object={clonedScene} scale={0.005} />

      {carry && (
        <mesh position={[0, 0.5, 0.4]} rotation={[Math.PI / 4, 0, Math.PI / 4]}>
          <boxGeometry args={[0.3, 0.3, 0.3]} />
          <meshStandardMaterial color={carry.color} />
        </mesh>
      )}
    </group>
  );
};
