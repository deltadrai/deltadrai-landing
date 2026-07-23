/**
 * waveFieldViewModel — the ViewModel (MVVM glue between the View and the Model).
 *
 * Registered with Alpine as `x-data`. The View drives it declaratively:
 *   - `x-init="boot($refs.canvas)"` bootstraps once the canvas exists,
 *   - `@resize.window="sync()"` propagates viewport changes.
 * It owns no DOM logic itself — everything flows through the injected
 * collaborators (DomAdapter, WaveField factory, CanvasRenderer factory), which
 * are wired in main.js (the composition root).
 *
 * The model/renderer/loop live in closure variables rather than on the returned
 * object so Alpine's reactivity proxy never wraps the per-frame point grid.
 *
 * @param {object}   deps
 * @param {import('./domAdapter.js').DomAdapter} deps.dom
 * @param {() => import('./waveField.js').WaveField} deps.createField
 * @param {() => import('./nodeEffects.js').NodeEffects} deps.createEffects
 * @param {(canvas: HTMLCanvasElement) => import('./canvasRenderer.js').CanvasRenderer} deps.createRenderer
 */
export function createWaveFieldViewModel({ dom, createField, createEffects, createRenderer }) {
  let field = null;
  let effects = null;
  let renderer = null;
  let stop = null;

  return {
    /** Alpine x-init: build the model + renderer and start animating. */
    boot(canvas) {
      field = createField();
      effects = createEffects();
      renderer = createRenderer(canvas);
      this.sync();
      if (!dom.prefersReducedMotion()) {
        stop = dom.startAnimation((t) => this.frame(t));
      }
    },

    /** Alpine @resize.window: re-measure; repaint immediately if not looping. */
    sync() {
      if (!field || !renderer) return;
      renderer.resize(dom.width, dom.height, dom.pixelRatio);
      field.setViewport(dom.width, dom.height);
      effects.setGrid(field.cols, field.rows);
      if (dom.prefersReducedMotion()) this.frame(0);
    },

    /** Advance the model one step and render the resulting frame. */
    frame(t) {
      field.advance(t);
      effects.advance(t);
      renderer.draw(field.points, field.rgb, {
        heatingNodes: effects.heatingNodes,
        circularNodes: effects.circularNodes,
      });
    },

    /** Alpine lifecycle: stop the loop when the component is torn down. */
    destroy() {
      if (stop) stop();
    },
  };
}
