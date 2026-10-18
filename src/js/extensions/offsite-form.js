// @ts-check
// src/js/extensions/offsite-form.js

/**
 * htmx extension (`hx-ext="offsite-form"`) that turns an off-site JSON service into
 * hypermedia: it makes the request a CORS "simple request", asks the matching
 * provider adapter whether the response succeeded, and swaps in the success or error
 * `<template>` that ships inside the form. Provider-agnostic: providers live in
 * adapters. Provider text only ever reaches the DOM through `textContent`.
 *
 * @param {object} deps
 * @param {{ swap: (target: Element, content: string, spec: { swapStyle: string }) => void }} deps.htmx
 * @param {readonly import('../contracts.js').OffsiteAdapter[]} deps.adapters
 * @param {{ network: string }} deps.messages
 * @param {Pick<Document, 'createElement'>} deps.document
 */
export function createOffsiteFormExtension({ htmx, adapters, messages, document }) {
  /** @type {WeakMap<Element, import('../contracts.js').OffsiteAdapter>} */
  const adapterByForm = new WeakMap();

  /** @param {string} path */
  function adapterFor(path) {
    let url;
    try {
      url = new URL(path);
    } catch {
      return undefined;
    }
    return adapters.find((adapter) => adapter.matches(url));
  }

  /**
   * Serialise a form's result template, filling the error list from plain text.
   * @param {Element} form
   * @param {'success' | 'error'} kind
   * @param {{ message: string }[]} [errors]
   */
  function render(form, kind, errors = []) {
    const template = /** @type {HTMLTemplateElement | null} */ (
      form.querySelector(`template[data-offsite="${kind}"]`)
    );
    if (!template) return '';
    const content = /** @type {DocumentFragment} */ (template.content.cloneNode(true));
    const list = content.querySelector('[data-offsite-errors]');
    if (list) {
      if (!errors.length) list.remove();
      for (const { message } of errors) {
        const item = document.createElement('li');
        item.textContent = message;
        list.append(item);
      }
    }
    const holder = document.createElement('div');
    holder.append(content);
    return holder.innerHTML;
  }

  /** @param {Element} form */
  const statusRegion = (form) => form.querySelector('[data-form-status]');

  return Object.freeze({
    /**
     * @param {string} name
     * @param {any} evt
     */
    onEvent(name, evt) {
      const detail = evt.detail ?? {};
      const form = detail.elt?.closest?.('form');
      if (!form) return true;

      if (name === 'htmx:configRequest') {
        const adapter = adapterFor(detail.path);
        if (!adapter) return true;
        adapterByForm.set(form, adapter);
        // htmx's own headers would force a CORS preflight that providers may refuse.
        for (const header of Object.keys(detail.headers)) {
          if (header.toUpperCase().startsWith('HX-')) delete detail.headers[header];
        }
        Object.assign(detail.headers, adapter.headers);
      }

      if (name === 'htmx:beforeSwap') {
        const adapter = adapterByForm.get(form);
        if (!adapter) return true;
        const result = adapter.parse(detail.xhr.status, detail.xhr.responseText);
        detail.shouldSwap = true;
        detail.isError = false;
        if (result.ok) {
          detail.target = form;
          detail.swapOverride = 'outerHTML';
          detail.serverResponse = render(form, 'success');
        } else {
          detail.target = statusRegion(form);
          detail.swapOverride = 'innerHTML';
          detail.serverResponse = render(form, 'error', result.errors);
        }
      }

      if (name === 'htmx:sendError') {
        const region = statusRegion(form);
        if (region) {
          htmx.swap(region, render(form, 'error', [{ message: messages.network }]), {
            swapStyle: 'innerHTML',
          });
        }
      }

      return true;
    },
  });
}
