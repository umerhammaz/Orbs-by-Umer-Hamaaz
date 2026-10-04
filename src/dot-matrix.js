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

  destroy() {
    this.stop();
    this.ro.disconnect();
    this.canvas.remove();
  }
}