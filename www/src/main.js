/**
 * Composition root (IoC). All instances are created and wired here;
 * no build step, loaded directly as an ES module by index.html.
 *
 * Modules stay free of direct window/document access — the browser globals are
 * resolved here and injected (per docs/architecture.md).
 */
import { WaveField } from './waveField.js';

const canvas = document.getElementById('waves');
const field = new WaveField(canvas, window);
field.start();
