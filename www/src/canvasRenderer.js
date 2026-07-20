import { HEATING_RGB, COMPUTE_RGB, CIRCULAR_RGB } from './nodeEffects.js';

/**
 * CanvasRenderer — the only module aware of the `<canvas>` and its 2D context.
 * It renders a WaveField frame (the projected `points` grid) but knows nothing
 * about how that grid is computed, keeping drawing and modelling separate.
 */
export class CanvasRenderer {
  /** @param {HTMLCanvasElement} canvas */
  constructor(canvas) {
    this._canvas = canvas;
    this._ctx = canvas.getContext('2d');
    this._w = 0;
    this._h = 0;
  }

  /** Size the backing store for a given CSS viewport and device pixel ratio. */
  resize(width, height, pixelRatio) {
    this._w = width;
    this._h = height;
    this._canvas.width = Math.round(width * pixelRatio);
    this._canvas.height = Math.round(height * pixelRatio);
    this._canvas.style.width = `${width}px`;
    this._canvas.style.height = `${height}px`;
    this._ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  }

  /**
   * Draw one frame: a triangulated wireframe (edges) with a node at every
   * intersection, both fading towards the horizon, plus an optional overlay
   * layer of scripted per-node effects (heating/computation blinks, circular
   * exchange rings) supplied independently of the wave geometry.
   * @param {Array<Array<{x:number,y:number,alpha:number,v:number}>>} points
   * @param {string} rgb brand colour as an "r, g, b" string
   * @param {object} [effects]
   * @param {Array<{i:number,j:number,glowAlpha:number,computing:boolean}>} [effects.heatingNodes]
   * @param {Array<{i:number,j:number,ringAlpha:number,ringGrowth:number,nodeAlpha:number}>} [effects.circularNodes]
   */
  draw(points, rgb, effects = {}) {
    const ctx = this._ctx;
    ctx.clearRect(0, 0, this._w, this._h);
    if (!points.length) return;

    const rows = points.length - 1;
    const cols = points[0].length - 1;
    const heatingByKey = new Map();
    for (const h of effects.heatingNodes || []) heatingByKey.set(`${h.i},${h.j}`, h);
    const circularByKey = new Map();
    for (const c of effects.circularNodes || []) circularByKey.set(`${c.i},${c.j}`, c);

    // Edges: connect each point to its right, down and diagonal neighbour.
    ctx.lineWidth = 1;
    for (let j = 0; j <= rows; j++) {
      for (let i = 0; i <= cols; i++) {
        const a = points[j][i];
        const right = i < cols ? points[j][i + 1] : null;
        const down = j < rows ? points[j + 1][i] : null;
        const diag = i < cols && j < rows ? points[j + 1][i + 1] : null;
        for (const b of [right, down, diag]) {
          if (!b) continue;
          const alpha = Math.min(a.alpha, b.alpha) * 0.45;
          if (alpha < 0.01) continue;
          ctx.strokeStyle = `rgba(${rgb}, ${alpha.toFixed(3)})`;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }

    // Nodes: dots at every intersection, larger and stronger up close.
    for (let j = 0; j <= rows; j++) {
      for (let i = 0; i <= cols; i++) {
        const p = points[j][i];
        if (p.alpha < 0.02) continue;
        const key = `${i},${j}`;
        const circular = circularByKey.get(key);
        const heating = heatingByKey.get(key);
        const nodeAlphaMul = circular ? circular.nodeAlpha : 1;
        const r = 0.5 + 1.9 * p.v;

        // Heat glow: a soft outward gradient beneath the node, never
        // recoloring the node itself.
        if (heating && nodeAlphaMul > 0.01) {
          const glowRadius = r + (4 + 9 * p.v);
          const glowStrength = Math.min(1, heating.glowAlpha * p.alpha * 1.3) * nodeAlphaMul;
          if (glowStrength > 0.01) {
            const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowRadius);
            gradient.addColorStop(0, `rgba(${HEATING_RGB}, ${glowStrength.toFixed(3)})`);
            gradient.addColorStop(1, `rgba(${HEATING_RGB}, 0)`);
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(p.x, p.y, glowRadius, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        if (nodeAlphaMul > 0.01) {
          const computing = heating && heating.computing;
          const fillRgb = computing ? COMPUTE_RGB : rgb;
          const baseAlpha = computing ? Math.min(1, p.alpha * 0.9 + 0.3) : p.alpha * 0.9;
          const alpha = Math.min(1, baseAlpha) * nodeAlphaMul;
          ctx.fillStyle = `rgba(${fillRgb}, ${alpha.toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
          ctx.fill();
        }

        if (circular) {
          const ringRadius = r + circular.ringGrowth * (5 + 6 * p.v);
          const ringAlpha = Math.min(1, circular.ringAlpha * p.alpha * 1.4);
          if (ringAlpha > 0.01) {
            ctx.strokeStyle = `rgba(${CIRCULAR_RGB}, ${ringAlpha.toFixed(3)})`;
            ctx.lineWidth = 1.25;
            ctx.beginPath();
            ctx.arc(p.x, p.y, ringRadius, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
      }
    }
  }
}
