// @ts-check
// src/js/config.js — frozen configuration. Holds no navigation URLs: the only URLs
// here are the off-site origin allowlist, which is a security policy (keep it in
// sync with the CSP in _includes/head-security.html).

export const config = Object.freeze({
  debug: false,

  motion: Object.freeze({
    ease: 'power2.out',
    duration: 0.4,
    // Must stay >= the page-out transition and equal to the `swap:300ms` on boosted containers.
    pageMs: 300,
  }),

  htmx: Object.freeze({
    selfRequestsOnly: false, // off-site services allowed, but ONLY via the allowlist
    allowEval: false, // no hx-on / js: expressions; behaviour lives in Alpine
    allowScriptTags: false, // fragments never carry scripts
    includeIndicatorStyles: false, // indicators are styled with Tailwind
    historyCacheSize: 0, // architecture D7
    refreshOnHistoryMiss: true,
    scrollIntoViewOnBoost: true,
    defaultSwapStyle: 'innerHTML',
  }),

  offsite: Object.freeze({
    allowedOrigins: Object.freeze(['https://formspree.io']), // security policy, not navigation
  }),

  selectors: Object.freeze({
    mountRoots: Object.freeze(['#page']),
    page: '#page',
    pageHeading: '#page h1',
    offsiteForm: '[hx-ext~="offsite-form"]',
    fragmentStatus: '[data-fragment-status]',
  }),

  messages: Object.freeze({
    offsite: Object.freeze({
      network: 'No connection to the form service. Check your internet connection and send again.',
    }),
    fragment: Object.freeze({
      failed: 'This page could not be loaded. Select the link again to retry.',
    }),
  }),

  // RGB triplets ("r, g, b") consumed by the canvas renderer.
  wave: Object.freeze({
    colors: Object.freeze({
      mesh: '127, 180, 168',
      heating: '238, 175, 106',
      compute: '116, 139, 151',
      circular: '160, 219, 182',
    }),
  }),

  // The company's legally mandated contact details, stored as code-point offsets
  // (see lib/decode.js) instead of string literals so that neither the served HTML
  // nor this module's source contains a harvestable address or e-mail. The
  // `contact` ViewModel decodes them at runtime and Alpine writes them into the
  // DOM via x-text, which keeps them real, selectable, screen-reader-readable text
  // for humans while staying invisible to crawlers that only regex the raw
  // response body. This is obfuscation, not security: a scraper driving a
  // headless browser still reads the rendered text. It defeats the common
  // harvester that greps HTML for `mailto:` and `\S+@\S+`, which is why no
  // `mailto:` link exists anywhere on the site.
  contact: Object.freeze({
    company: Object.freeze([123, 124, 131, 139, 120, 123, 137, 120, 128, 55, 94, 132, 121, 95]),
    street: Object.freeze([
      88, 123, 120, 131, 121, 124, 137, 139, 68, 106, 139, 128, 125, 139, 124, 137, 68, 106, 139,
      137, 120, 246, 124, 55, 75,
    ]),
    city: Object.freeze([
      75, 78, 72, 71, 55, 94, 137, 128, 124, 138, 130, 128, 137, 122, 127, 124, 133,
    ]),
    country: Object.freeze([237, 138, 139, 124, 137, 137, 124, 128, 122, 127]),
    // Split so that not even a decoded-but-unjoined dump yields a full address.
    emailLocal: Object.freeze([128, 132, 135, 137, 124, 138, 138, 140, 132]),
    emailDomain: Object.freeze([123, 124, 131, 139, 120, 123, 137, 69, 120, 128]),
  }),
});
