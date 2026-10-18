import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createHtmxBridge } from '../../src/js/services/htmx-bridge.js';

const selectors = {
  page: '#page',
  pageHeading: '#page h1',
  offsiteForm: '[hx-ext~="offsite-form"]',
  fragmentStatus: '[data-fragment-status]',
};

function setup(allowed = () => true) {
  const dom = new JSDOM(`<footer><p role="status" data-fragment-status></p></footer>
    <main id="page"><h1 tabindex="-1">T</h1></main>
    <form hx-ext="offsite-form"><button></button></form>`);
  const { document } = dom.window;
  const calls = [];
  const animator = {
    mount: (el) => calls.push(['mount', el.id || el.tagName]),
    unmount: (el) => calls.push(['unmount', el.id || el.tagName]),
    transition: async (name, el) => void calls.push(['transition', name, el.id]),
  };
  const bridge = createHtmxBridge({
    animator,
    allowsUrl: allowed,
    document,
    selectors,
    messages: { failed: 'FAILED' },
  });
  const stop = bridge.start();
  const fire = (target, type, detail = {}, cancelable = false) => {
    const event = new dom.window.CustomEvent(type, { bubbles: true, cancelable, detail });
    target.dispatchEvent(event);
    return event;
  };
  return { dom, document, calls, fire, stop, page: document.getElementById('page'), form: document.querySelector('form') };
}

test('validateUrl: cancels everything the request policy rejects', () => {
  const { fire, page } = setup((url) => url.origin === 'https://ok.test');
  assert.equal(fire(page, 'htmx:validateUrl', { url: new URL('https://ok.test/a') }, true).defaultPrevented, false);
  assert.equal(fire(page, 'htmx:validateUrl', { url: new URL('https://evil.test/a') }, true).defaultPrevented, true);
});

test('page swap: page-out before the swap, unmount after it, mount + page-in + focus after settle', async () => {
  const { fire, page, calls, document } = setup();
  fire(page, 'htmx:beforeSwap', { target: page, shouldSwap: true, isError: false });
  fire(page, 'htmx:afterSwap', { target: page });
  fire(page, 'htmx:afterSettle', {});
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(calls, [
    ['transition', 'page-out', 'page'],
    ['unmount', 'page'],
    ['mount', 'page'],
    ['transition', 'page-in', 'page'],
  ]);
  assert.equal(document.activeElement.tagName, 'H1');
});

test('no page-out when htmx will not swap (e.g. a 404), so the page is never left faded out', () => {
  const { fire, page, calls } = setup();
  fire(page, 'htmx:beforeSwap', { target: page, shouldSwap: false, isError: true });
  fire(page, 'htmx:beforeSwap', { target: page, shouldSwap: true, isError: true });
  assert.deepEqual(calls, []);
});

test('fragment swaps are mounted but get no page transition or focus move', async () => {
  const { fire, form, calls, document } = setup();
  const status = form.appendChild(document.createElement('div'));
  fire(status, 'htmx:afterSettle', {});
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(calls, [['mount', 'DIV']]);
});

test('own-origin failures are announced; off-site form failures are left to the extension; the next request clears it', () => {
  const { fire, page, form, document } = setup();
  const region = document.querySelector('[data-fragment-status]');
  fire(page, 'htmx:responseError', { elt: page });
  assert.equal(region.textContent, 'FAILED');
  fire(page, 'htmx:beforeRequest', {});
  assert.equal(region.textContent, '');
  fire(form, 'htmx:sendError', { elt: form.querySelector('button') });
  assert.equal(region.textContent, '');
  fire(page, 'htmx:sendError', { elt: page });
  assert.equal(region.textContent, 'FAILED');
});

test('stop removes every listener', () => {
  const { fire, page, stop, calls } = setup();
  stop();
  fire(page, 'htmx:afterSwap', { target: page });
  assert.deepEqual(calls, []);
});
