// @ts-check
// src/js/adapters/formspree.js

const ORIGIN = 'https://formspree.io';

/**
 * @param {unknown} value
 * @returns {value is Record<string, any>}
 */
const isObject = (value) => typeof value === 'object' && value !== null;

/**
 * Formspree's protocol: JSON in and out, `errors[]` with optional field names on
 * validation failures, a plain `error` string otherwise. Knows nothing about the DOM.
 * @returns {import('../contracts.js').OffsiteAdapter}
 */
export function createFormspreeAdapter() {
  return Object.freeze({
    name: 'formspree',
    matches: (url) => url.origin === ORIGIN,
    headers: Object.freeze({ Accept: 'application/json' }),

    parse(status, body) {
      if (status >= 200 && status < 300) return { ok: true, errors: [] };

      let data;
      try {
        data = JSON.parse(body);
      } catch {
        return { ok: false, errors: [] };
      }
      if (!isObject(data)) return { ok: false, errors: [] };

      if (Array.isArray(data.errors) && data.errors.length) {
        return {
          ok: false,
          errors: data.errors
            .filter((error) => isObject(error) && typeof error.message === 'string')
            .map((error) => ({
              ...(typeof error.field === 'string' ? { field: error.field } : {}),
              message: error.message,
            })),
        };
      }
      if (typeof data.error === 'string') return { ok: false, errors: [{ message: data.error }] };
      return { ok: false, errors: [] };
    },
  });
}
