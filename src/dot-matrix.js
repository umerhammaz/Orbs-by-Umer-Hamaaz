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
  'depthSort', 'inertia', 'lockAxis', 'interactive',
  'view', 'viewX', 'viewY', 'viewZ', 'panX', 'panY', 'motion', 'swing', 'dolly',
  'snapToDetent', 'absorption'
];

// Camera presets: [pitch, yaw, roll] in radians
const VIEWS = {
  free: [0, 0, 0],
  front: [0, 0, 0],
  back: [0, Math.PI, 0],
  top: [Math.PI / 2, 0, 0],
  side: [0, Math.PI / 2, 0],
  iso: [0.6155, Math.PI / 4, 0],
  high: [0.8, 0.3, 0],
  low: [-0.5, 0.3, 0],
  dutch: [0.35, 0.5, 0.45]
};

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
      view: options.view || 'free',
      viewX: options.viewX ?? 0,
      viewY: options.viewY ?? 0,
      viewZ: options.viewZ ?? 0,
      panX: options.panX ?? 0,
      panY: options.panY ?? 0,
      motion: options.motion || 'spin',
      swing: options.swing ?? 0.6,
      dolly: options.dolly ?? 0,
      snapToDetent: options.snapToDetent ?? true,
      absorption: options.absorption ?? true,
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
    this.mouse = { isDown: false, lastX: 0, lastY: 0, isPan: false };
    this._vx = 0;
    this._vy = 0;
    this._latched = false;

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
      this.mouse.isPan = e.shiftKey || e.button === 1 || e.button === 2;
      this.mouse.lastX = e.clientX;
      this.mouse.lastY = e.clientY;
      this.spinX = 0;
      this.spinY = 0;
      this._vx = 0;
      this._vy = 0;
      this._latched = false;
      this._lastMove = performance.now();
    };
    this._onMove = (e) => {
      if (!this.mouse.isDown) return;
      const rawDx = e.clientX - this.mouse.lastX;
      const rawDy = e.clientY - this.mouse.lastY;
      if (!Number.isFinite(rawDx) || !Number.isFinite(rawDy)) return;

      // Anti-hammering / high-power attack bounds clamp
      const cx = clamp(rawDx, -40, 40);
      const cy = clamp(rawDy, -40, 40);

      this.mouse.lastX = e.clientX;
      this.mouse.lastY = e.clientY;
      this._lastMove = performance.now();

      if (this.mouse.isPan) {
        const scale = 1 / (this.size || 300);
        const dpx = cx * scale;
        const dpy = cy * scale;
        this.opts.panX = clamp(this.opts.panX + dpx, -1.2, 1.2);
        this.opts.panY = clamp(this.opts.panY + dpy, -1.2, 1.2);
      } else {
        const lock = this.opts.lockAxis;
        const dx = lock === 'x' ? 0 : cx * 0.005;
        const dy = lock === 'y' ? 0 : cy * 0.005;
        this.ay += dx;
        this.ax += dy;

        // Exponential leaky velocity integrator
        this._vx = this._vx * 0.35 + dx * 0.65;
        this._vy = this._vy * 0.35 + dy * 0.65;
        this.spinY = dx;
        this.spinX = dy;
      }
    };
    this._onUp = () => {
      if (!this.mouse.isDown) return;
      this.mouse.isDown = false;
      const timeSinceMove = performance.now() - (this._lastMove || 0);

      if (this.opts.absorption) {
        // Drop lock: manual intervention halts perpetual auto-spin
        this.opts.motion = 'still';

        const energy = this._vx * this._vx + this._vy * this._vy;
        if (timeSinceMove > 50 || energy < 0.00015) {
          // Zone 1: Deadband drop - immediate total momentum arrest
          this.spinX = 0;
          this.spinY = 0;
          this._vx = 0;
          this._vy = 0;
        } else if (energy < 0.0025) {
          // Zone 2: Viscous siphon
          this.spinX = clamp(this._vy * 0.35, -0.02, 0.02);
          this.spinY = clamp(this._vx * 0.35, -0.02, 0.02);
        } else {
          // Zone 3: Controlled bounded flick
          this.spinX = clamp(this._vy * 0.6, -0.05, 0.05);
          this.spinY = clamp(this._vx * 0.6, -0.05, 0.05);
        }
      } else if (this.opts.inertia <= 0 || timeSinceMove > 80) {
        this.spinX = 0;
        this.spinY = 0;
      }
    };
    this._onContextMenu = (e) => {
      if (this.opts.interactive) e.preventDefault();
    };
    this._onDblClick = () => {
      this.opts.motion = this.opts.motion === 'spin' ? 'still' : 'spin';
    };
    this._onWheel = (e) => {
      if (!this.opts.wheelZoom) return;
      e.preventDefault();
      this.opts.zoom = clamp(this.opts.zoom * Math.exp(-e.deltaY * 0.001), 0.3, 3);
    };

    this.canvas.addEventListener('pointerdown', this._onDown);
    this.canvas.addEventListener('contextmenu', this._onContextMenu);
    this.canvas.addEventListener('dblclick', this._onDblClick);
    window.addEventListener('pointermove', this._onMove);
    window.addEventListener('pointerup', this._onUp);
    window.addEventListener('pointercancel', this._onUp);
    this.canvas.addEventListener('wheel', this._onWheel, { passive: false });
  }

  updateOptions(newOpts = {}) {
    const { shapeParams, shape, ...rest } = newOpts;
    const prevDensity = this.opts.density;
    const prevSeed = this.opts.seed;
    const prevMotion = this.opts.motion;
    const prevView = this.opts.view;

    if (rest.density !== undefined) rest.density = clamp(Number(rest.density) || 1, 0.1, 4);
    Object.assign(this.opts, rest);
    this._syncColors();

    if ((rest.motion !== undefined && rest.motion !== prevMotion) ||
        (rest.view !== undefined && rest.view !== prevView)) {
      this.ax = 0;
      this.ay = 0;
      this.az = 0;
      this.spinX = 0;
      this.spinY = 0;
    }

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
      const auto = opts.motion === 'spin';
      this.ax += ((auto ? opts.speedX : 0) + this.spinX) * dtf;
      this.ay += ((auto ? opts.speedY : 0) + this.spinY) * dtf;
      this.az += (auto ? opts.speedZ : 0) * dtf;

      // Resilient kinetic absorption decay
      const decay = opts.absorption
        ? Math.pow(Math.min(opts.inertia > 0 ? opts.inertia : 0.82, 0.92), dtf)
        : Math.pow(opts.inertia, dtf);

      this.spinX *= decay;
      this.spinY *= decay;

      if (Math.abs(this.spinX) < 0.00008) this.spinX = 0;
      if (Math.abs(this.spinY) < 0.00008) this.spinY = 0;

      // Magnetic Detent Basin (Snap to Top & Cardinal Anchors)
      if (opts.snapToDetent && Math.abs(this.spinX) < 0.018 && Math.abs(this.spinY) < 0.018) {
        const normPitch = ((this.ax % TAU) + TAU + Math.PI) % TAU - Math.PI;
        const detentPitch = Math.PI / 2; // Top orientation
        const diffPitch = detentPitch - normPitch;

        // Gravitational basin capture (~20 degrees)
        if (Math.abs(diffPitch) < 0.35) {
          const pull = diffPitch * 0.14 * dtf;
          this.ax += pull;
          this.spinX *= 0.6;
          if (Math.abs(diffPitch) < 0.002) {
            this.ax += diffPitch;
            this.spinX = 0;
            this._latched = true;
          }
        }

        // Spatial Pan Detent (Top shelf snap if dropped near top: panY ~ -0.38)
        if (opts.panY < -0.25 && opts.panY > -0.55) {
          const diffPan = -0.38 - opts.panY;
          opts.panY += diffPan * 0.15 * dtf;
          if (Math.abs(diffPan) < 0.003) opts.panY = -0.38;
        }
      }
    }

    const vw = VIEWS[opts.view] || VIEWS.free;
    let swX = 0, swY = 0;
    if (opts.motion === 'sway') {
      const ph = this.t * opts.speedY;
      swY = Math.sin(ph) * opts.swing;
      swX = Math.sin(ph * 0.7 + 1) * opts.swing * 0.5;
    }
    const aX = this.ax + vw[0] + opts.viewX + swX;
    const aY = this.ay + vw[1] + opts.viewY + swY;
    const aZ = this.az + vw[2] + opts.viewZ;
    const cosX = Math.cos(aX), sinX = Math.sin(aX);
    const cosY = Math.cos(aY), sinY = Math.sin(aY);
    const cosZ = Math.cos(aZ), sinZ = Math.sin(aZ);
    const ortho = opts.projection === 'orthographic';
    const zoom = opts.zoom * (1 + opts.dolly * Math.sin(this.t * 0.03));
    const zoomR = Math.sqrt(zoom);
    const panX = opts.panX * size;
    const panY = opts.panY * size;
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
      o.px = w / 2 + panX + x3 * s * zoom;
      o.py = h / 2 + panY + y3 * s * zoom;
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
      this.canvas.removeEventListener('contextmenu', this._onContextMenu);
      this.canvas.removeEventListener('dblclick', this._onDblClick);
      this.canvas.removeEventListener('wheel', this._onWheel);
      window.removeEventListener('pointermove', this._onMove);
      window.removeEventListener('pointerup', this._onUp);
      window.removeEventListener('pointercancel', this._onUp);
    }
    this.canvas.remove();
  }
}