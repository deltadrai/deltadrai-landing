/**
 * Composition root (IoC). All instances are created and wired here;
 * no build step, loaded directly as an ES module by index.html.
 */
import Alpine from 'https://cdn.jsdelivr.net/npm/alpinejs@3.14.1/dist/module.esm.js';
import { indexViewModel } from './index.js';

window.Alpine = Alpine;

Alpine.data('indexViewModel', indexViewModel);

Alpine.start();
