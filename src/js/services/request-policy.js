// @ts-check
// src/js/services/request-policy.js

/**
 * Which origins htmx may call: our own, plus the off-site allowlist. Compared by
 * exact origin, so look-alike hosts such as `formspree.io.evil.test` are rejected.
 * @param {{ ownOrigin: string, allowedOrigins: readonly string[] }} deps
 * @returns {import('../contracts.js').RequestPolicy}
 */
export function createRequestPolicy({ ownOrigin, allowedOrigins }) {
  const allowed = new Set([ownOrigin, ...allowedOrigins]);
  return Object.freeze({
    allows: (url) => allowed.has(url.origin),
  });
}
