import DotMatrix from './dot-matrix.js';

// ==========================================================================
// 1. Ambient Hero Oscilloscope (Wave Plane)
// ==========================================================================
new DotMatrix('#hero-wave', {
  shape: 'wave',
  color: '200, 200, 200',
  speedX: 0.002,
  speedY: 0.003,
  trail: 0.22,
  pointSize: 1.8,
  interactive: false
});

// ==========================================================================
// 2. Main Studio Laboratory with Telemetry HUD
// ==========================================================================
const $ = (id) => document.getElementById(id);
const hudShape = $('hud-shape');
const hudPoints = $('hud-points');
const hudRot = $('hud-rot');
const hudFps = $('hud-fps');
const codeSnippet = $('live-code-snippet');

const baseSpeedX = 0.012;
const baseSpeedY = 0.018;
const DEFAULT_FOV = 360;
const DEFAULT_RADIUS = 2.2;

const ENGINE_DEFAULTS = {
  speedZ: 0,
  zoom: 1,
  projection: 'perspective',
  inertia: 0,
  lockAxis: 'none',
  density: 1,
  trail: 0.25,
  depthFade: 1,
  sizeByDepth: 1,
  colorMode: 'solid',
  color: '255, 255, 255',
  color2: '90, 90, 90',
  depthSort: false,
  seed: 1337,
  view: 'free',
  viewX: 0,
  viewY: 0,
  viewZ: 0,
  panX: 0,
  panY: 0,
  motion: 'spin',
  swing: 0.6,
  dolly: 0
};

const CAMERA_CONTROLS = [
  { key: 'speedZ', label: 'Roll Speed', type: 'number', min: -0.05, max: 0.05, step: 0.001 },
  { key: 'zoom', label: 'Zoom', type: 'number', min: 0.4, max: 2.5, step: 0.05 },
  { key: 'projection', label: 'Projection', type: 'enum', options: ['perspective', 'orthographic'] },
  { key: 'inertia', label: 'Drag Inertia', type: 'number', min: 0, max: 0.98, step: 0.02 },
  { key: 'lockAxis', label: 'Lock Drag Axis', type: 'enum', options: ['none', 'x', 'y'] },
  { key: 'view', label: 'View Angle', type: 'enum', options: ['free', 'front', 'back', 'top', 'side', 'iso', 'high', 'low', 'dutch'] },
  { key: 'motion', label: 'Camera Motion', type: 'enum', options: ['spin', 'sway', 'still'] },
  { key: 'swing', label: 'Sway Amount', type: 'number', min: 0, max: 1.5, step: 0.05 },
  { key: 'viewX', label: 'Tilt (Pitch)', type: 'number', min: -3.14, max: 3.14, step: 0.05 },
  { key: 'viewY', label: 'Turn (Yaw)', type: 'number', min: -3.14, max: 3.14, step: 0.05 },
  { key: 'viewZ', label: 'Roll', type: 'number', min: -3.14, max: 3.14, step: 0.05 },
  { key: 'panX', label: 'Pan X', type: 'number', min: -0.6, max: 0.6, step: 0.02 },
  { key: 'panY', label: 'Pan Y', type: 'number', min: -0.6, max: 0.6, step: 0.02 },
  { key: 'dolly', label: 'Dolly Pulse', type: 'number', min: 0, max: 0.5, step: 0.02 }
];

const RENDER_CONTROLS = [
  { key: 'density', label: 'Density', type: 'number', min: 0.25, max: 3, step: 0.25 },
  { key: 'trail', label: 'Trail Fade', type: 'number', min: 0.05, max: 1, step: 0.05 },
  { key: 'depthFade', label: 'Depth Fade', type: 'number', min: 0, max: 1, step: 0.05 },
  { key: 'sizeByDepth', label: 'Size By Depth', type: 'number', min: 0, max: 1, step: 0.05 },
  { key: 'colorMode', label: 'Color Mode', type: 'enum', options: ['solid', 'depth', 'height'] },
  { key: 'color', label: 'Color', type: 'color' },
  { key: 'color2', label: 'Color 2', type: 'color' },
  { key: 'depthSort', label: 'Depth Sort', type: 'bool' },
  { key: 'seed', label: 'Seed', type: 'int', min: 1, max: 9999, widget: 'number' }
];

let frameCount = 0;

const studio = new DotMatrix('#main-stage', {
  shape: 'cube',
  color: '255, 255, 255',
  speedX: baseSpeedX,
  speedY: baseSpeedY,
  fov: DEFAULT_FOV,
  pointSize: DEFAULT_RADIUS,
  trail: 0.25,
  interactive: true,
  onFrame: (telemetry) => {
    if (hudPoints) hudPoints.textContent = String(telemetry.points).padStart(4, '0');
    if (hudRot) hudRot.textContent = `${(telemetry.ax % (Math.PI * 2)).toFixed(2)} / ${(telemetry.ay % (Math.PI * 2)).toFixed(2)}`;
    frameCount++;
    if (hudFps && frameCount % 20 === 0) hudFps.textContent = `${Math.round(telemetry.fps)} FPS`;
  }
});

// --- Dynamic control builder -------------------------------------------------
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function decimals(step) {
  const s = String(step);
  const i = s.indexOf('.');
  return i < 0 ? 0 : s.length - i - 1;
}

const rgbToHex = (str) => '#' + str.split(',').map((n) => Math.max(0, Math.min(255, Number(n.trim()) || 0)).toString(16).padStart(2, '0')).join('');
const hexToRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ');

function makeControl(spec) {
  const row = el('div', 'slider-row');
  const head = el('div', 'slider-header');
  const readout = el('span', 'slider-readout');
  head.append(el('span', null, spec.label), readout);
  row.appendChild(head);

  if (spec.type === 'number' || (spec.type === 'int' && !spec.widget)) {
    const d = decimals(spec.step);
    const input = el('input');
    input.type = 'range';
    input.min = spec.min;
    input.max = spec.max;
    input.step = spec.step;
    input.value = spec.value;
    readout.textContent = Number(spec.value).toFixed(d);
    input.addEventListener('input', () => {
      const v = spec.type === 'int' ? parseInt(input.value, 10) : parseFloat(input.value);
      readout.textContent = v.toFixed(d);
      spec.onInput(v);
    });
    row.appendChild(input);
  } else if (spec.type === 'int') {
    const input = el('input', 'ctl-number');
    input.type = 'number';
    input.min = spec.min;
    input.max = spec.max;
    input.step = 1;
    input.value = spec.value;
    readout.textContent = String(spec.value);
    input.addEventListener('change', () => {
      const v = Math.max(spec.min, Math.min(spec.max, parseInt(input.value, 10) || spec.min));
      input.value = v;
      readout.textContent = String(v);
      spec.onInput(v);
    });
    row.appendChild(input);
  } else if (spec.type === 'enum') {
    const select = el('select', 'ctl-select');
    for (const opt of spec.options) {
      const o = el('option', null, opt.toUpperCase());
      o.value = opt;
      select.appendChild(o);
    }
    select.value = spec.value;
    readout.textContent = String(spec.value).toUpperCase();
    select.addEventListener('change', () => {
      readout.textContent = select.value.toUpperCase();
      spec.onInput(select.value);
    });
    row.appendChild(select);
  } else if (spec.type === 'bool') {
    const input = el('input', 'ctl-check');
    input.type = 'checkbox';
    input.checked = !!spec.value;
    readout.textContent = spec.value ? 'ON' : 'OFF';
    input.addEventListener('change', () => {
      readout.textContent = input.checked ? 'ON' : 'OFF';
      spec.onInput(input.checked);
    });
    row.appendChild(input);
  } else if (spec.type === 'color') {
    const input = el('input', 'ctl-color');
    input.type = 'color';
    input.value = rgbToHex(spec.value);
    readout.textContent = input.value.toUpperCase();
    input.addEventListener('input', () => {
      readout.textContent = input.value.toUpperCase();
      spec.onInput(hexToRgb(input.value));
    });
    row.appendChild(input);
  }

  if (spec.def !== undefined) {
    const btn = el('button', 'row-reset', '\u21BA');
    btn.type = 'button';
    btn.title = 'Reset to default';
    btn.addEventListener('click', () => {
      const inp = row.lastElementChild;
      const d = spec.def;
      if (inp.type === 'checkbox') {
        inp.checked = !!d;
        inp.dispatchEvent(new Event('change'));
      } else if (inp.type === 'color') {
        inp.value = rgbToHex(d);
        inp.dispatchEvent(new Event('input'));
      } else if (inp.tagName === 'SELECT') {
        inp.value = d;
        inp.dispatchEvent(new Event('change'));
      } else if (inp.type === 'range') {
        inp.value = d;
        inp.dispatchEvent(new Event('input'));
      } else {
        inp.value = d;
        inp.dispatchEvent(new Event('change'));
      }
    });
    head.appendChild(btn);
  }
  return row;
}

const paramsBox = $('shape-params');
const cameraBox = $('camera-controls');
const renderBox = $('render-controls');

function buildShapeParams() {
  if (!paramsBox) return;
  paramsBox.innerHTML = '';
  const schema = DotMatrix.getSchema(studio.opts.shape);
  for (const [key, s] of Object.entries(schema)) {
    paramsBox.appendChild(makeControl({
      ...s,
      value: studio.P[key],
      onInput: (v) => {
        studio.setShapeParam(key, v);
        updateCodeSnippet();
      }
    }));
  }
}

function buildEngineControls() {
  const fill = (box, list) => {
    if (!box) return;
    box.innerHTML = '';
    for (const c of list) {
      box.appendChild(makeControl({
        ...c,
        def: ENGINE_DEFAULTS[c.key],
        value: studio.opts[c.key],
        onInput: (v) => {
          studio.updateOptions({ [c.key]: v });
          updateCodeSnippet();
        }
      }));
    }
  };
  fill(cameraBox, CAMERA_CONTROLS);
  fill(renderBox, RENDER_CONTROLS);
}

// --- Code export ---------------------------------------------------------------
let activeFormat = 'esm';

const EXPORT_DEFAULTS = {
  color: '255, 255, 255',
  color2: '90, 90, 90',
  colorMode: 'solid',
  trail: 0.25,
  speedX: 0.012,
  speedY: 0.018,
  speedZ: 0,
  fov: 360,
  pointSize: 2.2,
  density: 1,
  seed: 1337,
  projection: 'perspective',
  zoom: 1,
  depthFade: 1,
  sizeByDepth: 1,
  depthSort: false,
  inertia: 0,
  lockAxis: 'none',
  interactive: true,
  view: 'free',
  viewX: 0,
  viewY: 0,
  viewZ: 0,
  panX: 0,
  panY: 0,
  motion: 'spin',
  swing: 0.6,
  dolly: 0
};

function literal(value, depth = 0) {
  const pad = '  '.repeat(depth + 1);
  const end = '  '.repeat(depth);
  if (typeof value === 'string') {
    return "'" + value.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value);
    if (!entries.length) return '{}';
    const body = entries
      .map(([k, v]) => pad + (/^[A-Za-z_$][\w$]*$/.test(k) ? k : literal(k)) + ': ' + literal(v, depth + 1))
      .join(',\n');
    return '{\n' + body + '\n' + end + '}';
  }
  return String(value);
}

function exportConfig() {
  const state = studio.getState();
  const out = { shape: state.shape };
  for (const [k, v] of Object.entries(state)) {
    if (k === 'shape' || k === 'shapeParams') continue;
    if (EXPORT_DEFAULTS[k] !== v) out[k] = v;
  }
  if (state.shapeParams) out.shapeParams = state.shapeParams;
  return out;
}

function updateCodeSnippet() {
  if (!codeSnippet) return;
  const json = literal(exportConfig());

  if (activeFormat === 'esm') {
    codeSnippet.textContent = `// Requires dot-matrix.js and shapes.js in the same folder
import DotMatrix from './dot-matrix.js';

// Initialize in any container (modal, hero, or AI card)
const matrix = new DotMatrix('#container', ${json});

// Live tweaks:
// matrix.setShapeParam('key', value);
// matrix.updateOptions({ zoom: 1.2 });`;
  } else {
    const cfg = json.split('\n').join('\n    ');
    codeSnippet.textContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Orbs 3D Playground Export</title>
  <style>
    body { margin: 0; background: #000; overflow: hidden; display: flex; justify-content: center; align-items: center; height: 100vh; }
    #orb-stage { width: 100vw; height: 100vh; }
  </style>
</head>
<body>
  <div id="orb-stage"></div>
  <script type="module">
    import DotMatrix from 'https://umerhammaz.github.io/Orbs-by-Umer-Hamaaz/src/dot-matrix.js';

    new DotMatrix('#orb-stage', ${cfg});
  <\/script>
</body>
</html>`;
  }
}

document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    activeFormat = btn.dataset.format;
    updateCodeSnippet();
  });
});

const copyBtn = $('btn-copy-code');
copyBtn?.addEventListener('click', async () => {
  const text = codeSnippet ? codeSnippet.textContent : '';
  try {
    await navigator.clipboard.writeText(text);
    copyBtn.textContent = '[ COPIED TO CLIPBOARD! ]';
    copyBtn.style.background = '#4A9E5C';
    copyBtn.style.color = '#fff';
    copyBtn.style.borderColor = '#4A9E5C';
    setTimeout(() => {
      copyBtn.textContent = '[ COPY CODE ]';
      copyBtn.style.background = '';
      copyBtn.style.color = '';
      copyBtn.style.borderColor = '';
    }, 2000);
  } catch (err) {
    copyBtn.textContent = '[ COPY FAILED - SELECT MANUALLY ]';
  }
});

// --- Presets -----------------------------------------------------------------
const presetButtons = document.querySelectorAll('.seg-btn');

function markActivePreset() {
  presetButtons.forEach((b) => b.classList.toggle('active', b.dataset.shape === studio.opts.shape));
  if (hudShape) hudShape.textContent = studio.opts.shape.toUpperCase();
}

presetButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    studio.setShape(btn.dataset.shape);
    markActivePreset();
    buildShapeParams();
    updateCodeSnippet();
  });
});

// --- Mechanical sliders ------------------------------------------------------
const sliderSpeed = $('slider-speed');
const speedVal = $('speed-val');
const sliderFov = $('slider-fov');
const fovVal = $('fov-val');
const sliderRadius = $('slider-radius');
const radiusVal = $('radius-val');

function syncStaticSliders() {
  const mult = studio.opts.speedX / baseSpeedX;
  if (sliderSpeed) sliderSpeed.value = mult.toFixed(1);
  if (speedVal) speedVal.textContent = `${mult.toFixed(1)}x`;
  if (sliderFov) sliderFov.value = studio.opts.fov;
  if (fovVal) fovVal.textContent = studio.opts.fov;
  if (sliderRadius) sliderRadius.value = studio.opts.pointSize;
  if (radiusVal) radiusVal.textContent = `${Number(studio.opts.pointSize).toFixed(1)}px`;
}

sliderSpeed?.addEventListener('input', (e) => {
  const m = parseFloat(e.target.value);
  if (speedVal) speedVal.textContent = `${m.toFixed(1)}x`;
  studio.updateOptions({ speedX: baseSpeedX * m, speedY: baseSpeedY * m });
  updateCodeSnippet();
});

sliderFov?.addEventListener('input', (e) => {
  const v = parseInt(e.target.value, 10);
  if (fovVal) fovVal.textContent = v;
  studio.updateOptions({ fov: v });
  updateCodeSnippet();
});

sliderRadius?.addEventListener('input', (e) => {
  const v = parseFloat(e.target.value);
  if (radiusVal) radiusVal.textContent = `${v.toFixed(1)}px`;
  studio.updateOptions({ pointSize: v });
  updateCodeSnippet();
});

[
  [sliderSpeed, 1.0],
  [sliderFov, DEFAULT_FOV],
  [sliderRadius, DEFAULT_RADIUS]
].forEach(([input, def]) => {
  const head = input && input.closest('.slider-row') && input.closest('.slider-row').querySelector('.slider-header');
  if (!head) return;
  const btn = el('button', 'row-reset', '\u21BA');
  btn.type = 'button';
  btn.title = 'Reset to default';
  btn.addEventListener('click', () => {
    input.value = def;
    input.dispatchEvent(new Event('input'));
  });
  head.appendChild(btn);
});

// --- Play / Pause, Reset, Params reset, Seed, Share --------------------------
const toggleBtn = $('btn-toggle');
toggleBtn?.addEventListener('click', () => {
  studio.toggle();
  toggleBtn.textContent = studio.running ? 'Pause Engine' : 'Resume Engine';
  if (hudFps) hudFps.textContent = studio.running ? `${Math.round(studio.fps)} FPS` : 'PAUSED';
});

$('btn-reset')?.addEventListener('click', () => {
  studio.resetShapeParams();
  studio.updateOptions({
    ...ENGINE_DEFAULTS,
    speedX: baseSpeedX,
    speedY: baseSpeedY,
    fov: DEFAULT_FOV,
    pointSize: DEFAULT_RADIUS
  });
  syncStaticSliders();
  buildShapeParams();
  buildEngineControls();
  updateCodeSnippet();
});

$('btn-reset-params')?.addEventListener('click', () => {
  studio.resetShapeParams();
  buildShapeParams();
  updateCodeSnippet();
});

$('btn-randomize')?.addEventListener('click', () => {
  studio.updateOptions({ seed: 1 + Math.floor(Math.random() * 9999) });
  buildEngineControls();
  updateCodeSnippet();
});

const shareBtn = $('btn-share');
shareBtn?.addEventListener('click', async () => {
  const hash = '#s=' + encodeURIComponent(JSON.stringify(studio.getState()));
  const url = location.origin + location.pathname + hash;
  try {
    await navigator.clipboard.writeText(url);
    history.replaceState(null, '', hash);
    shareBtn.textContent = 'Link Copied';
  } catch (err) {
    shareBtn.textContent = 'Copy Failed';
  }
  setTimeout(() => { shareBtn.textContent = 'Copy Link'; }, 2000);
});

function loadFromHash() {
  if (!location.hash.startsWith('#s=')) return;
  try {
    const state = JSON.parse(decodeURIComponent(location.hash.slice(3)));
    studio.setState(state);
  } catch (err) {
    console.warn('[Orbs] Ignored invalid share link.', err);
  }
}

loadFromHash();
markActivePreset();
syncStaticSliders();
buildShapeParams();
buildEngineControls();
updateCodeSnippet();

// ==========================================================================
// 3. Real-World AI & Interaction Use Cases (Defensively Guarded)
// ==========================================================================

// Use Case A: AI Agent "Thinking" / Reasoning Loop
const aiCard = $('card-ai');
const aiMatrix = aiCard ? new DotMatrix('#card-ai', {
  shape: 'sphere',
  color: '240, 240, 240',
  speedX: 0.006,
  speedY: 0.008,
  pointSize: 1.8,
  interactive: false
}) : null;

const btnSimulateAI = $('btn-simulate-ai');
const aiStatusBadge = $('ai-status-badge');
const aiTokenStream = $('ai-token-stream');
let isAIThinking = false;

btnSimulateAI?.addEventListener('click', () => {
  if (!aiMatrix || isAIThinking) return;
  isAIThinking = true;

  aiStatusBadge.textContent = 'AI // REASONING...';
  aiStatusBadge.style.color = '#D71921';
  aiStatusBadge.style.borderColor = '#D71921';
  btnSimulateAI.disabled = true;
  btnSimulateAI.textContent = 'Generating Tokens...';

  aiMatrix.updateOptions({
    shape: 'galaxy',
    speedX: 0.035,
    speedY: 0.045,
    pointSize: 1.5,
    color: '255, 255, 255'
  });

  let tokens = 0;
  const tokenInterval = setInterval(() => {
    tokens += Math.floor(Math.random() * 18) + 12;
    aiTokenStream.textContent = `INFERENCE \u2022 ${tokens} TOKENS GENERATED`;
  }, 120);

  setTimeout(() => {
    clearInterval(tokenInterval);
    aiStatusBadge.textContent = 'AI // COMPLETE';
    aiStatusBadge.style.color = '#4A9E5C';
    aiStatusBadge.style.borderColor = '#4A9E5C';
    aiTokenStream.textContent = `RESOLVED \u2022 ${tokens} TOKENS IN 2.4s`;
    btnSimulateAI.textContent = 'Simulate Prompt Again';
    btnSimulateAI.disabled = false;
    isAIThinking = false;

    aiMatrix.updateOptions({
      shape: 'sphere',
      speedX: 0.006,
      speedY: 0.008,
      pointSize: 2.0,
      color: '160, 255, 180'
    });
  }, 2600);
});

// Use Case B: Tactile Action Button Interaction
const btnCard = $('card-btn-action');
const btnMatrix = btnCard ? new DotMatrix('#card-btn-action', {
  shape: 'hollow-cube',
  color: '255, 255, 255',
  speedX: 0.01,
  speedY: 0.015,
  pointSize: 2.2,
  interactive: true
}) : null;

const actionBtn = $('btn-interactive-trigger');
const actionStatus = $('btn-trigger-status');

actionBtn?.addEventListener('click', () => {
  if (!btnMatrix) return;
  actionStatus.textContent = 'BURST TRIGGERED [!]';
  actionStatus.style.color = '#fff';

  btnMatrix.updateOptions({
    shape: 'chaos',
    speedX: 0.06,
    speedY: 0.07,
    pointSize: 3.0
  });

  setTimeout(() => {
    btnMatrix.updateOptions({
      shape: 'hollow-cube',
      speedX: 0.01,
      speedY: 0.015,
      pointSize: 2.2
    });
    actionStatus.textContent = 'IDLE \u2022 READY';
    actionStatus.style.color = '';
  }, 800);
});

// Use Case C: Voice / Audio Agent Visualizer
const voiceCard = $('card-voice');
const voiceMatrix = voiceCard ? new DotMatrix('#card-voice', {
  shape: 'wave',
  color: '140, 210, 255',
  speedX: 0.003,
  speedY: 0.005,
  pointSize: 1.8,
  interactive: false
}) : null;

const toggleVoiceBtn = $('btn-toggle-voice');
const voiceBadge = $('voice-badge');
const voiceStatus = $('voice-status');
let isSpeaking = false;

toggleVoiceBtn?.addEventListener('click', () => {
  if (!voiceMatrix) return;
  isSpeaking = !isSpeaking;
  if (isSpeaking) {
    voiceBadge.textContent = 'MIC // SPEAKING';
    voiceBadge.style.color = '#38bdf8';
    voiceStatus.textContent = 'SYNTHESIZING AUDIO';
    voiceMatrix.updateOptions({
      shape: 'helix',
      color: '180, 230, 255',
      speedX: 0.02,
      speedY: 0.03
    });
  } else {
    voiceBadge.textContent = 'MIC // LISTENING';
    voiceBadge.style.color = '';
    voiceStatus.textContent = 'INPUT ACTIVE (IDLE)';
    voiceMatrix.updateOptions({
      shape: 'wave',
      color: '140, 210, 255',
      speedX: 0.003,
      speedY: 0.005
    });
  }
});