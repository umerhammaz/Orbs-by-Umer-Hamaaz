import { SHAPES, TAU, makeContext, resolveParams } from './shapes.js';

/**
 * DotMatrix3D
 * Lightweight, zero-dependency 3D volumetric point-lattice canvas renderer.
 * Shapes live in ./shapes.js as a registry with parameter schemas.
 */

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

function parseColor(str, fallback) {
  const parts = String(str).split(',').map((s) => Number(s.trim()));
  if (parts.length < 3 || parts.some((n) => !Number.isFinite(n))) return fallback;
  return parts.slice(0, 3).map((n) => clamp(Math.round(n), 0, 255));
}

function mixColor(a, b, t) {
  const [ar, ag, ab] = a;
  const [br, bg, bb] = b;
  return `${(ar + (br - ar) * t) | 0}, ${(ag + (bg - ag) * t) | 0}, ${(ab + (bb - ab) * t) | 0}`;
}

const ALPHA_BUCKETS = 16;
const STATE_KEYS = [
  'shape', 'color', 'color2', 'colorMode', 'trail', 'speedX', 'speedY', 'speedZ', 'fov',
  'pointSize', 'density', 'seed', 'projection', 'zoom', 'depthFade', 'sizeByDepth',
  'depthSort', 'inertia', 'lockAxis', 'interactive'
];

export default class DotMatrix {
  static get shapes() {
    return Object.keys(SHAPES);
  }

  static getSchema(name) {
    return SHAPES[name] ? SHAPES[name].params : {};
  }

  static getLabel(name) {
    return SHAPES[name] ? SHAPES[name].label : name;
  }

  constructor(target, options = {}) {
    this.container = typeof target === 'string' ? document.querySelector(target) : target;
    if (!this.container) throw new Error(`[DotMatrix] Target element "${target}" not found.`);

    this.opts = {
      shape: options.shape || 'cube',
      color: options.color || '255, 255, 255',
      color2: options.color2 || '90, 90, 90',
      colorMode: options.colorMode || 'solid',
      trail: options.trail ?? 0.25,
      speedX: options.speedX ?? 0.012,
      speedY: options.speedY ?? 0.018,
      speedZ: options.speedZ ?? 0,
      fov: options.fov ?? 360,
      interactive: options.interactive ?? true,
      autoStart: options.autoStart ?? true,
      pointSize: options.pointSize ?? 2.2,
      density: options.density ?? 1,
      seed: options.seed ?? 1337,
      projection: options.projection || 'perspective',
      zoom: options.zoom ?? 1,
      depthFade: options.depthFade ?? 1,
      sizeByDepth: options.sizeByDepth ?? 1,
      depthSort: options.depthSort ?? false,
      inertia: options.inertia ?? 0,
      lockAxis: options.lockAxis || 'none',
      wheelZoom: options.wheelZoom ?? false,
      onFrame: options.onFrame || null
    };

    this.params = {};
    if (options.shapeParams) {
      for (const [name, vals] of Object.entries(options.shapeParams)) this.params[name] = { ...vals };
    }

    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.canvas.style.display = 'block';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.container.appendChild(this.canvas);

    const [rx = 0, ry = 0, rz = 0] = options.initialRotation || [];
    this.ax = rx;
    this.ay = ry;
    this.az = rz;
    this.spinX = 0;
    this.spinY = 0;
    this.t = 0;
    this.fps = 60;
    this.running = false;
    this.points = [];
    this.def = null;
    this.P = {};
    this.sc = null;
    this._last = 0;
    this._lastMove = 0;
    this._builtSize = 0;
    this._pool = [];
    this._buckets = Array.from({ length: ALPHA_BUCKETS }, () => []);
    this.mouse = { isDown: false, lastX: 0, lastY: 0 };

    this._syncColors();
    this.resize();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(this.container);

    if (this.opts.interactive) this.bindEvents();

    this.setShape(this.opts.shape);

    if (this.opts.autoStart) this.start();
  }

  _syncColors() {
    this._rgb = parseColor(this.opts.color, [255, 255, 255]);
    this._rgb2 = parseColor(this.opts.color2, [90, 90, 90]);
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = this.container.clientWidth || 300;
    this.h = this.container.clientHeight || 300;
    this.canvas.width = Math.floor(this.w * dpr);
    this.canvas.height = Math.floor(this.h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.size = Math.min(this.w, this.h);
    if (this.points.length && Math.abs(this.size - this._builtSize) > 0.5) this._build();
  }

  bindEvents() {
    this._onDown = (e) => {
      this.mouse.isDown = true;
      this.mouse.lastX = e.clientX;
      this.mouse.lastY = e.clientY;
      this.spinX = 0;
      this.spinY = 0;
    };
    this._onMove = (e) => {
      if (!this.mouse.isDown) return;
      const lock = this.opts.lockAxis;
      const dx = lock === 'x' ? 0 : (e.clientX - this.mouse.lastX) * 0.005;
      const dy = lock === 'y' ? 0 : (e.clientY - this.mouse.lastY) * 0.005;
      this.ay += dx;
      this.ax += dy;
      this.spinY = dx;
      this.spinX = dy;
      this._lastMove = performance.now();
      this.mouse.lastX = e.clientX;
      this.mouse.lastY = e.clientY;
    };
    this._onUp = () => {
      if (!this.mouse.isDown) return;
      this.mouse.isDown = false;
      if (this.opts.inertia <= 0 || performance.now() - this._lastMove > 80) {
        this.spinX = 0;
        this.spinY = 0;
      }
    };
    this._onWheel = (e) => {
      if (!this.opts.wheelZoom) return;
      e.preventDefault();
      this.opts.zoom = clamp(this.opts.zoom * Math.exp(-e.deltaY * 0.001), 0.3, 3);
    };

    this.canvas.addEventListener('pointerdown', this._onDown);
    window.addEventListener('pointermove', this._onMove);
    window.addEventListener('pointerup', this._onUp);
    window.addEventListener('pointercancel', this._onUp);
    this.canvas.addEventListener('wheel', this._onWheel, { passive: false });
  }

  updateOptions(newOpts = {}) {
    const { shapeParams, shape, ...rest } = newOpts;
    const prevDensity = this.opts.density;
    const prevSeed = this.opts.seed;

    if (rest.density !== undefined) rest.density = clamp(Number(rest.density) || 1, 0.1, 4);
    Object.assign(this.opts, rest);
    this._syncColors();

    if (shapeParams) {
      for (const [name, vals] of Object.entries(shapeParams)) {
        this.params[name] = { ...this.params[name], ...vals };
      }
    }

    const rebuild = shape !== undefined || !!shapeParams ||
      this.opts.density !== prevDensity || this.opts.seed !== prevSeed;
    if (rebuild) this.setShape(shape || this.opts.shape);
  }

  setShape(name) {
    if (!SHAPES[name]) name = 'cube';
    this.opts.shape = name;
    this.def = SHAPES[name];
    this.P = resolveParams(name, this.params[name]);
    this._build();
  }

  _build() {
    if (!this.def) return;
    this.sc = makeContext({ R: this.size * 0.28, seed: this.opts.seed, density: this.opts.density });
    this.points = this.def.generate(this.sc, this.P);
    this._builtSize = this.size;
  }

  setShapeParam(key, value, shape = this.opts.shape) {
    const schema = SHAPES[shape] && SHAPES[shape].params[key];
    if (!schema) return false;
    this.params[shape] = { ...this.params[shape], [key]: value };
    if (shape === this.opts.shape) {
      this.P = resolveParams(shape, this.params[shape]);
      if (!schema.live) this._build();
    }
    return true;
  }

  resetShapeParams(shape = this.opts.shape) {
    delete this.params[shape];
    if (shape === this.opts.shape) this.setShape(shape);
  }

  getState() {
    const state = {};
    for (const key of STATE_KEYS) {
      const v = this.opts[key];
      state[key] = typeof v === 'number' ? +v.toFixed(5) : v;
    }
    const schema = DotMatrix.getSchema(this.opts.shape);
    const over = this.params[this.opts.shape] || {};
    const diff = {};
    for (const [k, v] of Object.entries(over)) {
      if (schema[k] && schema[k].def !== v) diff[k] = v;
    }
    if (Object.keys(diff).length) state.shapeParams = { [this.opts.shape]: diff };
    return state;
  }

  setState(state = {}) {
    this.params = {};
    this.updateOptions({ ...state, shapeParams: state.shapeParams || {} });
  }

  start() {
    if (this.running) return;
    this.running = true;
    this._last = 0;
    this.raf = requestAnimationFrame((ts) => this.loop(ts));
  }

  stop() {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
  }

  toggle() {
    this.running ? this.stop() : this.start();
  }

  loop(ts) {
    if (!this.running) return;
    const now = typeof ts === 'number' ? ts : performance.now();
    const dt = this._last ? clamp((now - this._last) / 1000, 0.001, 0.1) : 1 / 60;
    this._last = now;
    const dtf = dt * 60;
    this.t += dtf;
    this.fps += (1 / dt - this.fps) * 0.1;

    const { ctx, w, h, size, opts } = this;

    ctx.fillStyle = `rgba(0, 0, 0, ${opts.trail})`;
    ctx.fillRect(0, 0, w, h);

    if (this.def && this.def.update) this.def.update(this.sc, this.P, this.points, this.t, dtf);

    if (!this.mouse.isDown) {
      this.ax += (opts.speedX + this.spinX) * dtf;
      this.ay += (opts.speedY + this.spinY) * dtf;
      this.az += opts.speedZ * dtf;
      const decay = Math.pow(opts.inertia, dtf);
      this.spinX *= decay;
      this.spinY *= decay;
    }

    const cosX = Math.cos(this.ax), sinX = Math.sin(this.ax);
    const cosY = Math.cos(this.ay), sinY = Math.sin(this.ay);
    const cosZ = Math.cos(this.az), sinZ = Math.sin(this.az);
    const ortho = opts.projection === 'orthographic';
    const zoom = opts.zoom;
    const zoomR = Math.sqrt(zoom);
    const fov = opts.fov;
    const pool = this._pool;
    let n = 0;

    for (const p of this.points) {
      const x1 = p.x * cosY + p.z * sinY;
      const z1 = -p.x * sinY + p.z * cosY;
      const y2 = p.y * cosX - z1 * sinX;
      const z2 = p.y * sinX + z1 * cosX;
      const x3 = x1 * cosZ - y2 * sinZ;
      const y3 = x1 * sinZ + y2 * cosZ;

      const s = ortho ? 1 : fov / (fov + z2 + size * 0.4);
      const nn = clamp((z2 + size * 0.32) / (size * 0.64), 0, 1);
      const o = pool[n] || (pool[n] = {});
      o.px = w / 2 + x3 * s * zoom;
      o.py = h / 2 + y3 * s * zoom;
      o.r = Math.max(0.4, opts.pointSize * (1 + (s - 1) * opts.sizeByDepth) * zoomR);
      o.a = clamp(1 - opts.depthFade * (1 - nn), 0.12, 1);
      o.z = z2;
      o.m = opts.colorMode === 'height' ? clamp(0.5 + y3 / (size * 0.56), 0, 1) : 1 - nn;
      n++;
    }

    const solid = opts.colorMode === 'solid';
    if (solid && !opts.depthSort) {
      const buckets = this._buckets;
      for (const b of buckets) b.length = 0;
      for (let i = 0; i < n; i++) {
        const o = pool[i];
        const b = Math.min(ALPHA_BUCKETS - 1, Math.max(0, Math.ceil(o.a * ALPHA_BUCKETS) - 1));
        buckets[b].push(o);
      }
      for (let b = 0; b < ALPHA_BUCKETS; b++) {
        const list = buckets[b];
        if (!list.length) continue;
        ctx.fillStyle = `rgba(${opts.color}, ${(b + 1) / ALPHA_BUCKETS})`;
        ctx.beginPath();
        for (const o of list) {
          ctx.moveTo(o.px + o.r, o.py);
          ctx.arc(o.px, o.py, o.r, 0, TAU);
        }
        ctx.fill();
      }
    } else {
      const list = opts.depthSort ? pool.slice(0, n).sort((a, b) => b.z - a.z) : pool;
      const count = opts.depthSort ? list.length : n;
      for (let i = 0; i < count; i++) {
        const o = list[i];
        ctx.beginPath();
        ctx.arc(o.px, o.py, o.r, 0, TAU);
        ctx.fillStyle = solid
          ? `rgba(${opts.color}, ${o.a})`
          : `rgba(${mixColor(this._rgb, this._rgb2, o.m)}, ${o.a})`;
        ctx.fill();
      }
    }

    if (opts.onFrame) {
      opts.onFrame({
        points: this.points.length,
        ax: this.ax,
        ay: this.ay,
        az: this.az,
        t: this.t,
        fps: this.fps,
        dt
      });
    }

    this.raf = requestAnimationFrame((next) => this.loop(next));
  }

  destroy() {
    this.stop();
    this.ro.disconnect();
    if (this._onDown) {
      this.canvas.removeEventListener('pointerdown', this._onDown);
      this.canvas.removeEventListener('wheel', this._onWheel);
      window.removeEventListener('pointermove', this._onMove);
      window.removeEventListener('pointerup', this._onUp);
      window.removeEventListener('pointercancel', this._onUp);
    }
    this.canvas.remove();
  }
}