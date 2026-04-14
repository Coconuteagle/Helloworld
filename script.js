import {
  advanceLapState,
  clamp,
  createInitialLapState,
  createSessionSettings,
  createTrack,
  crossesGate,
  formatLapTime,
  getBestLapStorageKey,
  getPointAtProgress,
  getTrackSample,
  normalizeWheelAngle,
  rankRaceEntries,
  TRACK_PRESETS,
  updateBoostValue,
} from './game-core.js';

const DEFAULT_SETTINGS = createSessionSettings();
const WHEEL_MAX_ANGLE = Math.PI * 0.58;
const BOOST_SPEND_RATE = 0.52;
const BOOST_RECHARGE_RATE = 0.22;

const TRACK_DETAILS = {
  'rookie-loop': {
    summary: '넓고 부드러운 입문용 서킷',
    fieldTop: '#eef6ff',
    fieldBottom: '#dce9f7',
    accent: '#3b82f6',
    speedFactor: 1.02,
    aiPace: 0.92,
  },
  'velocity-ring': {
    summary: '고속 코너 위주의 스피드형',
    fieldTop: '#f2fbff',
    fieldBottom: '#d8edf5',
    accent: '#0ea5e9',
    speedFactor: 1.06,
    aiPace: 0.98,
  },
  'grand-circuit': {
    summary: '밸런스 중심의 표준 코스',
    fieldTop: '#f8fbff',
    fieldBottom: '#dce9f6',
    accent: '#1864ab',
    speedFactor: 1,
    aiPace: 0.96,
  },
  'marathon-bend': {
    summary: '길고 리듬이 큰 장거리형',
    fieldTop: '#f7fbf7',
    fieldBottom: '#ddebdc',
    accent: '#1b9c62',
    speedFactor: 0.98,
    aiPace: 0.95,
  },
  'technical-maze': {
    summary: '더 구불구불한 테크니컬 코스',
    fieldTop: '#fff8f1',
    fieldBottom: '#f0e3d6',
    accent: '#f76707',
    speedFactor: 0.93,
    aiPace: 0.9,
  },
};

const canvas = document.querySelector('#raceCanvas');
const context = canvas.getContext('2d');
const stageFrame = document.querySelector('.track-frame');

const startOverlay = document.querySelector('#startOverlay');
const pauseOverlay = document.querySelector('#pauseOverlay');
const resultOverlay = document.querySelector('#resultOverlay');

const startButton = document.querySelector('#startButton');
const restartButton = document.querySelector('#restartButton');
const backToSetupButton = document.querySelector('#backToSetupButton');
const resumeButton = document.querySelector('#resumeButton');
const applyRestartButton = document.querySelector('#applyRestartButton');
const pauseButton = document.querySelector('#pauseButton');

const wheelControl = document.querySelector('#wheelControl');
const wheelFace = document.querySelector('#wheelFace');
const brakeButton = document.querySelector('#brakeButton');
const boostButton = document.querySelector('#boostButton');
const driftButton = document.querySelector('#driftButton');

const trackValue = document.querySelector('#trackValue');
const lapValue = document.querySelector('#lapValue');
const bestValue = document.querySelector('#bestValue');
const currentValue = document.querySelector('#currentValue');
const speedValue = document.querySelector('#speedValue');
const boostFill = document.querySelector('#boostFill');
const boostValue = document.querySelector('#boostValue');

const resultTrack = document.querySelector('#resultTrack');
const resultBest = document.querySelector('#resultBest');
const resultTotal = document.querySelector('#resultTotal');
const resultPosition = document.querySelector('#resultPosition');

const settingsPanels = [
  {
    trackOptions: document.querySelector('#startTrackOptions'),
    lapInput: document.querySelector('#startLapInput'),
    lapOutput: document.querySelector('#startLapOutput'),
    aiInput: document.querySelector('#startAiInput'),
    aiOutput: document.querySelector('#startAiOutput'),
  },
  {
    trackOptions: document.querySelector('#pauseTrackOptions'),
    lapInput: document.querySelector('#pauseLapInput'),
    lapOutput: document.querySelector('#pauseLapOutput'),
    aiInput: document.querySelector('#pauseAiInput'),
    aiOutput: document.querySelector('#pauseAiOutput'),
  },
];

const state = {
  status: 'ready',
  viewport: { width: 0, height: 0 },
  settings: { ...DEFAULT_SETTINGS },
  draftSettings: { ...DEFAULT_SETTINGS },
  track: null,
  player: null,
  rivals: [],
  lapState: createInitialLapState(DEFAULT_SETTINGS.laps),
  lastFrameAt: 0,
  sessionStartedAt: 0,
  lapStartedAt: 0,
  storedBestLapMs: null,
  playerPosition: 1,
  boost: {
    value: 1,
    max: 1,
  },
  controls: {
    wheel: {
      active: false,
      pointerId: null,
      angle: 0,
      steer: 0,
    },
    brake: false,
    boost: false,
    drift: false,
  },
  keyboard: {
    left: false,
    right: false,
    brake: false,
    boost: false,
    drift: false,
  },
};

function getTrackDetail(trackKey) {
  return TRACK_DETAILS[trackKey] || TRACK_DETAILS['grand-circuit'];
}

function cloneSettings(settings) {
  return createSessionSettings({ ...settings });
}

function readStoredBestLap(trackKey) {
  try {
    const stored = Number(localStorage.getItem(getBestLapStorageKey(trackKey)));
    return Number.isFinite(stored) && stored > 0 ? stored : null;
  } catch {
    return null;
  }
}

function writeStoredBestLap(trackKey, value) {
  try {
    localStorage.setItem(getBestLapStorageKey(trackKey), String(Math.floor(value)));
  } catch {
    // Ignore storage failures and keep the session playable.
  }
}

function approach(current, target, delta) {
  if (current < target) {
    return Math.min(target, current + delta);
  }

  return Math.max(target, current - delta);
}

function angleBetween(x, y) {
  return Math.atan2(y, x);
}

function shortestAngleDelta(from, to) {
  let delta = (to - from + Math.PI) % (Math.PI * 2);

  if (delta < 0) {
    delta += Math.PI * 2;
  }

  return delta - Math.PI;
}

function setStatus(nextStatus) {
  state.status = nextStatus;
  startOverlay.classList.toggle('hidden', nextStatus !== 'ready');
  pauseOverlay.classList.toggle('hidden', nextStatus !== 'paused');
  resultOverlay.classList.toggle('hidden', nextStatus !== 'finished');
  pauseButton.disabled = nextStatus !== 'running';

  if (nextStatus !== 'running') {
    resetInputState();
  }
}

function renderWheel() {
  wheelFace.style.transform = `rotate(${state.controls.wheel.angle}rad)`;
  wheelControl.setAttribute('aria-valuenow', String(Math.round(state.controls.wheel.steer * 100)));
}

function renderBoostMeter() {
  boostFill.style.transform = `scaleX(${state.boost.value})`;
  boostValue.textContent = `${Math.round(state.boost.value * 100)}%`;
}

function renderSettingsPanels() {
  for (const panel of settingsPanels) {
    panel.lapInput.value = String(state.draftSettings.laps);
    panel.lapOutput.textContent = String(state.draftSettings.laps);
    panel.aiInput.value = String(state.draftSettings.aiCount);
    panel.aiOutput.textContent = String(state.draftSettings.aiCount);

    panel.trackOptions.querySelectorAll('[data-track-key]').forEach((button) => {
      button.classList.toggle('is-active', button.dataset.trackKey === state.draftSettings.trackKey);
    });
  }
}

function updateDraftSettings(partial) {
  state.draftSettings = createSessionSettings({
    ...state.draftSettings,
    ...partial,
  });
  renderSettingsPanels();
}

function buildTrackSelectors() {
  for (const panel of settingsPanels) {
    panel.trackOptions.innerHTML = '';

    for (const preset of TRACK_PRESETS) {
      const detail = getTrackDetail(preset.key);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'track-chip';
      button.dataset.trackKey = preset.key;
      button.innerHTML = `<strong>${preset.label}</strong><small>${detail.summary}</small>`;
      button.addEventListener('click', () => {
        updateDraftSettings({ trackKey: preset.key });
      });
      panel.trackOptions.append(button);
    }

    panel.lapInput.addEventListener('input', () => {
      updateDraftSettings({ laps: Number(panel.lapInput.value) });
    });

    panel.aiInput.addEventListener('input', () => {
      updateDraftSettings({ aiCount: Number(panel.aiInput.value) });
    });
  }
}

function refreshStoredBest() {
  state.storedBestLapMs = readStoredBestLap(state.settings.trackKey);
}

function positionOnTrack(progress, laneOffset) {
  const sample = getPointAtProgress(state.track, progress);

  return {
    x: sample.position.x + sample.normal.x * laneOffset,
    y: sample.position.y + sample.normal.y * laneOffset,
    heading: angleBetween(sample.tangent.x, sample.tangent.y),
  };
}

function createCar(config) {
  const spawn = positionOnTrack(config.progress, config.laneOffset);

  return {
    ...config,
    position: { x: spawn.x, y: spawn.y },
    previousPosition: { x: spawn.x, y: spawn.y },
    heading: spawn.heading,
    speed: 0,
    steering: 0,
    desiredSteering: 0,
    completedLaps: 0,
    progress: (config.progress % 1 + 1) % 1,
    targetSpeedScale: 1,
    turnFactor: 1,
    recoveryFactor: 1,
    steerPenaltyScale: 0.14,
    onTrack: true,
  };
}

function createLaneOffsets(count, laneStep) {
  const pattern = [0, -1, 1, -2, 2, -3, 3];

  return Array.from({ length: count }, (_, index) => (pattern[index] || 0) * laneStep);
}

function resetRaceCars() {
  const scale = Math.min(state.viewport.width, state.viewport.height);
  const laneOffsets = createLaneOffsets(state.settings.aiCount, state.track.halfWidth * 0.21);
  const tuning = getTrackDetail(state.settings.trackKey);
  const baseMaxSpeed = scale * 0.34 * tuning.speedFactor;
  const rivalColors = ['#1b9c62', '#d94841', '#f59f00', '#7c3aed', '#0891b2', '#c2410c', '#0f766e'];

  state.player = createCar({
    id: 'player',
    color: '#1864ab',
    accent: '#f8fbff',
    progress: 0.02,
    laneOffset: 0,
    maxSpeed: baseMaxSpeed,
    acceleration: scale * 0.42,
    turnRate: 2.85,
    size: { length: scale * 0.06, width: scale * 0.033 },
  });

  state.rivals = Array.from({ length: state.settings.aiCount }, (_, index) => {
    return createCar({
      id: `ai-${index + 1}`,
      color: rivalColors[index % rivalColors.length],
      accent: '#ffffff',
      progress: 0.02 - (index + 1) * 0.028,
      laneOffset: laneOffsets[index],
      maxSpeed: baseMaxSpeed * (tuning.aiPace + index * 0.012),
      acceleration: scale * 0.36,
      turnRate: 2.2,
      size: { length: scale * 0.055, width: scale * 0.03 },
    });
  });
}

function rebuildTrack() {
  state.track = createTrack(state.viewport.width, state.viewport.height, state.settings.trackKey);

  if (!state.player) {
    return;
  }

  const cars = [state.player, ...state.rivals];
  for (const car of cars) {
    const next = positionOnTrack(car.progress, car.laneOffset);
    car.position.x = next.x;
    car.position.y = next.y;
    car.previousPosition = { x: next.x, y: next.y };
    car.heading = next.heading;
  }
}

function resizeCanvas() {
  const rect = stageFrame.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  state.viewport.width = rect.width;
  state.viewport.height = rect.height;

  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  context.setTransform(dpr, 0, 0, dpr, 0, 0);

  rebuildTrack();
  drawScene(performance.now());
}

function syncHudStatic() {
  trackValue.textContent = state.track?.label || TRACK_PRESETS.find((preset) => preset.key === state.settings.trackKey)?.label || 'Grand Circuit';
  renderBoostMeter();
}

function updateHud(now) {
  if (!state.player) {
    return;
  }

  lapValue.textContent = `${Math.min(state.lapState.lap, state.settings.laps)}/${state.settings.laps}`;
  bestValue.textContent = formatLapTime(state.lapState.bestLapMs || state.storedBestLapMs);
  currentValue.textContent = formatLapTime(now - state.lapStartedAt);
  speedValue.textContent = `${Math.round(state.player.speed * 0.64)} km/h`;
  syncHudStatic();
}

function applyCurrentSettings() {
  state.settings = cloneSettings(state.draftSettings);
  state.lapState = createInitialLapState(state.settings.laps);
  refreshStoredBest();
  rebuildTrack();
  syncHudStatic();
}

function resetInputState() {
  state.controls.wheel.active = false;
  state.controls.wheel.pointerId = null;
  state.controls.wheel.angle = 0;
  state.controls.wheel.steer = 0;
  state.controls.brake = false;
  state.controls.boost = false;
  state.controls.drift = false;
  renderWheel();
  [brakeButton, boostButton, driftButton].forEach((button) => button.classList.remove('is-active'));
}

function startRace() {
  applyCurrentSettings();
  state.lastFrameAt = 0;
  state.sessionStartedAt = performance.now();
  state.lapStartedAt = state.sessionStartedAt;
  state.lapState = createInitialLapState(state.settings.laps);
  state.playerPosition = 1;
  state.boost.value = 1;
  resetRaceCars();
  setStatus('running');
  updateHud(state.sessionStartedAt);
}

function openPause() {
  if (state.status !== 'running') {
    return;
  }

  state.draftSettings = cloneSettings(state.settings);
  renderSettingsPanels();
  setStatus('paused');
}

function resumeRace() {
  if (state.status !== 'paused') {
    return;
  }

  state.lastFrameAt = 0;
  setStatus('running');
}

function showSetup() {
  state.draftSettings = cloneSettings(state.settings);
  renderSettingsPanels();
  setStatus('ready');
}

function finishRace(now) {
  const order = getRaceOrder();
  state.playerPosition = order.findIndex((entry) => entry.id === 'player') + 1;
  resultTrack.textContent = state.track.label;
  resultBest.textContent = formatLapTime(state.lapState.bestLapMs || state.storedBestLapMs);
  resultTotal.textContent = formatLapTime(now - state.sessionStartedAt);
  resultPosition.textContent = `${state.playerPosition} / ${state.settings.aiCount + 1}`;
  setStatus('finished');
}

function updateCarLapProgress(car, nextProgress) {
  if (car.progress > 0.82 && nextProgress < 0.18) {
    car.completedLaps += 1;
  }

  car.progress = nextProgress;
}

function updatePhysics(car, delta) {
  const trackSample = getTrackSample(state.track, car.position);
  const trackHeading = angleBetween(trackSample.tangent.x, trackSample.tangent.y);
  const alignmentPenalty = Math.abs(shortestAngleDelta(car.heading, trackHeading));

  car.steering += (car.desiredSteering - car.steering) * Math.min(1, delta * 6);

  let targetSpeed = car.maxSpeed * car.targetSpeedScale;
  if (!trackSample.onTrack) {
    targetSpeed *= 0.52;
  }

  targetSpeed *= clamp(1 - Math.abs(car.steering) * car.steerPenaltyScale - alignmentPenalty * 0.08, 0.52, 1);

  const acceleration = car.acceleration * (trackSample.onTrack ? 1 : 1.5);
  car.speed = approach(car.speed, targetSpeed, acceleration * delta);

  car.heading += car.steering * car.turnRate * car.turnFactor * (0.6 + car.speed / car.maxSpeed) * delta;

  if (!trackSample.onTrack) {
    car.heading -= shortestAngleDelta(trackHeading, car.heading) * delta * 1.25 * car.recoveryFactor;
  }

  car.previousPosition.x = car.position.x;
  car.previousPosition.y = car.position.y;
  car.position.x += Math.cos(car.heading) * car.speed * delta;
  car.position.y += Math.sin(car.heading) * car.speed * delta;

  const afterSample = getTrackSample(state.track, car.position);
  car.onTrack = afterSample.onTrack;
  updateCarLapProgress(car, afterSample.progress);

  if (!afterSample.onTrack && afterSample.distance > state.track.halfWidth * 1.16) {
    car.position.x = afterSample.point.x + afterSample.normal.x * state.track.halfWidth * 0.94;
    car.position.y = afterSample.point.y + afterSample.normal.y * state.track.halfWidth * 0.94;
    car.speed *= 0.72;
  }
}

function getKeyboardSteer() {
  if (state.keyboard.left && !state.keyboard.right) return -1;
  if (state.keyboard.right && !state.keyboard.left) return 1;
  return 0;
}

function getPlayerInput() {
  if (state.controls.wheel.active || Math.abs(state.controls.wheel.steer) > 0.01) {
    return state.controls.wheel.steer;
  }

  return getKeyboardSteer();
}

function isBrakeActive() {
  return state.controls.brake || state.keyboard.brake;
}

function isBoostActive() {
  return (state.controls.boost || state.keyboard.boost) && state.boost.value > 0.02;
}

function isDriftActive() {
  return state.controls.drift || state.keyboard.drift;
}

function updatePlayer(delta, now) {
  const braking = isBrakeActive();
  const boosting = isBoostActive();
  const drifting = isDriftActive() && state.player.speed > state.player.maxSpeed * 0.42;

  state.boost.value = updateBoostValue(state.boost.value, delta, {
    active: boosting,
    spendRate: BOOST_SPEND_RATE,
    rechargeRate: BOOST_RECHARGE_RATE,
    maxBoost: state.boost.max,
  });

  state.player.desiredSteering = getPlayerInput();
  state.player.targetSpeedScale = 1;
  state.player.turnFactor = 1;
  state.player.recoveryFactor = 1;
  state.player.steerPenaltyScale = 0.14;

  if (braking) {
    state.player.targetSpeedScale *= 0.46;
    state.player.recoveryFactor = 1.45;
    state.player.turnFactor = 0.92;
  }

  if (boosting) {
    state.player.targetSpeedScale *= 1.26;
  }

  if (drifting) {
    state.player.targetSpeedScale *= 0.95;
    state.player.turnFactor = 1.42;
    state.player.recoveryFactor = 0.72;
    state.player.steerPenaltyScale = 0.06;
  }

  updatePhysics(state.player, delta);
  renderBoostMeter();

  for (let gateIndex = 0; gateIndex < state.track.gates.length; gateIndex += 1) {
    const gate = state.track.gates[gateIndex];

    if (!crossesGate(state.player.previousPosition, state.player.position, gate)) {
      continue;
    }

    const previousLapCount = state.lapState.completedLaps;
    const lapDuration = now - state.lapStartedAt;
    state.lapState = advanceLapState(
      state.lapState,
      gateIndex,
      lapDuration,
      state.track.gates.length,
    );

    if (state.lapState.completedLaps !== previousLapCount) {
      if (state.storedBestLapMs == null || lapDuration < state.storedBestLapMs) {
        state.storedBestLapMs = lapDuration;
        writeStoredBestLap(state.settings.trackKey, lapDuration);
      }

      state.lapStartedAt = now;

      if (state.lapState.finished) {
        finishRace(now);
      }
    }

    break;
  }
}

function updateRivals(delta) {
  const tuning = getTrackDetail(state.settings.trackKey);

  for (let index = 0; index < state.rivals.length; index += 1) {
    const rival = state.rivals[index];
    const targetSample = getPointAtProgress(state.track, rival.progress + 0.028);
    const futureSample = getPointAtProgress(state.track, rival.progress + 0.07);
    const target = {
      x: targetSample.position.x + targetSample.normal.x * rival.laneOffset,
      y: targetSample.position.y + targetSample.normal.y * rival.laneOffset,
    };
    const curveDemand = Math.abs(
      shortestAngleDelta(
        angleBetween(targetSample.tangent.x, targetSample.tangent.y),
        angleBetween(futureSample.tangent.x, futureSample.tangent.y),
      ),
    );
    const targetHeading = angleBetween(target.x - rival.position.x, target.y - rival.position.y);

    rival.desiredSteering = clamp(shortestAngleDelta(rival.heading, targetHeading) * 1.6, -1, 1);
    rival.targetSpeedScale = clamp(tuning.aiPace + 0.08 - curveDemand * 0.55, 0.58, 1.04);
    rival.turnFactor = 1;
    rival.recoveryFactor = 1;
    rival.steerPenaltyScale = 0.12;

    updatePhysics(rival, delta);
  }
}

function handleCollisions() {
  const cars = [state.player, ...state.rivals];

  for (let firstIndex = 0; firstIndex < cars.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < cars.length; secondIndex += 1) {
      const first = cars[firstIndex];
      const second = cars[secondIndex];
      const dx = second.position.x - first.position.x;
      const dy = second.position.y - first.position.y;
      const distance = Math.hypot(dx, dy) || 1;
      const minDistance = (first.size.length + second.size.length) * 0.42;

      if (distance >= minDistance) {
        continue;
      }

      const overlap = minDistance - distance;
      const nx = dx / distance;
      const ny = dy / distance;

      first.position.x -= nx * overlap * 0.5;
      first.position.y -= ny * overlap * 0.5;
      second.position.x += nx * overlap * 0.5;
      second.position.y += ny * overlap * 0.5;
      first.speed *= 0.965;
      second.speed *= 0.965;
    }
  }
}

function getRaceOrder() {
  return rankRaceEntries([
    {
      id: 'player',
      completedLaps: state.lapState.completedLaps,
      progress: state.player.progress,
    },
    ...state.rivals.map((rival) => ({
      id: rival.id,
      completedLaps: rival.completedLaps,
      progress: rival.progress,
    })),
  ]);
}

function updateRace(delta, now) {
  updatePlayer(delta, now);

  if (state.status !== 'running') {
    return;
  }

  updateRivals(delta);
  handleCollisions();
  const order = getRaceOrder();
  state.playerPosition = order.findIndex((entry) => entry.id === 'player') + 1;
  updateHud(now);
}

function midpoint(a, b) {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  };
}

function traceTrackPath() {
  const { points } = state.track;
  const firstMid = midpoint(points[0], points[1]);

  context.beginPath();
  context.moveTo(firstMid.x, firstMid.y);

  for (let index = 1; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    const nextMid = midpoint(current, next);
    context.quadraticCurveTo(current.x, current.y, nextMid.x, nextMid.y);
  }

  context.quadraticCurveTo(points[0].x, points[0].y, firstMid.x, firstMid.y);
  context.closePath();
}

function drawTrackSurface() {
  const detail = getTrackDetail(state.track.key);

  context.clearRect(0, 0, state.viewport.width, state.viewport.height);

  const fieldGradient = context.createLinearGradient(0, 0, 0, state.viewport.height);
  fieldGradient.addColorStop(0, detail.fieldTop);
  fieldGradient.addColorStop(1, detail.fieldBottom);
  context.fillStyle = fieldGradient;
  context.fillRect(0, 0, state.viewport.width, state.viewport.height);

  context.fillStyle = `${detail.accent}12`;
  for (let index = 0; index < 8; index += 1) {
    context.beginPath();
    context.arc(
      state.viewport.width * (0.14 + index * 0.11),
      state.viewport.height * (0.16 + (index % 3) * 0.17),
      state.track.halfWidth * (0.4 + (index % 4) * 0.08),
      0,
      Math.PI * 2,
    );
    context.fill();
  }

  context.save();
  context.lineCap = 'round';
  context.lineJoin = 'round';

  traceTrackPath();
  context.strokeStyle = '#dbe4ec';
  context.lineWidth = state.track.halfWidth * 2.74;
  context.stroke();

  traceTrackPath();
  context.strokeStyle = '#3a4651';
  context.lineWidth = state.track.halfWidth * 2.18;
  context.stroke();

  traceTrackPath();
  context.strokeStyle = '#f9fbfe';
  context.lineWidth = state.track.halfWidth * 2.04;
  context.stroke();

  traceTrackPath();
  context.strokeStyle = '#2f3b46';
  context.lineWidth = state.track.halfWidth * 1.9;
  context.stroke();

  traceTrackPath();
  context.setLineDash([18, 18]);
  context.strokeStyle = 'rgba(255, 255, 255, 0.22)';
  context.lineWidth = 2;
  context.stroke();
  context.setLineDash([]);

  traceTrackPath();
  context.strokeStyle = detail.accent;
  context.lineWidth = 6;
  context.stroke();

  traceTrackPath();
  context.strokeStyle = '#ffffff';
  context.lineWidth = 2;
  context.stroke();
  context.restore();

  drawFinishLine();
}

function drawFinishLine() {
  const gate = state.track.gates[0];
  const dx = gate.b.x - gate.a.x;
  const dy = gate.b.y - gate.a.y;
  const length = Math.hypot(dx, dy) || 1;
  const tangent = { x: dx / length, y: dy / length };
  const normal = { x: -tangent.y, y: tangent.x };
  const cellWidth = state.track.halfWidth * 0.18;
  const rows = 6;
  const cols = 2;

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const origin = {
        x: gate.a.x + tangent.x * (length / rows) * row + normal.x * cellWidth * (col - 0.5),
        y: gate.a.y + tangent.y * (length / rows) * row + normal.y * cellWidth * (col - 0.5),
      };

      context.fillStyle = (row + col) % 2 === 0 ? '#111827' : '#f8fbff';
      context.beginPath();
      context.moveTo(origin.x, origin.y);
      context.lineTo(origin.x + tangent.x * (length / rows), origin.y + tangent.y * (length / rows));
      context.lineTo(
        origin.x + tangent.x * (length / rows) + normal.x * cellWidth,
        origin.y + tangent.y * (length / rows) + normal.y * cellWidth,
      );
      context.lineTo(origin.x + normal.x * cellWidth, origin.y + normal.y * cellWidth);
      context.closePath();
      context.fill();
    }
  }
}

function drawCar(car, isPlayer = false) {
  context.save();
  context.translate(car.position.x, car.position.y);
  context.rotate(car.heading);
  context.shadowColor = isPlayer ? 'rgba(24, 100, 171, 0.36)' : 'rgba(17, 24, 39, 0.18)';
  context.shadowBlur = isPlayer ? 20 : 12;
  context.shadowOffsetY = 8;

  context.fillStyle = car.color;
  context.beginPath();
  context.roundRect(
    -car.size.length / 2,
    -car.size.width / 2,
    car.size.length,
    car.size.width,
    car.size.width * 0.46,
  );
  context.fill();

  context.fillStyle = car.accent;
  context.beginPath();
  context.roundRect(
    -car.size.length * 0.16,
    -car.size.width * 0.38,
    car.size.length * 0.32,
    car.size.width * 0.76,
    car.size.width * 0.3,
  );
  context.fill();

  context.fillStyle = 'rgba(255, 255, 255, 0.88)';
  context.fillRect(-car.size.length * 0.12, -car.size.width * 0.58, car.size.length * 0.24, 4);
  context.restore();
}

function drawRaceMeta(now) {
  context.save();
  context.fillStyle = 'rgba(16, 35, 58, 0.76)';
  context.font = '600 16px "Space Grotesk", "SUIT", sans-serif';
  context.fillText(`POS ${state.playerPosition} / ${state.settings.aiCount + 1}`, 26, state.viewport.height - 28);

  if (state.status === 'running') {
    context.fillStyle = 'rgba(16, 35, 58, 0.58)';
    context.font = '500 14px "Space Grotesk", "SUIT", sans-serif';
    context.fillText(`SESSION ${formatLapTime(now - state.sessionStartedAt)}`, 26, 28);
    context.fillText(state.track.label, state.viewport.width - 170, 28);
  }

  context.restore();
}

function drawScene(now) {
  if (!state.track) {
    return;
  }

  drawTrackSurface();

  for (const rival of state.rivals) {
    drawCar(rival, false);
  }

  if (state.player) {
    drawCar(state.player, true);
  }

  drawRaceMeta(now);
}

function tick(now) {
  if (!state.lastFrameAt) {
    state.lastFrameAt = now;
  }

  const delta = Math.min((now - state.lastFrameAt) / 1000, 0.032);
  state.lastFrameAt = now;

  if (state.status === 'running') {
    updateRace(delta, now);
  }

  drawScene(now);
  window.requestAnimationFrame(tick);
}

function updateWheelFromPointer(event) {
  const rect = wheelControl.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const rawAngle = Math.atan2(event.clientY - centerY, event.clientX - centerX) + Math.PI / 2;
  state.controls.wheel.angle = clamp(rawAngle, -WHEEL_MAX_ANGLE, WHEEL_MAX_ANGLE);
  state.controls.wheel.steer = normalizeWheelAngle(state.controls.wheel.angle, WHEEL_MAX_ANGLE);
  renderWheel();
}

function setPadState(button, key, active) {
  if (state.status !== 'running' && active) {
    return;
  }

  state.controls[key] = active;
  button.classList.toggle('is-active', active);
}

function attachHoldButton(button, key) {
  button.addEventListener('pointerdown', (event) => {
    button.setPointerCapture(event.pointerId);
    setPadState(button, key, true);
  });

  const release = () => setPadState(button, key, false);
  button.addEventListener('pointerup', release);
  button.addEventListener('pointercancel', release);
  button.addEventListener('pointerleave', release);
}

startButton.addEventListener('click', () => {
  state.draftSettings = cloneSettings(state.draftSettings);
  startRace();
});

restartButton.addEventListener('click', () => {
  state.draftSettings = cloneSettings(state.settings);
  startRace();
});

backToSetupButton.addEventListener('click', showSetup);
pauseButton.addEventListener('click', openPause);
resumeButton.addEventListener('click', resumeRace);
applyRestartButton.addEventListener('click', () => {
  state.draftSettings = cloneSettings(state.draftSettings);
  startRace();
});

wheelControl.addEventListener('pointerdown', (event) => {
  if (state.status !== 'running') {
    return;
  }

  state.controls.wheel.active = true;
  state.controls.wheel.pointerId = event.pointerId;
  wheelControl.setPointerCapture(event.pointerId);
  updateWheelFromPointer(event);
});

wheelControl.addEventListener('pointermove', (event) => {
  if (!state.controls.wheel.active || state.controls.wheel.pointerId !== event.pointerId) {
    return;
  }

  updateWheelFromPointer(event);
});

wheelControl.addEventListener('pointerup', (event) => {
  if (state.controls.wheel.pointerId !== event.pointerId) {
    return;
  }

  wheelControl.releasePointerCapture(event.pointerId);
  state.controls.wheel.active = false;
  state.controls.wheel.pointerId = null;
  state.controls.wheel.angle = 0;
  state.controls.wheel.steer = 0;
  renderWheel();
});

wheelControl.addEventListener('pointercancel', () => {
  state.controls.wheel.active = false;
  state.controls.wheel.pointerId = null;
  state.controls.wheel.angle = 0;
  state.controls.wheel.steer = 0;
  renderWheel();
});

attachHoldButton(brakeButton, 'brake');
attachHoldButton(boostButton, 'boost');
attachHoldButton(driftButton, 'drift');

window.addEventListener('keydown', (event) => {
  if (['ArrowLeft', 'ArrowRight', 'a', 'A', 'd', 'D', ' ', 'Shift', 'b', 'B', 'Escape'].includes(event.key)) {
    event.preventDefault();
  }

  if (event.key === 'ArrowLeft' || event.key === 'a' || event.key === 'A') {
    state.keyboard.left = true;
  }

  if (event.key === 'ArrowRight' || event.key === 'd' || event.key === 'D') {
    state.keyboard.right = true;
  }

  if (event.key === ' ') {
    state.keyboard.brake = true;
  }

  if (event.key === 'Shift') {
    state.keyboard.drift = true;
  }

  if (event.key === 'b' || event.key === 'B' || event.key === 'Enter') {
    state.keyboard.boost = true;
  }

  if (event.key === 'Escape') {
    if (state.status === 'running') {
      openPause();
    } else if (state.status === 'paused') {
      resumeRace();
    }
  }
});

window.addEventListener('keyup', (event) => {
  if (event.key === 'ArrowLeft' || event.key === 'a' || event.key === 'A') {
    state.keyboard.left = false;
  }

  if (event.key === 'ArrowRight' || event.key === 'd' || event.key === 'D') {
    state.keyboard.right = false;
  }

  if (event.key === ' ') {
    state.keyboard.brake = false;
  }

  if (event.key === 'Shift') {
    state.keyboard.drift = false;
  }

  if (event.key === 'b' || event.key === 'B' || event.key === 'Enter') {
    state.keyboard.boost = false;
  }
});

new ResizeObserver(resizeCanvas).observe(stageFrame);

buildTrackSelectors();
refreshStoredBest();
renderSettingsPanels();
renderWheel();
renderBoostMeter();
resizeCanvas();
syncHudStatic();
updateHud(performance.now());
setStatus('ready');
window.requestAnimationFrame(tick);
