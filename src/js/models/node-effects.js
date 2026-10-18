// @ts-check
// src/js/models/node-effects.js
/**
 * @typedef {{ i: number, j: number, glowAlpha: number, computing: boolean }} HeatingNode
 * @typedef {{ i: number, j: number, ringAlpha: number, ringGrowth: number, nodeAlpha: number }} CircularNode
 */

const MAX_HEATING = 10;
const HEATING_FADE_IN = 1.2;
const HEATING_FADE_OUT = 1.0;
const HEATING_HOLD_MIN = 6.0;
const HEATING_HOLD_MAX = 11.0;
const HEATING_SPAWN_GAP_MIN = 0.3;
const HEATING_SPAWN_GAP_MAX = 1.0;
const HEATING_BLINK_DUR_MIN = 0.2;
const HEATING_BLINK_DUR_MAX = 0.45;
const HEATING_BLINK_GAP_MIN = 0.5;
const HEATING_BLINK_GAP_MAX = 1.3;

const MAX_CIRCULAR = 1;
const CIRCULAR_RING_IN = 0.8;
const CIRCULAR_NODE_OUT = 0.6;
const CIRCULAR_HOLD = 1.0;
const CIRCULAR_NODE_IN = 0.6;
const CIRCULAR_RING_OUT = 0.8;
const CIRCULAR_SPAWN_GAP_MIN = 4.5;
const CIRCULAR_SPAWN_GAP_MAX = 10.0;

/**
 * Rules for a second animation layer, independent of the wave's travelling swell:
 * a sparse set of grid nodes cycle through scripted lifecycles rather than the
 * continuous wave function. `advance(t)` is stepped with the same clock as the
 * wave, but the lifecycles here are self-timed, not phase-locked to it.
 *
 * Two independent behaviours, tracked by grid index `"i,j"`:
 *  - "heating" nodes grow a soft glow beneath them (an outward gradient, as if the
 *    node radiated heat) while the node itself keeps its normal colour; during the
 *    hold, the node itself randomly blinks to represent computation happening on
 *    top of the heat.
 *  - "circular" nodes (never a currently-heating node) grow a ring, hide the node,
 *    reveal it again, then fade the ring out — symbolising the node being exchanged.
 *
 * @param {object} deps
 * @param {() => number} deps.random source of randomness in [0, 1), injected for tests
 * @param {number} [deps.cols] grid columns (must match the wave field's)
 * @param {number} [deps.rows] grid rows (must match the wave field's)
 */
export function createNodeEffectsModel({ random, cols = 10, rows = 8 }) {
  let gridCols = cols;
  let gridRows = rows;

  /** @type {Map<string, any>} */
  const heating = new Map();
  /** @type {Map<string, any>} */
  const circular = new Map();
  /** @type {HeatingNode[]} */
  let heatingNodes = [];
  /** @type {CircularNode[]} */
  let circularNodes = [];

  let started = false;
  let nextHeatingSpawnAt = 0;

  const randomBetween = (/** @type {number} */ min, /** @type {number} */ max) =>
    min + random() * (max - min);
  const keyOf = (/** @type {number} */ i, /** @type {number} */ j) => `${i},${j}`;
  const isOccupied = (/** @type {string} */ key) => heating.has(key) || circular.has(key);

  let nextCircularSpawnAt = randomBetween(CIRCULAR_SPAWN_GAP_MIN, CIRCULAR_SPAWN_GAP_MAX);

  /** Pick a grid node biased towards the nearer 65% of rows, where it's visible. */
  function pickNode() {
    const i = Math.floor(random() * (gridCols + 1));
    const jMin = Math.floor(gridRows * 0.35);
    const j = jMin + Math.floor(random() * (gridRows + 1 - jMin));
    return { i, j };
  }

  /** @param {number} t */
  function spawnHeating(t) {
    if (heating.size >= MAX_HEATING) return;
    if (t < nextHeatingSpawnAt) return;

    const { i, j } = pickNode();
    const key = keyOf(i, j);
    // Try again on the next frame rather than skipping the whole gap.
    if (isOccupied(key)) return;

    heating.set(key, {
      i,
      j,
      state: 'in',
      stateStart: t,
      holdDur: randomBetween(HEATING_HOLD_MIN, HEATING_HOLD_MAX),
      nextBlinkAt:
        t + HEATING_FADE_IN + randomBetween(HEATING_BLINK_GAP_MIN, HEATING_BLINK_GAP_MAX),
      blinkUntil: 0,
    });
    nextHeatingSpawnAt = t + randomBetween(HEATING_SPAWN_GAP_MIN, HEATING_SPAWN_GAP_MAX);
  }

  /** @param {number} t */
  function stepHeating(t) {
    /** @type {HeatingNode[]} */
    const out = [];
    for (const [key, node] of heating) {
      const elapsed = t - node.stateStart;

      if (node.state === 'in') {
        const glowAlpha = Math.min(1, elapsed / HEATING_FADE_IN);
        if (elapsed >= HEATING_FADE_IN) {
          node.state = 'hold';
          node.stateStart = t;
        }
        out.push({ i: node.i, j: node.j, glowAlpha, computing: false });
        continue;
      }

      if (node.state === 'hold') {
        const isBlinking = t < node.blinkUntil;
        if (!isBlinking && t >= node.nextBlinkAt) {
          node.blinkUntil = t + randomBetween(HEATING_BLINK_DUR_MIN, HEATING_BLINK_DUR_MAX);
          node.nextBlinkAt =
            node.blinkUntil + randomBetween(HEATING_BLINK_GAP_MIN, HEATING_BLINK_GAP_MAX);
        }
        const computing = t < node.blinkUntil;
        if (elapsed >= node.holdDur) {
          node.state = 'out';
          node.stateStart = t;
        }
        out.push({ i: node.i, j: node.j, glowAlpha: 1, computing });
        continue;
      }

      if (node.state === 'out') {
        const glowAlpha = Math.max(0, 1 - elapsed / HEATING_FADE_OUT);
        if (elapsed >= HEATING_FADE_OUT) {
          heating.delete(key);
          continue;
        }
        out.push({ i: node.i, j: node.j, glowAlpha, computing: false });
      }
    }
    return out;
  }

  /** @param {number} t */
  function spawnCircular(t) {
    if (circular.size >= MAX_CIRCULAR) return;
    if (t < nextCircularSpawnAt) return;

    const { i, j } = pickNode();
    const key = keyOf(i, j);
    if (isOccupied(key)) return;

    circular.set(key, { i, j, state: 'ringIn', stateStart: t });
    nextCircularSpawnAt = t + randomBetween(CIRCULAR_SPAWN_GAP_MIN, CIRCULAR_SPAWN_GAP_MAX);
  }

  /** @param {number} t */
  function stepCircular(t) {
    /** @type {CircularNode[]} */
    const out = [];
    for (const [key, node] of circular) {
      const elapsed = t - node.stateStart;
      const { i, j } = node;

      switch (node.state) {
        case 'ringIn': {
          const ringAlpha = Math.min(1, elapsed / CIRCULAR_RING_IN);
          if (elapsed >= CIRCULAR_RING_IN) {
            node.state = 'nodeOut';
            node.stateStart = t;
          }
          out.push({ i, j, ringAlpha, ringGrowth: ringAlpha, nodeAlpha: 1 });
          break;
        }
        case 'nodeOut': {
          const nodeAlpha = Math.max(0, 1 - elapsed / CIRCULAR_NODE_OUT);
          if (elapsed >= CIRCULAR_NODE_OUT) {
            node.state = 'hold';
            node.stateStart = t;
          }
          out.push({ i, j, ringAlpha: 1, ringGrowth: 1, nodeAlpha });
          break;
        }
        case 'hold': {
          if (elapsed >= CIRCULAR_HOLD) {
            node.state = 'nodeIn';
            node.stateStart = t;
          }
          out.push({ i, j, ringAlpha: 1, ringGrowth: 1, nodeAlpha: 0 });
          break;
        }
        case 'nodeIn': {
          const nodeAlpha = Math.min(1, elapsed / CIRCULAR_NODE_IN);
          if (elapsed >= CIRCULAR_NODE_IN) {
            node.state = 'ringOut';
            node.stateStart = t;
          }
          out.push({ i, j, ringAlpha: 1, ringGrowth: 1, nodeAlpha });
          break;
        }
        case 'ringOut': {
          const ringAlpha = Math.max(0, 1 - elapsed / CIRCULAR_RING_OUT);
          if (elapsed >= CIRCULAR_RING_OUT) {
            circular.delete(key);
            continue;
          }
          out.push({ i, j, ringAlpha, ringGrowth: 1, nodeAlpha: 1 });
          break;
        }
        default:
          break;
      }
    }
    return out;
  }

  return Object.freeze({
    get heatingNodes() {
      return heatingNodes;
    },
    get circularNodes() {
      return circularNodes;
    },

    /**
     * Update the shared grid resolution (called on resize, once the wave field has
     * re-derived its own cols/rows). Existing nodes are keyed by grid index, so a
     * resolution change drops any in-flight lifecycles rather than risk indices
     * that fall outside the new grid.
     * @param {number} nextCols
     * @param {number} nextRows
     */
    setGrid(nextCols, nextRows) {
      if (nextCols === gridCols && nextRows === gridRows) return;
      gridCols = nextCols;
      gridRows = nextRows;
      heating.clear();
      circular.clear();
      heatingNodes = [];
      circularNodes = [];
    },

    /**
     * Advance all lifecycles to time `t` (seconds) and recompute the public
     * `heatingNodes`/`circularNodes` arrays.
     * @param {number} t elapsed time in seconds
     */
    advance(t) {
      if (!started) {
        started = true;
        nextHeatingSpawnAt = t;
      }

      spawnHeating(t);
      heatingNodes = stepHeating(t);

      spawnCircular(t);
      circularNodes = stepCircular(t);
    },
  });
}
