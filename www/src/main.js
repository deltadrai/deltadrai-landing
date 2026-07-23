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
import { FormspreeClient } from './formspreeClient.js';
import { createWaitlistViewModel } from './waitlistViewModel.js';

// Adapter over the real window (the single point of contact with a browser global).
const domAdapter = new DomAdapter(window);

// Factories: how the ViewModel obtains a fresh Model and a canvas-bound renderer.
// WaveField derives its own grid resolution from the viewport (see
// waveField.js#setViewport); the ViewModel keeps NodeEffects' grid in sync so
// heating/circular nodes line up with the wave's grid intersections.
const createField = () => new WaveField();
const createEffects = () => new NodeEffects();
const createRenderer = (canvas) => new CanvasRenderer(canvas);

// Bind the ViewModel to Alpine's `x-data="waveFieldViewModel"`.
Alpine.data('waveFieldViewModel', () =>
  createWaveFieldViewModel({ dom: domAdapter, createField, createEffects, createRenderer }),
);

// Coming-soon waitlist form: posts the visitor's email to Formspree, alongside
// a fixed staff-facing lead notice the visitor never sees or edits.
const FORMSPREE_ENDPOINT = 'https://formspree.io/f/mlgqwgzz';
const WAITLIST_STAFF_MESSAGE =
  'New lead: a visitor joined the deltadr.ai waitlist from the coming-soon page.';
const formspreeClient = new FormspreeClient(window.fetch.bind(window), FORMSPREE_ENDPOINT);

// Bind the ViewModel to Alpine's `x-data="waitlistViewModel"`.
Alpine.data('waitlistViewModel', () =>
  createWaitlistViewModel({ client: formspreeClient, staffMessage: WAITLIST_STAFF_MESSAGE }),
);

window.Alpine = Alpine;
Alpine.start();
