import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWaveBackdropViewModel } from '../../src/js/viewmodels/wave-backdrop.js';

function setup({ reduced = false, grids = [{ cols: 10, rows: 8 }] } = {}) {
  const calls = [];
  let gridIndex = 0;
  const canvas = { id: 'canvas' };
  const field = {
    width: 0,
    height: 0,
    cols: 10,
    rows: 8,
    points: [[{}]],
    gridFor: () => grids[Math.min(gridIndex, grids.length - 1)],
    setViewport(w, h) {
      this.width = w;
      this.height = h;
      const g = grids[Math.min(gridIndex, grids.length - 1)];
      this.cols = g.cols;
      this.rows = g.rows;
      calls.push('setViewport');
    },
    advance: (t) => calls.push(`field.advance:${t}`),
  };
  const effects = {
    heatingNodes: [],
    circularNodes: [],
    setGrid: (c, r) => calls.push(`setGrid:${c}x${r}`),
    advance: () => calls.push('effects.advance'),
  };
  const renderer = {
    resize: (w, h, p) => calls.push(`resize:${w}x${h}@${p}`),
    draw: () => calls.push('draw'),
  };
  const ticks = { cb: null, stopped: false };
  const vm = createWaveBackdropViewModel({
    viewport: { width: 1000, height: 700, pixelRatio: 2 },
    ticker: { add: (cb) => ((ticks.cb = cb), () => (ticks.stopped = true)), now: () => 42 },
    transition: async (name, el) => {
      assert.equal(el, canvas);
      calls.push(name);
    },
    prefersReduced: () => reduced,
    createField: () => field,
    createEffects: () => effects,
    createRenderer: (c) => (assert.equal(c, canvas), renderer),
  });
  vm.$refs = { canvas };
  return { vm, calls, ticks, nextGrid: () => gridIndex++ };
}

test('init builds the pieces, paints once and starts the ticker', () => {
  const { vm, calls, ticks } = setup();
  vm.init();
  assert.deepEqual(calls.slice(0, 3), ['resize:1000x700@2', 'setViewport', 'setGrid:10x8']);
  assert.ok(calls.includes('draw'));
  assert.equal(typeof ticks.cb, 'function');
  ticks.cb(5);
  assert.ok(calls.includes('field.advance:5'));
});

test('reduced motion: one static frame at t=0 and no ticker', () => {
  const { vm, calls, ticks } = setup({ reduced: true });
  vm.init();
  assert.equal(ticks.cb, null);
  assert.ok(calls.includes('field.advance:0'));
});

test('destroy stops the ticker', () => {
  const { vm, ticks } = setup();
  vm.init();
  vm.destroy();
  assert.equal(ticks.stopped, true);
});

test('a resize that keeps the grid does not fade', async () => {
  const { vm, calls } = setup();
  vm.init();
  calls.length = 0;
  await vm.sync();
  assert.ok(!calls.includes('canvas-fade-out'));
  assert.ok(calls.includes('draw'));
});

test('a grid-changing resize fades out, rebuilds, then fades in', async () => {
  const { vm, calls, nextGrid } = setup({ grids: [{ cols: 10, rows: 8 }, { cols: 30, rows: 20 }] });
  vm.init();
  calls.length = 0;
  nextGrid();
  await vm.sync();
  const order = ['canvas-fade-out', 'resize:1000x700@2', 'setViewport', 'setGrid:30x20', 'draw', 'canvas-fade-in'];
  let at = -1;
  for (const step of order) {
    const i = calls.indexOf(step, at + 1);
    assert.ok(i > at, `${step} after previous step (calls: ${calls})`);
    at = i;
  }
});

test('syncs requested during a fade are coalesced into one extra pass', async () => {
  const { vm, calls, nextGrid } = setup({ grids: [{ cols: 10, rows: 8 }, { cols: 30, rows: 20 }] });
  vm.init();
  calls.length = 0;
  nextGrid();
  const first = vm.sync(); // grid changed: parks at the fade-out
  vm.sync();
  vm.sync();
  await first;
  assert.equal(calls.filter((c) => c.startsWith('resize:')).length, 2);
});
