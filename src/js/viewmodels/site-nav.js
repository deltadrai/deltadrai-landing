// @ts-check
// src/js/viewmodels/site-nav.js

/**
 * ViewModel for the persistent legal-links footer. It outlives boosted navigation,
 * so it re-reads the location after each settle to keep `aria-current` correct.
 *
 * @param {object} deps
 * @param {() => string} deps.currentPath
 */
export function createSiteNavViewModel({ currentPath }) {
  return {
    path: currentPath(),

    /** Alpine @htmx:after-settle.window: the URL may have changed. */
    refresh() {
      this.path = currentPath();
    },

    /**
     * `aria-current` value for a link; `null` removes the attribute.
     * @param {string} pathname the link's own path
     */
    current(pathname) {
      return pathname === this.path ? 'page' : null;
    },
  };
}
