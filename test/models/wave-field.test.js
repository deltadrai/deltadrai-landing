import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWaveFieldModel } from '../../src/js/models/wave-field.js';

test('gridFor derives resolution from the viewport and clamps it', () => {
  const m = createWaveFieldModel();
  assert.deepEqual(m.gridFor(1280, 800), { cols: 33, rows: 22 });
  assert.deepEqual(m.gridFor(10, 10), { cols: 10, rows: 8 }, 'lower bound');
  assert.deepEqual(m.gridFor(99999, 99999), { cols: 90, rows: 60 }, 'upper bound');
});

test('gridFor is pure; setViewport commits', () => {
  const m = createWaveFieldModel();
  const before = { cols: m.cols, rows: m.rows };
  m.gridFor(1280, 800);
  assert.deepEqual({ cols: m.cols, rows: m.rows }, before);
  m.setViewport(1280, 800);
  assert.deepEqual({ cols: m.cols, rows: m.rows, w: m.width, h: m.height }, { cols: 33, rows: 22, w: 1280, h: 800 });
});

test('advance yields (rows+1) x (cols+1) points, fading to nothing at the horizon', () => {
  const m = createWaveFieldModel();
  m.setViewport(800, 600);
  m.advance(1.5);
  assert.equal(m.points.length, m.rows + 1);
  assert.ok(m.points.every((row) => row.length === m.cols + 1));
  assert.equal(m.points[0][0].alpha, 0);
  assert.equal(m.points.at(-1)[0].alpha, 1);
});

test('advance is deterministic for a given time and viewport', () => {
  const a = createWaveFieldModel();
  const b = createWaveFieldModel();
  for (const m of [a, b]) {
    m.setViewport(640, 480);
    m.advance(3);
  }
  assert.deepEqual(a.points, b.points);
});
