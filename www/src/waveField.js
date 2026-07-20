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
   * @param {number} [options.cols] grid columns
   * @param {number} [options.rows] grid rows
   * @param {string} [options.rgb]  brand colour as an "r, g, b" string
   */
  constructor({ cols = 48, rows = 30, rgb = '127, 180, 168' } = {}) {
    this.cols = cols;
    this.rows = rows;
    this.rgb = rgb;

    this.width = 0;
    this.height = 0;

    /**
     * Latest projected grid: rows+1 arrays of cols+1 points, each
     * `{ x, y, alpha, v }`. Populated by `advance`.
     * @type {Array<Array<{x:number,y:number,alpha:number,v:number}>>}
     */
    this.points = [];
  }

  /** Push the current viewport dimensions in (called on init and resize). */
  setViewport(width, height) {
    this.width = width;
    this.height = height;
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
        row.push(this._project(i / this.cols, j / this.rows, t));
      }
      grid.push(row);
    }
    this.points = grid;
  }

  /**
   * Project a grid coordinate onto the screen, applying a fake perspective
   * (far rows converge high and narrow, near rows spread wide and low) plus a
   * travelling-wave vertical displacement.
   * @param {number} u  0..1 across the grid (left→right)
   * @param {number} v  0..1 depth of the grid (0 = far/top, 1 = near/bottom)
   * @param {number} t  time in seconds
   */
  _project(u, v, t) {
    const w = this.width;
    const h = this.height;
    const horizon = h * 0.12;

    // Rows bunch up near the horizon (pow > 1) and spread out near the viewer.
    const depth = Math.pow(v, 1.9);
    const baseY = horizon + (h * 1.15 - horizon) * depth;

    // A flat plane receding to a wide horizon — only a slight convergence, so
    // the far edge still spans the frame (no dome/fan silhouette).
    const spread = 0.72 + 0.5 * v;
    const x = w * 0.5 + (u - 0.5) * w * 1.28 * spread;

    // Rolling swells: the dominant sines depend on depth, so their crests form
    // horizontal ridges that travel across the plane as time advances; a gentle
    // side-to-side wobble and a finer cross term keep the ridges from looking
    // mechanical.
    const wobble = Math.sin(u * 2.3 + t * 0.25) * 0.5;
    const wave =
      Math.sin(v * 9.0 - t * 0.8 + wobble) +
      0.45 * Math.sin(v * 4.3 - t * 0.5 + u * 1.6) +
      0.25 * Math.sin(u * 7.0 + v * 5.0 + t * 0.6);

    const amp = h * 0.14 * Math.pow(v, 1.1); // waves grow towards the viewer
    const y = baseY - wave * amp;

    // Depth cue: fade to nothing at the horizon.
    const alpha = Math.min(1, Math.pow(v, 1.3) * 1.2);

    return { x, y, alpha, v };
  }
}
