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
  //
  // position the indexes
  const INDEX_WIDTH = 4;
  const INDEX_GAP = 0.3;
  const indexesPositions = Array.from({ length: indexCount }, (_, i) => {
    const x = i * INDEX_WIDTH + i * INDEX_GAP;
    const y = 0;
    const width = INDEX_WIDTH;
    const height = 8;
    return { x, y, width, height };
  });

  const indexesBox = enlargeBox(
    getBoundingBoxFromBoxes(indexesPositions),
    INDEX_GAP * 2,
  );
  indexesBox.width += 1.3;
  indexesBox.x -= 1;

  //
  // positions the indexers
  const indexersPositions = createClusterLayout(nodeIndexerCount);
  const indexersBox = enlargeBox(
    getBoundingBoxFromPoints(indexersPositions),
    1.2,
  );
  {
    const tx = -indexersBox.x + indexesBox.x - indexersBox.width - 3;
    const ty = 1;
    [...indexersPositions, indexersBox].forEach((p) => {
      p.x += tx;
      p.y += ty;
    });
  }

  //
  // positions the searchers
  const searchersPositions = createClusterLayout(nodeSearcherCount);
  const searchersBox = enlargeBox(
    getBoundingBoxFromPoints(searchersPositions),
    1.2,
  );
  {
    const tx = indexesBox.x + indexesBox.width - searchersBox.x + 3;
    const ty = 2;
    [...searchersPositions, searchersBox].forEach((p) => {
      p.x += tx;
      p.y += ty;
    });
  }

  //
  // positions the metastores
  const metastoresPositions = createClusterLayout(nodeSearcherCount);
  const metastoresBox = enlargeBox(
    getBoundingBoxFromPoints(metastoresPositions),
    1.2,
  );
  {
    const tx = -metastoresBox.x + indexesBox.x - metastoresBox.width - 2;
    const ty = indexersBox.y - metastoresBox.y + indexersBox.height + 2;
    [...metastoresPositions, metastoresBox].forEach((p) => {
      p.x += tx;
      p.y += ty;
    });
  }

  const spacing = 8; // spacing between clusters
  const padding = 2;
  const controlPlanesPositions = createClusterLayout(nodeControlPlaneCount);

  const positions = [
    { x: 0, y: 0 },
    ...indexersPositions,
    ...searchersPositions,
    ...metastoresPositions,
    ...controlPlanesPositions,
  ];
  const viewportBox = getBoundingBoxFromBoxes([
    getBoundingBoxFromPoints(positions),
    indexesBox,
  ]);

  return {
    indexersPositions,
    indexersBox,

    searchersPositions,
    searchersBox,

    indexesPositions,
    indexesBox,

    metastoresPositions,
    metastoresBox,

    controlPlanesPositions,

    worldViewport: {
      x: viewportBox.x - padding,
      y: viewportBox.y - padding,
      width: viewportBox.width + padding * 2,
      height: viewportBox.height + padding * 2,
    },
  };
};

export type Point = { x: number; y: number };
export type Box = { x: number; y: number; width: number; height: number };

export const getBoundingBoxFromPoints = (points: Point[]): Box => {
  const max = {
    x: Math.max(...points.map((p) => p.x)),
    y: Math.max(...points.map((p) => p.y)),
  };
  const min = {
    x: Math.min(...points.map((p) => p.x)),
    y: Math.min(...points.map((p) => p.y)),
  };
  return { ...min, width: max.x - min.x, height: max.y - min.y };
};
export const getBoundingBoxFromBoxes = (boxes: Box[]): Box =>
  getBoundingBoxFromPoints(
    boxes.flatMap((box) => [
      box,
      { x: box.x + box.width, y: box.y + box.height },
    ]),
  );
export const enlargeBox = (box: Box, margin: number): Box => ({
  x: box.x - margin,
  y: box.y - margin,
  width: box.width + margin * 2,
  height: box.height + margin * 2,
});

export const createClusterLayout = (n: number) => {
  const l = Math.ceil(Math.sqrt(n));
  return Array.from({ length: n }, (_, i) => {
    const y = Math.floor(i / l);
    const x = (i % l) + (y % 2 ? 0.5 : 0);
    return { x, y };
  });
};
