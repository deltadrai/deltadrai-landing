// @ts-check
// src/js/services/motion-policy.js

const REDUCED = '(prefers-reduced-motion: reduce)';
const FULL = '(prefers-reduced-motion: no-preference)';

/**
 * Motion preferences: reduced motion and Save-Data.
 * @param {{ matchMedia: (query: string) => { matches: boolean }, connection?: { saveData?: boolean } }} deps
 * @returns {import('../contracts.js').MotionPolicy}
 */
export function createMotionPolicy({ matchMedia, connection }) {
  return Object.freeze({
    conditions: Object.freeze({ reduced: REDUCED, full: FULL }),
    prefersReduced: () => matchMedia(REDUCED).matches,
    saveData: () => Boolean(connection?.saveData),
  });
}
