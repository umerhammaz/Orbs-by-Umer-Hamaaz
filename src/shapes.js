export const TAU = Math.PI * 2;

export function mulberry32(seed) {
  let a = (seed >>> 0) || 1;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function gauss(rng) {
  const u = Math.max(rng(), 1e-9);
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
}

export function makeContext({ R = 84, seed = 1337, density = 1 } = {}) {
  return {
    R,
    rng: mulberry32(seed),
    state: {},
    n: (v) => Math.max(1, Math.round(v * density))
  };
}

const N = (label, min, max, step, def, extra = {}) => ({ type: 'number', label, min, max, step, def, ...extra });
const I = (label, min, max, def, extra = {}) => ({ type: 'int', label, min, max, step: 1, def, ...extra });
const B = (label, def, extra = {}) => ({ type: 'bool', label, def, ...extra });
const E = (label, options, def, extra = {}) => ({ type: 'enum', label, options, def, ...extra });

function rot(a, b, ang) {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  return [a * c - b * s, a * s + b * c];
}

function lattice(ctx, P, hollow) {
  const n = P.divisions;
  const R = ctx.R;
  const pts = [];
  const c = (i) => (i / (n - 1)) * 2 - 1;
  for (let x = 0; x < n; x++) {
    for (let y = 0; y < n; y++) {
      for (let z = 0; z < n; z++) {
        if (hollow && !(x === 0 || x === n - 1 || y === 0 || y === n - 1 || z === 0 || z === n - 1)) continue;
        pts.push({ x: c(x) * R * P.sizeX, y: c(y) * R * P.sizeY, z: c(z) * R * P.sizeZ });
      }
    }
  }
  return pts;
}

function torusV(t, k) {
  let v = TAU * t;
  for (let i = 0; i < 8; i++) {
    v -= (v + k * Math.sin(v) - TAU * t) / (1 + k * Math.cos(v));
  }
  return v;
}

function gyroidF(u, v, w) {
  return Math.sin(u) * Math.cos(v) + Math.sin(v) * Math.cos(w) + Math.sin(w) * Math.cos(u);
}

function rubikCommit(pts, st) {
  const { axis, slice, dir } = st;
  for (const p of pts) {
    const isTarget = (axis === 0 && p.cx === slice) ||
                     (axis === 1 && p.cy === slice) ||
                     (axis === 2 && p.cz === slice);
    if (!isTarget) continue;
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

export const SHAPES = {
  cube: {
    label: 'Cube',
    params: {
      divisions: I('Divisions', 2, 24, 9),
      sizeX: N('Size X', 0.2, 2, 0.05, 1),
      sizeY: N('Size Y', 0.2, 2, 0.05, 1),
      sizeZ: N('Size Z', 0.2, 2, 0.05, 1)
    },
    generate: (ctx, P) => lattice(ctx, P, false)
  },

  'hollow-cube': {
    label: 'Hollow Cube',
    params: {
      divisions: I('Divisions', 2, 24, 9),
      sizeX: N('Size X', 0.2, 2, 0.05, 1),
      sizeY: N('Size Y', 0.2, 2, 0.05, 1),
      sizeZ: N('Size Z', 0.2, 2, 0.05, 1)
    },
    generate: (ctx, P) => lattice(ctx, P, true)
  },

  sphere: {
    label: 'Sphere',
    params: {
      points: I('Points', 50, 3000, 550),
      layers: I('Shell Layers', 1, 6, 1),
      radius: N('Radius', 0.2, 1.5, 0.05, 1),
      jitter: N('Jitter', 0, 0.2, 0.005, 0)
    },
    generate(ctx, P) {
      const L = P.layers;
      const total = ctx.n(P.points);
      const R = ctx.R * P.radius;
      const golden = Math.PI * (1 + Math.sqrt(5));
      let wsum = 0;
      for (let l = 0; l < L; l++) wsum += ((l + 1) / L) ** 2;
      const pts = [];
      for (let l = 0; l < L; l++) {
        const rl = (R * (l + 1)) / L;
        const cnt = Math.max(1, Math.round((total * ((l + 1) / L) ** 2) / wsum));
        for (let i = 0; i < cnt; i++) {
          const phi = Math.acos(1 - (2 * (i + 0.5)) / cnt);
          const theta = golden * i + l * 1.3;
          let x = rl * Math.sin(phi) * Math.cos(theta);
          let y = rl * Math.sin(phi) * Math.sin(theta);
          let z = rl * Math.cos(phi);
          if (P.jitter > 0) {
            const j = P.jitter * ctx.R;
            x += (ctx.rng() - 0.5) * 2 * j;
            y += (ctx.rng() - 0.5) * 2 * j;
            z += (ctx.rng() - 0.5) * 2 * j;
          }
          pts.push({ x, y, z });
        }
      }
      return pts;
    }
  },

  torus: {
    label: 'Torus',
    params: {
      major: N('Major Radius', 0.3, 1.5, 0.05, 0.85),
      minor: N('Minor Radius', 0.1, 0.8, 0.05, 0.35),
      uSteps: I('Ring Count (U)', 8, 80, 28),
      vSteps: I('Tube Count (V)', 6, 40, 16),
      twist: N('Twist', 0, 4, 0.1, 0)
    },
    generate(ctx, P) {
      const Rm = ctx.R * P.major;
      const tr = ctx.R * P.minor;
      const k = Math.min(0.95, tr / Rm);
      const pts = [];
      for (let i = 0; i < P.uSteps; i++) {
        const u = (i / P.uSteps) * TAU;
        const shift = (P.twist * i) / P.uSteps;
        for (let j = 0; j < P.vSteps; j++) {
          const t = (((j + 0.5) / P.vSteps + shift) % 1 + 1) % 1;
          const v = torusV(t, k);
          pts.push({
            x: (Rm + tr * Math.cos(v)) * Math.cos(u),
            y: (Rm + tr * Math.cos(v)) * Math.sin(u),
            z: tr * Math.sin(v)
          });
        }
      }
      return pts;
    }
  },

  'breathing-cube': {
    label: 'Breathing Cube',
    params: {
      divisions: I('Divisions', 3, 14, 8),
      amplitude: N('Amplitude', 0, 0.8, 0.01, 0.35, { live: true }),
      frequency: N('Frequency', 0.2, 4, 0.1, 1, { live: true })
    },
    generate(ctx, P) {
      const n = P.divisions;
      const pts = [];
      const c = (i) => ((i / (n - 1)) * 2 - 1) * ctx.R;
      for (let x = 0; x < n; x++) {
        for (let y = 0; y < n; y++) {
          for (let z = 0; z < n; z++) {
            pts.push({ bx: c(x), by: c(y), bz: c(z), x: 0, y: 0, z: 0 });
          }
        }
      }
      return pts;
    },
    update(ctx, P, pts, t) {
      const scale = 1 + Math.sin(t * 0.05 * P.frequency) * P.amplitude;
      for (const p of pts) {
        p.x = p.bx * scale;
        p.y = p.by * scale;
        p.z = p.bz * scale;
      }
    }
  },

  helix: {
    label: 'Helix',
    params: {
      points: I('Points / Strand', 40, 800, 300),
      strands: I('Strands', 1, 4, 2),
      turns: N('Turns', 1, 14, 0.1, 7.6),
      radius: N('Radius', 0.1, 1.5, 0.05, 0.65),
      height: N('Height', 0.5, 3.5, 0.1, 2.2)
    },
    generate(ctx, P) {
      const n = ctx.n(P.points);
      const hr = ctx.R * P.radius;
      const H = ctx.R * P.height;
      const pts = [];
      for (let s = 0; s < P.strands; s++) {
        for (let i = 0; i < n; i++) {
          const f = n === 1 ? 0 : i / (n - 1);
          const a = f * TAU * P.turns + (s * TAU) / P.strands;
          pts.push({ x: Math.cos(a) * hr, y: (f - 0.5) * H, z: Math.sin(a) * hr });
        }
      }
      return pts;
    }
  },

  wave: {
    label: 'Wave',
    params: {
      grid: I('Grid', 8, 60, 22),
      extent: N('Extent', 1, 4, 0.1, 2.6),
      mode: E('Mode', ['radial', 'plane'], 'radial', { live: true }),
      amplitude: N('Amplitude', 0, 0.8, 0.01, 0.25, { live: true }),
      wavelength: N('Wavelength', 0.3, 4, 0.05, 1.5, { live: true }),
      speed: N('Wave Speed', 0, 4, 0.1, 1, { live: true })
    },
    generate(ctx, P) {
      const n = P.grid;
      const sp = (ctx.R * P.extent) / (n - 1);
      const off = ((n - 1) * sp) / 2;
      const pts = [];
      for (let x = 0; x < n; x++) {
        for (let z = 0; z < n; z++) {
          const px = x * sp - off;
          const pz = z * sp - off;
          pts.push({ x: px, y: 0, z: pz, bx: px, bz: pz });
        }
      }
      return pts;
    },
    update(ctx, P, pts, t) {
      const k = TAU / (ctx.R * P.wavelength);
      const A = ctx.R * P.amplitude;
      const ph = t * 0.07 * P.speed;
      const plane = P.mode === 'plane';
      for (const p of pts) {
        const d = plane ? p.bx : Math.hypot(p.bx, p.bz);
        p.y = Math.sin(d * k - ph) * A;
      }
    }
  },

  galaxy: {
    label: 'Galaxy',
    params: {
      points: I('Points', 100, 3000, 650),
      arms: I('Arms', 1, 8, 3),
      tightness: N('Spiral Tightness', 0.1, 0.8, 0.01, 0.3),
      radius: N('Radius', 0.4, 2, 0.05, 1.2),
      scatter: N('Scatter', 0, 0.5, 0.01, 0.1),
      thickness: N('Thickness', 0, 0.5, 0.01, 0.1)
    },
    generate(ctx, P) {
      const n = ctx.n(P.points);
      const R = ctx.R;
      const r0 = 0.05 * R;
      const rmax = R * P.radius;
      const pts = [];
      for (let i = 0; i < n; i++) {
        const u = (i + 0.5) / n;
        const rad = r0 + (rmax - r0) * u;
        const theta = (i % P.arms) * (TAU / P.arms) + Math.log(rad / r0) / P.tightness;
        pts.push({
          x: Math.cos(theta) * rad + gauss(ctx.rng) * P.scatter * R,
          y: gauss(ctx.rng) * P.thickness * R,
          z: Math.sin(theta) * rad + gauss(ctx.rng) * P.scatter * R
        });
      }
      return pts;
    }
  },

  cylinder: {
    label: 'Cylinder',
    params: {
      radius: N('Radius', 0.2, 1.5, 0.05, 0.75),
      height: N('Height', 0.5, 3, 0.1, 2),
      rings: I('Rings', 2, 60, 18),
      perRing: I('Points / Ring', 6, 96, 26),
      caps: B('End Caps', false)
    },
    generate(ctx, P) {
      const cr = ctx.R * P.radius;
      const h = ctx.R * P.height;
      const pts = [];
      for (let i = 0; i < P.rings; i++) {
        const z = (i / (P.rings - 1)) * h - h / 2;
        for (let j = 0; j < P.perRing; j++) {
          const a = (j / P.perRing) * TAU;
          pts.push({ x: Math.cos(a) * cr, y: Math.sin(a) * cr, z });
        }
      }
      if (P.caps) {
        const capRings = Math.max(1, Math.round(P.perRing / 8));
        for (const sign of [-1, 1]) {
          const z = (sign * h) / 2;
          pts.push({ x: 0, y: 0, z });
          for (let k = 1; k <= capRings; k++) {
            const rr = (cr * k) / (capRings + 1);
            const cnt = Math.max(3, Math.round((P.perRing * k) / (capRings + 1)));
            for (let j = 0; j < cnt; j++) {
              const a = (j / cnt) * TAU;
              pts.push({ x: Math.cos(a) * rr, y: Math.sin(a) * rr, z });
            }
          }
        }
      }
      return pts;
    }
  },

  chaos: {
    label: 'Chaos',
    params: {
      count: I('Points', 50, 3000, 450),
      mode: E('Volume', ['cube', 'ball'], 'cube'),
      extent: N('Extent', 0.3, 2, 0.05, 1)
    },
    generate(ctx, P) {
      const n = ctx.n(P.count);
      const R = ctx.R * P.extent;
      const rng = ctx.rng;
      const pts = [];
      for (let i = 0; i < n; i++) {
        if (P.mode === 'ball') {
          const x = gauss(rng);
          const y = gauss(rng);
          const z = gauss(rng);
          const l = Math.hypot(x, y, z) || 1;
          const rr = Math.cbrt(rng()) * R;
          pts.push({ x: (x / l) * rr, y: (y / l) * rr, z: (z / l) * rr });
        } else {
          pts.push({ x: (rng() - 0.5) * R * 2, y: (rng() - 0.5) * R * 2, z: (rng() - 0.5) * R * 2 });
        }
      }
      return pts;
    }
  },

  rubik: {
    label: 'Rubik',
    params: {
      gap: N('Cubie Gap', 0, 0.3, 0.01, 0.05),
      turnSpeed: N('Turn Speed', 0.2, 4, 0.1, 1, { live: true })
    },
    generate(ctx, P) {
      const cs = ctx.R * 0.52;
      const pts = [];
      ctx.state = { axis: 1, slice: 1, progress: 0, dir: 1, step: cs + P.gap * ctx.R };
      for (let cx = -1; cx <= 1; cx++) {
        for (let cy = -1; cy <= 1; cy++) {
          for (let cz = -1; cz <= 1; cz++) {
            for (let lx = -1; lx <= 1; lx++) {
              for (let ly = -1; ly <= 1; ly++) {
                for (let lz = -1; lz <= 1; lz++) {
                  if (Math.abs(lx) === 1 || Math.abs(ly) === 1 || Math.abs(lz) === 1) {
                    pts.push({
                      cx, cy, cz,
                      lx: lx * (cs * 0.38),
                      ly: ly * (cs * 0.38),
                      lz: lz * (cs * 0.38),
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
    },
    update(ctx, P, pts, t, dtf = 1) {
      const st = ctx.state;
      st.progress += 0.035 * P.turnSpeed * dtf;
      const { axis, slice, dir, progress, step } = st;
      const theta = Math.sin(Math.min(progress, 1) * (Math.PI / 2)) * (Math.PI / 2) * dir;
      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);

      for (const p of pts) {
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

      if (st.progress >= 1) {
        rubikCommit(pts, st);
        st.progress = 0;
        st.axis = Math.floor(ctx.rng() * 3);
        st.slice = ctx.rng() > 0.5 ? 1 : -1;
        st.dir = ctx.rng() > 0.5 ? 1 : -1;
      }
    }
  },

  tesseract: {
    label: 'Tesseract',
    params: {
      samples: I('Points / Edge', 0, 40, 11),
      distance: N('4D Distance', 2.2, 6, 0.1, 2.4, { live: true }),
      scale: N('Scale', 0.4, 2, 0.05, 1, { live: true }),
      xw: N('XW Rotation', -3, 3, 0.1, 1, { live: true }),
      zw: N('ZW Rotation', -3, 3, 0.1, 1, { live: true }),
      yw: N('YW Rotation', -3, 3, 0.1, 0, { live: true }),
      xy: N('XY Rotation', -3, 3, 0.1, 0, { live: true }),
      xz: N('XZ Rotation', -3, 3, 0.1, 0, { live: true }),
      yz: N('YZ Rotation', -3, 3, 0.1, 0, { live: true })
    },
    generate(ctx, P) {
      const verts = [];
      for (let i = 0; i < 16; i++) {
        verts.push({
          x: i & 1 ? 1 : -1,
          y: i & 2 ? 1 : -1,
          z: i & 4 ? 1 : -1,
          w: i & 8 ? 1 : -1
        });
      }
      const pts = verts.map((v) => ({ x4: v.x, y4: v.y, z4: v.z, w4: v.w, x: 0, y: 0, z: 0 }));
      const steps = P.samples + 1;
      for (let i = 0; i < 16; i++) {
        for (let j = i + 1; j < 16; j++) {
          const diff = (verts[i].x !== verts[j].x ? 1 : 0) +
                       (verts[i].y !== verts[j].y ? 1 : 0) +
                       (verts[i].z !== verts[j].z ? 1 : 0) +
                       (verts[i].w !== verts[j].w ? 1 : 0);
          if (diff !== 1) continue;
          for (let s = 1; s < steps; s++) {
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
      return pts;
    },
    update(ctx, P, pts, t) {
      const scale = ctx.R * 1.8 * P.scale;
      for (const p of pts) {
        let x = p.x4, y = p.y4, z = p.z4, w = p.w4;
        [x, w] = rot(x, w, t * 0.02 * P.xw);
        [z, w] = rot(z, w, t * 0.015 * P.zw);
        if (P.yw) [y, w] = rot(y, w, t * 0.02 * P.yw);
        if (P.xy) [x, y] = rot(x, y, t * 0.02 * P.xy);
        if (P.xz) [x, z] = rot(x, z, t * 0.02 * P.xz);
        if (P.yz) [y, z] = rot(y, z, t * 0.02 * P.yz);
        const proj = 1 / (P.distance - w);
        p.x = x * proj * scale;
        p.y = y * proj * scale;
        p.z = z * proj * scale;
      }
    }
  },

  blackhole: {
    label: 'Black Hole',
    params: {
      points: I('Points', 100, 2000, 550),
      innerRadius: N('Inner Radius', 0.1, 1, 0.02, 0.42),
      outerRadius: N('Outer Radius', 0.6, 2.5, 0.05, 1.52),
      diskSpeed: N('Disk Speed', 0, 3, 0.1, 1, { live: true }),
      lensing: N('Lensing', 0, 1.5, 0.05, 1, { live: true })
    },
    generate(ctx, P) {
      const n = ctx.n(P.points);
      const R = ctx.R;
      const inner = P.innerRadius;
      const outer = Math.max(P.outerRadius, inner + 0.1);
      const pts = [];
      for (let i = 0; i < n; i++) {
        const rad = R * (inner + Math.pow(ctx.rng(), 1.6) * (outer - inner));
        pts.push({
          rad,
          angle: ctx.rng() * TAU,
          lensSide: ctx.rng() > 0.5 ? 1 : -1,
          x: 0, y: 0, z: 0
        });
      }
      ctx.state = { innerPx: inner * R };
      return pts;
    },
    update(ctx, P, pts, t, dtf = 1) {
      const R = ctx.R;
      const inner = ctx.state.innerPx || P.innerRadius * R;
      const lim = R * 0.95;
      for (const p of pts) {
        p.angle += 0.05 * P.diskSpeed * Math.pow(inner / p.rad, 1.5) * dtf;
        const px = Math.cos(p.angle) * p.rad;
        const pz = Math.sin(p.angle) * p.rad;
        let py = 0;
        if (pz < 0 && Math.abs(px) < lim) {
          const factor = (1 - Math.abs(px) / lim) * (-pz / p.rad);
          py = factor * R * 0.65 * P.lensing * p.lensSide;
        }
        p.x = px; p.y = py; p.z = pz;
      }
    }
  },

  gyroid: {
    label: 'Gyroid',
    params: {
      resolution: I('Resolution', 6, 30, 14),
      frequency: N('Cell Frequency', 0.5, 3, 0.05, 1.3),
      threshold: N('Surface Band', 0.02, 0.5, 0.01, 0.16),
      project: B('Snap To Surface', true),
      pulse: N('Pulse', 0, 0.3, 0.01, 0.08, { live: true }),
      morphSpeed: N('Morph Speed', 0, 3, 0.1, 1, { live: true })
    },
    generate(ctx, P) {
      const res = P.resolution;
      const scale = Math.PI * P.frequency;
      const R = ctx.R;
      const pts = [];
      for (let x = -res; x <= res; x++) {
        for (let y = -res; y <= res; y++) {
          for (let z = -res; z <= res; z++) {
            let u = (x / res) * scale;
            let v = (y / res) * scale;
            let w = (z / res) * scale;
            if (Math.abs(gyroidF(u, v, w)) >= P.threshold) continue;
            if (P.project) {
              for (let k = 0; k < 4; k++) {
                const val = gyroidF(u, v, w);
                const gu = Math.cos(u) * Math.cos(v) - Math.sin(w) * Math.sin(u);
                const gv = -Math.sin(u) * Math.sin(v) + Math.cos(v) * Math.cos(w);
                const gw = -Math.sin(v) * Math.sin(w) + Math.cos(w) * Math.cos(u);
                const g2 = gu * gu + gv * gv + gw * gw;
                if (g2 < 1e-6) break;
                const s = val / g2;
                u -= s * gu; v -= s * gv; w -= s * gw;
              }
              if (Math.abs(gyroidF(u, v, w)) > 1e-3) continue;
              const lim = scale * 1.001;
              if (Math.abs(u) > lim || Math.abs(v) > lim || Math.abs(w) > lim) continue;
            }
            const bx = (u / scale) * R;
            const by = (v / scale) * R;
            const bz = (w / scale) * R;
            pts.push({ u, v, w, baseX: bx, baseY: by, baseZ: bz, x: bx, y: by, z: bz });
          }
        }
      }
      return pts;
    },
    update(ctx, P, pts, t) {
      const time = t * 0.04 * P.morphSpeed;
      for (const p of pts) {
        const pulse = 1 + Math.sin(p.u * 2 + time) * P.pulse;
        p.x = p.baseX * pulse;
        p.y = p.baseY * pulse;
        p.z = p.baseZ * pulse;
      }
    }
  },

  neural: {
    label: 'Neural',
    params: {
      layers: I('Layers', 2, 6, 4),
      nodes: I('Max Nodes / Layer', 2, 8, 5),
      segments: I('Segments / Link', 2, 24, 10),
      pulses: I('Pulses', 0, 100, 25),
      jitter: N('Pulse Jitter', 0, 0.2, 0.005, 0.025, { live: true })
    },
    generate(ctx, P) {
      const R = ctx.R;
      const rng = ctx.rng;
      const L = P.layers;
      const layers = [];
      for (let l = 0; l < L; l++) {
        const n = Math.max(2, Math.round(P.nodes * (0.4 + 0.6 * Math.sin((Math.PI * (l + 0.5)) / L))));
        const nodes = [];
        for (let i = 0; i < n; i++) {
          nodes.push({ y: ((i / (n - 1)) * 2 - 1) * 0.7 * R, z: (rng() - 0.5) * 0.6 * R });
        }
        layers.push(nodes);
      }
      const lx = (l) => ((l / (L - 1)) * 2 - 1) * 0.9 * R;
      const pts = [];
      const add = (x, y, z) => pts.push({ x, y, z, bx: x, by: y, bz: z, ox: 0, oy: 0 });

      for (let l = 0; l < L; l++) {
        for (const n of layers[l]) add(lx(l), n.y, n.z);
      }
      for (let l = 0; l < L - 1; l++) {
        for (const n1 of layers[l]) {
          for (const n2 of layers[l + 1]) {
            for (let s = 1; s < P.segments; s++) {
              const f = s / P.segments;
              add(
                lx(l) + (lx(l + 1) - lx(l)) * f,
                n1.y + (n2.y - n1.y) * f,
                n1.z + (n2.z - n1.z) * f
              );
            }
          }
        }
      }

      const pulses = [];
      for (let i = 0; i < P.pulses; i++) {
        pulses.push({ pos: Math.floor(rng() * pts.length), speed: Math.floor(rng() * 3) + 2 });
      }
      ctx.state = { pulses };
      return pts;
    },
    update(ctx, P, pts, t, dtf = 1) {
      if (!pts.length) return;
      const decay = Math.pow(0.92, dtf);
      for (const p of pts) {
        p.ox *= decay;
        p.oy *= decay;
        p.x = p.bx + p.ox;
        p.y = p.by + p.oy;
      }
      const j = P.jitter * ctx.R;
      for (const pulse of ctx.state.pulses) {
        pulse.pos = (pulse.pos + pulse.speed * dtf) % pts.length;
        const target = pts[Math.floor(pulse.pos)];
        if (target) {
          target.ox += (ctx.rng() - 0.5) * 2 * j;
          target.oy += (ctx.rng() - 0.5) * 2 * j;
        }
      }
    }
  }
};

export function resolveParams(name, overrides = {}) {
  const def = SHAPES[name];
  const out = {};
  if (!def) return out;
  for (const [key, s] of Object.entries(def.params)) {
    let v = overrides[key];
    if (v === undefined || v === null) v = s.def;
    if (s.type === 'number' || s.type === 'int') {
      v = Number(v);
      if (!Number.isFinite(v)) v = s.def;
      v = Math.min(s.max, Math.max(s.min, v));
      if (s.type === 'int') v = Math.round(v);
    } else if (s.type === 'bool') {
      v = Boolean(v);
    } else if (s.type === 'enum') {
      if (!s.options.includes(v)) v = s.def;
    }
    out[key] = v;
  }
  return out;
}

export function listShapes() {
  return Object.keys(SHAPES);
}