// @ts-check
// src/js/models/wave-field.js
/**
 * @typedef {{ x: number, y: number, alpha: number, v: number }} WavePoint
 */

/**
 * Pure geometry/animation rules for the wireframe wave mesh. No knowledge of the
 * canvas, the window or any rendering concern.
 *
 * The viewport size is pushed in via `setViewport`, the animation is stepped by
 * `advance(timeSeconds)`, and the resulting projected grid is exposed as `points`
 * for a renderer to consume.
 *
 * @param {object} [options]
 * @param {number} [options.colSpacing] target CSS-px distance between adjacent columns
 * @param {number} [options.rowSpacing] target CSS-px distance between adjacent rows
 * @param {number} [options.minCols] lower bound on grid resolution (very narrow viewports)
 * @param {number} [options.minRows] lower bound on grid resolution (very short viewports)
 * @param {number} [options.maxCols] upper bound on grid resolution (perf cap on huge viewports)
 * @param {number} [options.maxRows] upper bound on grid resolution (perf cap on huge viewports)
 */
export function createWaveFieldModel({
  colSpacing = 50,
  rowSpacing = 37,
  minCols = 10,
  minRows = 8,
  maxCols = 90,
  maxRows = 60,
} = {}) {
  let width = 0;
  let height = 0;
  let cols = minCols;
  let rows = minRows;
  /**
   * Latest projected grid: rows+1 arrays of cols+1 points. Populated by `advance`.
   * @type {WavePoint[][]}
   */
  let points = [];

  const clamp = (
    /** @type {number} */ value,
    /** @type {number} */ min,
    /** @type {number} */ max,
  ) => Math.min(max, Math.max(min, value));

  /**
   * Pure preview of the grid resolution `setViewport` would derive for a given
   * viewport, without mutating any state. Lets a caller detect an upcoming
   * grid-resolution change — a column/row count change re-keys every node, which
   * is a discontinuous jump rather than a smooth reflow — before committing to it.
   * @param {number} w
   * @param {number} h
   */
  function gridFor(w, h) {
    // Mirrors the overscan factors used in `project` (1.28x width, and height
    // minus the 0.12h horizon down to the 1.15h far edge) so the derived grid
    // resolution matches what's actually drawn.
    const horizontalExtent = w * 1.28;
    const depthExtent = h * 1.03;

    return {
      cols: clamp(Math.round(horizontalExtent / colSpacing), minCols, maxCols),
      rows: clamp(Math.round(depthExtent / rowSpacing), minRows, maxRows),
    };
  }

  /**
   * Push the current viewport dimensions in (called on init and resize), and
   * re-derive the grid resolution from it so that adjacent nodes stay the same
   * CSS-px distance apart regardless of viewport size, aspect ratio or DPI — a
   * fixed column/row count would otherwise squash into thin strips on narrow
   * viewports (e.g. mobile portrait). DPI itself needs no handling here:
   * everything downstream stays in CSS pixels.
   * @param {number} w
   * @param {number} h
   */
  function setViewport(w, h) {
    width = w;
    height = h;
    const grid = gridFor(w, h);
    cols = grid.cols;
    rows = grid.rows;
  }

  /**
   * Deterministic pseudo-random jitter per grid node (stable across frames so the
   * mesh doesn't flicker), used to break up the otherwise perfectly even spacing.
   * @param {number} i column index
   * @param {number} j row index
   */
  function jitter(i, j) {
    const seed = Math.sin(i * 12.9898 + j * 78.233) * 43758.5453;
    return seed - Math.floor(seed);
  }

  /**
   * Project a grid coordinate onto the screen, applying a fake perspective (far
   * rows converge high and narrow, near rows spread wide and low) plus a
   * travelling-wave vertical displacement.
   * @param {number} u  0..1 across the grid (left→right)
   * @param {number} v  0..1 depth of the grid (0 = far/top, 1 = near/bottom)
   * @param {number} t  time in seconds
   * @param {number} i  column index
   * @param {number} j  row index
   * @returns {WavePoint}
   */
  function project(u, v, t, i, j) {
    const horizon = height * 0.12;

    // Slow the whole animation down so the swells roll gently rather than scroll past.
    const time = t * 0.45;

    // Stable per-node jitter (-0.5..0.5) de-uniforms the otherwise even grid spacing.
    const jx = jitter(i, j) - 0.5;
    const jy = jitter(i + 1, j + 1) - 0.5;

    // Rows bunch up near the horizon (pow > 1) and spread out near the viewer.
    const depth = Math.pow(v, 1.9);
    const baseY = horizon + (height * 1.15 - horizon) * depth;
    const cellH = (height * 1.15 - horizon) / rows;

    // A flat plane receding to a wide horizon — only a slight convergence, so the
    // far edge still spans the frame (no dome/fan silhouette).
    const spread = 0.72 + 0.5 * v;
    const cellW = (width * 1.28 * spread) / cols;
    const x = width * 0.5 + (u - 0.5) * width * 1.28 * spread + jx * cellW * 0.7;

    // Rolling swells: the dominant sines depend on depth, so their crests form
    // horizontal ridges that travel across the plane as time advances; a gentle
    // side-to-side wobble and a finer cross term keep the ridges from looking
    // mechanical.
    const wobble = Math.sin(u * 2.3 + time * 0.25) * 0.5;
    const wave =
      Math.sin(v * 9.0 - time * 0.8 + wobble) +
      0.45 * Math.sin(v * 4.3 - time * 0.5 + u * 1.6) +
      0.25 * Math.sin(u * 7.0 + v * 5.0 + time * 0.6);

    const amp = height * 0.14 * Math.pow(v, 1.1); // waves grow towards the viewer
    const y = baseY - wave * amp + jy * cellH * 0.7;

    // Depth cue: fade to nothing at the horizon.
    const alpha = Math.min(1, Math.pow(v, 1.3) * 1.2);

    return { x, y, alpha, v };
  }

  /**
   * Advance the field to time `t` (seconds) and recompute `points`.
   * @param {number} t elapsed time in seconds
   */
  function advance(t) {
    const grid = [];
    for (let j = 0; j <= rows; j++) {
      const row = [];
      for (let i = 0; i <= cols; i++) {
        row.push(project(i / cols, j / rows, t, i, j));
      }
      grid.push(row);
    }
    points = grid;
  }

  return Object.freeze({
    get width() {
      return width;
    },
    get height() {
      return height;
    },
    get cols() {
      return cols;
    },
    get rows() {
      return rows;
    },
    get points() {
      return points;
    },
    gridFor,
    setViewport,
    advance,
  });
}
