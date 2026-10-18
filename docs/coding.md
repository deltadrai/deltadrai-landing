# Coding guidelines

These are the coding rules for this project. The overall structure is described in
[architecture.md](./architecture.md), and the visual and interaction specification is in
[site.md](./site.md). Where the two disagree, architecture.md wins for structure and
site.md wins for look and behaviour.

---

## 1. General JavaScript (ES2022 modules)

### Modules and files
- Every file in `src/js/` is a native ES module, except `boot.js`.
- Put `// @ts-check` at the top of every module and type public functions with JSDoc.
- File names use kebab-case (`ambient-video.js`).
- Use named exports only. Do not use default exports in app code.
- Aim for one exported factory per file and fewer than ~120 lines per file. If a file
  outgrows that, it probably has more than one responsibility.
- **No side effects on import.** A module may only declare things: functions, constants
  and frozen definition objects. Listeners, timers, DOM access and `fetch` only happen
  inside functions that are called from `main.js`.

### Factories and dependency injection
- Name factories `create<Thing>(deps)`. A factory takes a single destructured
  dependencies object and returns a plain object.
- Prefer closures over classes.
- Freeze returned service objects (`Object.freeze`). Do not freeze ViewModels, because
  Alpine needs to make them reactive.
- **Only `main.js` imports concrete implementations, vendor libraries and globals.**
  Every other module gets `window`, `document`, `gsap`, `htmx`, timers and similar
  through its deps. Importing `lib/` helpers and JSDoc types is allowed everywhere.
- Inject the narrowest dependency that works. For example, a ViewModel that only needs
  to animate gets `transition`, not `animator`.
- Do not use service locators, singletons or module-level mutable state.

### Style
- Use `const` by default and `let` only when a binding really changes. Never use `var`.
- Use early returns, `?.` and `??`. Avoid nested ternaries.
- Use `async`/`await` for anything asynchronous, including GSAP animations, which are
  thenable. Do not chain `.then()` in app code.
- Errors:
  - Services fail soft. For example, an unknown preset name produces a
    `console.warn` when `config.debug` is on and otherwise does nothing.
  - A failure must never hide content. The `boot.js` failsafe is the last line of
    defence.
- Do not leave `console.log` in committed code. Log through `if (debug)` only where it is
  injected.
- Write comments that explain *why*. Code shows *what*.

## 2. `main.js` (composition root)
- This is the only place that:
  - calls factories;
  - registers GSAP plugins;
  - defines htmx extensions (`htmx.defineExtension`);
  - assigns `htmx.config`;
  - registers `Alpine.data` components;
  - calls `Alpine.start()`.
- It is a flat list of steps: configure vendors → services → ViewModels → lifecycle →
  boot. It contains no branching on UI behaviour.
- Every `Alpine.data(name, factory)` closure builds that component's dependencies,
  including its Model, from what `main.js` has already created.
- When a ViewModel gains a new dependency, change its factory signature and the single
  registration line here. Nothing else should need to change.

## 3. MVVM rules

### View (HTML)
- The View contains semantic HTML, Tailwind classes and declarative attributes only.
- Do not use inline `<script>` or `style=""` attributes. Each `.html` page is allowed
  exactly two script tags: `boot.js` and `main.js`.
- **Bindings reference ViewModel members only:**
  - Good: `@click="toggle()"`, `:aria-expanded="isOpen"`, `x-text="label"`.
  - Bad: `@click="open = !open; $refs.x.focus()"`, `:class="i === index ? 'a' : 'b'"`.

  Put logic like that in a ViewModel getter or method. This keeps Views testable through
  their ViewModel and keeps the Alpine CSP build an option.
- `x-data` always names a registered component, for example `x-data="carousel(6)"`.
  Never write an object literal in `x-data`.
- `data-anim="<preset>"` selects a reveal preset. Preset options go in
  `data-anim-<option>` attributes, for example `data-anim-stagger="0.08"`.
- Use one `<h1>` per page and keep the heading levels in order. Eyebrow labels are `<p>`
  elements, not headings.

### ViewModel (`src/js/viewmodels/`)
- A ViewModel holds UI state and exposes commands and getters to the View.
- It can only reach the DOM through its own `this.$el` and `this.$refs`.
- If it allocates anything (watchers, listeners), it must implement `init()` for setup
  and `destroy()` for cleanup.
- It must not import vendor libraries or create services.
- It must not hold URLs, call `fetch`, or read `location.search`. Data and next actions
  arrive as hypermedia (§5.2).

```js
// @ts-check
// src/js/viewmodels/dialog.js
/**
 * Shared by the content dialog and the mobile off-canvas menu; only the
 * transition names differ.
 * @param {{ transition: import('../contracts.js').Transition, enter: string, leave: string }} deps
 */
export function createDialogViewModel({ transition, enter, leave }) {
  return {
    isOpen: false,

    async open() {
      if (this.isOpen) return;
      this.$refs.dialog.showModal();
      this.isOpen = true;
      await transition(enter, this.$refs.panel);
    },

    async close() {
      if (!this.isOpen) return;
      await transition(leave, this.$refs.panel);
      this.$refs.dialog.close();
      this.isOpen = false;
    },

    /** Esc key: run the exit animation instead of the instant native close. */
    onCancel(/** @type {Event} */ event) {
      event.preventDefault();
      this.close();
    },
  };
}
```

```html
<!-- View (in src/_includes/dialog.html, shared by team bios and press videos) -->
<div x-data="dialog">
  <dialog x-ref="dialog" @cancel="onCancel($event)" @click.self="close()"
          class="m-auto w-full max-w-3xl bg-transparent p-4 backdrop:bg-forest-950/70">
    <div x-ref="panel" class="rounded-2xl bg-mycelium-50 p-8 text-forest-950">
      <button type="button" @click="close()" class="..." aria-label="Schließen">…</button>
      <div id="dialog-body" @htmx:after-settle="open()"></div>
    </div>
  </dialog>
</div>
```

### Model (`src/js/models/`)
- A Model is a set of pure functions over plain data. It does not touch the DOM, timers,
  globals or `this`.
- Reactive state (such as `index`) lives in the ViewModel. The Model only computes the
  next value.

```js
// @ts-check
// src/js/models/carousel.js
/** @param {{ count: number, loop?: boolean }} opts */
export function createCarouselModel({ count, loop = true }) {
  const clamp = (i) => Math.min(Math.max(i, 0), count - 1);
  const wrap = (i) => ((i % count) + count) % count;
  const norm = loop ? wrap : clamp;
  return Object.freeze({
    count,
    next: (i) => norm(i + 1),
    prev: (i) => norm(i - 1),
    goTo: (i) => norm(i),
  });
}
```

### Services (`src/js/services/`)
- A service wraps exactly one kind of side effect: animation lifecycle, htmx lifecycle,
  motion preferences or viewport visibility.
- Its public surface is the matching contract in `contracts.js`. Anything else stays
  private inside the closure.

## 4. Alpine.js
- Register every component with `Alpine.data` in `main.js`. Do not use `Alpine.store`
  unless state really is page-global and shared by several components. If you do need
  one, create it in `main.js`.
- **Do not use `x-transition`.** GSAP owns all motion.
  - For instant toggles where nothing animates (tab panels, for example), `x-show` is
    fine.
  - For anything that animates in or out, call the injected `transition()` and let GSAP
    handle `autoAlpha` and `visibility`.
- Use `x-cloak` on elements whose initial state depends on Alpine.
- Prefer `$refs` over selectors. Use `$dispatch` for communication from child to parent.
  Do not reach into sibling components.
- Use `@click.outside`, `@keydown.escape` and similar modifiers instead of hand-written
  global listeners.
- Listen for htmx events in kebab-case (`@htmx:after-settle`). htmx 2 emits kebab-case
  copies of its events specifically so they work in attribute syntax.
- Alpine initialises components inside htmx-swapped HTML automatically. Do not call
  `Alpine.initTree` yourself.
- Do not bind `hx-*` attributes dynamically (`:hx-get`). htmx does not see attribute
  changes unless `htmx.process()` is called, and this project does not do that.
- Accessibility state belongs in the ViewModel, for example `:aria-expanded="isOpen"`,
  `:aria-selected="isActive(id)"` and roving `:tabindex`.

## 5. htmx, fragments and HATEOAS

### 5.1 Configuration (set in `config.js`, applied by `main.js`)
```js
htmx: Object.freeze({
  selfRequestsOnly: false,       // off-site services allowed, but ONLY via the allowlist (5.4)
  allowEval: false,              // no hx-on / js: expressions; behaviour lives in Alpine
  allowScriptTags: false,        // fragments never carry scripts
  includeIndicatorStyles: false, // indicators are styled with Tailwind (§6)
  historyCacheSize: 0,           // architecture D7
  refreshOnHistoryMiss: true,
  scrollIntoViewOnBoost: true,
  defaultSwapStyle: 'innerHTML',
}),
offsite: Object.freeze({
  allowedOrigins: ['https://formspree.io'], // security policy, not navigation
}),
```

`selfRequestsOnly: false` is safe only because the bridge cancels every request whose
URL fails `requestPolicy.allows` on `htmx:validateUrl`. Never remove that listener.

### 5.2 HATEOAS rules
- **URLs live in hypermedia only:** `href`, `hx-get`, `hx-post` and form `action`
  attributes in HTML.
  - JavaScript never builds, concatenates, stores or reads URLs for navigation or data.
    No `` `/partials/${slug}.html` ``.
  - ViewModels hold no URLs.
  - `config.js` holds only the origin allowlist.
- **Fragments are self-describing.** Every fragment contains the controls for its legal
  next actions, and only those. Do not render a disabled "next" button on the last page.
  Leave it out.
- **The DOM is the state.** Do not keep client-side copies of server or content state. If
  something is shown, it is in the DOM because a fragment put it there.
- **Replace the control with its result** where the action is "more" or "next":
  `hx-target="this" hx-swap="outerHTML"`.
- **No query-string state.** Variants are separate fragments, for example
  `forms/investieren.html` rather than `forms/kontakt.html?topic=invest`. JavaScript
  never reads `location.search`.

### 5.3 Requests and fragments
- Our own origin: GET only, to `.html` files that exist under `src/`.
- **Every** element that makes a request declares `hx-target` and `hx-swap` explicitly.
  Do not rely on inherited `hx-*` values. `hx-ext` on a `<form>` is the one intentional
  exception: it covers the form's own request.
- Boost attributes appear only on link-only containers (architecture §8.3). Mark
  external, `mailto:`, download and anchor links with `hx-boost="false"`, or keep them
  out of boosted containers.
- **Fragment contract** (architecture §6.4):
  - a single root element;
  - no `<script>`, `<style>`, `<head>` or `<body>`;
  - the same Tailwind classes and `data-anim` hooks as pages;
  - its own next-action controls;
  - a heading with `id="dialog-title"` if it is shown in the dialog.
- Pick triggers deliberately:
  - `intersect once` for lazy panels;
  - `click` for user-requested content;
  - avoid `load`, because content needed at page load belongs in the page.
- Every lazy target shows a loading state with a `.htmx-indicator` styled through the
  `htmx-request:` variant, and a `<noscript>` note.
- Own-origin failures: the bridge listens for `htmx:responseError` and `htmx:sendError`
  on non-off-site requests and swaps in a short inline message with a retry control.
  Failures are never silent.
- Do not use `hx-push-url` for fragments. Only boosted navigation changes the URL.

### 5.4 Off-site services (Formspree and future providers)
- Off-site requests are only allowed:
  - to origins in `config.offsite.allowedOrigins`, enforced by the request policy;
  - from a `<form>` with `hx-ext="offsite-form"`.

  Nothing else may call another origin.
- **The endpoint URL lives in the markup.** Each use case gets its own Formspree form id,
  written in `hx-post` and in `action` (for the no-JavaScript fallback).
- **The extension** (`extensions/offsite-form.js`) is provider-agnostic. Its job:
  1. On `htmx:configRequest`, pick the adapter whose `matches(url)` is true. Remove all
     `HX-*` request headers, so the request is a CORS simple request. Add the adapter's
     `headers`, which must be CORS-safelisted, such as `Accept: application/json`.
  2. On `htmx:beforeSwap`, call `adapter.parse(status, body)`:
     - On `ok`: render `<template data-offsite="success">` from the form, set
       `target = form` and `swapOverride = 'outerHTML'`.
     - Otherwise: render `<template data-offsite="error">`, fill
       `[data-offsite-errors]` with one `<li>` per error, set
       `target = form.querySelector('[data-form-status]')`, `swapOverride = 'innerHTML'`
       and `isError = false`.

     In both cases set `shouldSwap = true` and `serverResponse` to the rendered HTML.
  3. On `htmx:sendError`, render the error template with `messages.network` into the
     status region via the injected `htmx.swap()`.
- **Never use `innerHTML` with provider data.** Error messages are written with
  `textContent` into cloned template nodes. Only then is the clone serialised for the
  swap.
- **Adapters** (`adapters/<provider>.js`) know the protocol and nothing about the DOM:
  `{ name, matches(url), headers, parse(status, body) → { ok, errors[] } }`. If the body
  cannot be parsed, `parse` returns `{ ok: false, errors: [] }` and the template's generic
  message applies.
- **Spam and privacy:**
  - Include the `_gotcha` honeypot (`class="hidden" tabindex="-1" autocomplete="off"`).
  - Never add CAPTCHA scripts.
  - Collect only the fields site.md lists.
  - Each form has a privacy note with a Datenschutz link.
- **Progressive enhancement:** `<form method="post" action="…">` must work with
  JavaScript disabled.

```html
<!-- src/partials/forms/beratung.html (single root) -->
<form method="post" action="https://formspree.io/f/FORM_ID"
      hx-post="https://formspree.io/f/FORM_ID" hx-ext="offsite-form"
      hx-target="this" hx-swap="outerHTML"
      hx-disabled-elt="find button[type='submit']"
      class="grid gap-6 md:grid-cols-2">
  <input type="hidden" name="_subject" value="Beratungsanfrage">
  <input type="text" name="_gotcha" class="hidden" tabindex="-1" autocomplete="off">

  <div class="grid gap-2">
    <label for="f-name" class="text-sm font-semibold">Name</label>
    <input id="f-name" name="name" required autocomplete="name" class="…">
  </div>
  <!-- … email, organisation (optional), thema, nachricht … -->

  <p class="text-sm md:col-span-2">Wir verwenden deine Angaben nur für die Antwort.
    <a href="/datenschutz/" class="underline underline-offset-4">Datenschutz</a></p>

  <div role="status" data-form-status class="min-h-6 text-sm md:col-span-2"></div>

  <button type="submit" class="…">
    Anfrage senden
    <span class="htmx-indicator opacity-0 htmx-request:opacity-100">Wird gesendet …</span>
  </button>

  <template data-offsite="success">
    <div data-anim="appear" class="space-y-4 md:col-span-2">
      <h2 tabindex="-1" autofocus class="font-display text-3xl">Danke, deine Anfrage ist angekommen.</h2>
      <p>[Platzhalter: was als Nächstes passiert]</p>
      <button type="button" hx-get="/partials/forms/beratung.html"
              hx-target="closest div" hx-swap="outerHTML" class="…">Neue Anfrage</button>
      <a href="/" class="…">Zur Startseite</a>
    </div>
  </template>

  <template data-offsite="error">
    <div data-anim="appear" class="space-y-2 text-alert-600">
      <p tabindex="-1" autofocus class="font-semibold">Deine Anfrage wurde nicht gesendet.</p>
      <ul data-offsite-errors class="list-disc pl-5"></ul>
    </div>
  </template>
</form>
```

The success fragment's "Neue Anfrage" control is plain hypermedia. It fetches the
original form fragment and replaces the success message with it. That fragment then
carries its own controls again.

## 6. Tailwind CSS (v4, CSS-first configuration)

### `src/css/app.css` is the only stylesheet, and this is all it contains
```css
@import "tailwindcss";

/* 1. Custom variants (Tailwind-native extension points) */
@custom-variant js (&:where(.js *));                                   /* JS-enhanced only */
@custom-variant htmx-request (&:where(.htmx-request, .htmx-request *)); /* loading state */

/* 2. Design tokens (values are defined in site.md §4) */
@theme {
  --font-display: "Fraunces", ui-serif, Georgia, serif;
  --font-sans: "Figtree", ui-sans-serif, system-ui, sans-serif;
  --color-forest-950: #10201a;
  /* … full token list per site.md … */
}

/* 3. Self-hosted Google Fonts */
@font-face {
  font-family: "Fraunces";
  src: url("/fonts/fraunces-var.woff2") format("woff2");
  font-weight: 100 900;
  font-display: swap;
}

/* 4. Documented exceptions (no Tailwind equivalent) */
[x-cloak] { display: none !important; }
```

### Rules
- **No custom CSS where a Tailwind equivalent exists.** The only permitted CSS is the four
  blocks above. Adding anything else requires a written justification in a PR comment and
  an entry in this list.
- Do not use `@apply` to build component classes. Reuse comes from includes and partials,
  not from CSS abstractions.
- Tokens live in `@theme`. Arbitrary values (`w-[37rem]`) are allowed for true one-offs.
  If the same value appears twice, make it a token.
- Never build class names dynamically (`'bg-' + color`), because Tailwind cannot detect
  them. ViewModels expose state, and the View maps state to complete class strings with
  `:class="{ 'bg-moss-600': isActive(id) }"` or `data-[state=active]:` variants.
- Prefer `data-*` and `aria-*` variants for state-driven styling
  (`aria-selected:border-chanterelle-400`, `data-[state=open]:…`). This keeps styling in
  the View.
- Write mobile-first. Unprefixed classes are for mobile, and `md:`/`lg:` add to them.
  Layout breakpoints are listed in site.md §5.
- Classes are sorted automatically by `prettier-plugin-tailwindcss`. Do not sort them by
  hand.
- Elements that are hidden until GSAP reveals them get `js:invisible`. GSAP's `autoAlpha`
  then overrides `visibility` inline.
- **Motion exceptions, decided deliberately.** Only these two Tailwind motion utilities
  are allowed:
  - `transition-colors duration-200` for simple hover and focus colour feedback;
  - `motion-safe:scroll-smooth` on `<html>`, for in-page anchor jumps.

  Anything that moves, fades, scales or is sequenced must use GSAP. To enforce "GSAP for
  everything" strictly, remove these exceptions. Add a `hover-tint` preset and register
  GSAP's ScrollToPlugin for a `scroll-to` transition instead.

## 7. GSAP

### Setup
- Register plugins once in `main.js` with
  `gsap.registerPlugin(ScrollTrigger, SplitText)`. All GSAP plugins are free, including
  SplitText, and they ship in the public `gsap` npm package. No auth token or private
  registry is needed.
- Global defaults are set once with `gsap.defaults(...)`, using values from
  `config.motion`.

### Presets and transitions
- **Reveal presets** have the shape `{ name, setup(targets[], ctx) }`. The animator groups
  elements by `data-anim` and calls `setup` once per group inside
  `gsap.matchMedia(root)`. That scopes selectors, makes cleanup automatic and switches
  reduced motion live.
- **Transitions** have the shape `{ name, run(el, { gsap, reduced, options }) }` and
  return the animation, which is thenable. Callers `await` them.
- A preset never imports gsap, because it receives it. A preset never queries outside its
  targets.
- **Every preset must handle `reduced`.** Show the end state immediately
  (`gsap.set(targets, { autoAlpha: 1 })`) and create no ScrollTriggers.

```js
// @ts-check
// src/js/animations/presets/fade-up.js
/** @type {import('../../contracts.js').RevealPreset} */
export const fadeUp = Object.freeze({
  name: 'fade-up',
  setup(targets, { gsap, ScrollTrigger, reduced, ctx }) {
    if (reduced) {
      gsap.set(targets, { autoAlpha: 1 });
      return;
    }
    gsap.set(targets, { autoAlpha: 0, y: 24 });
    ScrollTrigger.batch(targets, {
      start: 'top 85%',
      once: true,
      // Tweens created later in callbacks are NOT tracked by the context unless
      // wrapped in ctx.add(); without it, revert() would miss them.
      onEnter: (batch) =>
        ctx.add(() =>
          gsap.to(batch, { autoAlpha: 1, y: 0, duration: 0.6, ease: 'power2.out', stagger: 0.08, overwrite: true }),
        ),
    });
  },
});
```

### Rules
- Animate transforms and opacity only: `x`, `y`, `xPercent`, `yPercent`, `scale`,
  `rotation` and `autoAlpha`. Never animate `top`, `left`, `width`, `height`, `margin` or
  `padding`.
- Use `autoAlpha` instead of `opacity` for show and hide.
- Use `ScrollTrigger.batch` for groups of similar elements and `once: true` for
  entrances. Never leave `markers` on outside `config.debug`.
- Call `ScrollTrigger.refresh()` only through the injected `refreshScroll`. The htmx
  bridge does this after every settle, and `main.js` does it after `document.fonts.ready`.
  Do not sprinkle refresh calls elsewhere.
- **SplitText:**
  - Use `SplitText.create(el, { type: 'lines', mask: 'lines', autoSplit: true, onSplit })`.
  - Create the animation *inside* `onSplit` and return it, so re-splits on font load or
    resize stay in sync.
  - Keep `aria: 'auto'`, which is the default, so screen readers read the unsplit text.
  - Only split what you animate.
- Use `gsap.quickTo` for pointer-driven effects such as hover zoom. Do not create a new
  tween per event.
- Use `will-change` only through GSAP (`force3D` is the default) and only during the
  animation. Do not add global `will-change` classes.
- Use `overwrite: 'auto'` (or `true`) on tweens that can be re-triggered, such as menu
  toggles.
- Never animate the element that a ScrollTrigger pins. Animate its children instead.
- Timelines that need labels, nesting or control (`hero-intro`, `word-cycle`) are built
  inside the preset and are not exported.

## 8. Ownership and interplay

| If you need to… | Use | Never |
|---|---|---|
| Show or hide without animation | Alpine `x-show` | GSAP or CSS classes toggled by hand |
| Show or hide with animation | ViewModel → `transition()` → GSAP `autoAlpha` | `x-show` + GSAP, or `x-transition` |
| Load content | htmx `hx-get` to a fragment | `fetch` in a ViewModel |
| Offer a next action | A control inside the fragment (`hx-get`, `a[href]`) | JavaScript deciding which URL comes next |
| Submit data | `<form hx-post hx-ext="offsite-form">` to an allowlisted origin | `fetch`/XHR in app code, third-party embed scripts |
| Navigate | Boosted link | `location.href =` in JavaScript |
| React to scroll position | Preset with ScrollTrigger, or injected `watchViewport` | `window.onscroll`, or IntersectionObserver in a ViewModel |
| Style a state | Tailwind `aria-*`/`data-*` variants | Inline styles from JavaScript (GSAP is the only exception) |

## 9. Accessibility (non-negotiable)
- Every interactive element is a real `<button>` or `<a href>`. Never put click handlers
  on a `<div>`.
- Focus is always visible:
  `focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-chanterelle-400`.
- Use the WAI-ARIA patterns:
  - **Tabs:** `tablist`/`tab`/`tabpanel`, arrow keys, Home/End, roving tabindex.
  - **Disclosure:** `aria-expanded` + `aria-controls`.
  - **Dialog:** native `<dialog>` with `showModal()`. Focus returns to the opener on
    close.
- After a boosted navigation, move focus to `#page h1` (tabindex `-1`) and leave the
  `<title>` update to htmx.
- After a user-triggered fragment swap, focus goes to the new content. Put `autofocus`
  (plus `tabindex="-1"` on non-interactive elements) on the element that should receive
  it, and htmx focuses it on settle. Examples: the result heading of a form, the first
  appended archive card, the heading of a newly loaded bio. JavaScript never moves focus
  for fragments.
- Respect `prefers-reduced-motion` through the motion policy. Decorative videos also stop
  when reduced motion or Save-Data is on.
- Decorative media get `alt=""` and `aria-hidden="true"`. Content images get meaningful
  `alt` text in German.
- Text on top of video must meet WCAG AA contrast against the darkest *and* lightest
  frames. Use a gradient overlay.
- Animated content never blocks reading. All reveals finish within 1 second, and nothing
  loops automatically for more than 5 seconds without a way to stop it. Scroll-driven
  effects and word cycling meet this (see site.md §9).

## 10. Security and performance
- Every page carries this meta CSP. Inline style is allowed because GSAP and SplitText
  write styles, and eval is allowed because the Alpine standard build needs it
  (architecture D11). Every allowlisted off-site origin appears in **both**
  `connect-src` (htmx) and `form-action` (no-JavaScript fallback), and in
  `config.offsite.allowedOrigins`. Keep the three in sync.
  ```html
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'self'; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self'; font-src 'self'; connect-src 'self' https://formspree.io; base-uri 'self'; form-action 'self' https://formspree.io mailto:; object-src 'none'">
  ```
- The CSP meta tag lives in a single include (`_includes/head-security.html`) so it is
  never edited per page.
- Use `<script type="module" src="/js/main.js">`. Modules are deferred by default, so no
  `defer` attribute is needed.
- Preload:
  - the LCP hero poster image;
  - the two primary font files (`crossorigin` is required for fonts, even same-origin).
- Images:
  - AVIF/WebP with `width` and `height` set;
  - `loading="lazy"` below the fold and `fetchpriority="high"` on the hero poster;
  - `srcset`/`sizes` for anything larger than 600 px.
- Videos: `muted playsinline loop preload="none"`, with sources set by the ambient video
  ViewModel. Budgets are in site.md §11.

## 11. Testing
- Use `node --test`, with no framework. Tests live in `test/` and mirror the `src/js/`
  folders.
- Test Models and ViewModels with fakes. Because everything is injected, you do not need
  a DOM library for most tests.
- Test services against minimal fakes (a fake `gsap` that records calls, and an
  `EventTarget` standing in for htmx).
- **Adapters:** table-driven tests of `parse()` for each response shape. Cover 200, 422
  with field errors, 4xx without a body, non-JSON bodies and empty bodies.
- **Request policy:** own origin is allowed, allowlisted origins are allowed, and
  everything else is rejected. Include look-alike hosts such as `formspree.io.evil.test`.
- **Extension:** drive `onEvent` with fake event details. Assert the header stripping,
  target and swap overrides, and that provider text never reaches HTML unescaped.
- **htmx event order:** the "verify" items in architecture §8.2 get a test each, run
  against the pinned htmx in a minimal jsdom setup. This is the one place jsdom is
  allowed.
- Do not test presets visually. Review them by eye in the browser with `config.debug`
  markers turned on.

```js
// test/models/carousel.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCarouselModel } from '../../src/js/models/carousel.js';

test('wraps around in loop mode', () => {
  const m = createCarouselModel({ count: 3 });
  assert.equal(m.next(2), 0);
  assert.equal(m.prev(0), 2);
});
```

## 12. Tooling and commits
- Format with Prettier and `prettier-plugin-tailwindcss` (`npm run format`). No other
  linters are used (YAGNI). `// @ts-check` gives editor type checking.
- Pin dependencies with `--save-exact`. Upgrade one library per commit and include a
  smoke test of the affected features.
- Commit messages use the imperative mood and are scoped, for example
  `feat(press): lazy-load archive panel` or `fix(animator): revert nested roots`.

## 13. Review checklist
- [ ] No module other than `main.js` imports vendor code, touches globals or calls another
      module's factory.
- [ ] Each new ViewModel or preset is registered in `main.js`, with a test (ViewModel) or
      a site.md entry (preset).
- [ ] View bindings reference ViewModel members only. No `x-transition`. No inline
      `<script>` or `style=""`.
- [ ] htmx elements declare `hx-target` and `hx-swap`. Fragments follow the fragment
      contract and carry their own next controls.
- [ ] No URL is built, stored or read in JavaScript. The only URLs in `src/js/` are the
      origin allowlist.
- [ ] Off-site forms: allowlisted origin listed in config and in the CSP (`connect-src`
      and `form-action`); `hx-ext="offsite-form"`; status region; success and error
      templates; honeypot; privacy note; works without JavaScript.
- [ ] `app.css` contains nothing beyond the four permitted blocks.
- [ ] Reduced motion handled. Keyboard path works. One `<h1>` per page.
- [ ] Media within budget. Lighthouse mobile results: Performance ≥ 90, Accessibility =
      100.
