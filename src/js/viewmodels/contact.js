// @ts-check
// src/js/viewmodels/contact.js

/**
 * ViewModel for the legal pages' contact block. Decodes the obfuscated contact parts
 * once, at instantiation, and exposes them as plain properties for x-text bindings.
 * The decoding is pure and the DOM write is left to Alpine.
 *
 * @param {object} deps
 * @param {Record<'company' | 'street' | 'city' | 'country' | 'emailLocal' | 'emailDomain', readonly number[]>} deps.contact
 *   encoded parts
 * @param {(codes: readonly number[]) => string} deps.decode reverses the encoding
 */
export function createContactViewModel({ contact, decode }) {
  return {
    company: decode(contact.company),
    street: decode(contact.street),
    city: decode(contact.city),
    country: decode(contact.country),
    email: `${decode(contact.emailLocal)}@${decode(contact.emailDomain)}`,
  };
}
