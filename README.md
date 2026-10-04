# ORBS BY UMER HAMAAZ

> Minimalist, hardware-accelerated 3D volumetric point-lattice and orb canvas engine. Engineered with an industrial instrument aesthetic (monochromatic hierarchy, OLED black contrast, zero-shadow precision, real-time telemetry).

[![Live Website](https://img.shields.io/badge/Live%20Demo-GitHub%20Pages-white.svg?style=flat-square)](https://umerhammaz.github.io/Orbs-by-Umer-Hamaaz/)
[![Live Website](https://img.shields.io/badge/Live%20Demo-GitHub%20Pages-white.svg?style=flat-square)](https://umerhammaz.github.io/Orbs-by-Umer-Hamaaz/)
[![License: MIT](https://img.shields.io/badge/License-MIT-black.svg?style=flat-square)](LICENSE)
[![Bundle Size](https://img.shields.io/badge/Size-%3C6.2KB%20Gzipped-black.svg?style=flat-square)](src/dot-matrix.js)
[![Dependencies](https://img.shields.io/badge/Dependencies-Zero-black.svg?style=flat-square)](package.json)

**Live Playground:** [https://umerhammaz.github.io/Orbs-by-Umer-Hamaaz/](https://umerhammaz.github.io/Orbs-by-Umer-Hamaaz/)

---

## 1. DESIGN SPECIFICATION

This engine rejects bloated 3D web frameworks in favor of mechanical honesty:
- **No Three.js (600KB+):** Eliminates massive runtime bundles for simple geometric point clouds.
- **No CSS 3D Layout Thrashing:** Bypasses 1,000+ DOM `<div>` nodes that choke browser paint passes.
- **Direct 3D $\to$ 2D Projection:** Mathematical isometric/perspective camera transforms executed on a single hardware-accelerated `<canvas>`.
- **Instrument Typography & Tokens:** Designed around `Doto` (dot-matrix display), `Space Grotesk` (technical body), and `Space Mono` (instrument readouts).

---

## 2. QUICKSTART

Run locally with zero build overhead:

```bash
git clone https://github.com/umerhammaz/Orbs-by-Umer-Hamaaz.git
cd Orbs-by-Umer-Hamaaz

npm install
npm run dev
```

*Or simply open `index.html` in any modern browser directly.*

---

## 3. ENGINE API

### Instantiation
```javascript
import DotMatrix from './src/dot-matrix.js';

const matrix = new DotMatrix('#container', {
  shape: 'sphere',          // Presets: 'cube' | 'sphere' | 'hollow-cube' | 'torus' | 'breathing-cube' | 'helix' | 'wave' | 'galaxy' | 'cylinder' | 'chaos'
  color: '255, 255, 255',   // RGB format
  speedX: 0.012,            // X-axis angular velocity
  speedY: 0.018,            // Y-axis angular velocity
  fov: 360,                 // Perspective focal depth
  pointSize: 2.2,           // Base dot radius in pixels
  trail: 0.25,              // Motion trail persistence (0.1 = heavy trail, 1 = crisp)
  interactive: true,        // Pointer drag tilt
  onFrame: (telemetry) => {
    console.log(telemetry.points, telemetry.ax, telemetry.ay);
  }
});
```

### Controls & Lifecycle
```javascript
// Switch shape dynamically
matrix.setShape('galaxy');

// Update knobs in real-time
matrix.updateOptions({ speedX: 0.004, pointSize: 3.0 });

// Battery saver loop management
matrix.stop();   // Pauses requestAnimationFrame
matrix.start();  // Resumes animation
matrix.toggle(); // Toggles play/pause state

// Clean unmount (disconnects ResizeObserver, destroys canvas)
matrix.destroy();
```

---

## 4. MATHEMATICAL PRESETS

| Index | Identifier | Geometry | Points Formula | Best Use Case |
|---|---|---|---|---|
| `01` | `cube` | 3D Voxel Lattice | $N \times N \times N$ discrete grid | Default instrument box |
| `02` | `sphere` | Fibonacci Orb | Golden spiral spherical distribution | Core biometric sensor / HUD |
| `03` | `hollow-cube` | Wireframe Box | Surface boundary points only | Transparent boundary cage |
| `04` | `torus` | Particle Donut | Double-angle parametric torus | Dial / gauge compass |
| `05` | `breathing-cube`| Pulsing Lattice | Radial sine oscillation | Audio beat / heart rate sim |
| `06` | `helix` | Double Spiral | Interleaved phase strands | Diagnostic telemetry / DNA |
| `07` | `wave` | Liquid Oscilloscope | Radial distance wave $z = \sin(r - t)$ | Hero banner / section footer |
| `08` | `galaxy` | Logarithmic Vortex | Multi-arm spiral dispersion | Loading / processing state |
| `09` | `cylinder` | Particle Tunnel | Circular ring array along Z-axis | Data stream / bandwidth pipe |
| `10` | `chaos` | Entropy Field | Uniform random 3D space distribution | Noise / glitch / particle cloud |
| `11` | `rubik` | 3x3 Rubik Solver | 27 sub-cubes with periodic slice rotations | Mechanical puzzle / solver UI |
| `12` | `tesseract` | 4D Hypercube | 4D $XW/ZW$ rotation projected to 3D | Sci-fi / high-dimensional math |
| `13` | `blackhole` | Accretion Disc | Keplerian disk + gravitational lensing | Hero background / astrophysics |
| `14` | `gyroid` | Minimal Surface | Triply periodic $\sin x \cos y$ isosurface | Metamaterials / organic tech |
| `15` | `neural` | Synapse Graph | Multi-layer node network with pulse signals | AI model telemetry / neural HUD |

---

## 5. REAL-WORLD UI RECIPES

### A. AI Agent "Thinking" / Reasoning Loop
Switch your orb to high-speed swirl during LLM inference, then resolve to a calm status ring when complete:

```javascript
const orb = new DotMatrix('#ai-orb', { shape: 'sphere', speedX: 0.005, speedY: 0.008 });

// When user sends a prompt
function onAISend() {
  orb.updateOptions({ shape: 'galaxy', speedX: 0.035, speedY: 0.045, pointSize: 1.6 });
}

// When stream completes
function onAIComplete() {
  orb.updateOptions({ shape: 'sphere', speedX: 0.005, speedY: 0.008, pointSize: 2.2 });
}

### React / Next.js
```tsx
import { useEffect, useRef } from 'react';
import DotMatrix from './dot-matrix.js';

export function NothingMatrix({ shape = 'sphere' }: { shape?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<DotMatrix | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    engineRef.current = new DotMatrix(containerRef.current, {
      shape,
      color: '255, 255, 255',
      interactive: true
    });

    return () => engineRef.current?.destroy();
  }, [shape]);

  return <div ref={containerRef} style={{ width: '100%', height: '320px', background: '#000' }} />;
}
```

### Vue 3
```vue
<script setup>
import { onMounted, onUnmounted, ref } from 'vue';
import DotMatrix from './dot-matrix.js';

const stage = ref(null);
let engine = null;

onMounted(() => {
  engine = new DotMatrix(stage.value, { shape: 'wave' });
});

onUnmounted(() => {
  engine?.destroy();
});
</script>

<template>
  <div ref="stage" class="matrix-viewport" />
</template>

<style scoped>
.matrix-viewport {
  width: 100%;
  height: 280px;
  background: #000;
}
</style>
```

---

## 6. TELEMETRY & DESIGN AUDIT

- **OLED Surface:** Background `#000000`, card surfaces `#111111`, hairline structural dividers `#222222`.
- **Status Indicator:** Single `#D71921` signal dot reserved exclusively for real-time state interrupt (`[REC ● LIVE]`).
- **Typography Budget:** Exactly 3 typeface families loaded (`Doto`, `Space Grotesk`, `Space Mono`) adhering to the three-layer hierarchy rule.

---

## LICENSE
MIT &mdash; Free for commercial and non-commercial application.