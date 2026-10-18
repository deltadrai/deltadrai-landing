// Verifies the htmx behaviour that architecture §8.2 and coding.md §9 rely on, against
// the pinned htmx build, in a minimal jsdom setup. This (plus extensions/offsite-form.test.js)
// is the one place jsdom is allowed.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { createOffsiteFormExtension } from '../../src/js/extensions/offsite-form.js';
import { createFormspreeAdapter } from '../../src/js/adapters/formspree.js';

const htmxSource = readFileSync(new URL('../../node_modules/htmx.org/dist/htmx.js', import.meta.url), 'utf8');

/** @type {{ own: http.Server, remote: http.Server }} */
let servers;
const hits = { own: [], remote: [] };
let ownPort;
let remotePort;
let respond = { own: () => {}, remote: () => {} };

const listen = (server) => new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));

before(async () => {
  const handler = (name) => (req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      hits[name].push({ method: req.method, url: req.url, headers: req.headers, body });
      res.setHeader('access-control-allow-origin', '*');
      if (req.method === 'OPTIONS') {
        res.setHeader('access-control-allow-headers', '*');
        res.statusCode = 204;
        return res.end();
      }
      respond[name](req, res);
    });
  };
  servers = { own: http.createServer(handler('own')), remote: http.createServer(handler('remote')) };
  ownPort = await listen(servers.own);
  remotePort = await listen(servers.remote);
});
after(() => Promise.all(Object.values(servers).map((s) => new Promise((r) => s.close(r)))));

const send = (status, body, type = 'text/html') => (req, res) => {
  res.statusCode = status;
  res.setHeader('content-type', type);
  res.end(body);
};

async function env(markup) {
  hits.own.length = 0;
  hits.remote.length = 0;
  const dom = new JSDOM(`<!DOCTYPE html><body>${markup}</body>`, {
    url: `http://127.0.0.1:${ownPort}/`,
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  });
  await new Promise((resolve) => dom.window.addEventListener('load', resolve));
  // htmx scans for hx-on:* with an XPath call that jsdom only supports with an explicit
  // result type. The site never uses hx-on (allowEval is off), so default it here.
  const xpath = dom.window.XPathExpression.prototype;
  const evaluate = xpath.evaluate;
  xpath.evaluate = function (context, type = 0, ...rest) {
    return evaluate.call(this, context, type, ...rest);
  };
  dom.window.eval(htmxSource);
  const { htmx } = dom.window;
  Object.assign(htmx.config, { selfRequestsOnly: false, allowEval: false, includeIndicatorStyles: false, historyCacheSize: 0 });
  htmx.process(dom.window.document.body);
  return { dom, htmx, document: dom.window.document, window: dom.window };
}
const tick = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 2000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (fn()) return;
    await tick(10);
  }
  throw new Error('timed out waiting for condition');
};
const click = (window, el) => el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));

test('htmx:beforeSwap fires before the swap: delay, with the old content still in place', async () => {
  respond.own = send(200, '<p id="new">new</p>');
  const { window, document } = await env('<div id="t"><button id="b" hx-get="/x" hx-target="#t" hx-swap="innerHTML swap:150ms">go</button></div>');
  const seen = {};
  document.addEventListener('htmx:beforeSwap', () => {
    seen.at = Date.now();
    seen.oldStillThere = !!document.getElementById('b');
  });
  document.addEventListener('htmx:afterSwap', () => (seen.swappedAt = Date.now()));
  click(window, document.getElementById('b'));
  await until(() => seen.swappedAt);
  assert.equal(seen.oldStillThere, true);
  assert.ok(seen.swappedAt - seen.at >= 140, `swap delayed by ${seen.swappedAt - seen.at}ms`);
  assert.ok(document.getElementById('new'));
});

test('htmx:beforeSwap may override serverResponse, target, swapOverride, shouldSwap and isError', async () => {
  respond.own = send(500, 'server error');
  const { window, document } = await env('<div id="a">a</div><div id="b">b</div><button id="go" hx-get="/x" hx-target="#a" hx-swap="outerHTML">go</button>');
  let responseErrors = 0;
  document.addEventListener('htmx:responseError', () => responseErrors++);
  document.addEventListener('htmx:beforeSwap', (e) => {
    Object.assign(e.detail, { shouldSwap: true, isError: false, target: document.getElementById('b'), swapOverride: 'innerHTML', serverResponse: '<i id="o">overridden</i>' });
  });
  click(window, document.getElementById('go'));
  await until(() => document.getElementById('o'));
  assert.equal(document.getElementById('a').textContent, 'a', 'original target untouched');
  assert.equal(document.querySelector('#b > i#o')?.textContent, 'overridden', 'innerHTML into the overridden target');
  assert.equal(document.getElementById('b').childNodes.length, 1, 'old content replaced');
  assert.equal(responseErrors, 0, 'no responseError when isError is set to false');
});

test('control: without the override a 5xx raises responseError and does not swap', async () => {
  respond.own = send(500, 'server error');
  const { window, document } = await env('<div id="a">a</div><button id="go" hx-get="/x" hx-target="#a">go</button>');
  let responseErrors = 0;
  document.addEventListener('htmx:responseError', () => responseErrors++);
  click(window, document.getElementById('go'));
  await until(() => responseErrors > 0);
  assert.equal(document.getElementById('a').textContent, 'a');
});

test('htmx:validateUrl fires for cross-origin requests when selfRequestsOnly is false, and preventDefault cancels', async () => {
  respond.remote = send(200, '<p>remote</p>');
  const { window, document } = await env(`<div id="a">a</div><button id="go" hx-get="http://localhost:${remotePort}/x" hx-target="#a">go</button>`);
  const urls = [];
  document.addEventListener('htmx:validateUrl', (e) => {
    urls.push({ origin: e.detail.url.origin, sameHost: e.detail.sameHost });
    e.preventDefault();
  });
  click(window, document.getElementById('go'));
  await tick(300);
  assert.deepEqual(urls, [{ origin: `http://localhost:${remotePort}`, sameHost: false }]);
  assert.equal(hits.remote.length, 0, 'the cancelled request never reached the network');
});

test('htmx focuses an [autofocus] element in newly swapped content on settle', async () => {
  respond.own = send(200, '<div><p id="f" tabindex="-1" autofocus>result</p></div>');
  const { window, document } = await env('<div id="t"><button id="b" hx-get="/x" hx-target="#t" hx-swap="innerHTML">go</button></div>');
  let settled = false;
  document.addEventListener('htmx:afterSettle', () => (settled = true));
  click(window, document.getElementById('b'));
  await until(() => settled);
  await tick(50);
  assert.equal(document.activeElement?.id, 'f');
});

test('htmx:afterSettle targets the NEW element after an outerHTML swap (what the bridge mounts)', async () => {
  respond.own = send(200, '<section id="fresh" class="n">fresh</section>');
  const { window, document } = await env('<section id="old"><button id="b" hx-get="/x" hx-target="#old" hx-swap="outerHTML">go</button></section>');
  const events = [];
  document.addEventListener('htmx:afterSwap', (e) => events.push(['afterSwap.detail.target', e.detail.target.id, e.detail.target.isConnected]));
  document.addEventListener('htmx:afterSettle', (e) => events.push(['afterSettle.target', e.target.id, e.target.isConnected]));
  click(window, document.getElementById('b'));
  await until(() => events.length >= 2);
  assert.deepEqual(events, [['afterSwap.detail.target', 'old', false], ['afterSettle.target', 'fresh', true]]);
});

// ── the real extension + adapter against a fake provider ──
const FORM = (action) => `<form id="f" method="post" action="${action}" hx-post="${action}" hx-ext="offsite-form" hx-target="this" hx-swap="outerHTML" hx-disabled-elt="find button[type='submit']">
  <input name="email" value="a@b.co"><input type="text" name="_gotcha" value="">
  <button type="submit">Send</button>
  <div role="status" data-form-status></div>
  <template data-offsite="success"><div id="ok"><p id="ok-msg" tabindex="-1" autofocus>Thanks</p></div></template>
  <template data-offsite="error"><div id="bad"><p id="bad-msg" tabindex="-1" autofocus>Failed</p><ul data-offsite-errors></ul></div></template>
</form>`;

async function formEnv() {
  const e = await env(FORM(`http://localhost:${remotePort}/f/abc`));
  // The extension is provider-agnostic; point the Formspree adapter at the fake origin.
  const adapter = { ...createFormspreeAdapter(), matches: (url) => url.origin === `http://localhost:${remotePort}` };
  e.htmx.defineExtension('offsite-form', createOffsiteFormExtension({ htmx: e.htmx, adapters: [adapter], messages: { network: 'NET' }, document: e.document }));
  e.htmx.process(e.document.body);
  return e;
}
const submit = (window, document) => document.getElementById('f').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));

test('extension e2e: success replaces the form, focus lands on the result, request carries no custom headers', async () => {
  respond.remote = send(200, '{"ok":true}', 'application/json');
  const { window, document } = await formEnv();
  submit(window, document);
  await until(() => document.getElementById('ok'));
  await tick(50);
  assert.equal(document.getElementById('f'), null);
  assert.equal(document.activeElement?.id, 'ok-msg');
  // htmx registers xhr.upload listeners on every request, which per the Fetch spec forces a
  // CORS preflight even for an otherwise simple request. Stripping HX-* matters because the
  // preflight must not ask the provider to allow any custom header.
  const preflights = hits.remote.filter((h) => h.method === 'OPTIONS');
  assert.ok(preflights.length <= 1);
  for (const p of preflights) {
    assert.equal(p.headers['access-control-request-headers'], undefined, 'preflight asks for no custom headers');
    assert.equal(p.headers['access-control-request-method'], 'POST');
  }
  const [req, ...rest] = hits.remote.filter((h) => h.method !== 'OPTIONS');
  assert.deepEqual(rest, [], 'exactly one real request');
  assert.equal(req.method, 'POST');
  assert.equal(req.headers.accept, 'application/json');
  assert.equal(req.headers['content-type'], 'application/x-www-form-urlencoded');
  assert.deepEqual(Object.keys(req.headers).filter((h) => h.startsWith('hx-')), []);
  assert.equal(req.body, 'email=a%40b.co&_gotcha=');
});

test('extension e2e: a 422 keeps the form and its input, fills the status region, focuses the message', async () => {
  respond.remote = send(422, '{"errors":[{"field":"email","message":"<b>bad</b>"}]}', 'application/json');
  const { window, document } = await formEnv();
  let responseErrors = 0;
  document.addEventListener('htmx:responseError', () => responseErrors++);
  submit(window, document);
  await until(() => document.getElementById('bad'));
  await tick(50);
  assert.ok(document.getElementById('f'), 'form kept');
  assert.equal(document.querySelector('[name=email]').value, 'a@b.co', 'input kept');
  assert.equal(document.querySelector('[data-form-status] li').textContent, '<b>bad</b>');
  assert.equal(document.querySelector('[data-form-status] b'), null);
  assert.equal(document.activeElement?.id, 'bad-msg');
  assert.equal(responseErrors, 0);
  assert.equal(document.querySelector('button[type=submit]').disabled, false, 're-enabled so the user can send again');
});

test('extension e2e: a network failure renders the error template with the network message', async () => {
  const { window, document } = await formEnv();
  // Nothing listens on this port any more.
  const dead = http.createServer();
  const port = await listen(dead);
  await new Promise((r) => dead.close(r));
  const form = document.getElementById('f');
  form.setAttribute('hx-post', `http://localhost:${port}/f/abc`);
  const adapter = { ...createFormspreeAdapter(), matches: () => true };
  window.htmx.defineExtension('offsite-form', createOffsiteFormExtension({ htmx: window.htmx, adapters: [adapter], messages: { network: 'NET' }, document }));
  window.htmx.process(form);
  submit(window, document);
  await until(() => document.querySelector('[data-form-status] li'), 4000);
  assert.equal(document.querySelector('[data-form-status] li').textContent, 'NET');
  assert.ok(document.getElementById('f'));
});
