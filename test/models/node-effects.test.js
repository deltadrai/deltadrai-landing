import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNodeEffectsModel } from '../../src/js/models/node-effects.js';

/** Deterministic LCG in [0, 1). */
function seeded(seed = 1) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const run = (m, from, to, step = 0.1) => {
  for (let t = from; t <= to; t += step) m.advance(t);
};

test('heating nodes spawn, never exceed the cap and stay inside the grid', () => {
  const m = createNodeEffectsModel({ random: seeded(7), cols: 20, rows: 12 });
  for (let t = 0; t < 60; t += 0.1) {
    m.advance(t);
    assert.ok(m.heatingNodes.length <= 10);
    for (const n of m.heatingNodes) {
      assert.ok(n.i >= 0 && n.i <= 20 && n.j >= 0 && n.j <= 12);
      assert.ok(n.glowAlpha >= 0 && n.glowAlpha <= 1);
    }
  }
});

test('a heating node ramps its glow up to 1, holds, and some nodes blink to "computing"', () => {
  const m = createNodeEffectsModel({ random: seeded(3) });
  let sawPartial = false;
  let sawFull = false;
  let sawComputing = false;
  for (let t = 0; t < 40; t += 0.05) {
    m.advance(t);
    for (const n of m.heatingNodes) {
      if (n.glowAlpha > 0 && n.glowAlpha < 1) sawPartial = true;
      if (n.glowAlpha === 1) sawFull = true;
      if (n.computing) sawComputing = true;
    }
  }
  assert.deepEqual([sawPartial, sawFull, sawComputing], [true, true, true]);
});

test('circular nodes never overlap a heating node and run one at a time', () => {
  const m = createNodeEffectsModel({ random: seeded(11), cols: 12, rows: 10 });
  for (let t = 0; t < 120; t += 0.1) {
    m.advance(t);
    assert.ok(m.circularNodes.length <= 1);
    for (const c of m.circularNodes) {
      assert.ok(!m.heatingNodes.some((h) => h.i === c.i && h.j === c.j));
    }
  }
});

test('setGrid with a new resolution drops in-flight lifecycles; same resolution keeps them', () => {
  const m = createNodeEffectsModel({ random: seeded(5), cols: 10, rows: 8 });
  run(m, 0, 3);
  assert.ok(m.heatingNodes.length > 0);
  m.setGrid(10, 8);
  assert.ok(m.heatingNodes.length > 0, 'unchanged grid keeps nodes');
  m.setGrid(30, 20);
  assert.equal(m.heatingNodes.length, 0);
  assert.equal(m.circularNodes.length, 0);
});
