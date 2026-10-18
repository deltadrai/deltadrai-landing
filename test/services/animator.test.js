import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createAnimator } from '../../src/js/services/animator.js';

/** A fake gsap whose matchMedia contexts run synchronously and record reverts. */
function fakeGsap({ reduced = false } = {}) {
  const log = { contexts: [], sets: [], tweens: [] };
  return {
    log,
    set: (t, v) => (log.sets.push([t, v]), { then: (r) => r() }),
    to: (t, v) => (log.tweens.push(['to', t, v]), Promise.resolve()),
    matchMedia(scope) {
      const ctx = { scope, reverted: false, revert() { this.reverted = true; } };
      log.contexts.push(ctx);
      ctx.add = (conditions, fn) => fn({ conditions: { reduced, full: !reduced } });
      return ctx;
    },
  };
}

const motion = (reduced = false) => ({ conditions: { reduced: 'r', full: 'f' }, prefersReduced: () => reduced, saveData: () => false });

function setup({ reduced = false, debug = false } = {}) {
  const dom = new JSDOM('<main id="a"><p data-anim="x"></p><p data-anim="x"></p><p data-anim="nope"></p><section id="inner"><i data-anim="x"></i></section></main>');
  const gsap = fakeGsap({ reduced });
  const setups = [];
  const animator = createAnimator({
    gsap,
    presets: [{ name: 'x', setup: (targets, c) => setups.push({ n: targets.length, reduced: c.reduced, gsap: c.gsap }) }],
    transitions: [{ name: 't', run: (el, c) => (setups.push({ t: el.id, reduced: c.reduced, options: c.options }), Promise.resolve()) }],
    motion: motion(reduced),
    debug,
  });
  return { dom, gsap, setups, animator, root: dom.window.document.getElementById('a') };
}

test('mount groups [data-anim] elements per preset and hands the preset gsap + reduced', () => {
  const { gsap, setups, animator, root } = setup();
  animator.mount(root);
  assert.equal(gsap.log.contexts.length, 1);
  assert.deepEqual(setups, [{ n: 3, reduced: false, gsap }]);
});

test('mount includes the root itself when it carries data-anim', () => {
  const { dom, setups, animator } = setup();
  const el = dom.window.document.createElement('div');
  el.dataset.anim = 'x';
  animator.mount(el);
  assert.equal(setups[0].n, 1);
});

test('mount passes the live reduced flag', () => {
  const { setups, animator, root } = setup({ reduced: true });
  animator.mount(root);
  assert.equal(setups[0].reduced, true);
});

test('unknown presets fail soft and only warn in debug', () => {
  const warnings = [];
  const original = console.warn;
  console.warn = (m) => warnings.push(m);
  try {
    setup().animator.mount(setup().root);
    assert.deepEqual(warnings, []);
    const d = setup({ debug: true });
    d.animator.mount(d.root);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /nope/);
  } finally {
    console.warn = original;
  }
});

test('mounting a root without data-anim creates no context', () => {
  const { dom, gsap, animator } = setup();
  animator.mount(dom.window.document.createElement('div'));
  assert.equal(gsap.log.contexts.length, 0);
});

test('unmount reverts contexts at or inside the root, and re-mount reverts the old one', () => {
  const { dom, gsap, animator, root } = setup();
  const inner = dom.window.document.getElementById('inner');
  inner.dataset.anim = 'x';
  animator.mount(inner);
  animator.mount(root);
  const [innerCtx, rootCtx] = gsap.log.contexts;
  assert.equal(innerCtx.reverted, true, 'mounting a container supersedes nested contexts');
  assert.equal(rootCtx.reverted, false);
  animator.unmount(root);
  assert.deepEqual([innerCtx.reverted, rootCtx.reverted], [true, true]);

  animator.mount(root);
  animator.mount(root);
  assert.equal(gsap.log.contexts.at(-2).reverted, true);
  assert.equal(gsap.log.contexts.at(-1).reverted, false);
});

test('transition runs the named preset with options and resolves; unknown names resolve quietly', async () => {
  const { dom, setups, animator } = setup();
  const el = dom.window.document.getElementById('a');
  await animator.transition('t', el, { a: 1 });
  assert.deepEqual(setups.at(-1), { t: 'a', reduced: false, options: { a: 1 } });
  await animator.transition('missing', el);
});
