import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createViewport } from '../../src/js/services/viewport.js';
import { createTicker } from '../../src/js/services/ticker.js';

test('viewport reads live values and caps the pixel ratio at 2', () => {
  const win = { innerWidth: 100, innerHeight: 50, devicePixelRatio: 3 };
  const v = createViewport({ window: win });
  assert.deepEqual([v.width, v.height, v.pixelRatio], [100, 50, 2]);
  win.innerWidth = 200;
  win.devicePixelRatio = 0;
  assert.deepEqual([v.width, v.pixelRatio], [200, 1]);
});

test('ticker adds/removes the same listener on gsap.ticker and reports its clock', () => {
  const listeners = new Set();
  const gsap = { ticker: { time: 12, add: (l) => listeners.add(l), remove: (l) => listeners.delete(l) } };
  const ticker = createTicker({ gsap });
  const seen = [];
  const stop = ticker.add((t) => seen.push(t));
  for (const l of listeners) l(1.5);
  assert.deepEqual(seen, [1.5]);
  assert.equal(ticker.now(), 12);
  stop();
  assert.equal(listeners.size, 0);
});
