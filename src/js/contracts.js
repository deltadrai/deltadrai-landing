// @ts-check
// src/js/contracts.js — JSDoc typedefs only.

/**
 * @typedef {Object} MotionPolicy
 * @property {Record<string,string>} conditions   // for gsap.matchMedia: { reduced, full }
 * @property {() => boolean} prefersReduced
 * @property {() => boolean} saveData
 */

/**
 * @typedef {Object} RequestPolicy
 * @property {(url: URL) => boolean} allows       // own origin or allowlisted off-site origin
 */

/**
 * @typedef {Object} OffsiteResult
 * @property {boolean} ok
 * @property {{ field?: string, message: string }[]} errors
 */

/**
 * @typedef {Object} OffsiteAdapter              // one per provider
 * @property {string} name
 * @property {(url: URL) => boolean} matches
 * @property {Record<string,string>} headers     // CORS-safelisted only, e.g. { Accept: 'application/json' }
 * @property {(status: number, body: string) => OffsiteResult} parse
 */

/**
 * @typedef {Object} RevealContext
 * @property {any} gsap
 * @property {boolean} reduced
 * @property {{ add: (fn: Function) => void }} ctx   // gsap context: wrap tweens created in callbacks
 */

/**
 * @typedef {Object} RevealPreset            // declarative, selected by data-anim="<name>"
 * @property {string} name
 * @property {(targets: HTMLElement[], c: RevealContext) => void} setup
 */

/**
 * @typedef {Object} TransitionPreset        // imperative, called by ViewModels and the bridge
 * @property {string} name
 * @property {(el: HTMLElement, c: { gsap: any, reduced: boolean, options: object }) => any} run
 */

/** @typedef {(name: string, el: HTMLElement, options?: object) => Promise<void>} Transition */

/**
 * @typedef {Object} Animator
 * @property {(root: Element) => void} mount
 * @property {(root: Element) => void} unmount
 * @property {Transition} transition
 */

/**
 * CSS-pixel viewport metrics.
 * @typedef {Object} Viewport
 * @property {number} width
 * @property {number} height
 * @property {number} pixelRatio   // capped to bound the canvas backing-store cost
 */

/**
 * Frame loop. `add` returns a stop function; times are seconds on one shared clock.
 * @typedef {Object} Ticker
 * @property {(callback: (timeSeconds: number) => void) => () => void} add
 * @property {() => number} now
 */

/**
 * Draws one wave frame onto a canvas.
 * @typedef {Object} WaveRenderer
 * @property {(width: number, height: number, pixelRatio: number) => void} resize
 * @property {(points: any[][], effects?: object) => void} draw
 */

export {};
