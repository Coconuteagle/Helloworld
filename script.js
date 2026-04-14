import {
  advanceLapState,
  clamp,
  createInitialLapState,
  createTrack,
  crossesGate,
  formatLapTime,
  getPointAtProgress,
  getTrackSample,
  normalizeSteeringInput,
  rankRaceEntries,
} from './game-core.js';

const TOTAL_LAPS = 3;
const RIVAL_COUNT = 3;
const STORAGE_KEY = 'apex-sprint-lap-best';

const canvas = document.querySelector('#raceCanvas');
const context = canvas.getContext('2d');
const stageFrame = document.querySelector('.track-frame');
const startOverlay = document.querySelector('#startOverlay');
const resultOverlay = document.querySelector('#resultOverlay');
const startButton = document.querySelector('#startButton');
const restartButton = document.querySelector('#restartButton');

const lapValue = document.querySelector('#lapValue');
const bestValue = document.querySelector('#bestValue');
const currentValue = document.querySelector('#currentValue');
const speedValue = document.querySelector('#speedValue');
const resultBest = document.querySelector('#resultBest');
const resultTotal = document.querySelector('#resultTotal');
const resultPosition = document.querySelector('#resultPosition');

const state = {
  status: 'ready',
  viewport: { width: 0, height: 0 },
  track: null,
  player: null,
  rivals: [],
  lapState: createInitialLapState(TOTAL_LAPS),
  lastFrameAt: 0,
  sessionStartedAt: 0,
  lapStartedAt: 0,
  storedBestLapMs: readStoredBestLap(),
  pointer: {
    active: false,
    startX: 0,
    currentX: 0,
  },
  keyboard: {
    left: false,
    right: false,
  },
  playerPosition: 1,
};

function readStoredBestLap() {
  try {
    const stored = Number(localStorage.getItem(STORAGE_KEY));
    return Number.isFinite(stored) && stored > 0 ? stored : null;
  } catch {
    return null;
  }
}

function writeStoredBestLap(value) {
  try {
    localStorage.setItem(STORAGE_KEY, String(Math.floor(value)));
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
    onTrack: true,
  };
}

function resetRaceCars() {
  const scale = Math.min(state.viewport.width, state.viewport.height);
  const lane = state.track.halfWidth * 0.34;
  const baseMaxSpeed = scale * 0.34;

  state.player = createCar({
    id: 'player',
    color: '#1864ab',
    accent: '#f8fbff',
    progress: 0.02,
    laneOffset: 0,
    maxSpeed: baseMaxSpeed,
    acceleration: scale * 0.42,
    turnRate: 2.8,
    size: { length: scale * 0.06, width: scale * 0.033 },
  });

  state.rivals = Array.from({ length: RIVAL_COUNT }, (_, index) => {
    const laneOffset = [-lane, lane, 0][index];

    return createCar({
      id: `ai-${index + 1}`,
      color: ['#1b9c62', '#d94841', '#f59f00'][index],
      accent: '#ffffff',
      progress: 0.02 - (index + 1) * 0.035,
      laneOffset,
      maxSpeed: baseMaxSpeed * (0.93 + index * 0.02),
      acceleration: scale * 0.36,
      turnRate: 2.3,
      size: { length: scale * 0.055, width: scale * 0.03 },
    });
  });
}

function rebuildTrack() {
  state.track = createTrack(state.viewport.width, state.viewport.height);

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

function startRace() {
  state.status = 'running';
  state.lastFrameAt = 0;
  state.sessionStartedAt = performance.now();
  state.lapStartedAt = state.sessionStartedAt;
  state.lapState = createInitialLapState(TOTAL_LAPS);
  state.playerPosition = 1;
  state.pointer.active = false;
  state.pointer.startX = 0;
  state.pointer.currentX = 0;
  resetRaceCars();
  startOverlay.classList.add('hidden');
  resultOverlay.classList.add('hidden');
  updateHud(state.sessionStartedAt);
}

function finishRace(now) {
  state.status = 'finished';
  const order = getRaceOrder();
  state.playerPosition = order.findIndex((entry) => entry.id === 'player') + 1;

  resultBest.textContent = formatLapTime(state.lapState.bestLapMs || state.storedBestLapMs);
  resultTotal.textContent = formatLapTime(now - state.sessionStartedAt);
  resultPosition.textContent = `${state.playerPosition} / ${RIVAL_COUNT + 1}`;
  resultOverlay.classList.remove('hidden');
}

function updateHud(now) {
  if (!state.player) {
    return;
  }

  lapValue.textContent = `${Math.min(state.lapState.lap, TOTAL_LAPS)}/${TOTAL_LAPS}`;
  bestValue.textContent = formatLapTime(state.lapState.bestLapMs || state.storedBestLapMs);
  currentValue.textContent = formatLapTime(now - state.lapStartedAt);
  speedValue.textContent = `${Math.round(state.player.speed * 0.64)} km/h`;
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

  targetSpeed *= clamp(1 - Math.abs(car.steering) * 0.14 - alignmentPenalty * 0.08, 0.55, 1);

  const acceleration = car.acceleration * (trackSample.onTrack ? 1 : 1.5);
  car.speed = approach(car.speed, targetSpeed, acceleration * delta);

  car.heading += car.steering * car.turnRate * (0.6 + car.speed / car.maxSpeed) * delta;

  if (!trackSample.onTrack) {
    car.heading -= shortestAngleDelta(trackHeading, car.heading) * delta * 1.25;
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

function getPlayerInput() {
  if (state.pointer.active) {
    return normalizeSteeringInput(
      state.pointer.currentX - state.pointer.startX,
      state.viewport.width,
    );
  }

  if (state.keyboard.left && !state.keyboard.right) return -1;
  if (state.keyboard.right && !state.keyboard.left) return 1;
  return 0;
}

function updatePlayer(delta, now) {
  state.player.desiredSteering = getPlayerInput();
  state.player.targetSpeedScale = 1;
  updatePhysics(state.player, delta);

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
        writeStoredBestLap(lapDuration);
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
    rival.targetSpeedScale = clamp(1 - curveDemand * 0.55, 0.62, 0.98 + index * 0.02);

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
  context.clearRect(0, 0, state.viewport.width, state.viewport.height);

  const fieldGradient = context.createLinearGradient(0, 0, 0, state.viewport.height);
  fieldGradient.addColorStop(0, '#e6f0fa');
  fieldGradient.addColorStop(1, '#d3e4f2');
  context.fillStyle = fieldGradient;
  context.fillRect(0, 0, state.viewport.width, state.viewport.height);

  context.fillStyle = 'rgba(24, 100, 171, 0.06)';
  for (let index = 0; index < 7; index += 1) {
    context.beginPath();
    context.arc(
      state.viewport.width * (0.15 + index * 0.12),
      state.viewport.height * (0.18 + (index % 2) * 0.18),
      state.track.halfWidth * (0.45 + (index % 3) * 0.08),
      0,
      Math.PI * 2,
    );
    context.fill();
  }

  context.save();
  context.lineCap = 'round';
  context.lineJoin = 'round';

  traceTrackPath();
  context.strokeStyle = '#c9d5e1';
  context.lineWidth = state.track.halfWidth * 2.72;
  context.stroke();

  traceTrackPath();
  context.strokeStyle = '#37424d';
  context.lineWidth = state.track.halfWidth * 2.18;
  context.stroke();

  traceTrackPath();
  context.strokeStyle = '#f8fbff';
  context.lineWidth = state.track.halfWidth * 2.04;
  context.stroke();

  traceTrackPath();
  context.strokeStyle = '#313e49';
  context.lineWidth = state.track.halfWidth * 1.9;
  context.stroke();

  traceTrackPath();
  context.setLineDash([18, 18]);
  context.strokeStyle = 'rgba(255, 255, 255, 0.22)';
  context.lineWidth = 2;
  context.stroke();
  context.setLineDash([]);

  traceTrackPath();
  context.strokeStyle = '#d94841';
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
  context.fillText(`POS ${state.playerPosition} / ${RIVAL_COUNT + 1}`, 26, state.viewport.height - 24);

  if (state.pointer.active) {
    const steer = normalizeSteeringInput(
      state.pointer.currentX - state.pointer.startX,
      state.viewport.width,
    );
    context.beginPath();
    context.arc(state.pointer.startX, state.viewport.height - 70, 28, 0, Math.PI * 2);
    context.fillStyle = 'rgba(255, 255, 255, 0.26)';
    context.fill();

    context.beginPath();
    context.arc(
      state.pointer.startX + steer * 36,
      state.viewport.height - 70,
      18,
      0,
      Math.PI * 2,
    );
    context.fillStyle = 'rgba(24, 100, 171, 0.9)';
    context.fill();
  }

  if (state.status === 'running') {
    context.fillStyle = 'rgba(16, 35, 58, 0.58)';
    context.font = '500 14px "Space Grotesk", "SUIT", sans-serif';
    context.fillText(`SESSION ${formatLapTime(now - state.sessionStartedAt)}`, 26, 28);
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

function updatePointer(event) {
  state.pointer.currentX = event.clientX - stageFrame.getBoundingClientRect().left;
}

startButton.addEventListener('click', startRace);
restartButton.addEventListener('click', startRace);

canvas.addEventListener('pointerdown', (event) => {
  if (state.status !== 'running') {
    return;
  }

  state.pointer.active = true;
  state.pointer.startX = event.clientX - stageFrame.getBoundingClientRect().left;
  state.pointer.currentX = state.pointer.startX;
  canvas.setPointerCapture(event.pointerId);
});

canvas.addEventListener('pointermove', (event) => {
  if (!state.pointer.active) {
    return;
  }

  updatePointer(event);
});

canvas.addEventListener('pointerup', (event) => {
  state.pointer.active = false;
  state.pointer.currentX = state.pointer.startX;
  canvas.releasePointerCapture(event.pointerId);
});

canvas.addEventListener('pointercancel', () => {
  state.pointer.active = false;
  state.pointer.currentX = state.pointer.startX;
});

window.addEventListener('keydown', (event) => {
  if (['ArrowLeft', 'ArrowRight', 'a', 'A', 'd', 'D', ' '].includes(event.key)) {
    event.preventDefault();
  }

  if (event.key === 'ArrowLeft' || event.key === 'a' || event.key === 'A') {
    state.keyboard.left = true;
  }

  if (event.key === 'ArrowRight' || event.key === 'd' || event.key === 'D') {
    state.keyboard.right = true;
  }
});

window.addEventListener('keyup', (event) => {
  if (event.key === 'ArrowLeft' || event.key === 'a' || event.key === 'A') {
    state.keyboard.left = false;
  }

  if (event.key === 'ArrowRight' || event.key === 'd' || event.key === 'D') {
    state.keyboard.right = false;
  }
});

new ResizeObserver(resizeCanvas).observe(stageFrame);

resizeCanvas();
resetRaceCars();
updateHud(performance.now());
drawScene(performance.now());
window.requestAnimationFrame(tick);
