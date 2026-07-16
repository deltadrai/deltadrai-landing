/**
 * ViewModel for index.html.
 * Pure data/logic module: no window/document access (per docs/architecture.md).
 * Alpine bindings (x-data/x-for) glue this data to the View.
 */

// Node positions are authored as percentages (0-100) within a square mesh
// container, matching the reference network graphic (dense top-right,
// thinning out towards the bottom-left).
const MESH_NODES = [
  { x: 62, y: 4 },
  { x: 80, y: 2 },
  { x: 96, y: 10 },
  { x: 74, y: 20 },
  { x: 92, y: 28 },
  { x: 58, y: 32 },
  { x: 42, y: 18 },
  { x: 30, y: 8 },
  { x: 68, y: 46 },
  { x: 88, y: 50 },
  { x: 48, y: 52 },
  { x: 78, y: 68 },
  { x: 60, y: 70 },
  { x: 96, y: 72 },
  { x: 34, y: 62 },
  { x: 20, y: 40 },
  { x: 10, y: 22 },
];

const MESH_EDGES = [
  [0, 1], [1, 2], [0, 3], [1, 3], [2, 4], [3, 4],
  [0, 6], [6, 7], [0, 7], [3, 6], [3, 5], [5, 6],
  [4, 9], [5, 8], [3, 8], [8, 9], [5, 10], [6, 10],
  [8, 12], [9, 11], [8, 11], [11, 12], [9, 13], [11, 13],
  [10, 12], [10, 14], [12, 14], [10, 15], [14, 15],
  [6, 15], [15, 16], [7, 16],
];

// Duration of one full wave cycle; per-element delays below are staggered
// fractions of this so the wave appears to travel diagonally across the mesh.
const WAVE_DURATION_S = 4.5;

// Delay is proportional to distance along the diagonal (x + y), so elements
// near the top-left of the mesh animate first and the wave glides towards
// the bottom-right.
function waveDelay(x, y) {
  return `${(((x + y) / 200) * WAVE_DURATION_S).toFixed(2)}s`;
}

function edgeStyle(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);

  return {
    left: `${a.x}%`,
    top: `${a.y}%`,
    width: `${length}%`,
    transform: `rotate(${angle}deg)`,
    animationDelay: waveDelay((a.x + b.x) / 2, (a.y + b.y) / 2),
  };
}

export function indexViewModel() {
  return {
    nodes: MESH_NODES.map((node) => ({
      ...node,
      delay: waveDelay(node.x, node.y),
    })),
    edges: MESH_EDGES.map(([from, to]) => ({
      key: `${from}-${to}`,
      style: edgeStyle(MESH_NODES[from], MESH_NODES[to]),
    })),
  };
}
