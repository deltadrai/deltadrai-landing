/**
 * WaveField — the Model. Pure geometry/animation logic for the wireframe wave
 * mesh, with no knowledge of the canvas, the window or any rendering concern
 * (per docs/architecture.md: no direct window/document access in modules).
 *
 * The viewport size is pushed in via `setViewport`, the animation is stepped by
 * `advance(timeSeconds)`, and the resulting projected grid is exposed as the
 * public `points` property for a renderer to consume. This indirection keeps
 * the module environment-agnostic and unit-testable with plain values.
 */
export class WaveField {
  /**
   * @param {object} [options]
   * @param {string} [options.rgb]  brand colour as an "r, g, b" string
   * @param {number} [options.colSpacing] target CSS-px distance between adjacent columns
   * @param {number} [options.rowSpacing] target CSS-px distance between adjacent rows
   * @param {number} [options.minCols] lower bound on grid resolution (very narrow viewports)
   * @param {number} [options.minRows] lower bound on grid resolution (very short viewports)
   * @param {number} [options.maxCols] upper bound on grid resolution (perf cap on huge viewports)
   * @param {number} [options.maxRows] upper bound on grid resolution (perf cap on huge viewports)
   */
  constructor({
    rgb = '127, 180, 168',
    colSpacing = 50,
    rowSpacing = 37,
    minCols = 10,
    minRows = 8,
    maxCols = 90,
    maxRows = 60,
  } = {}) {
    this.rgb = rgb;
    this._colSpacing = colSpacing;
    this._rowSpacing = rowSpacing;
    this._minCols = minCols;
    this._minRows = minRows;
    this._maxCols = maxCols;
    this._maxRows = maxRows;

    this.width = 0;
    this.height = 0;
    this.cols = minCols;
    this.rows = minRows;

    /**
     * Latest projected grid: rows+1 arrays of cols+1 points, each
     * `{ x, y, alpha, v }`. Populated by `advance`.
     * @type {Array<Array<{x:number,y:number,alpha:number,v:number}>>}
     */
    this.points = [];
  }

  /**
   * Push the current viewport dimensions in (called on init and resize), and
   * re-derive the grid resolution from it so that adjacent nodes stay the
   * same CSS-px distance apart regardless of viewport size, aspect ratio or
   * DPI — a fixed column/row count would otherwise squash into thin strips on
   * narrow viewports (e.g. mobile portrait). DPI itself needs no separate
   * handling here: everything downstream stays in CSS pixels, the backing
   * store is scaled independently in CanvasRenderer.
   */
  setViewport(width, height) {
    this.width = width;
    this.height = height;
    const grid = this.gridFor(width, height);
    this.cols = grid.cols;
    this.rows = grid.rows;
  }

  /**
   * Pure preview of the grid resolution `setViewport` would derive for a
   * given viewport, without mutating any state. Lets a caller (e.g. the
   * ViewModel) detect an upcoming grid-resolution change — a column/row
   * count change re-keys every node, which is a discontinuous jump rather
   * than a smooth reflow — before committing to it.
   */
  gridFor(width, height) {
    // Mirrors the overscan factors used in `_project` (1.28x width, and
    // height minus the 0.12h horizon down to the 1.15h far edge) so the
    // derived grid resolution matches what's actually drawn.
    const horizontalExtent = width * 1.28;
    const depthExtent = height * 1.03;

    return {
      cols: this._clamp(Math.round(horizontalExtent / this._colSpacing), this._minCols, this._maxCols),
      rows: this._clamp(Math.round(depthExtent / this._rowSpacing), this._minRows, this._maxRows),
    };
  }

  _clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  /**
   * Advance the field to time `t` (seconds) and recompute `points`.
   * @param {number} t elapsed time in seconds
   */
  advance(t) {
    const grid = [];
    for (let j = 0; j <= this.rows; j++) {
      const row = [];
      for (let i = 0; i <= this.cols; i++) {
        row.push(this._project(i / this.cols, j / this.rows, t, i, j));
      }
      grid.push(row);
    }
    this.points = grid;
  }

  /**
   * Deterministic pseudo-random jitter per grid node (stable across frames so
   * the mesh doesn't flicker), used to break up the otherwise perfectly even
   * spacing of rows/columns.
   * @param {number} i column index
   * @param {number} j row index
   */
  _jitter(i, j) {
    const seed = Math.sin(i * 12.9898 + j * 78.233) * 43758.5453;
    return seed - Math.floor(seed);
  }

  /**
   * Project a grid coordinate onto the screen, applying a fake perspective
   * (far rows converge high and narrow, near rows spread wide and low) plus a
   * travelling-wave vertical displacement.
   * @param {number} u  0..1 across the grid (left→right)
   * @param {number} v  0..1 depth of the grid (0 = far/top, 1 = near/bottom)
   * @param {number} t  time in seconds
   */
  _project(u, v, t, i, j) {
    const w = this.width;
    const h = this.height;
    const horizon = h * 0.12;

    // Slow the whole animation down so the swells roll gently rather than
    // scroll past.
    const time = t * 0.45;

    // Stable per-node jitter (0..1) used to de-uniform the otherwise perfectly
    // even grid spacing.
    const jx = this._jitter(i, j) - 0.5;
    const jy = this._jitter(i + 1, j + 1) - 0.5;

    // Rows bunch up near the horizon (pow > 1) and spread out near the viewer.
    const depth = Math.pow(v, 1.9);
    const baseY = horizon + (h * 1.15 - horizon) * depth;
    const cellH = (h * 1.15 - horizon) / this.rows;

    // A flat plane receding to a wide horizon — only a slight convergence, so
    // the far edge still spans the frame (no dome/fan silhouette).
    const spread = 0.72 + 0.5 * v;
    const cellW = (w * 1.28 * spread) / this.cols;
    const x = w * 0.5 + (u - 0.5) * w * 1.28 * spread + jx * cellW * 0.7;

    // Rolling swells: the dominant sines depend on depth, so their crests form
    // horizontal ridges that travel across the plane as time advances; a gentle
    // side-to-side wobble and a finer cross term keep the ridges from looking
    // mechanical.
    const wobble = Math.sin(u * 2.3 + time * 0.25) * 0.5;
    const wave =
      Math.sin(v * 9.0 - time * 0.8 + wobble) +
      0.45 * Math.sin(v * 4.3 - time * 0.5 + u * 1.6) +
      0.25 * Math.sin(u * 7.0 + v * 5.0 + time * 0.6);

    const amp = h * 0.14 * Math.pow(v, 1.1); // waves grow towards the viewer
    const y = baseY - wave * amp + jy * cellH * 0.7;

    // Depth cue: fade to nothing at the horizon.
    const alpha = Math.min(1, Math.pow(v, 1.3) * 1.2);

    return { x, y, alpha, v };
  }
}
