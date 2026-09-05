/**
 * contactData.js — the company's legally mandated contact details.
 *
 * The values are stored as code-point offsets instead of string literals so
 * that neither the served HTML nor this module's source contains a harvestable
 * address or e-mail. `impressumViewModel` decodes them at runtime and Alpine
 * writes them into the DOM via x-text, which keeps them real, selectable,
 * screen-reader-readable text for humans while staying invisible to crawlers
 * that only fetch and regex the raw response body.
 *
 * This is obfuscation, not security: a scraper driving a headless browser will
 * still read the rendered text. It defeats the common case — the harvester that
 * greps HTML for `mailto:` and for `\S+@\S+` — which is why no `mailto:` link
 * exists anywhere on the site.
 *
 * The transform is a plain code-point shift (no atob, no browser globals), so
 * this module stays environment-agnostic and unit-testable per
 * docs/architecture.md ("no direct access to window or document in modules").
 */

const OFFSET = 23;

/**
 * Reverse the code-point shift applied to the CONTACT parts below.
 *
 * @param {number[]} codes shifted code points
 * @returns {string} the original text
 */
export function decode(codes) {
  return codes.map((code) => String.fromCodePoint(code - OFFSET)).join('');
}

/** Encoded parts of the Impressum contact block. Decode via `decode()`. */
export const CONTACT = {
  company: [123, 124, 131, 139, 120, 123, 137, 120, 128, 55, 94, 132, 121, 95],
  street: [
    88, 123, 120, 131, 121, 124, 137, 139, 68, 106, 139, 128, 125, 139, 124, 137, 68, 106, 139,
    137, 120, 246, 124, 55, 75,
  ],
  city: [75, 78, 72, 71, 55, 94, 137, 128, 124, 138, 130, 128, 137, 122, 127, 124, 133],
  country: [237, 138, 139, 124, 137, 137, 124, 128, 122, 127],
  // Split so that not even a decoded-but-unjoined dump yields a full address.
  emailLocal: [128, 132, 135, 137, 124, 138, 138, 140, 132],
  emailDomain: [123, 124, 131, 139, 120, 123, 137, 69, 120, 128],
};
