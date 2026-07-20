/**
 * NodeEffects — the Model for a second animation layer, independent of the
 * WaveField's travelling swell: a sparse set of grid nodes cycle through
 * scripted lifecycles rather than the continuous wave function. No DOM
 * access (per docs/architecture.md); `advance(t)` is stepped with the same
 * clock as the wave, but the lifecycles here are self-timed, not phase-locked
 * to it.
 *
 * Two independent behaviours, tracked by grid index `"i,j"`:
 *  - "heating" nodes fade up to #EEAF6A, hold while randomly blinking to
 *    #748B97 (computation), then fade back out.
 *  - "circular" nodes (never a currently-heating node) grow a ring in
 *    #A0DBB6, hide the node, reveal it again, then fade the ring out —
 *    symbolising the node being exchanged.
 */
const HEATING_RGB = '238, 175, 106';
const COMPUTE_RGB = '116, 139, 151';
const CIRCULAR_RGB = '160, 219, 182';

const MAX_HEATING = 3;
const HEATING_FADE_IN = 1.2;
const HEATING_FADE_OUT = 1.0;
const HEATING_HOLD_MIN = 2.5;
const HEATING_HOLD_MAX = 5.0;
const HEATING_SPAWN_GAP_MIN = 1.5;
const HEATING_SPAWN_GAP_MAX = 4.0;
const HEATING_BLINK_DUR_MIN = 0.15;
const HEATING_BLINK_DUR_MAX = 0.35;
const HEATING_BLINK_GAP_MIN = 0.6;
const HEATING_BLINK_GAP_MAX = 1.6;

const MAX_CIRCULAR = 1;
const CIRCULAR_RING_IN = 0.8;
const CIRCULAR_NODE_OUT = 0.6;
const CIRCULAR_HOLD = 1.0;
const CIRCULAR_NODE_IN = 0.6;
const CIRCULAR_RING_OUT = 0.8;
const CIRCULAR_SPAWN_GAP_MIN = 6.0;
const CIRCULAR_SPAWN_GAP_MAX = 14.0;

export class NodeEffects {
  /**
   * @param {object} [options]
   * @param {number} [options.cols] grid columns (must match the WaveField's)
   * @param {number} [options.rows] grid rows (must match the WaveField's)
   * @param {() => number} [options.random] source of randomness, injectable for tests
   */
  constructor({ cols = 48, rows = 30, random = Math.random } = {}) {
    this.cols = cols;
    this.rows = rows;
    this._random = random;

    this._lastT = null;
    this._heating = new Map();
    this._circular = new Map();
    this._nextHeatingSpawnAt = 0;
    this._nextCircularSpawnAt = this._randomBetween(
      CIRCULAR_SPAWN_GAP_MIN,
      CIRCULAR_SPAWN_GAP_MAX,
    );

    /** @type {Array<{i:number,j:number,rgb:string,alpha:number}>} */
    this.heatingNodes = [];
    /** @type {Array<{i:number,j:number,ringAlpha:number,ringGrowth:number,nodeAlpha:number}>} */
    this.circularNodes = [];
  }

  _randomBetween(min, max) {
    return min + this._random() * (max - min);
  }

  /** Pick a grid node biased towards the nearer 65% of rows, where it's visible. */
  _pickNode() {
    const i = Math.floor(this._random() * (this.cols + 1));
    const jMin = Math.floor(this.rows * 0.35);
    const j = jMin + Math.floor(this._random() * (this.rows + 1 - jMin));
    return { i, j };
  }

  _key(i, j) {
    return `${i},${j}`;
  }

  _isOccupied(key) {
    return this._heating.has(key) || this._circular.has(key);
  }

  /**
   * Advance all lifecycles to time `t` (seconds) and recompute the public
   * `heatingNodes`/`circularNodes` arrays.
   * @param {number} t elapsed time in seconds
   */
  advance(t) {
    if (this._lastT === null) {
      this._nextHeatingSpawnAt = t;
    }
    this._lastT = t;

    this._spawnHeating(t);
    this.heatingNodes = this._stepHeating(t);

    this._spawnCircular(t);
    this.circularNodes = this._stepCircular(t);
  }

  _spawnHeating(t) {
    if (this._heating.size >= MAX_HEATING) return;
    if (t < this._nextHeatingSpawnAt) return;

    const { i, j } = this._pickNode();
    const key = this._key(i, j);
    if (this._isOccupied(key)) {
      // Try again on the next frame rather than skipping the whole gap.
      return;
    }

    this._heating.set(key, {
      i,
      j,
      state: 'in',
      stateStart: t,
      holdDur: this._randomBetween(HEATING_HOLD_MIN, HEATING_HOLD_MAX),
      nextBlinkAt: t + HEATING_FADE_IN + this._randomBetween(HEATING_BLINK_GAP_MIN, HEATING_BLINK_GAP_MAX),
      blinkUntil: 0,
    });
    this._nextHeatingSpawnAt = t + this._randomBetween(HEATING_SPAWN_GAP_MIN, HEATING_SPAWN_GAP_MAX);
  }

  _stepHeating(t) {
    const out = [];
    for (const [key, node] of this._heating) {
      const elapsed = t - node.stateStart;

      if (node.state === 'in') {
        const alpha = Math.min(1, elapsed / HEATING_FADE_IN);
        if (elapsed >= HEATING_FADE_IN) {
          node.state = 'hold';
          node.stateStart = t;
        }
        out.push({ i: node.i, j: node.j, rgb: HEATING_RGB, alpha });
        continue;
      }

      if (node.state === 'hold') {
        const isBlinking = t < node.blinkUntil;
        if (!isBlinking && t >= node.nextBlinkAt) {
          node.blinkUntil = t + this._randomBetween(HEATING_BLINK_DUR_MIN, HEATING_BLINK_DUR_MAX);
          node.nextBlinkAt = node.blinkUntil + this._randomBetween(HEATING_BLINK_GAP_MIN, HEATING_BLINK_GAP_MAX);
        }
        const rgb = t < node.blinkUntil ? COMPUTE_RGB : HEATING_RGB;
        if (elapsed >= node.holdDur) {
          node.state = 'out';
          node.stateStart = t;
        }
        out.push({ i: node.i, j: node.j, rgb, alpha: 1 });
        continue;
      }

      if (node.state === 'out') {
        const alpha = Math.max(0, 1 - elapsed / HEATING_FADE_OUT);
        if (elapsed >= HEATING_FADE_OUT) {
          this._heating.delete(key);
          continue;
        }
        out.push({ i: node.i, j: node.j, rgb: HEATING_RGB, alpha });
      }
    }
    return out;
  }

  _spawnCircular(t) {
    if (this._circular.size >= MAX_CIRCULAR) return;
    if (t < this._nextCircularSpawnAt) return;

    const { i, j } = this._pickNode();
    const key = this._key(i, j);
    if (this._isOccupied(key)) return;

    this._circular.set(key, { i, j, state: 'ringIn', stateStart: t });
    this._nextCircularSpawnAt = t + this._randomBetween(CIRCULAR_SPAWN_GAP_MIN, CIRCULAR_SPAWN_GAP_MAX);
  }

  _stepCircular(t) {
    const out = [];
    for (const [key, node] of this._circular) {
      const elapsed = t - node.stateStart;

      switch (node.state) {
        case 'ringIn': {
          const ringAlpha = Math.min(1, elapsed / CIRCULAR_RING_IN);
          if (elapsed >= CIRCULAR_RING_IN) {
            node.state = 'nodeOut';
            node.stateStart = t;
          }
          out.push({ i: node.i, j: node.j, ringAlpha, ringGrowth: ringAlpha, nodeAlpha: 1 });
          break;
        }
        case 'nodeOut': {
          const nodeAlpha = Math.max(0, 1 - elapsed / CIRCULAR_NODE_OUT);
          if (elapsed >= CIRCULAR_NODE_OUT) {
            node.state = 'hold';
            node.stateStart = t;
          }
          out.push({ i: node.i, j: node.j, ringAlpha: 1, ringGrowth: 1, nodeAlpha });
          break;
        }
        case 'hold': {
          if (elapsed >= CIRCULAR_HOLD) {
            node.state = 'nodeIn';
            node.stateStart = t;
          }
          out.push({ i: node.i, j: node.j, ringAlpha: 1, ringGrowth: 1, nodeAlpha: 0 });
          break;
        }
        case 'nodeIn': {
          const nodeAlpha = Math.min(1, elapsed / CIRCULAR_NODE_IN);
          if (elapsed >= CIRCULAR_NODE_IN) {
            node.state = 'ringOut';
            node.stateStart = t;
          }
          out.push({ i: node.i, j: node.j, ringAlpha: 1, ringGrowth: 1, nodeAlpha });
          break;
        }
        case 'ringOut': {
          const ringAlpha = Math.max(0, 1 - elapsed / CIRCULAR_RING_OUT);
          if (elapsed >= CIRCULAR_RING_OUT) {
            this._circular.delete(key);
            continue;
          }
          out.push({ i: node.i, j: node.j, ringAlpha, ringGrowth: 1, nodeAlpha: 1 });
          break;
        }
        default:
          break;
      }
    }
    return out;
  }
}

export { HEATING_RGB, COMPUTE_RGB, CIRCULAR_RGB };
