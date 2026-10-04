import DotMatrix from './dot-matrix.js';

// 1. Hero Liquid Wave Background
new DotMatrix('#hero-wave', {
  shape: 'wave',
  color: '120, 180, 255',
  speedX: 0.002,
  speedY: 0.004,
  trail: 0.2,
  pointSize: 2.0
});

// 2. Main Interactive Studio Canvas
const studio = new DotMatrix('#main-stage', {
  shape: 'cube',
  color: '255, 255, 255',
  trail: 0.25,
  pointSize: 2.2,
  interactive: true
});

// Presets Switching
const presetButtons = document.querySelectorAll('.preset-btn');
presetButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    presetButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    studio.setShape(btn.dataset.shape);
  });
});

// Studio Playback Controls
document.getElementById('btn-toggle').addEventListener('click', () => {
  studio.toggle();
});

// 3. Mini Trigger Showcase Instances
const sphereCard = new DotMatrix('#card-sphere', {
  shape: 'sphere',
  color: '255, 255, 255',
  speedX: 0.015,
  speedY: 0.02
});

const torusCard = new DotMatrix('#card-torus', {
  shape: 'torus',
  color: '160, 240, 200',
  speedX: 0.012,
  speedY: 0.016
});

// 4. Modal On-Demand Trigger Demo
let modalMatrix = null;
const modalBackdrop = document.getElementById('modal-backdrop');
const openModalBtn = document.getElementById('btn-open-modal');
const closeModalBtn = document.getElementById('btn-close-modal');

openModalBtn.addEventListener('click', () => {
  modalBackdrop.classList.add('open');
  if (!modalMatrix) {
    modalMatrix = new DotMatrix('#modal-stage', {
      shape: 'galaxy',
      color: '240, 200, 255',
      speedX: 0.008,
      speedY: 0.014
    });
  } else {
    modalMatrix.start();
  }
});

closeModalBtn.addEventListener('click', () => {
  modalBackdrop.classList.remove('open');
  if (modalMatrix) modalMatrix.stop();
});