/**
 * DomAdapter — a thin adapter over the injected `window`, so the rest of the
 * app never touches browser globals directly (per docs/architecture.md). This
 * is what makes the ViewModel testable: swap in a fake window in tests.
 *
 * Resize propagation is handled declaratively in the View via Alpine
 * (`@resize.window`), so this adapter only exposes viewport metrics, the
 * reduced-motion preference and the animation loop.
 */
export class DomAdapter {
  /** @param {Window} win */
  constructor(win) {
    this._win = win;
  }

  get width() {
    return this._win.innerWidth;
  }

  get height() {
    return this._win.innerHeight;
  }

  /** Device pixel ratio, capped at 2 to bound the canvas backing-store cost. */
  get pixelRatio() {
    return Math.min(this._win.devicePixelRatio || 1, 2);
  }

  prefersReducedMotion() {
    return (
      typeof this._win.matchMedia === 'function' &&
      this._win.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }

  /** Current time in seconds, on the same clock basis as `startAnimation`'s callback. */
  now() {
    return this._win.performance.now() * 0.001;
  }

  /** Resolve after `ms` milliseconds — used to sequence a fade around a resize. */
  wait(ms) {
    return new Promise((resolve) => this._win.setTimeout(resolve, ms));
  }

  /**
   * Drive an animation loop, invoking `cb(timeSeconds)` each frame.
   * @param {(timeSeconds: number) => void} cb
   * @returns {() => void} a stop function that cancels the loop
   */
  startAnimation(cb) {
    let raf;
    const loop = (nowMs) => {
      cb(nowMs * 0.001);
      raf = this._win.requestAnimationFrame(loop);
    };
    raf = this._win.requestAnimationFrame(loop);
    return () => this._win.cancelAnimationFrame(raf);
  }
}
