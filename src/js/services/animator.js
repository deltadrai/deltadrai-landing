// @ts-check
// src/js/services/animator.js

/**
 * Animation lifecycle: reveal presets are mounted per root inside a
 * `gsap.matchMedia(root)` (scoped selectors, automatic cleanup, live
 * reduced-motion switching); transitions are imperative and awaited by callers.
 *
 * @param {object} deps
 * @param {any} deps.gsap
 * @param {Record<string, any>} [deps.plugins] extra GSAP plugins handed to presets
 * @param {readonly import('../contracts.js').RevealPreset[]} deps.presets
 * @param {readonly import('../contracts.js').TransitionPreset[]} deps.transitions
 * @param {import('../contracts.js').MotionPolicy} deps.motion
 * @param {boolean} [deps.debug]
 * @returns {import('../contracts.js').Animator}
 */
export function createAnimator({
  gsap,
  plugins = {},
  presets,
  transitions,
  motion,
  debug = false,
}) {
  const revealByName = new Map(presets.map((preset) => [preset.name, preset]));
  const transitionByName = new Map(transitions.map((preset) => [preset.name, preset]));
  /** @type {Map<Element, { revert: () => void }>} */
  const contexts = new Map();

  /** @param {string} message */
  const warn = (message) => {
    if (debug) console.warn(`[animator] ${message}`);
  };

  /** @param {Element} root */
  function unmount(root) {
    for (const [key, context] of contexts) {
      if (key === root || root.contains(key)) {
        context.revert();
        contexts.delete(key);
      }
    }
  }

  /** @param {Element} root */
  function groupByPreset(root) {
    /** @type {Map<string, HTMLElement[]>} */
    const groups = new Map();
    const elements = [...root.querySelectorAll('[data-anim]')];
    if (root.matches('[data-anim]')) elements.unshift(root);
    for (const element of /** @type {HTMLElement[]} */ (elements)) {
      const name = element.dataset.anim ?? '';
      groups.set(name, [...(groups.get(name) ?? []), element]);
    }
    return groups;
  }

  return Object.freeze({
    unmount,

    /** @param {Element} root */
    mount(root) {
      unmount(root);
      const groups = groupByPreset(root);
      if (!groups.size) return;

      const context = gsap.matchMedia(root);
      context.add({ ...motion.conditions }, (/** @type {any} */ ctx) => {
        const reduced = Boolean(ctx.conditions?.reduced);
        for (const [name, targets] of groups) {
          const preset = revealByName.get(name);
          if (!preset) {
            warn(`unknown reveal preset "${name}"`);
            continue;
          }
          preset.setup(targets, { gsap, ...plugins, reduced, ctx });
        }
      });
      contexts.set(root, context);
    },

    async transition(name, el, options = {}) {
      const preset = transitionByName.get(name);
      if (!preset) {
        warn(`unknown transition "${name}"`);
        return;
      }
      await preset.run(el, { gsap, reduced: motion.prefersReduced(), options });
    },
  });
}
