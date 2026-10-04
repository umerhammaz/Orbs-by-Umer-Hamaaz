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

// Update live code display
function updateCodeSnippet() {
  codeSnippet.textContent = `import DotMatrix from './src/dot-matrix.js';

const matrix = new DotMatrix('#my-container', {
  shape: '${currentShape}',
  speedX: ${(baseSpeedX * speedMultiplier).toFixed(4)},
  speedY: ${(baseSpeedY * speedMultiplier).toFixed(4)},
  fov: ${currentFov},
  pointSize: ${currentRadius},
  trail: 0.25,
  interactive: true
});`;
}

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
// 3. Compact Sensor Modules
// ==========================================================================
new DotMatrix('#card-sphere', {
  shape: 'sphere',
  color: '255, 255, 255',
  speedX: 0.015,
  speedY: 0.02,
  pointSize: 1.8,
  interactive: true
});

new DotMatrix('#card-torus', {
  shape: 'torus',
  color: '160, 240, 200',
  speedX: 0.012,
  speedY: 0.016,
  pointSize: 2.0,
  interactive: true
});

// ==========================================================================
// 4. On-Demand Diagnostic Modal
// ==========================================================================
let modalInstance = null;
const modalBackdrop = document.getElementById('modal-backdrop');
const openModalBtn = document.getElementById('btn-open-modal');
const closeModalBtn = document.getElementById('btn-close-modal');
const closeModalAlt = document.getElementById('btn-close-modal-alt');

function openModal() {
  modalBackdrop.classList.add('open');
  if (!modalInstance) {
    modalInstance = new DotMatrix('#modal-stage', {
      shape: 'galaxy',
      color: '255, 255, 255',
      speedX: 0.008,
      speedY: 0.014,
      pointSize: 1.6
    });
  } else {
    modalInstance.start();
  }
}

function closeModal() {
  modalBackdrop.classList.remove('open');
  if (modalInstance) modalInstance.stop();
}

openModalBtn.addEventListener('click', openModal);
[closeModalBtn, closeModalAlt].forEach(btn => btn.addEventListener('click', closeModal));