export const FencedBox = ({ width, height }) => {
  const spheresPerUnit = 2; // configurable: spheres per unit length
  const sphereRadius = 0.06;

  const spheres = [];

  const halfWidth = width / 2;
  const halfHeight = height / 2;

  // Top edge (left to right)
  for (let x = -halfWidth; x <= halfWidth; x += 1 / spheresPerUnit) {
    spheres.push([x, 0, halfHeight]);
  }

  // Right edge (top to bottom)
  for (let y = halfHeight; y >= -halfHeight; y -= 1 / spheresPerUnit) {
    if (y !== halfHeight) {
      // avoid duplicate at corner
      spheres.push([halfWidth, 0, y]);
    }
  }

  // Bottom edge (right to left)
  for (let x = halfWidth; x >= -halfWidth; x -= 1 / spheresPerUnit) {
    if (x !== halfWidth) {
      // avoid duplicate at corner
      spheres.push([x, 0, -halfHeight]);
    }
  }

  // Left edge (bottom to top)
  for (let y = -halfHeight; y <= halfHeight; y += 1 / spheresPerUnit) {
    if (y !== -halfHeight && y !== halfHeight) {
      // avoid duplicate at corners
      spheres.push([-halfWidth, 0, y]);
    }
  }

  return (
    <>
      {spheres.map((position, index) => (
        <mesh key={index} position={position} castShadow>
          <sphereGeometry args={[sphereRadius, 16, 16]} />
          <meshStandardMaterial color="white" />
        </mesh>
      ))}
    </>
  );
};
