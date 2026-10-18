// @ts-check
// src/js/animations/transitions/canvas-fade.js

/**
 * Masks a discontinuous change behind a brief fade of the element itself. Used by
 * the wave backdrop when a resize changes the grid resolution.
 * @param {string} name
 * @param {number} alpha
 * @returns {import('../../contracts.js').TransitionPreset}
 */
const fadeTo = (name, alpha) =>
  Object.freeze({
    name,
    run(el, { gsap, reduced }) {
      if (reduced) return gsap.set(el, { autoAlpha: alpha });
      return gsap.to(el, {
        autoAlpha: alpha,
        duration: 0.22,
        ease: 'power1.inOut',
        overwrite: true,
      });
    },
  });

export const canvasFadeOut = fadeTo('canvas-fade-out', 0);
export const canvasFadeIn = fadeTo('canvas-fade-in', 1);
