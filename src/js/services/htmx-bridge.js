// @ts-check
// src/js/services/htmx-bridge.js

/**
 * Connects the htmx swap lifecycle to the animator and enforces the request
 * allowlist. `selfRequestsOnly: false` is safe only because of the validateUrl
 * listener below: never remove it.
 *
 * @param {object} deps
 * @param {import('../contracts.js').Animator} deps.animator
 * @param {(url: URL) => boolean} deps.allowsUrl
 * @param {EventTarget & { querySelector: Function }} deps.document
 * @param {{ page: string, pageHeading: string, offsiteForm: string, fragmentStatus: string }} deps.selectors
 * @param {{ failed: string }} deps.messages
 */
export function createHtmxBridge({ animator, allowsUrl, document, selectors, messages }) {
  const isPage = (/** @type {any} */ el) => Boolean(el?.matches?.(selectors.page));

  /** @param {string} text */
  const showStatus = (text) => {
    const region = document.querySelector(selectors.fragmentStatus);
    if (region) region.textContent = text;
  };

  /** @type {Array<[string, (event: any) => void]>} */
  const listeners = [
    // Security: cancel every request whose origin is not allowlisted.
    [
      'htmx:validateUrl',
      (event) => {
        if (!allowsUrl(event.detail.url)) event.preventDefault();
      },
    ],

    ['htmx:beforeRequest', () => showStatus('')],

    // Start the exit animation during htmx's swap delay. Skipped when htmx will not
    // swap (e.g. a 404), so a failed navigation never leaves the page faded out.
    [
      'htmx:beforeSwap',
      (event) => {
        const { target, shouldSwap, isError } = event.detail;
        if (isPage(target) && shouldSwap && !isError) animator.transition('page-out', target);
      },
    ],

    // The old content is gone (detached for outerHTML swaps): revert its animations.
    ['htmx:afterSwap', (event) => animator.unmount(event.detail.target)],

    // htmx fires afterSettle on each newly inserted element (outerHTML) or on the
    // container (innerHTML), so `event.target` is the root of the new content.
    [
      'htmx:afterSettle',
      async (event) => {
        const root = event.target;
        animator.mount(root);
        if (!isPage(root)) return;
        // Focus after the transition: page-in starts at visibility:hidden, which
        // would drop focus from the heading if it were focused earlier.
        await animator.transition('page-in', root);
        document.querySelector(selectors.pageHeading)?.focus({ preventScroll: true });
      },
    ],

    // Own-origin failures are never silent. Off-site forms render their own error
    // template through the offsite-form extension.
    ...['htmx:responseError', 'htmx:sendError'].map(
      /** @returns {[string, (event: any) => void]} */
      (name) => [
        name,
        (event) => {
          if (event.detail.elt?.closest?.(selectors.offsiteForm)) return;
          showStatus(messages.failed);
        },
      ],
    ),
  ];

  return Object.freeze({
    /** @returns {() => void} stop function */
    start() {
      for (const [name, listener] of listeners) document.addEventListener(name, listener);
      return () => {
        for (const [name, listener] of listeners) document.removeEventListener(name, listener);
      };
    },
  });
}
