// @ts-check
// src/js/services/ticker.js

/**
 * Frame loop on GSAP's ticker, so GSAP owns every moving thing on the page.
 * @param {{ gsap: { ticker: { add: Function, remove: Function, time: number } } }} deps
 * @returns {import('../contracts.js').Ticker}
 */
export function createTicker({ gsap }) {
  return Object.freeze({
    add(callback) {
      const listener = (/** @type {number} */ time) => callback(time);
      gsap.ticker.add(listener);
      return () => gsap.ticker.remove(listener);
    },
    now: () => gsap.ticker.time,
  });
}
