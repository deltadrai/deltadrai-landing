// @ts-check
// src/js/animations/transitions/index.js
import { canvasFadeIn, canvasFadeOut } from './canvas-fade.js';
import { pageIn, pageOut } from './page.js';

export const transitionPresets = Object.freeze([canvasFadeOut, canvasFadeIn, pageOut, pageIn]);
