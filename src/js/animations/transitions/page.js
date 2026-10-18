// @ts-check
// src/js/animations/transitions/page.js

/**
 * Page transitions for boosted navigation. `page-out` must finish within
 * `config.motion.pageMs`, which matches `swap:300ms` on the boosted containers.
 */

/** @type {import('../../contracts.js').TransitionPreset} */
export const pageOut = Object.freeze({
  name: 'page-out',
  run(el, { gsap, reduced }) {
    if (reduced) return gsap.set(el, { autoAlpha: 0 });
    return gsap.to(el, {
      autoAlpha: 0,
      y: -12,
      duration: 0.25,
      ease: 'power2.in',
      overwrite: true,
    });
  },
});

/** @type {import('../../contracts.js').TransitionPreset} */
export const pageIn = Object.freeze({
  name: 'page-in',
  run(el, { gsap, reduced }) {
    if (reduced) return gsap.set(el, { autoAlpha: 1, y: 0 });
    return gsap.fromTo(
      el,
      { autoAlpha: 0, y: 12 },
      { autoAlpha: 1, y: 0, duration: 0.4, ease: 'power2.out', overwrite: true },
    );
  },
});
