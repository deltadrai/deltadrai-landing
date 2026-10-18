// @ts-check
// src/js/services/viewport.js

/**
 * CSS-pixel viewport metrics, read live from the injected window.
 * @param {{ window: Pick<Window, 'innerWidth' | 'innerHeight' | 'devicePixelRatio'> }} deps
 * @returns {import('../contracts.js').Viewport}
 */
export function createViewport({ window }) {
  return Object.freeze({
    get width() {
      return window.innerWidth;
    },
    get height() {
      return window.innerHeight;
    },
    /** Capped at 2 to bound the canvas backing-store cost. */
    get pixelRatio() {
      return Math.min(window.devicePixelRatio || 1, 2);
    },
  });
}
