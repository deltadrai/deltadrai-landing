// @ts-check
// src/js/viewmodels/wave-backdrop.js

/**
 * ViewModel for the animated wave mesh behind the page (`_includes/backdrop.html`).
 *
 * The View drives it declaratively: Alpine calls `init()`/`destroy()`, and
 * `@resize.window` calls `sync()`. The model/renderer/loop live in closure variables
 * rather than on the returned object so Alpine's reactivity proxy never wraps the
 * per-frame point grid.
 *
 * @param {object} deps
 * @param {import('../contracts.js').Viewport} deps.viewport
 * @param {import('../contracts.js').Ticker} deps.ticker
 * @param {import('../contracts.js').Transition} deps.transition
 * @param {() => boolean} deps.prefersReduced
 * @param {() => ReturnType<import('../models/wave-field.js').createWaveFieldModel>} deps.createField
 * @param {() => ReturnType<import('../models/node-effects.js').createNodeEffectsModel>} deps.createEffects
 * @param {(canvas: HTMLCanvasElement) => import('../contracts.js').WaveRenderer} deps.createRenderer
 */
export function createWaveBackdropViewModel({
  viewport,
  ticker,
  transition,
  prefersReduced,
  createField,
  createEffects,
  createRenderer,
}) {
  /** @type {ReturnType<typeof createField> | null} */
  let field = null;
  /** @type {ReturnType<typeof createEffects> | null} */
  let effects = null;
  /** @type {import('../contracts.js').WaveRenderer | null} */
  let renderer = null;
  /** @type {(() => void) | null} */
  let stop = null;
  let syncing = false;
  let resyncRequested = false;

  return {
    /** Alpine lifecycle: build the model + renderer and start animating. */
    init() {
      field = createField();
      effects = createEffects();
      renderer = createRenderer(/** @type {HTMLCanvasElement} */ (this.$refs.canvas));
      this.sync();
      if (!prefersReduced()) stop = ticker.add((t) => this.frame(t));
    },

    /**
     * Alpine @resize.window: re-measure and repaint.
     *
     * A resize that changes the grid's column/row count (e.g. a mobile orientation
     * flip) re-keys every node — a discontinuous jump rather than a smooth reflow —
     * so that case is masked behind a brief GSAP fade-out/in. A resize that keeps
     * the same grid resolution (most desktop window drags) reflows continuously and
     * skips the fade entirely. Overlapping calls are coalesced into one more pass.
     */
    async sync() {
      if (!field || !effects || !renderer) return;
      if (syncing) {
        resyncRequested = true;
        return;
      }
      syncing = true;
      try {
        do {
          resyncRequested = false;
          const { width, height, pixelRatio } = viewport;
          const next = field.gridFor(width, height);
          const gridChanged =
            field.width > 0 && (next.cols !== field.cols || next.rows !== field.rows);
          const canvas = /** @type {HTMLCanvasElement} */ (this.$refs.canvas);

          if (gridChanged) await transition('canvas-fade-out', canvas);

          renderer.resize(width, height, pixelRatio);
          field.setViewport(width, height);
          effects.setGrid(field.cols, field.rows);
          // Resizing clears the canvas: repaint now rather than wait for the next tick.
          this.frame(prefersReduced() ? 0 : ticker.now());

          if (gridChanged) await transition('canvas-fade-in', canvas);
        } while (resyncRequested);
      } finally {
        syncing = false;
      }
    },

    /** Advance the model one step and render the resulting frame. */
    frame(/** @type {number} */ t) {
      if (!field || !effects || !renderer) return;
      field.advance(t);
      effects.advance(t);
      renderer.draw(field.points, {
        heatingNodes: effects.heatingNodes,
        circularNodes: effects.circularNodes,
      });
    },

    /** Alpine lifecycle: stop the loop when the component is torn down. */
    destroy() {
      stop?.();
    },
  };
}
