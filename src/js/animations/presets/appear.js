// @ts-check
// src/js/animations/presets/appear.js

/** Swapped-in results (form success/error): a quick fade and settle. */
/** @type {import('../../contracts.js').RevealPreset} */
export const appear = Object.freeze({
  name: 'appear',
  setup(targets, { gsap, reduced }) {
    if (reduced) {
      gsap.set(targets, { autoAlpha: 1 });
      return;
    }
    gsap.fromTo(
      targets,
      { autoAlpha: 0, y: 8 },
      { autoAlpha: 1, y: 0, duration: 0.3, ease: 'power2.out' },
    );
  },
});
