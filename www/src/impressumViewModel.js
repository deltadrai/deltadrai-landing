/**
 * impressumViewModel — ViewModel for the legal notice page (impressum.html).
 * Registered with Alpine as `x-data`. Decodes the obfuscated contact parts
 * from contactData.js once, at instantiation, and exposes them as plain
 * properties for x-text bindings.
 *
 * Nothing here touches window/document: the decoding is pure and the DOM write
 * is left to Alpine (per docs/architecture.md).
 *
 * @param {object} deps
 * @param {{ company: number[], street: number[], city: number[], country: number[],
 *           emailLocal: number[], emailDomain: number[] }} deps.contact encoded parts
 * @param {(codes: number[]) => string} deps.decode reverses the encoding
 */
export function createImpressumViewModel({ contact, decode }) {
  return {
    company: decode(contact.company),
    street: decode(contact.street),
    city: decode(contact.city),
    country: decode(contact.country),
    email: `${decode(contact.emailLocal)}@${decode(contact.emailDomain)}`,
  };
}
