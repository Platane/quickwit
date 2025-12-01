import { get } from "cypress/types/jquery";

/**
 * let be this function responsible for all elements positioning
 *
 * it will be easier for all elements to have world space coordinates (vs nested tree transfrom)
 * i think it will help for animations
 */
export const createLayout = ({
  nodeIndexerCount,
  nodeSearcherCount,
  nodeMetastoreCount,
  nodeControlPlaneCount,
  indexCount,
}: {
  nodeIndexerCount: number;
  nodeSearcherCount: number;
  nodeMetastoreCount: number;
  nodeControlPlaneCount: number;
  indexCount: number;
}) => {
  const spacing = 8; // spacing between clusters
  const padding = 2;
  const indexersLayout = createClusterLayout(nodeIndexerCount);
  const searchersLayout = createClusterLayout(nodeSearcherCount);
  const metastoresLayout = createClusterLayout(nodeMetastoreCount);
  const controlPlanesLayout = createClusterLayout(nodeControlPlaneCount);

  const indexerBox = getBoundingBox(indexersLayout);
  const searcherBox = getBoundingBox(searchersLayout);
  const metastoreBox = getBoundingBox(metastoresLayout);
  const controlPlaneBox = getBoundingBox(controlPlanesLayout);

  const indexerWidth = indexerBox.max.x - indexerBox.min.x;
  const indexerHeight = indexerBox.max.y - indexerBox.min.y;
  const searcherWidth = searcherBox.max.x - searcherBox.min.x;
  const searcherHeight = searcherBox.max.y - searcherBox.min.y;
  const metastoreWidth = metastoreBox.max.x - metastoreBox.min.x;
  const metastoreHeight = metastoreBox.max.y - metastoreBox.min.y;
  const controlPlaneWidth = controlPlaneBox.max.x - controlPlaneBox.min.x;
  const controlPlaneHeight = controlPlaneBox.max.y - controlPlaneBox.min.y;

  const indexersPositions = indexersLayout.map((pos) => ({
    x: pos.x - indexerBox.min.x - indexerWidth / 2 - spacing / 2,
    y: pos.y,
  }));

  const searchersPositions = searchersLayout.map((pos) => ({
    x: pos.x - searcherBox.min.x + searcherWidth / 2 + spacing / 2,
    y: pos.y,
  }));

  const controlPlanePositions = controlPlanesLayout.map((pos) => ({
    x: pos.x - controlPlaneBox.min.x - controlPlaneWidth / 2 - spacing / 8,
    y: pos.y - controlPlaneBox.min.y - controlPlaneHeight / 2 - spacing / 2,
  }));

  const metastoresPositions = metastoresLayout.map((pos) => ({
    x: pos.x - metastoreBox.min.x + metastoreWidth / 2 + spacing / 8,
    y: pos.y - metastoreBox.min.y - metastoreHeight / 2 - spacing / 2,
  }));

  const positions = [
    ...indexersPositions,
    ...searchersPositions,
    ...metastoresPositions,
    ...controlPlanePositions,
  ];
  const viewportBox = getBoundingBox(positions);

  return {
    indexers: indexersPositions,
    searchers: searchersPositions,
    metastores: metastoresPositions,
    controlPlanes: controlPlanePositions,
    worldViewport: {
      x: viewportBox.min.x - padding,
      y: viewportBox.min.y - padding,
      width: viewportBox.max.x - viewportBox.min.x + padding * 2,
      height: viewportBox.max.y - viewportBox.min.y + padding * 2,
    },
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
