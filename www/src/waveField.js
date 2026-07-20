/**
 * WaveField — animated wireframe wave mesh rendered to a <canvas>.
 *
 * Recreates the static "wallpaper" look (a network of dots and lines laid over
 * a plane that recedes into the distance) and animates it: travelling sine
 * waves roll across the surface, densest and tallest close to the viewer and
 * dissolving into the white background towards the horizon.
 *
 * Per docs/architecture.md this module never touches the browser globals
 * directly — the canvas element and a window-like object are injected by the
 * composition root (main.js), which keeps it environment-agnostic/testable.
 */
export class WaveField {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {Window} win           injected window (matchMedia, rAF, resize, DPR)
   * @param {object} [options]
   */
  constructor(canvas, win, options = {}) {
    this.canvas = canvas;
    this.win = win;
    this.ctx = canvas.getContext('2d');

    // Grid resolution of the mesh (columns × rows of points).
    this.cols = options.cols ?? 48;
    this.rows = options.rows ?? 30;

    // Brand teal as an "r, g, b" string so we can vary alpha per point.
    this.rgb = options.rgb ?? '127, 180, 168';

    this.reduced =
      typeof win.matchMedia === 'function' &&
      win.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this._onResize = () => this.resize();
    this._frame = (now) => this._tick(now);
  }

  start() {
    this.resize();
    this.win.addEventListener('resize', this._onResize);

    if (this.reduced) {
      // Honour reduced-motion: paint a single static frame, no loop.
      this._render(0);
      return;
    }
    this._raf = this.win.requestAnimationFrame(this._frame);
  }

  stop() {
    this.win.removeEventListener('resize', this._onResize);
    if (this._raf) this.win.cancelAnimationFrame(this._raf);
  }

  resize() {
    const dpr = Math.min(this.win.devicePixelRatio || 1, 2);
    this.w = this.win.innerWidth;
    this.h = this.win.innerHeight;

    this.canvas.width = Math.round(this.w * dpr);
    this.canvas.height = Math.round(this.h * dpr);
    this.canvas.style.width = `${this.w}px`;
    this.canvas.style.height = `${this.h}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (this.reduced) this._render(0);
  }

  _tick(now) {
    this._render(now * 0.001);
    this._raf = this.win.requestAnimationFrame(this._frame);
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
    const w = this.w;
    const h = this.h;
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

  _render(t) {
    const { ctx, cols, rows, rgb } = this;
    ctx.clearRect(0, 0, this.w, this.h);

    // Build the projected point grid once per frame.
    const pts = [];
    for (let j = 0; j <= rows; j++) {
      const row = [];
      for (let i = 0; i <= cols; i++) {
        row.push(this._project(i / cols, j / rows, t));
      }
      pts.push(row);
    }

    // Edges: connect each point to its right, down and diagonal neighbour so
    // the surface reads as a triangulated wireframe.
    ctx.lineWidth = 1;
    for (let j = 0; j <= rows; j++) {
      for (let i = 0; i <= cols; i++) {
        const a = pts[j][i];
        const right = i < cols ? pts[j][i + 1] : null;
        const down = j < rows ? pts[j + 1][i] : null;
        const diag = i < cols && j < rows ? pts[j + 1][i + 1] : null;
        for (const b of [right, down, diag]) {
          if (!b) continue;
          const alpha = Math.min(a.alpha, b.alpha) * 0.45;
          if (alpha < 0.01) continue;
          ctx.strokeStyle = `rgba(${rgb}, ${alpha.toFixed(3)})`;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }

    // Nodes: dots at every intersection, larger and stronger up close.
    for (let j = 0; j <= rows; j++) {
      for (let i = 0; i <= cols; i++) {
        const p = pts[j][i];
        if (p.alpha < 0.02) continue;
        const r = 0.5 + 1.9 * p.v;
        ctx.fillStyle = `rgba(${rgb}, ${Math.min(1, p.alpha * 0.9).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}
