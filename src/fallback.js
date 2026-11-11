const GAITS = {
  walk: { speed: 5.6, bpm: 42, frequency: 0.74, stride: 0.24, lift: 0.12, phases: [0, Math.PI, Math.PI * 1.5, Math.PI * 0.5] },
  trot: { speed: 13.2, bpm: 96, frequency: 1.35, stride: 0.34, lift: 0.19, phases: [0, Math.PI, Math.PI, 0] },
  canter: { speed: 19.8, bpm: 132, frequency: 1.55, stride: 0.43, lift: 0.25, phases: [0, Math.PI * 0.92, Math.PI * 0.56, -Math.PI * 0.48] },
  gallop: { speed: 38, bpm: 178, frequency: 1.9, stride: 0.54, lift: 0.31, phases: [0, Math.PI * 0.13, -Math.PI * 0.92, -Math.PI * 0.8] },
};

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

export function startFallback() {
  const frame = document.querySelector('#scene-frame');
  const mount = document.querySelector('#scene-mount');
  document.querySelector('#loading-state').classList.add('is-hidden');
  document.querySelector('.orbit-hint').textContent = 'DRAG TO TURN';
  const cameraButton = document.querySelector('#camera-button');
  cameraButton.disabled = true;
  cameraButton.classList.remove('is-active');
  cameraButton.setAttribute('aria-pressed', 'false');
  cameraButton.setAttribute('aria-label', 'Follow camera unavailable in illustrated preview');
  cameraButton.title = 'Follow camera is available when WebGL is supported';
  const audioButton = document.querySelector('#audio-button');
  audioButton.disabled = true;
  audioButton.setAttribute('aria-label', 'Horse audio unavailable in illustrated preview');
  audioButton.title = 'Horse audio is available in the Three.js scene';
  const canvas = document.createElement('canvas');
  canvas.className = 'fallback-scene-canvas';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Illustrated meadow preview with a moving bay horse');
  mount.append(canvas);

  const note = document.createElement('span');
  note.className = 'fallback-note';
  note.textContent = 'ILLUSTRATED PREVIEW · WEBGL UNAVAILABLE';
  frame.append(note);

  const context = canvas.getContext('2d');
  if (!context) {
    note.textContent = 'PREVIEW UNAVAILABLE · THIS BROWSER CANNOT DRAW THE SCENE';
    throw new Error('Neither WebGL nor a 2D canvas context is available.');
  }

  const state = {
    gait: 'gallop',
    playing: !reducedMotion.matches,
    pace: 1,
    time: 0,
    facing: 1,
    zoom: 1,
    dragging: false,
    pointerX: 0,
  };
  const grassMarks = Array.from({ length: 210 }, (_, index) => ({
    x: (index * 0.61803398875) % 1,
    y: 0.66 + ((index * 0.754877666) % 1) * 0.32,
    height: 4 + ((index * 0.414213562) % 1) * 14,
    shade: index % 4,
  }));
  const treeMarks = Array.from({ length: 16 }, (_, index) => ({
    x: index / 15,
    size: 12 + ((index * 0.732) % 1) * 18,
    shade: index % 3,
  }));
  let pixelRatio = 1;
  let width = 0;
  let height = 0;
  let previous = performance.now();

  const resize = () => {
    const rect = frame.getBoundingClientRect();
    pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  };

  const updateHud = () => {
    const gait = GAITS[state.gait];
    document.querySelector('#heart-rate').innerHTML = `${state.playing ? gait.bpm : 42} <small>BPM</small>`;
    document.querySelector('#speed-value').innerHTML = `${(gait.speed * state.pace).toFixed(1)} <small>KM/H</small>`;
    document.querySelectorAll('.gait-button').forEach((button) => {
      const selected = button.dataset.gait === state.gait;
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });

    const playButton = document.querySelector('#play-button');
    playButton.classList.toggle('is-paused', !state.playing);
    playButton.setAttribute('aria-label', state.playing ? 'Pause simulation' : 'Resume simulation');
    playButton.title = state.playing ? 'Pause simulation' : 'Resume simulation';
  };

  document.querySelectorAll('.gait-button').forEach((button) => {
    button.addEventListener('click', () => {
      state.gait = button.dataset.gait;
      updateHud();
    });
  });
  document.querySelector('#play-button').addEventListener('click', () => {
    state.playing = !state.playing;
    updateHud();
  });
  document.querySelector('#speed-slider').addEventListener('input', (event) => {
    state.pace = Number(event.currentTarget.value) / 100;
    updateHud();
  });
  document.querySelector('#fullscreen-button').addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await frame.requestFullscreen();
    } catch (error) {
      console.error('Fullscreen could not be changed.', error);
    }
  });
  window.addEventListener('keydown', (event) => {
    const target = event.target;
    if (target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'BUTTON', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return;
    if (event.code === 'Space') {
      event.preventDefault();
      state.playing = !state.playing;
      updateHud();
    }
    if (/^[1-4]$/.test(event.key)) {
      state.gait = Object.keys(GAITS)[Number(event.key) - 1];
      updateHud();
    }
  });
  reducedMotion.addEventListener('change', (event) => {
    if (event.matches) {
      state.playing = false;
      updateHud();
    }
  });

  canvas.addEventListener('pointerdown', (event) => {
    state.dragging = true;
    state.pointerX = event.clientX;
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointerup', (event) => {
    if (!state.dragging) return;
    const delta = event.clientX - state.pointerX;
    if (Math.abs(delta) > 24) state.facing = Math.sign(delta);
    state.dragging = false;
    canvas.releasePointerCapture(event.pointerId);
  });
  canvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    state.zoom = Math.max(0.78, Math.min(1.3, state.zoom - Math.sign(event.deltaY) * 0.06));
  }, { passive: false });

  function drawBackdrop() {
    const sky = context.createLinearGradient(0, 0, 0, height * 0.72);
    sky.addColorStop(0, '#aebfbc');
    sky.addColorStop(0.58, '#d6d7c6');
    sky.addColorStop(1, '#e8d8ba');
    context.fillStyle = sky;
    context.fillRect(0, 0, width, height);

    const sunGlow = context.createRadialGradient(width * 0.77, height * 0.2, 1, width * 0.77, height * 0.2, height * 0.42);
    sunGlow.addColorStop(0, 'rgba(255, 238, 193, .48)');
    sunGlow.addColorStop(1, 'rgba(255, 238, 193, 0)');
    context.fillStyle = sunGlow;
    context.fillRect(0, 0, width, height * 0.72);
    context.fillStyle = 'rgba(255, 238, 193, .8)';
    context.beginPath();
    context.arc(width * 0.77, height * 0.2, Math.max(12, height * 0.025), 0, Math.PI * 2);
    context.fill();

    for (const [x, y, rx, ry] of [
      [0.08, 0.55, 0.4, 0.14],
      [0.48, 0.51, 0.5, 0.12],
      [0.97, 0.56, 0.42, 0.16],
    ]) {
      context.fillStyle = '#879582';
      context.beginPath();
      context.ellipse(width * x, height * y, width * rx, height * ry, 0, Math.PI, Math.PI * 2);
      context.lineTo(width * (x + rx), height * 0.72);
      context.lineTo(width * (x - rx), height * 0.72);
      context.fill();
    }
    context.fillStyle = '#7b8b72';
    context.beginPath();
    context.moveTo(0, height * 0.61);
    context.bezierCurveTo(width * 0.22, height * 0.56, width * 0.34, height * 0.66, width * 0.56, height * 0.6);
    context.bezierCurveTo(width * 0.76, height * 0.55, width * 0.86, height * 0.65, width, height * 0.59);
    context.lineTo(width, height);
    context.lineTo(0, height);
    context.closePath();
    context.fill();

    const field = context.createLinearGradient(0, height * 0.62, 0, height);
    field.addColorStop(0, '#87916e');
    field.addColorStop(0.55, '#74835e');
    field.addColorStop(1, '#5e7352');
    context.fillStyle = field;
    context.fillRect(0, height * 0.63, width, height * 0.37);

    for (const tree of treeMarks) {
      const x = width * tree.x;
      const y = height * (0.56 + (tree.shade % 2) * 0.035);
      const size = tree.size * Math.max(0.65, width / 1000);
      context.fillStyle = '#68563f';
      context.fillRect(x - size * 0.06, y, size * 0.12, size * 1.05);
      context.fillStyle = ['#566c50', '#687a59', '#758060'][tree.shade];
      context.beginPath();
      context.arc(x, y, size * 0.68, 0, Math.PI * 2);
      context.arc(x - size * 0.44, y + size * 0.18, size * 0.45, 0, Math.PI * 2);
      context.arc(x + size * 0.42, y + size * 0.17, size * 0.48, 0, Math.PI * 2);
      context.fill();
    }

    const barnX = width * 0.16;
    const barnY = height * 0.55;
    const barnWidth = Math.max(46, width * 0.058);
    context.fillStyle = '#965c43';
    context.fillRect(barnX - barnWidth / 2, barnY, barnWidth, barnWidth * 0.45);
    context.beginPath();
    context.moveTo(barnX - barnWidth * 0.62, barnY + 1);
    context.lineTo(barnX, barnY - barnWidth * 0.27);
    context.lineTo(barnX + barnWidth * 0.62, barnY + 1);
    context.closePath();
    context.fillStyle = '#534c3e';
    context.fill();
    context.fillStyle = '#614635';
    context.fillRect(barnX - barnWidth * 0.16, barnY + barnWidth * 0.2, barnWidth * 0.32, barnWidth * 0.25);
  }

  function drawTrack() {
    context.fillStyle = 'rgba(151, 123, 86, .62)';
    context.beginPath();
    context.ellipse(width * 0.52, height * 0.83, width * 0.39, height * 0.18, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#77855f';
    context.beginPath();
    context.ellipse(width * 0.52, height * 0.81, width * 0.31, height * 0.115, 0, 0, Math.PI * 2);
    context.fill();

    context.strokeStyle = 'rgba(90, 72, 49, .85)';
    context.lineWidth = Math.max(2, width * 0.0025);
    for (const offset of [-0.032, 0.005]) {
      context.beginPath();
      context.ellipse(width * 0.52, height * (0.71 + offset), width * 0.385, height * 0.17, 0, Math.PI, Math.PI * 2);
      context.stroke();
    }
    for (let i = 0; i <= 30; i += 1) {
      const angle = Math.PI + (i / 30) * Math.PI;
      const x = width * 0.52 + Math.cos(angle) * width * 0.385;
      const y = height * 0.71 + Math.sin(angle) * height * 0.17;
      const postHeight = Math.max(8, height * 0.025);
      context.strokeStyle = '#70583d';
      context.lineWidth = Math.max(2, width * 0.0027);
      context.beginPath();
      context.moveTo(x, y);
      context.lineTo(x, y - postHeight);
      context.stroke();
    }
  }

  function drawLeg(hipX, phase, hind, far, gait, cycle) {
    const swing = Math.sin(phase);
    const lift = Math.max(0, Math.cos(phase - 0.65));
    const amplitude = gait.stride * (state.playing ? 1 : 0.11);
    const angle = swing * amplitude * (hind ? 0.78 : 1);
    const hipY = -1.37 + Math.sin(cycle * 2) * (state.playing ? gait.lift * 0.045 : 0.008);
    const upperLength = hind ? 0.56 : 0.65;
    const lowerLength = hind ? 0.62 : 0.66;
    const kneeX = hipX + Math.sin(angle) * upperLength * 0.68;
    const kneeY = hipY + upperLength * 0.88 - lift * gait.lift * (state.playing ? 0.5 : 0.02);
    const ankleX = kneeX + Math.sin(angle * 0.4 - lift * 0.28) * lowerLength * 0.62;
    const ankleY = kneeY + lowerLength * 0.9;
    const footX = ankleX + Math.sin(angle * 0.3) * 0.12;
    const footY = Math.min(-0.02, ankleY + 0.12);
    const upperColor = far ? '#784027' : '#884522';
    const lowerColor = far ? '#71402a' : '#8b4a2c';

    context.lineCap = 'round';
    context.strokeStyle = upperColor;
    context.lineWidth = hind ? 0.17 : 0.14;
    context.beginPath();
    context.moveTo(hipX, hipY);
    context.quadraticCurveTo(hipX + (hind ? 0.1 : -0.02), hipY + 0.25, kneeX, kneeY);
    context.stroke();
    context.strokeStyle = lowerColor;
    context.lineWidth = 0.07;
    context.beginPath();
    context.moveTo(kneeX, kneeY);
    context.lineTo(ankleX, ankleY);
    context.lineTo(footX, footY);
    context.stroke();
    context.fillStyle = '#382d25';
    context.beginPath();
    context.moveTo(footX - 0.1, footY - 0.02);
    context.lineTo(footX + 0.12, footY - 0.02);
    context.lineTo(footX + 0.19, footY + 0.07);
    context.lineTo(footX - 0.08, footY + 0.07);
    context.closePath();
    context.fill();
  }

  function drawHorse(now) {
    const gait = GAITS[state.gait];
    const cycle = state.time * gait.frequency * state.pace * Math.PI * 2;
    const horseScale = Math.min(height / 4.3, width / 13.8) * state.zoom;
    const horseX = width * 0.52;
    const horseGround = height * 0.81;
    const bob = Math.sin(cycle * 2) * (state.playing ? gait.lift * 0.045 : 0.008);
    context.save();
    context.translate(horseX, horseGround);
    context.scale(horseScale * state.facing, horseScale);

    context.fillStyle = 'rgba(37, 45, 31, .22)';
    context.beginPath();
    context.ellipse(-0.03, 0.015, 1.25, 0.13, 0, 0, Math.PI * 2);
    context.fill();

    const phases = gait.phases;
    drawLeg(-0.76, cycle + phases[2], true, true, gait, cycle);
    drawLeg(0.52, cycle + phases[1], false, true, gait, cycle);

    const bodyGradient = context.createLinearGradient(0, -2.13, 0, -1.12);
    bodyGradient.addColorStop(0, '#a75d37');
    bodyGradient.addColorStop(0.5, '#904b2b');
    bodyGradient.addColorStop(1, '#713a24');
    context.fillStyle = bodyGradient;
    context.beginPath();
    context.moveTo(-1.12, -1.7 + bob);
    context.bezierCurveTo(-1.17, -2.05 + bob, -0.76, -2.13 + bob, -0.27, -2.04 + bob);
    context.bezierCurveTo(0.28, -2.13 + bob, 0.79, -1.93 + bob, 0.9, -1.58 + bob);
    context.bezierCurveTo(0.83, -1.28 + bob, 0.43, -1.17 + bob, -0.23, -1.22 + bob);
    context.bezierCurveTo(-0.75, -1.17 + bob, -1.13, -1.34 + bob, -1.12, -1.7 + bob);
    context.fill();

    context.fillStyle = 'rgba(190, 119, 73, .45)';
    context.beginPath();
    context.ellipse(-0.55, -1.78 + bob, 0.33, 0.21, -0.14, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.ellipse(0.51, -1.72 + bob, 0.27, 0.35, -0.24, 0, Math.PI * 2);
    context.fill();

    const neckGradient = context.createLinearGradient(0.62, -1.93, 1.22, -2.8);
    neckGradient.addColorStop(0, '#814226');
    neckGradient.addColorStop(0.5, '#a75b34');
    neckGradient.addColorStop(1, '#864327');
    context.fillStyle = neckGradient;
    context.beginPath();
    context.moveTo(0.44, -1.91 + bob);
    context.bezierCurveTo(0.63, -2.04 + bob, 0.72, -2.27 + bob, 0.87, -2.53 + bob);
    context.bezierCurveTo(1.02, -2.79 + bob, 1.21, -2.94 + bob, 1.43, -2.85 + bob);
    context.lineTo(1.62, -2.58 + bob);
    context.bezierCurveTo(1.49, -2.44 + bob, 1.36, -2.48 + bob, 1.25, -2.55 + bob);
    context.bezierCurveTo(1.08, -2.26 + bob, 0.96, -2.01 + bob, 0.81, -1.72 + bob);
    context.closePath();
    context.fill();

    context.fillStyle = '#984f2d';
    context.beginPath();
    context.moveTo(1.22, -2.78 + bob);
    context.quadraticCurveTo(1.4, -3.03 + bob, 1.59, -2.89 + bob);
    context.lineTo(1.72, -2.71 + bob);
    context.lineTo(1.59, -2.53 + bob);
    context.lineTo(1.37, -2.59 + bob);
    context.closePath();
    context.fill();
    context.fillStyle = '#b36b46';
    context.beginPath();
    context.ellipse(1.58, -2.66 + bob, 0.2, 0.12, 0.13, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#38281f';
    context.beginPath();
    context.ellipse(1.74, -2.69 + bob, 0.035, 0.023, 0, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.ellipse(1.37, -2.82 + bob, 0.035, 0.024, -0.2, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = '#392820';
    context.beginPath();
    context.moveTo(1.11, -2.84 + bob);
    context.lineTo(1.16, -3.12 + bob);
    context.lineTo(1.24, -2.91 + bob);
    context.closePath();
    context.fill();
    context.beginPath();
    context.moveTo(1.26, -2.89 + bob);
    context.lineTo(1.37, -3.1 + bob);
    context.lineTo(1.39, -2.85 + bob);
    context.closePath();
    context.fill();
    context.fillStyle = '#d9b69a';
    context.beginPath();
    context.moveTo(1.14, -2.88 + bob);
    context.lineTo(1.17, -3.03 + bob);
    context.lineTo(1.21, -2.89 + bob);
    context.closePath();
    context.fill();

    context.strokeStyle = '#38281f';
    context.lineWidth = 0.085;
    context.lineCap = 'round';
    context.beginPath();
    context.moveTo(0.69, -1.97 + bob);
    context.bezierCurveTo(0.83, -2.32 + bob, 1.1, -2.65 + bob, 1.34, -2.91 + bob);
    context.stroke();
    for (let i = 0; i < 10; i += 1) {
      const t = i / 10;
      const x = 0.72 + t * 0.58;
      const y = -2.03 - t * 0.77 + bob;
      context.strokeStyle = i % 3 === 0 ? '#593b2b' : '#38281f';
      context.lineWidth = 0.025;
      context.beginPath();
      context.moveTo(x, y);
      context.quadraticCurveTo(x - 0.09, y + 0.08, x - 0.17, y + 0.17);
      context.stroke();
    }
    context.fillStyle = '#1f1712';
    context.beginPath();
    context.arc(1.35, -2.83 + bob, 0.036, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#f1d9b3';
    context.beginPath();
    context.arc(1.361, -2.842 + bob, 0.009, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = '#4b3024';
    context.beginPath();
    context.moveTo(-0.12, -2.1 + bob);
    context.quadraticCurveTo(-0.02, -2.29 + bob, 0.1, -2.07 + bob);
    context.lineTo(0.42, -1.94 + bob);
    context.lineTo(0.39, -1.77 + bob);
    context.closePath();
    context.fill();
    context.fillStyle = '#667358';
    context.beginPath();
    context.moveTo(-0.49, -2.12 + bob);
    context.quadraticCurveTo(-0.34, -2.23 + bob, -0.18, -2.1 + bob);
    context.lineTo(0.38, -1.94 + bob);
    context.lineTo(0.28, -1.83 + bob);
    context.lineTo(-0.45, -1.91 + bob);
    context.closePath();
    context.fill();
    context.strokeStyle = '#32281f';
    context.lineWidth = 0.035;
    context.beginPath();
    context.moveTo(-0.42, -2.12 + bob);
    context.quadraticCurveTo(-0.2, -1.67 + bob, 0.14, -1.56 + bob);
    context.stroke();
    context.strokeStyle = '#4a3428';
    context.lineWidth = 0.025;
    context.beginPath();
    context.moveTo(1.32, -2.86 + bob);
    context.quadraticCurveTo(1.19, -2.66 + bob, 0.96, -2.43 + bob);
    context.stroke();

    drawLeg(-0.76, cycle + phases[3], true, false, gait, cycle);
    drawLeg(0.52, cycle + phases[0], false, false, gait, cycle);

    context.strokeStyle = '#38271e';
    context.lineWidth = 0.13;
    context.lineCap = 'round';
    context.beginPath();
    context.moveTo(-1.02, -1.78 + bob);
    context.quadraticCurveTo(-1.25 + Math.sin(now * 0.002) * 0.07, -1.36, -1.19, -0.95);
    context.stroke();
    for (let i = 0; i < 7; i += 1) {
      context.strokeStyle = i % 2 ? '#4a3124' : '#30231c';
      context.lineWidth = 0.022;
      context.beginPath();
      context.moveTo(-1.15 + i * 0.025, -1.29);
      context.quadraticCurveTo(-1.31 + i * 0.025, -1.09, -1.22 + i * 0.035, -0.96);
      context.stroke();
    }
    context.restore();
  }

  function draw(now) {
    const delta = Math.min((now - previous) / 1000, 0.05);
    previous = now;
    if (state.playing) state.time += delta;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    drawBackdrop();
    drawTrack();
    drawHorse(now);

    for (const grass of grassMarks) {
      const x = grass.x * width;
      const y = grass.y * height;
      context.strokeStyle = ['rgba(188, 180, 122, .58)', 'rgba(44, 75, 52, .48)', 'rgba(204, 191, 131, .46)', 'rgba(56, 81, 50, .42)'][grass.shade];
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(x, y);
      context.quadraticCurveTo(x - 2, y - grass.height * 0.5, x + 1.5, y - grass.height);
      context.stroke();
    }
    requestAnimationFrame(draw);
  }

  new ResizeObserver(resize).observe(frame);
  window.addEventListener('resize', resize);
  resize();
  updateHud();
  requestAnimationFrame(draw);
}
