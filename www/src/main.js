/**
 * Composition root (IoC). All instances/factories are created and wired here;
 * no build step, loaded directly as an ES module by index.html. Modules stay
 * free of direct window/document access — the browser globals are resolved here
 * and injected behind adapters (per docs/architecture.md).
 */
import Alpine from 'https://cdn.jsdelivr.net/npm/alpinejs@3.14.1/dist/module.esm.js';
import { DomAdapter } from './domAdapter.js';
import { WaveField } from './waveField.js';
import { CanvasRenderer } from './canvasRenderer.js';
import { createWaveFieldViewModel } from './waveFieldViewModel.js';

// Adapter over the real window (the single point of contact with a browser global).
const domAdapter = new DomAdapter(window);

// Factories: how the ViewModel obtains a fresh Model and a canvas-bound renderer.
const createField = () => new WaveField({ cols: 48, rows: 30 });
const createRenderer = (canvas) => new CanvasRenderer(canvas);

// Bind the ViewModel to Alpine's `x-data="waveFieldViewModel"`.
Alpine.data('waveFieldViewModel', () =>
  createWaveFieldViewModel({ dom: domAdapter, createField, createRenderer }),
);

window.Alpine = Alpine;
Alpine.start();
