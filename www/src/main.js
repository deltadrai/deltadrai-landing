/**
 * Composition root (IoC). All instances/factories are created and wired here;
 * no build step, loaded directly as an ES module by index.html. Modules stay
 * free of direct window/document access — the browser globals are resolved here
 * and injected behind adapters (per docs/architecture.md).
 */
import Alpine from 'https://cdn.jsdelivr.net/npm/alpinejs@3.14.1/dist/module.esm.js';
import { DomAdapter } from './domAdapter.js';
import { WaveField } from './waveField.js';
import { NodeEffects } from './nodeEffects.js';
import { CanvasRenderer } from './canvasRenderer.js';
import { createWaveFieldViewModel } from './waveFieldViewModel.js';

// Adapter over the real window (the single point of contact with a browser global).
const domAdapter = new DomAdapter(window);

// Grid dimensions shared by the wave geometry and the independent node-effects
// layer, so heating/circular nodes line up with the wave's grid intersections.
const GRID_COLS = 48;
const GRID_ROWS = 30;

// Factories: how the ViewModel obtains a fresh Model and a canvas-bound renderer.
const createField = () => new WaveField({ cols: GRID_COLS, rows: GRID_ROWS });
const createEffects = () => new NodeEffects({ cols: GRID_COLS, rows: GRID_ROWS });
const createRenderer = (canvas) => new CanvasRenderer(canvas);

// Bind the ViewModel to Alpine's `x-data="waveFieldViewModel"`.
Alpine.data('waveFieldViewModel', () =>
  createWaveFieldViewModel({ dom: domAdapter, createField, createEffects, createRenderer }),
);

window.Alpine = Alpine;
Alpine.start();
