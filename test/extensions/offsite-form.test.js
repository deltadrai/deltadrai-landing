import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createOffsiteFormExtension } from '../../src/js/extensions/offsite-form.js';
import { createFormspreeAdapter } from '../../src/js/adapters/formspree.js';

// jsdom is allowed here: the extension serialises <template> content, which has no
// reasonable hand-written fake.
const FORM = `<form hx-ext="offsite-form">
  <button type="submit">Send</button>
  <div role="status" data-form-status></div>
  <template data-offsite="success"><div data-anim="appear"><p>Thanks</p></div></template>
  <template data-offsite="error"><div data-anim="appear"><p>Failed</p><ul data-offsite-errors></ul></div></template>
</form>`;

function setup() {
  const dom = new JSDOM(FORM);
  const { document } = dom.window;
  const swaps = [];
  const ext = createOffsiteFormExtension({
    htmx: { swap: (...args) => swaps.push(args) },
    adapters: [createFormspreeAdapter()],
    messages: { network: 'NET' },
    document,
  });
  const form = document.querySelector('form');
  return { ext, form, swaps, status: form.querySelector('[data-form-status]'), button: form.querySelector('button') };
}

const configure = (ext, form, button, path, headers) => {
  const detail = { elt: button, path, headers };
  ext.onEvent('htmx:configRequest', { detail });
  return detail;
};

const respond = (ext, form, button, status, responseText) => {
  const detail = { elt: button, xhr: { status, responseText }, target: form, shouldSwap: false, isError: true, serverResponse: 'raw' };
  ext.onEvent('htmx:beforeSwap', { detail });
  return detail;
};

test('configRequest strips every HX-* header (any case) and adds the adapter headers', () => {
  const { ext, form, button } = setup();
  const d = configure(ext, form, button, 'https://formspree.io/f/abc', {
    'HX-Request': 'true', 'hx-target': 'x', 'HX-Current-URL': 'y', 'Content-Type': 'application/x-www-form-urlencoded',
  });
  assert.deepEqual(d.headers, { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' });
});

test('configRequest leaves requests to unknown providers untouched', () => {
  const { ext, form, button } = setup();
  const d = configure(ext, form, button, 'https://other.test/x', { 'HX-Request': 'true' });
  assert.deepEqual(d.headers, { 'HX-Request': 'true' });
});

test('success swaps the success template over the whole form', () => {
  const { ext, form, button } = setup();
  configure(ext, form, button, 'https://formspree.io/f/abc', {});
  const d = respond(ext, form, button, 200, '{"ok":true}');
  assert.equal(d.target, form);
  assert.equal(d.swapOverride, 'outerHTML');
  assert.equal(d.shouldSwap, true);
  assert.equal(d.isError, false);
  assert.equal(d.serverResponse, '<div data-anim="appear"><p>Thanks</p></div>');
});

test('error swaps the error template into the status region, keeps the form, lists provider messages', () => {
  const { ext, form, button, status } = setup();
  configure(ext, form, button, 'https://formspree.io/f/abc', {});
  const d = respond(ext, form, button, 422, '{"errors":[{"field":"email","message":"bad email"},{"message":"second"}]}');
  assert.equal(d.target, status);
  assert.equal(d.swapOverride, 'innerHTML');
  assert.equal(d.shouldSwap, true);
  assert.equal(d.isError, false, 'so htmx does not raise responseError');
  assert.equal(
    d.serverResponse,
    '<div data-anim="appear"><p>Failed</p><ul data-offsite-errors=""><li>bad email</li><li>second</li></ul></div>',
  );
});

test('error without provider messages drops the empty list (generic message only)', () => {
  const { ext, form, button } = setup();
  configure(ext, form, button, 'https://formspree.io/f/abc', {});
  const d = respond(ext, form, button, 500, '<html>');
  assert.equal(d.serverResponse, '<div data-anim="appear"><p>Failed</p></div>');
});

test('provider text never reaches HTML unescaped', () => {
  const { ext, form, button } = setup();
  configure(ext, form, button, 'https://formspree.io/f/abc', {});
  const evil = '<img src=x onerror=alert(1)><script>boom()</script>';
  const d = respond(ext, form, button, 422, JSON.stringify({ errors: [{ message: evil }] }));
  assert.ok(!d.serverResponse.includes('<img'));
  assert.ok(!d.serverResponse.includes('<script'));
  assert.ok(d.serverResponse.includes('&lt;img src=x onerror=alert(1)&gt;'));
});

test('beforeSwap ignores forms whose request was not handled by an adapter', () => {
  const { ext, form, button } = setup();
  const d = respond(ext, form, button, 200, '');
  assert.equal(d.shouldSwap, false);
  assert.equal(d.serverResponse, 'raw');
});

test('sendError renders the error template with the network message into the status region', () => {
  const { ext, form, button, status, swaps } = setup();
  ext.onEvent('htmx:sendError', { detail: { elt: button } });
  assert.equal(swaps.length, 1);
  assert.equal(swaps[0][0], status);
  assert.deepEqual(swaps[0][2], { swapStyle: 'innerHTML' });
  assert.equal(swaps[0][1], '<div data-anim="appear"><p>Failed</p><ul data-offsite-errors=""><li>NET</li></ul></div>');
});

test('events outside a form are ignored and never veto htmx', () => {
  const { ext } = setup();
  assert.equal(ext.onEvent('htmx:beforeSwap', { detail: { elt: null } }), true);
});
