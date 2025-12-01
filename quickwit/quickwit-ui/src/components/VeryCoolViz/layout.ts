/**
 * let be this function responsible for all elements positioning
 *
 * it will be easier for all elements to have world space coordinates (vs nested tree transfrom)
 * i think it will help for animations
 */
export const createLayout = ({
  nodeIndexerCount,
}: {
  nodeIndexerCount: number;
  nodeSearcherCount: number;
  indexCount: number;
}) => {
  const indexersPositions = createClusterLayout(nodeIndexerCount);
  const indexerBox = getBoundingBox(indexersPositions);

  return {
    indexers: indexersPositions,
    worldViewport: { x: -10, y: -10, width: 40, height: 40 },
  };
};

export type Point = { x: number; y: number };
export type Rect = { x: number; y: number; width: number; height: number };

export const getBoundingBox = (points: Point[]) => {
  const max = {
    x: Math.max(...points.map((p) => p.x)),
    y: Math.max(...points.map((p) => p.y)),
  };
  const min = {
    x: Math.min(...points.map((p) => p.x)),
    y: Math.min(...points.map((p) => p.y)),
  };
  return { max, min };
};

export const createClusterLayout = (n: number) => {
  const l = Math.ceil(Math.sqrt(n));
  return Array.from({ length: n }, (_, i) => {
    const y = Math.floor(i / l);
    const x = (i % l) + (y % 2 ? 0.5 : 0);
    return { x, y };
  });
};
