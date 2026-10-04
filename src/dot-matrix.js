/**
 * DotMatrix3D
 * Lightweight, zero-dependency 3D volumetric point-lattice canvas renderer.
 */
export default class DotMatrix {
  constructor(target, options = {}) {
    this.container = typeof target === 'string' ? document.querySelector(target) : target;
    if (!this.container) throw new Error(`[DotMatrix] Target element "${target}" not found.`);

    this.opts = {
      shape: options.shape || 'cube',
      color: options.color || '255, 255, 255',
      trail: options.trail ?? 0.25,
      speedX: options.speedX ?? 0.012,
      speedY: options.speedY ?? 0.018,
      fov: options.fov ?? 360,
      interactive: options.interactive ?? true,
      autoStart: options.autoStart ?? true,
      pointSize: options.pointSize ?? 2.2,
      density: options.density ?? 1,
      onFrame: options.onFrame || null
    };

    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.canvas.style.display = 'block';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.container.appendChild(this.canvas);

    this.ax = 0;
    this.ay = 0;
    this.t = 0;
    this.running = false;
    this.points = [];
    this.mouse = { x: 0, y: 0, targetX: 0, targetY: 0, isDown: false, lastX: 0, lastY: 0 };

    this.resize();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(this.container);

    if (this.opts.interactive) {
      this.bindEvents();
    }

    this.setShape(this.opts.shape);

    if (this.opts.autoStart) {
      this.start();
    }
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = this.container.clientWidth || 300;
    this.h = this.container.clientHeight || 300;
    this.canvas.width = Math.floor(this.w * dpr);
    this.canvas.height = Math.floor(this.h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.size = Math.min(this.w, this.h);
    if (this.points.length && !['wave', 'breathing-cube'].includes(this.opts.shape)) {
      this.setShape(this.opts.shape);
    }
  }

  bindEvents() {
    this.canvas.addEventListener('pointerdown', (e) => {
      this.mouse.isDown = true;
      this.mouse.lastX = e.clientX;
      this.mouse.lastY = e.clientY;
    });

    window.addEventListener('pointermove', (e) => {
      if (!this.mouse.isDown) return;
      const dx = e.clientX - this.mouse.lastX;
      const dy = e.clientY - this.mouse.lastY;
      this.ay += dx * 0.005;
      this.ax += dy * 0.005;
      this.mouse.lastX = e.clientX;
      this.mouse.lastY = e.clientY;
    });

    window.addEventListener('pointerup', () => {
      this.mouse.isDown = false;
    });
  }

  updateOptions(newOpts = {}) {
    Object.assign(this.opts, newOpts);
    if (newOpts.density !== undefined || newOpts.shape !== undefined) {
      this.setShape(newOpts.shape || this.opts.shape);
    }
  }

  setShape(name) {
    this.opts.shape = name;
    const r = this.size * 0.28;
    const pts = [];

    switch (name) {
      case 'sphere': {
        const count = Math.floor(550 * this.opts.density);
        for (let i = 0; i < count; i++) {
          const phi = Math.acos(1 - 2 * (i + 0.5) / count);
          const theta = Math.PI * (1 + Math.sqrt(5)) * i;
          pts.push({
            x: r * Math.sin(phi) * Math.cos(theta),
            y: r * Math.sin(phi) * Math.sin(theta),
            z: r * Math.cos(phi)
          });
        }
        break;
      }

      case 'hollow-cube': {
        const N = 9;
        const sp = (r * 2) / (N - 1);
        const off = (N - 1) * sp / 2;
        for (let x = 0; x < N; x++) {
          for (let y = 0; y < N; y++) {
            for (let z = 0; z < N; z++) {
              if (x === 0 || x === N - 1 || y === 0 || y === N - 1 || z === 0 || z === N - 1) {
                pts.push({ x: x * sp - off, y: y * sp - off, z: z * sp - off });
              }
            }
          }
        }
        break;
      }

      case 'torus': {
        const R = r * 0.85;
        const tr = r * 0.35;
        const uSteps = 28;
        const vSteps = 16;
        for (let u = 0; u < uSteps; u++) {
          const a1 = (u / uSteps) * Math.PI * 2;
          for (let v = 0; v < vSteps; v++) {
            const a2 = (v / vSteps) * Math.PI * 2;
            pts.push({
              x: (R + tr * Math.cos(a2)) * Math.cos(a1),
              y: (R + tr * Math.cos(a2)) * Math.sin(a1),
              z: tr * Math.sin(a2)
            });
          }
        }
        break;
      }

      case 'breathing-cube': {
        const N = 8;
        const baseScale = (r * 2) / (N - 1);
        const off = (N - 1) * baseScale / 2;
        for (let x = 0; x < N; x++) {
          for (let y = 0; y < N; y++) {
            for (let z = 0; z < N; z++) {
              pts.push({
                bx: x * baseScale - off,
                by: y * baseScale - off,
                bz: z * baseScale - off,
                x: 0, y: 0, z: 0
              });
            }
          }
        }
        break;
      }

      case 'helix': {
        const count = Math.floor(300 * this.opts.density);
        const hr = r * 0.65;
        for (let i = 0; i < count; i++) {
          const a = i * 0.16;
          const y = (i - count / 2) * (r * 2.2 / count);
          pts.push({ x: Math.cos(a) * hr, y, z: Math.sin(a) * hr });
          pts.push({ x: Math.cos(a + Math.PI) * hr, y, z: Math.sin(a + Math.PI) * hr });
        }
        break;
      }

      case 'wave': {
        const N = 22;
        const sp = (r * 2.6) / (N - 1);
        const off = (N - 1) * sp / 2;
        for (let x = 0; x < N; x++) {
          for (let z = 0; z < N; z++) {
            const px = x * sp - off;
            const pz = z * sp - off;
            pts.push({ x: px, y: 0, z: pz, bx: px, bz: pz });
          }
        }
        break;
      }

      case 'galaxy': {
        const arms = 3;
        const count = Math.floor(650 * this.opts.density);
        for (let i = 0; i < count; i++) {
          const arm = i % arms;
          const rad = (i / count) * r * 1.2;
          const a = (arm * (Math.PI * 2 / arms)) + rad * 0.04;
          pts.push({
            x: Math.cos(a) * rad + (Math.random() - 0.5) * 14,
            y: (Math.random() - 0.5) * 16,
            z: Math.sin(a) * rad + (Math.random() - 0.5) * 14
          });
        }
        break;
      }

      case 'cylinder': {
        const rings = 18;
        const perRing = 26;
        const cr = r * 0.75;
        const h = r * 2;
        for (let i = 0; i < rings; i++) {
          const z = (i / (rings - 1)) * h - h / 2;
          for (let j = 0; j < perRing; j++) {
            const a = (j / perRing) * Math.PI * 2;
            pts.push({ x: Math.cos(a) * cr, y: Math.sin(a) * cr, z });
          }
        }
        break;
      }

      case 'chaos': {
        const count = Math.floor(450 * this.opts.density);
        for (let i = 0; i < count; i++) {
          pts.push({
            x: (Math.random() - 0.5) * r * 2,
            y: (Math.random() - 0.5) * r * 2,
            z: (Math.random() - 0.5) * r * 2
          });
        }
        break;
      }

      case 'rubik': {
        pts.push(...this.initRubik(r));
        break;
      }

      case 'tesseract': {
        pts.push(...this.initTesseract(r));
        break;
      }

      case 'blackhole': {
        pts.push(...this.initBlackhole(r));
        break;
      }

      case 'gyroid': {
        pts.push(...this.initGyroid(r));
        break;
      }

      case 'neural': {
        pts.push(...this.initNeural(r));
        break;
      }

      case 'cube':
      default: {
        const N = 9;
        const sp = (r * 2) / (N - 1);
        const off = (N - 1) * sp / 2;
        for (let x = 0; x < N; x++) {
          for (let y = 0; y < N; y++) {
            for (let z = 0; z < N; z++) {
              pts.push({ x: x * sp - off, y: y * sp - off, z: z * sp - off });
            }
          }
        }
        break;
      }
    }

    this.points = pts;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.loop();
  }

  stop() {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
  }

  toggle() {
    this.running ? this.stop() : this.start();
  }

  loop() {
    if (!this.running) return;
    this.t++;
    const { ctx, w, h, size, opts } = this;

    ctx.fillStyle = `rgba(0, 0, 0, ${opts.trail})`;
    ctx.fillRect(0, 0, w, h);

    if (opts.shape === 'wave') {
      for (const p of this.points) {
        p.y = Math.sin(Math.hypot(p.bx, p.bz) * 0.05 - this.t * 0.07) * (size * 0.07);
      }
    } else if (opts.shape === 'breathing-cube') {
      const scale = 1 + Math.sin(this.t * 0.05) * 0.35;
      for (const p of this.points) {
        p.x = p.bx * scale;
        p.y = p.by * scale;
        p.z = p.bz * scale;
      }
    } else if (opts.shape === 'rubik') {
      this.updateRubik();
    } else if (opts.shape === 'tesseract') {
      this.updateTesseract(size * 0.28);
    } else if (opts.shape === 'blackhole') {
      this.updateBlackhole(size * 0.28);
    } else if (opts.shape === 'gyroid') {
      this.updateGyroid(size * 0.28);
    } else if (opts.shape === 'neural') {
      this.updateNeural();
    }

    if (!this.mouse.isDown) {
      this.ax += opts.speedX;
      this.ay += opts.speedY;
    }

    const cosX = Math.cos(this.ax), sinX = Math.sin(this.ax);
    const cosY = Math.cos(this.ay), sinY = Math.sin(this.ay);

    for (const p of this.points) {
      const x1 = p.x * cosY + p.z * sinY;
      const z1 = -p.x * sinY + p.z * cosY;
      const y2 = p.y * cosX - z1 * sinX;
      const z2 = p.y * sinX + z1 * cosX;

      const fov = opts.fov;
      const depth = fov / (fov + z2 + size * 0.4);
      const px = w / 2 + x1 * depth;
      const py = h / 2 + y2 * depth;
      const radius = Math.max(0.4, opts.pointSize * depth);
      const alpha = Math.min(1, Math.max(0.12, (z2 + size * 0.32) / (size * 0.64)));

      ctx.beginPath();
      ctx.arc(px, py, radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${opts.color}, ${alpha})`;
      ctx.fill();
    }

    if (this.opts.onFrame) {
      this.opts.onFrame({
        points: this.points.length,
        ax: this.ax,
        ay: this.ay,
        t: this.t
      });
    }

    this.raf = requestAnimationFrame(() => this.loop());
  }

  // --- Dynamic Shape Generators & Updaters ---

  initRubik(r) {
    const pts = [];
    const cubieSize = r * 0.52;
    this.rubikSpacing = cubieSize + 4;
    this.rubik = { axis: 1, slice: 1, progress: 0, dir: 1 };

    for (let cx = -1; cx <= 1; cx++) {
      for (let cy = -1; cy <= 1; cy++) {
        for (let cz = -1; cz <= 1; cz++) {
          for (let lx = -1; lx <= 1; lx++) {
            for (let ly = -1; ly <= 1; ly++) {
              for (let lz = -1; lz <= 1; lz++) {
                if (Math.abs(lx) === 1 || Math.abs(ly) === 1 || Math.abs(lz) === 1) {
                  pts.push({
                    cx, cy, cz,
                    lx: lx * (cubieSize * 0.38),
                    ly: ly * (cubieSize * 0.38),
                    lz: lz * (cubieSize * 0.38),
                    x: 0, y: 0, z: 0
                  });
                }
              }
            }
          }
        }
      }
    }
    return pts;
  }

  updateRubik() {
    this.rubik.progress += 0.035;
    const { axis, slice, dir, progress } = this.rubik;
    const step = this.rubikSpacing;
    const theta = Math.sin(Math.min(progress, 1) * (Math.PI / 2)) * (Math.PI / 2) * dir;
    const cosT = Math.cos(theta), sinT = Math.sin(theta);

    for (const p of this.points) {
      const isTarget = (axis === 0 && p.cx === slice) ||
                       (axis === 1 && p.cy === slice) ||
                       (axis === 2 && p.cz === slice);

      let px = p.cx * step + p.lx;
      let py = p.cy * step + p.ly;
      let pz = p.cz * step + p.lz;

      if (isTarget) {
        if (axis === 0) {
          const y1 = py * cosT - pz * sinT;
          const z1 = py * sinT + pz * cosT;
          py = y1; pz = z1;
        } else if (axis === 1) {
          const x1 = px * cosT + pz * sinT;
          const z1 = -px * sinT + pz * cosT;
          px = x1; pz = z1;
        } else {
          const x1 = px * cosT - py * sinT;
          const y1 = px * sinT + py * cosT;
          px = x1; py = y1;
        }
      }

      p.x = px; p.y = py; p.z = pz;
    }

    if (this.rubik.progress >= 1) {
      for (const p of this.points) {
        const isTarget = (axis === 0 && p.cx === slice) ||
                         (axis === 1 && p.cy === slice) ||
                         (axis === 2 && p.cz === slice);
        if (isTarget) {
          if (axis === 0) {
            const ncy = dir === 1 ? -p.cz : p.cz;
            const ncz = dir === 1 ? p.cy : -p.cy;
            const nly = dir === 1 ? -p.lz : p.lz;
            const nlz = dir === 1 ? p.ly : -p.ly;
            p.cy = ncy; p.cz = ncz; p.ly = nly; p.lz = nlz;
          } else if (axis === 1) {
            const ncx = dir === 1 ? p.cz : -p.cz;
            const ncz = dir === 1 ? -p.cx : p.cx;
            const nlx = dir === 1 ? p.lz : -p.lz;
            const nlz = dir === 1 ? -p.lx : p.lx;
            p.cx = ncx; p.cz = ncz; p.lx = nlx; p.lz = nlz;
          } else {
            const ncx = dir === 1 ? -p.cy : p.cy;
            const ncy = dir === 1 ? p.cx : -p.cx;
            const nlx = dir === 1 ? -p.ly : p.ly;
            const nly = dir === 1 ? p.lx : -p.lx;
            p.cx = ncx; p.cy = ncy; p.lx = nlx; p.ly = nly;
          }
        }
      }
      this.rubik.progress = 0;
      this.rubik.axis = Math.floor(Math.random() * 3);
      this.rubik.slice = Math.random() > 0.5 ? 1 : -1;
      this.rubik.dir = Math.random() > 0.5 ? 1 : -1;
    }
  }

  initTesseract() {
    const pts = [];
    const verts = [];
    for (let i = 0; i < 16; i++) {
      verts.push({
        x: (i & 1 ? 1 : -1),
        y: (i & 2 ? 1 : -1),
        z: (i & 4 ? 1 : -1),
        w: (i & 8 ? 1 : -1)
      });
    }

    const steps = 12;
    for (let i = 0; i < 16; i++) {
      for (let j = i + 1; j < 16; j++) {
        const diff = (verts[i].x !== verts[j].x ? 1 : 0) +
                     (verts[i].y !== verts[j].y ? 1 : 0) +
                     (verts[i].z !== verts[j].z ? 1 : 0) +
                     (verts[i].w !== verts[j].w ? 1 : 0);
        if (diff === 1) {
          for (let s = 0; s <= steps; s++) {
            const f = s / steps;
            pts.push({
              x4: verts[i].x + (verts[j].x - verts[i].x) * f,
              y4: verts[i].y + (verts[j].y - verts[i].y) * f,
              z4: verts[i].z + (verts[j].z - verts[i].z) * f,
              w4: verts[i].w + (verts[j].w - verts[i].w) * f,
              x: 0, y: 0, z: 0
            });
          }
        }
      }
    }
    return pts;
  }

  updateTesseract(r) {
    const a = this.t * 0.02;
    const b = this.t * 0.015;
    const cosA = Math.cos(a), sinA = Math.sin(a);
    const cosB = Math.cos(b), sinB = Math.sin(b);

    for (const p of this.points) {
      const x1 = p.x4 * cosA - p.w4 * sinA;
      const w1 = p.x4 * sinA + p.w4 * cosA;
      const z1 = p.z4 * cosB - w1 * sinB;
      const w2 = p.z4 * sinB + w1 * cosB;

      const d4 = 2.4;
      const proj = 1 / (d4 - w2);
      p.x = x1 * proj * r * 1.8;
      p.y = p.y4 * proj * r * 1.8;
      p.z = z1 * proj * r * 1.8;
    }
  }

  initBlackhole(r) {
    const pts = [];
    const count = 550;
    for (let i = 0; i < count; i++) {
      const rad = r * 0.42 + Math.pow(Math.random(), 1.6) * r * 1.1;
      const angle = Math.random() * Math.PI * 2;
      pts.push({
        rad,
        angle,
        speed: (0.018 + 0.035 * (1 - rad / (r * 1.5))),
        lensSide: Math.random() > 0.5 ? 1 : -1,
        x: 0, y: 0, z: 0
      });
    }
    return pts;
  }

  updateBlackhole(r) {
    for (const p of this.points) {
      p.angle += p.speed;
      const px = Math.cos(p.angle) * p.rad;
      const pz = Math.sin(p.angle) * p.rad;
      let py = 0;

      if (pz < 0 && Math.abs(px) < r * 0.95) {
        const factor = (1 - Math.abs(px) / (r * 0.95)) * (-pz / p.rad);
        py = factor * r * 0.65 * p.lensSide;
      }
      p.x = px; p.y = py; p.z = pz;
    }
  }

  initGyroid(r) {
    const pts = [];
    const res = 14;
    const scale = Math.PI * 1.3;
    for (let x = -res; x <= res; x++) {
      for (let y = -res; y <= res; y++) {
        for (let z = -res; z <= res; z++) {
          const u = (x / res) * scale;
          const v = (y / res) * scale;
          const w = (z / res) * scale;
          const val = Math.sin(u) * Math.cos(v) + Math.sin(v) * Math.cos(w) + Math.sin(w) * Math.cos(u);
          if (Math.abs(val) < 0.16) {
            pts.push({
              u, v, w,
              baseX: (x / res) * r,
              baseY: (y / res) * r,
              baseZ: (z / res) * r,
              x: (x / res) * r,
              y: (y / res) * r,
              z: (z / res) * r
            });
          }
        }
      }
    }
    return pts;
  }

  updateGyroid(r) {
    const time = this.t * 0.04;
    for (const p of this.points) {
      const pulse = 1 + Math.sin(p.u * 2 + time) * 0.08;
      p.x = p.baseX * pulse;
      p.y = p.baseY * pulse;
      p.z = p.baseZ * pulse;
    }
  }

  initNeural(r) {
    const pts = [];
    const layers = [
      [{ y: -r * 0.6, z: 0 }, { y: 0, z: 0 }, { y: r * 0.6, z: 0 }],
      [{ y: -r * 0.7, z: -r * 0.3 }, { y: -r * 0.3, z: r * 0.3 }, { y: 0, z: 0 }, { y: r * 0.3, z: -r * 0.3 }, { y: r * 0.7, z: r * 0.3 }],
      [{ y: -r * 0.6, z: r * 0.3 }, { y: -r * 0.2, z: -r * 0.3 }, { y: r * 0.2, z: r * 0.3 }, { y: r * 0.6, z: -r * 0.3 }],
      [{ y: -r * 0.4, z: 0 }, { y: r * 0.4, z: 0 }]
    ];

    const layerX = [-r * 0.9, -r * 0.3, r * 0.3, r * 0.9];
    this.neuralPulses = [];

    for (let l = 0; l < layers.length - 1; l++) {
      const curL = layers[l];
      const nextL = layers[l + 1];
      for (const n1 of curL) {
        for (const n2 of nextL) {
          const segs = 10;
          for (let s = 0; s <= segs; s++) {
            const f = s / segs;
            pts.push({
              x: layerX[l] + (layerX[l + 1] - layerX[l]) * f,
              y: n1.y + (n2.y - n1.y) * f,
              z: n1.z + (n2.z - n1.z) * f
            });
          }
        }
      }
    }

    for (let p = 0; p < 25; p++) {
      this.neuralPulses.push({
        idx: Math.floor(Math.random() * pts.length),
        speed: Math.floor(Math.random() * 3) + 2
      });
    }

    return pts;
  }

  updateNeural() {
    for (const pulse of this.neuralPulses) {
      pulse.idx = (pulse.idx + pulse.speed) % this.points.length;
      const target = this.points[pulse.idx];
      if (target) {
        target.x += (Math.random() - 0.5) * 2;
        target.y += (Math.random() - 0.5) * 2;
      }
    }
  }

  destroy() {
    this.stop();
    this.ro.disconnect();
    this.canvas.remove();
  }
}