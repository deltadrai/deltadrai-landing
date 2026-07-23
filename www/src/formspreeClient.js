/**
 * FormspreeClient — thin adapter over `fetch` for posting to a Formspree
 * endpoint. Kept out of the ViewModel so no module touches the global
 * fetch directly (per docs/architecture.md: no direct window/document
 * access in modules, always inject an interface).
 */
export class FormspreeClient {
  /**
   * @param {typeof fetch} fetchFn
   * @param {string} endpoint
   */
  constructor(fetchFn, endpoint) {
    this._fetch = fetchFn;
    this._endpoint = endpoint;
  }

  /**
   * @param {{ email: string, message: string }} payload
   * @returns {Promise<boolean>} true if Formspree accepted the submission
   */
  async submit(payload) {
    const response = await this._fetch(this._endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    });
    return response.ok;
  }
}
