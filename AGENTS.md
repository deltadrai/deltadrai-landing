# AGENTS.md

This is the instruction file for AI coding agents working in this repository. Read it
fully before making any change.

## What this repo is
This repo contains a hypermedia-driven marketing site that reproduces the look and feel
of mypilz.eu. It is built with:

- **htmx** for fragments, HATEOAS, boosted navigation and off-site form posts;
- **Alpine.js** for UI-only state (ViewModels);
- **Tailwind CSS v4** for all styling;
- **GSAP** (with ScrollTrigger and SplitText) for all motion;
- **Google Fonts**, self-hosted;
- native **ES modules** with no bundler.

It is hosted on **GitHub Pages**, which serves our origin as static files. Dynamic needs,
such as receiving forms, go to **allowlisted off-site services**, starting with
Formspree.

## Required reading (in this order)
1. [docs/architecture.md](docs/architecture.md) covers the layers, the composition root,
   the hypermedia model (HATEOAS), off-site services, lifecycle, directory layout, build
   and deploy, privacy and the decision log.
2. [docs/coding.md](docs/coding.md) covers the coding rules for ES modules, DI, MVVM,
   Alpine, htmx/HATEOAS, off-site forms, Tailwind and GSAP, plus accessibility, testing
   and the review checklist.
3. [docs/site.md](docs/site.md) covers the UI/UX specification: tokens, layout,
   components, wireframes, fragment behaviour, form states, the motion table, budgets
   and copy voice.

All diagrams in the docs are Mermaid. Keep new diagrams in Mermaid too, and check their
syntax before committing.

If something in this repository conflicts with these docs, the docs win. You may change
the code to match the docs. Change the docs only when the user explicitly decides
something new. Record such decisions in the architecture decision log (§13).

## Non-negotiable rules
1. **`src/js/main.js` is the only composition root.** It is the only module that imports
   vendor code, touches globals, calls factories, registers GSAP plugins, htmx
   extensions and Alpine components, and boots the app. Every other module exports
   factories or frozen definitions and has no side effects on import.
2. **Dependency injection, narrowest first.** Modules receive dependencies as a single
   destructured object. Inject capabilities such as `transition` or `allowsUrl`, not
   whole services.
3. **MVVM:**
   - The View is HTML with hypermedia controls.
   - ViewModels are `Alpine.data` factories holding UI-only state.
   - Models are pure rules.
   - Services, the htmx extension and adapters wrap side effects.
   - View bindings reference ViewModel members only.
4. **HATEOAS:**
   - URLs reach the client only inside hypermedia controls (`href`, `hx-get`, `hx-post`,
     form `action`).
   - JavaScript never builds, stores or reads URLs. The single exception is the origin
     allowlist.
   - Every fragment carries the controls for its next actions. An unavailable action is
     absent, not disabled.
5. **One owner per concern:** HTML for structure and available actions, Tailwind for
   styling, htmx for fetching, submitting and navigating, Alpine for UI state, GSAP for
   every motion. Never use `x-transition`, CSS keyframes, or `fetch` in app code.
6. **htmx:**
   - Our own origin: GET only, to existing `.html` fragments.
   - Off-site: POST only, from `<form hx-ext="offsite-form">`, to origins in
     `config.offsite.allowedOrigins`. These origins must also be in the CSP's
     `connect-src` and `form-action`.
   - Every request element declares `hx-target` and `hx-swap`.
   - Boost attributes go only on link-only containers.
7. **Off-site data never reaches `innerHTML`.** Provider messages are written with
   `textContent` into cloned templates. Forms must work without JavaScript.
8. **No custom CSS** beyond the four permitted blocks in `src/css/app.css` (coding.md
   §6).
9. **Accessibility and reduced motion are part of "done".** Every preset handles
   `reduced`. Swapped content gets focus through `autofocus`.
10. **SOLID, YAGNI, KISS.** Do not add libraries, frameworks, a bundler, a DI container,
    a store, a router, i18n or our own backend unless the user asks for them.
11. **Privacy:** no third-party requests until the user submits a form. Do not add
    analytics, iframes, CAPTCHA scripts or CDNs. A new off-site provider requires an
    adapter, an allowlist entry, a CSP entry and a Datenschutz update, and the user's
    approval.
12. **Assets:** never download, copy or hot-link logos, photos, videos or copy from
    mypilz.eu. Use clearly marked placeholders (site.md §2).

## Commands
```bash
npm ci            # install pinned devDependencies
npm run dev       # build, then watch HTML/JS + Tailwind, serve _site/ over HTTP
npm run build     # production build into _site/
npm test          # node --test (models, viewmodels, services, adapters, extension)
npm run format    # prettier + tailwind class sorting
```
Never open pages over `file://`. ES modules and htmx require HTTP. Use the **test**
Formspree form ids locally, never the production ones.

## Where things go
| You are adding… | Put it in | Register or document in |
|---|---|---|
| A page | `src/<slug>/index.html` with includes and `<main id="page" tabindex="-1">` | Nav include, `sitemap.xml`, site.md §3 |
| Shared chrome | `src/_includes/*.html` | (expanded by `scripts/build.mjs`) |
| A fragment | `src/partials/<area>/<name>.html` (fragment contract) | The control that links to it; site.md §3 |
| A form | `src/partials/forms/<name>.html` (`hx-post` + `action` + `hx-ext="offsite-form"` + status region + templates) | site.md §10 |
| An off-site provider | `src/js/adapters/<provider>.js` | `main.js`, `config.offsite.allowedOrigins`, CSP include, Datenschutz, architecture §7 |
| A reveal animation | `src/js/animations/presets/<name>.js` | `presets/index.js`, site.md §9 |
| A show/hide transition | `src/js/animations/transitions/<name>.js` | `transitions/index.js`, site.md §9 |
| Interactive behaviour | `src/js/viewmodels/<name>.js` (+ `models/` for rules) | `main.js` (`Alpine.data`), a test in `test/` |
| A side-effect wrapper | `src/js/services/<name>.js` + typedef in `contracts.js` | `main.js` |
| A design token | `@theme` in `src/css/app.css` | site.md §4 |

## Definition of done
- `npm test` and `npm run build` pass.
- The review checklist in coding.md §13 is satisfied.
- The acceptance checklist in site.md §15 is satisfied for every touched page.
- A manual browser check covers: a keyboard-only pass, the reduced-motion emulation pass,
  the no-JavaScript pass (including native form submit), an offline form submission, and
  a mobile viewport at 375 px.
- The docs are updated if behaviour, motion, structure or the hypermedia graph changed.

## Working style
- Make small, focused changes, one concern per commit. Use imperative commit messages,
  for example `feat(forms): add investment enquiry fragment`.
- Push finished features, fixes, chores, user stories etc. to origin and PR.
- Always branch new features or worktress from latest `origin/main`.
- Before writing code that depends on an htmx, Alpine or GSAP API detail, check it
  against the **pinned** version in `package-lock.json`. Do not rely on memory. In
  particular, check the htmx event-order and `beforeSwap` override assumptions listed in
  architecture §8.2, and encode each as a test.
- Ask the user before:
  - changing a decision in the decision log;
  - adding a dependency or an off-site provider;
  - adding a page outside the v1 scope;
  - replacing provisional design tokens with guessed values.
