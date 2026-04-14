export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export const TRACK_PRESETS = [
  {
    key: 'rookie-loop',
    label: 'Rookie Loop',
    widthScale: 0.092,
    points: [
      [0.5, 0.16],
      [0.67, 0.2],
      [0.81, 0.32],
      [0.84, 0.49],
      [0.76, 0.67],
      [0.58, 0.79],
      [0.39, 0.8],
      [0.22, 0.68],
      [0.15, 0.48],
      [0.2, 0.27],
    ],
    gateIndices: [0, 2, 5, 7],
  },
  {
    key: 'velocity-ring',
    label: 'Velocity Ring',
    widthScale: 0.096,
    points: [
      [0.49, 0.12],
      [0.73, 0.16],
      [0.86, 0.28],
      [0.89, 0.48],
      [0.82, 0.68],
      [0.64, 0.82],
      [0.39, 0.84],
      [0.2, 0.74],
      [0.12, 0.53],
      [0.14, 0.3],
      [0.28, 0.16],
    ],
    gateIndices: [0, 3, 6, 8],
  },
  {
    key: 'grand-circuit',
    label: 'Grand Circuit',
    widthScale: 0.08,
    points: [
      [0.48, 0.13],
      [0.69, 0.18],
      [0.83, 0.32],
      [0.86, 0.53],
      [0.76, 0.74],
      [0.56, 0.85],
      [0.34, 0.82],
      [0.17, 0.68],
      [0.12, 0.46],
      [0.19, 0.24],
    ],
    gateIndices: [0, 2, 5, 7],
  },
  {
    key: 'marathon-bend',
    label: 'Marathon Bend',
    widthScale: 0.074,
    points: [
      [0.45, 0.1],
      [0.67, 0.13],
      [0.83, 0.21],
      [0.9, 0.39],
      [0.88, 0.6],
      [0.78, 0.78],
      [0.6, 0.88],
      [0.38, 0.87],
      [0.21, 0.77],
      [0.11, 0.58],
      [0.11, 0.35],
      [0.22, 0.17],
    ],
    gateIndices: [0, 3, 6, 9],
  },
  {
    key: 'technical-maze',
    label: 'Technical Maze',
    widthScale: 0.068,
    points: [
      [0.46, 0.11],
      [0.59, 0.13],
      [0.72, 0.18],
      [0.82, 0.27],
      [0.86, 0.39],
      [0.81, 0.5],
      [0.7, 0.56],
      [0.63, 0.64],
      [0.66, 0.76],
      [0.59, 0.86],
      [0.46, 0.84],
      [0.36, 0.76],
      [0.26, 0.8],
      [0.16, 0.72],
      [0.13, 0.6],
      [0.18, 0.49],
      [0.27, 0.42],
      [0.24, 0.31],
      [0.31, 0.2],
    ],
    gateIndices: [0, 5, 10, 15],
  },
];

function subtract(a, b) {
  return { x: a.x - b.x, y: a.y - b.y };
}

function length(vector) {
  return Math.hypot(vector.x, vector.y);
}

function normalize(vector) {
  const vectorLength = length(vector) || 1;
  return {
    x: vector.x / vectorLength,
    y: vector.y / vectorLength,
  };
}

function perpendicular(vector) {
  return { x: -vector.y, y: vector.x };
}

function pointLineDistance(point, sample) {
  return Math.hypot(point.x - sample.x, point.y - sample.y);
}

function orientation(a, b, c) {
  const value = (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);

  if (Math.abs(value) < 0.000001) {
    return 0;
  }

  return value > 0 ? 1 : 2;
}

function onSegment(a, b, c) {
  return (
    b.x <= Math.max(a.x, c.x) + 0.000001 &&
    b.x + 0.000001 >= Math.min(a.x, c.x) &&
    b.y <= Math.max(a.y, c.y) + 0.000001 &&
    b.y + 0.000001 >= Math.min(a.y, c.y)
  );
}

export function projectPointToSegment(point, start, end) {
  const segment = subtract(end, start);
  const segmentLengthSquared = segment.x ** 2 + segment.y ** 2 || 1;
  const t = clamp(
    ((point.x - start.x) * segment.x + (point.y - start.y) * segment.y) / segmentLengthSquared,
    0,
    1,
  );
  const sample = {
    x: start.x + segment.x * t,
    y: start.y + segment.y * t,
  };

  return {
    point: sample,
    t,
    distance: pointLineDistance(point, sample),
  };
}

function createGate(points, index, span) {
  const center = points[index];
  const next = points[(index + 1) % points.length];
  const tangent = normalize(subtract(next, center));
  const normal = perpendicular(tangent);

  return {
    index,
    center,
    a: {
      x: center.x - normal.x * span,
      y: center.y - normal.y * span,
    },
    b: {
      x: center.x + normal.x * span,
      y: center.y + normal.y * span,
    },
  };
}

export function createTrack(width, height, presetKey = 'grand-circuit') {
  const preset =
    TRACK_PRESETS.find((candidate) => candidate.key === presetKey) ||
    TRACK_PRESETS.find((candidate) => candidate.key === 'grand-circuit');
  const points = preset.points.map(([x, y]) => ({ x: width * x, y: height * y }));
  const halfWidth = Math.min(width, height) * preset.widthScale;
  const segmentLengths = [];
  const cumulativeLengths = [0];
  let totalLength = 0;

  for (let index = 0; index < points.length; index += 1) {
    const start = points[index];
    const end = points[(index + 1) % points.length];
    const segmentLength = length(subtract(end, start));
    segmentLengths.push(segmentLength);
    totalLength += segmentLength;
    cumulativeLengths.push(totalLength);
  }

  return {
    key: preset.key,
    label: preset.label,
    points,
    halfWidth,
    segmentLengths,
    cumulativeLengths,
    totalLength,
    gates: preset.gateIndices.map((index) => createGate(points, index, halfWidth * 1.35)),
  };
}

export function wrapProgress(progress) {
  return ((progress % 1) + 1) % 1;
}

export function getTrackSample(track, point) {
  let bestSample = null;

  for (let index = 0; index < track.points.length; index += 1) {
    const start = track.points[index];
    const end = track.points[(index + 1) % track.points.length];
    const sample = projectPointToSegment(point, start, end);

    if (!bestSample || sample.distance < bestSample.distance) {
      const tangent = normalize(subtract(end, start));
      const distanceAlongTrack =
        track.cumulativeLengths[index] + track.segmentLengths[index] * sample.t;

      bestSample = {
        ...sample,
        segmentIndex: index,
        progress: distanceAlongTrack / track.totalLength,
        tangent,
        normal: perpendicular(tangent),
      };
    }
  }

  return {
    ...bestSample,
    onTrack: bestSample.distance <= track.halfWidth,
  };
}

export function getPointAtProgress(track, progress) {
  const wrappedProgress = wrapProgress(progress);
  const targetLength = wrappedProgress * track.totalLength;
  let segmentIndex = 0;

  while (
    segmentIndex < track.segmentLengths.length - 1 &&
    track.cumulativeLengths[segmentIndex + 1] < targetLength
  ) {
    segmentIndex += 1;
  }

  const start = track.points[segmentIndex];
  const end = track.points[(segmentIndex + 1) % track.points.length];
  const segmentStart = track.cumulativeLengths[segmentIndex];
  const segmentLength = track.segmentLengths[segmentIndex] || 1;
  const t = clamp((targetLength - segmentStart) / segmentLength, 0, 1);
  const tangent = normalize(subtract(end, start));

  return {
    position: {
      x: start.x + (end.x - start.x) * t,
      y: start.y + (end.y - start.y) * t,
    },
    tangent,
    normal: perpendicular(tangent),
    segmentIndex,
  };
}

export function createInitialLapState(totalLaps) {
  return {
    lap: 1,
    totalLaps,
    nextGate: 1,
    completedLaps: 0,
    bestLapMs: null,
    lastLapMs: null,
    finished: false,
  };
}

export function crossesGate(from, to, gate) {
  const first = orientation(from, to, gate.a);
  const second = orientation(from, to, gate.b);
  const third = orientation(gate.a, gate.b, from);
  const fourth = orientation(gate.a, gate.b, to);

  if (first !== second && third !== fourth) {
    return true;
  }

  if (first === 0 && onSegment(from, gate.a, to)) return true;
  if (second === 0 && onSegment(from, gate.b, to)) return true;
  if (third === 0 && onSegment(gate.a, from, gate.b)) return true;
  if (fourth === 0 && onSegment(gate.a, to, gate.b)) return true;

  return false;
}

export function advanceLapState(state, gateIndex, lapTimeMs, totalGates) {
  if (state.finished) {
    return state;
  }

  if (gateIndex === 0) {
    if (state.nextGate !== totalGates) {
      return state;
    }

    const completedLaps = state.completedLaps + 1;
    const bestLapMs =
      state.bestLapMs == null ? lapTimeMs : Math.min(state.bestLapMs, lapTimeMs);

    return {
      ...state,
      lap: completedLaps >= state.totalLaps ? state.totalLaps : completedLaps + 1,
      nextGate: 1,
      completedLaps,
      bestLapMs,
      lastLapMs: lapTimeMs,
      finished: completedLaps >= state.totalLaps,
    };
  }

  if (gateIndex === state.nextGate) {
    return {
      ...state,
      nextGate: Math.min(totalGates, state.nextGate + 1),
    };
  }

  return state;
}

export function normalizeSteeringInput(deltaX, viewportWidth) {
  const referenceWidth = Math.max(72, viewportWidth * 0.2);
  return clamp(deltaX / referenceWidth, -1, 1);
}

export function normalizeWheelAngle(angle, maxAngle) {
  return clamp(angle / maxAngle, -1, 1);
}

export function updateBoostValue(current, deltaSeconds, config) {
  const { active, spendRate, rechargeRate, maxBoost } = config;
  const nextValue = active
    ? current - spendRate * deltaSeconds
    : current + rechargeRate * deltaSeconds;

  return clamp(nextValue, 0, maxBoost);
}

export function rankRaceEntries(entries) {
  return [...entries].sort((left, right) => {
    if (right.completedLaps !== left.completedLaps) {
      return right.completedLaps - left.completedLaps;
    }

    return right.progress - left.progress;
  });
}

export function formatLapTime(milliseconds) {
  if (milliseconds == null) {
    return '--:--.--';
  }

  const totalCentiseconds = Math.floor(milliseconds / 10);
  const minutes = Math.floor(totalCentiseconds / 6000);
  const seconds = Math.floor((totalCentiseconds % 6000) / 100);
  const centiseconds = totalCentiseconds % 100;
  const secondText = minutes > 0 ? String(seconds).padStart(2, '0') : String(seconds);

  if (minutes > 0) {
    return `${minutes}:${secondText}.${String(centiseconds).padStart(2, '0')}`;
  }

  return `${secondText}.${String(centiseconds).padStart(2, '0')}`;
}
