// @ts-check
// src/js/lib/decode.js
const OFFSET = 23;

/**
 * Reverse the code-point shift applied to the encoded contact parts in config.js.
 *
 * @param {number[]} codes shifted code points
 * @returns {string} the original text
 */
export function decode(codes) {
  return codes.map((code) => String.fromCodePoint(code - OFFSET)).join('');
}
