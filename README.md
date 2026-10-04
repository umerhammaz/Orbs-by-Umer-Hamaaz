# DotMatrix 3D

A lightweight (under 6KB, zero dependencies), mathematically projected 3D point-matrix canvas engine. Designed to be dropped into any web container, button, modal, or hero background with silky 60 FPS performance.

## Why this exists instead of CSS 3D or Three.js
- **Not pure CSS:** Rendering 800+ DOM nodes with `transform-style: preserve-3d` causes browser layout thrashing and drops frames.
- **Not Three.js:** Avoids downloading a 600KB bundle just to draw a clean rotating dot lattice.
- **The Sweet Spot:** Uses pure 2D `<canvas>` perspective projection (`x / z`, `y / z`) with hardware acceleration and trail fading.

---

## Quickstart

```bash
# Clone the repository
git clone https://github.com/your-username/dot-matrix-3d.git
cd dot-matrix-3d

# Run dev server
npm install
npm run dev
```

*Note: You don't even need npm. You can double-click `index.html` directly or serve via any static server.*

---

## Direct Usage

Copy `src/dot-matrix.js` straight into your project:

```javascript
import DotMatrix from './src/dot-matrix.js';

const matrix = new DotMatrix('#my-container', {
  shape: 'wave',           // 'cube' | 'sphere' | 'hollow-cube' | 'torus' | 'breathing-cube' | 'helix' | 'wave' | 'galaxy' | 'cylinder' | 'chaos'
  color: '100, 200, 255',  // RGB string
  speedX: 0.003,           // X rotation velocity
  speedY: 0.006,           // Y rotation velocity
  trail: 0.25,             // Motion blur opacity (0.1 = heavy trail, 1 = no trail)
  interactive: true        // Pointer drag rotation
});
```

---

## API Reference

### Configuration Options
| Option | Type | Default | Description |
|---|---|---|---|
| `shape` | `string` | `'cube'` | Initial 3D geometry |
| `color` | `string` | `'255, 255, 255'` | Point color formatted as `'R, G, B'` |
| `trail` | `number` | `0.25` | Canvas clear opacity (motion blur) |
| `speedX` | `number` | `0.012` | Automatic X-axis spin speed |
| `speedY` | `number` | `0.018` | Automatic Y-axis spin speed |
| `fov` | `number` | `360` | Field of view / perspective depth |
| `interactive` | `boolean` | `true` | Allows click & drag to tilt in 3D |
| `autoStart` | `boolean` | `true` | Start rendering loop immediately |
| `pointSize` | `number` | `2.2` | Base dot radius in pixels |

### Methods
- `matrix.setShape('sphere')` — Switches geometry at runtime.
- `matrix.start()` — Starts animation loop.
- `matrix.stop()` — Pauses loop (conserves battery when element is hidden).
- `matrix.toggle()` — Toggles pause/play state.
- `matrix.destroy()` — Removes canvas, disconnects `ResizeObserver`, stops RAF.

---

## Integration Recipes

### 1. Button Trigger / Modal
```javascript
let fx = null;

button.addEventListener('click', () => {
  modal.classList.add('visible');
  if (!fx) {
    fx = new DotMatrix('#modal-stage', { shape: 'sphere' });
  } else {
    fx.start();
  }
});

closeButton.addEventListener('click', () => {
  modal.classList.remove('visible');
  if (fx) fx.stop(); // Stop loop while hidden
});
```

### 2. React Hook
```jsx
import { useEffect, useRef } from 'react';
import DotMatrix from './dot-matrix.js';

export function MatrixCanvas({ shape = 'wave' }) {
  const containerRef = useRef(null);
  const matrixRef = useRef(null);

  useEffect(() => {
    matrixRef.current = new DotMatrix(containerRef.current, { shape });
    return () => matrixRef.current.destroy();
  }, [shape]);

  return <div ref={containerRef} style={{ width: '100%', height: '400px' }} />;
}
```

---

## License
MIT. Free to use anywhere.