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
const hudShape = document.getElementById('hud-shape');
const hudPoints = document.getElementById('hud-points');
const hudRot = document.getElementById('hud-rot');
const hudFps = document.getElementById('hud-fps');
const codeSnippet = document.getElementById('live-code-snippet');

let currentShape = 'cube';
let speedMultiplier = 1.0;
let currentFov = 360;
let currentRadius = 2.2;

const baseSpeedX = 0.012;
const baseSpeedY = 0.018;

const studio = new DotMatrix('#main-stage', {
  shape: currentShape,
  color: '255, 255, 255',
  speedX: baseSpeedX * speedMultiplier,
  speedY: baseSpeedY * speedMultiplier,
  fov: currentFov,
  pointSize: currentRadius,
  trail: 0.25,
  interactive: true,
  onFrame: (telemetry) => {
    hudPoints.textContent = String(telemetry.points).padStart(4, '0');
    hudRot.textContent = `${(telemetry.ax % (Math.PI * 2)).toFixed(2)} / ${(telemetry.ay % (Math.PI * 2)).toFixed(2)}`;
  }
});

// Current code format: 'esm' or 'html'
let activeFormat = 'esm';

// Update live code display
function updateCodeSnippet() {
  const sx = (baseSpeedX * speedMultiplier).toFixed(4);
  const sy = (baseSpeedY * speedMultiplier).toFixed(4);

  if (activeFormat === 'esm') {
    codeSnippet.textContent = `import DotMatrix from './src/dot-matrix.js';

// Initialize in any container (modal, hero, or AI card)
const matrix = new DotMatrix('#container', {
  shape: '${currentShape}',
  speedX: ${sx},
  speedY: ${sy},
  fov: ${currentFov},
  pointSize: ${currentRadius},
  trail: 0.25,
  interactive: true,
  onFrame: (telemetry) => {
    // Optional telemetry hook
  }
});`;
  } else {
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
    import DotMatrix from 'https://cdn.jsdelivr.net/gh/umerhammaz/Orbs-by-Umer-Hamaaz@main/src/dot-matrix.js';

    new DotMatrix('#orb-stage', {
      shape: '${currentShape}',
      speedX: ${sx},
      speedY: ${sy},
      fov: ${currentFov},
      pointSize: ${currentRadius},
      trail: 0.25,
      interactive: true
    });
  <\/script>
</body>
</html>`;
  }
}

// Code Format Tabs
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeFormat = btn.dataset.format;
    updateCodeSnippet();
  });
});

// Copy Code Button
const copyBtn = document.getElementById('btn-copy-code');
copyBtn.addEventListener('click', async () => {
  const text = codeSnippet.textContent;
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

// Preset Buttons
const presetButtons = document.querySelectorAll('.seg-btn');
presetButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    presetButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentShape = btn.dataset.shape;
    hudShape.textContent = currentShape.toUpperCase();
    studio.setShape(currentShape);
    updateCodeSnippet();
  });
});

// Mechanical Sliders
const sliderSpeed = document.getElementById('slider-speed');
const speedVal = document.getElementById('speed-val');
sliderSpeed.addEventListener('input', (e) => {
  speedMultiplier = parseFloat(e.target.value);
  speedVal.textContent = `${speedMultiplier.toFixed(1)}x`;
  studio.updateOptions({
    speedX: baseSpeedX * speedMultiplier,
    speedY: baseSpeedY * speedMultiplier
  });
  updateCodeSnippet();
});

const sliderFov = document.getElementById('slider-fov');
const fovVal = document.getElementById('fov-val');
sliderFov.addEventListener('input', (e) => {
  currentFov = parseInt(e.target.value, 10);
  fovVal.textContent = currentFov;
  studio.updateOptions({ fov: currentFov });
  updateCodeSnippet();
});

const sliderRadius = document.getElementById('slider-radius');
const radiusVal = document.getElementById('radius-val');
sliderRadius.addEventListener('input', (e) => {
  currentRadius = parseFloat(e.target.value);
  radiusVal.textContent = `${currentRadius.toFixed(1)}px`;
  studio.updateOptions({ pointSize: currentRadius });
  updateCodeSnippet();
});

// Play / Pause Toggle
const toggleBtn = document.getElementById('btn-toggle');
toggleBtn.addEventListener('click', () => {
  studio.toggle();
  toggleBtn.textContent = studio.running ? 'Pause Engine' : 'Resume Engine';
  hudFps.textContent = studio.running ? '60 FPS' : 'PAUSED';
});

// Reset
document.getElementById('btn-reset').addEventListener('click', () => {
  speedMultiplier = 1.0;
  currentFov = 360;
  currentRadius = 2.2;
  sliderSpeed.value = '1.0';
  speedVal.textContent = '1.0x';
  sliderFov.value = '360';
  fovVal.textContent = '360';
  sliderRadius.value = '2.2';
  radiusVal.textContent = '2.2px';
  studio.updateOptions({
    speedX: baseSpeedX,
    speedY: baseSpeedY,
    fov: currentFov,
    pointSize: currentRadius
  });
  updateCodeSnippet();
});

// ==========================================================================
// 3. Real-World AI & Interaction Use Cases (Defensively Guarded)
// ==========================================================================

// Use Case A: AI Agent "Thinking" / Reasoning Loop
const aiCard = document.getElementById('card-ai');
const aiMatrix = aiCard ? new DotMatrix('#card-ai', {
  shape: 'sphere',
  color: '240, 240, 240',
  speedX: 0.006,
  speedY: 0.008,
  pointSize: 1.8,
  interactive: false
}) : null;

const btnSimulateAI = document.getElementById('btn-simulate-ai');
const aiStatusBadge = document.getElementById('ai-status-badge');
const aiTokenStream = document.getElementById('ai-token-stream');
let isAIThinking = false;

btnSimulateAI?.addEventListener('click', () => {
  if (!aiMatrix || isAIThinking) return;
  if (isAIThinking) return;
  isAIThinking = true;

  // Phase 1: High-Speed Vortex / Reasoning Loop
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
    aiTokenStream.textContent = `INFERENCE &bull; ${tokens} TOKENS GENERATED`;
  }, 120);

  // Phase 2: Completed / Resolved State
  setTimeout(() => {
    clearInterval(tokenInterval);
    aiStatusBadge.textContent = 'AI // COMPLETE';
    aiStatusBadge.style.color = '#4A9E5C';
    aiStatusBadge.style.borderColor = '#4A9E5C';
    aiTokenStream.textContent = `RESOLVED &bull; ${tokens} TOKENS IN 2.4s`;
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
const btnCard = document.getElementById('card-btn-action');
const btnMatrix = btnCard ? new DotMatrix('#card-btn-action', {
  shape: 'hollow-cube',
  color: '255, 255, 255',
  speedX: 0.01,
  speedY: 0.015,
  pointSize: 2.2,
  interactive: true
}) : null;

const actionBtn = document.getElementById('btn-interactive-trigger');
const actionStatus = document.getElementById('btn-trigger-status');

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
    actionStatus.textContent = 'IDLE &bull; READY';
    actionStatus.style.color = '';
  }, 800);
});

// Use Case C: Voice / Audio Agent Visualizer
const voiceCard = document.getElementById('card-voice');
const voiceMatrix = voiceCard ? new DotMatrix('#card-voice', {
  shape: 'wave',
  color: '140, 210, 255',
  speedX: 0.003,
  speedY: 0.005,
  pointSize: 1.8,
  interactive: false
}) : null;

const toggleVoiceBtn = document.getElementById('btn-toggle-voice');
const voiceBadge = document.getElementById('voice-badge');
const voiceStatus = document.getElementById('voice-status');
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