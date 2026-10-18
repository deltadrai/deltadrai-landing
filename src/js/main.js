// @ts-check
// src/js/main.js — composition root. The ONLY module that imports concrete
// implementations, touches globals, and creates objects.

// ── Vendor (copied to /vendor by the build; imported by path, no import map) ──
import Alpine from '/vendor/alpinejs/module.esm.js';
import htmx from '/vendor/htmx/htmx.esm.js';
import gsap from '/vendor/gsap/index.js';

// ── App modules (factories and definitions only, no side effects on import) ──
import { config } from './config.js';
import { decode } from './lib/decode.js';
import { createMotionPolicy } from './services/motion-policy.js';
import { createViewport } from './services/viewport.js';
import { createTicker } from './services/ticker.js';
import { createRequestPolicy } from './services/request-policy.js';
import { createAnimator } from './services/animator.js';
import { createHtmxBridge } from './services/htmx-bridge.js';
import { createCanvasRenderer } from './services/canvas-renderer.js';
import { createOffsiteFormExtension } from './extensions/offsite-form.js';
import { createFormspreeAdapter } from './adapters/formspree.js';
import { revealPresets } from './animations/presets/index.js';
import { transitionPresets } from './animations/transitions/index.js';
import { createWaveFieldModel } from './models/wave-field.js';
import { createNodeEffectsModel } from './models/node-effects.js';
import { createWaveBackdropViewModel } from './viewmodels/wave-backdrop.js';
import { createContactViewModel } from './viewmodels/contact.js';
import { createSiteNavViewModel } from './viewmodels/site-nav.js';

// ── 1. Configure vendor ──
gsap.defaults({ ease: config.motion.ease, duration: config.motion.duration });
Object.assign(htmx.config, config.htmx);

// ── 2. Services ──
const motion = createMotionPolicy({
  matchMedia: (q) => window.matchMedia(q),
  connection: /** @type {any} */ (navigator).connection,
});
const viewport = createViewport({ window });
const ticker = createTicker({ gsap });
const requestPolicy = createRequestPolicy({
  ownOrigin: window.location.origin,
  allowedOrigins: config.offsite.allowedOrigins,
});
const animator = createAnimator({
  gsap,
  presets: revealPresets,
  transitions: transitionPresets,
  motion,
  debug: config.debug,
});
const transition = animator.transition; // ISP: ViewModels get only this capability

// ── 3. htmx extension for off-site services (OCP: add adapters, not code) ──
htmx.defineExtension(
  'offsite-form',
  createOffsiteFormExtension({
    htmx,
    adapters: [createFormspreeAdapter()],
    messages: config.messages.offsite,
    document,
  }),
);

// ── 4. ViewModels (Alpine calls these factories once per component instance) ──
Alpine.data('waveBackdrop', () =>
  createWaveBackdropViewModel({
    viewport,
    ticker,
    transition,
    prefersReduced: motion.prefersReduced,
    createField: () => createWaveFieldModel(),
    createEffects: () => createNodeEffectsModel({ random: Math.random }),
    createRenderer: (canvas) => createCanvasRenderer({ canvas, colors: config.wave.colors }),
  }),
);
Alpine.data('contact', () => createContactViewModel({ contact: config.contact, decode }));
Alpine.data('siteNav', () =>
  createSiteNavViewModel({ currentPath: () => window.location.pathname }),
);

// ── 5. Lifecycle wiring ──
createHtmxBridge({
  animator,
  allowsUrl: requestPolicy.allows,
  document,
  selectors: config.selectors,
  messages: config.messages.fragment,
}).start();

// ── 6. Boot ──
Alpine.start();
for (const sel of config.selectors.mountRoots) {
  const root = document.querySelector(sel);
  if (root) animator.mount(root);
}
document.documentElement.dataset.app = 'ready';
