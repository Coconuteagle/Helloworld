import test from 'node:test';
import assert from 'node:assert/strict';

import {
  advanceLapState,
  createTrack,
  crossesGate,
  createInitialLapState,
  formatLapTime,
  getPointAtProgress,
  getTrackSample,
  normalizeSteeringInput,
  rankRaceEntries,
  wrapProgress,
} from '../game-core.js';

test('crossesGate detects a movement segment passing through a checkpoint gate', () => {
  const gate = {
    a: { x: 120, y: 40 },
    b: { x: 120, y: 160 },
  };

  assert.equal(
    crossesGate({ x: 20, y: 100 }, { x: 220, y: 100 }, gate),
    true,
  );
  assert.equal(
    crossesGate({ x: 20, y: 20 }, { x: 80, y: 20 }, gate),
    false,
  );
});

test('advanceLapState ignores out-of-order checkpoints and only completes a lap after all gates', () => {
  const initial = {
    lap: 1,
    totalLaps: 3,
    nextGate: 1,
    completedLaps: 0,
    bestLapMs: null,
    lastLapMs: null,
    finished: false,
  };

  const wrongGate = advanceLapState(initial, 2, 45210, 4);
  assert.equal(wrongGate.nextGate, 1);
  assert.equal(wrongGate.completedLaps, 0);

  const gateOne = advanceLapState(initial, 1, 45210, 4);
  const gateTwo = advanceLapState(gateOne, 2, 45210, 4);
  const gateThree = advanceLapState(gateTwo, 3, 45210, 4);
  const lapDone = advanceLapState(gateThree, 0, 45210, 4);

  assert.equal(lapDone.completedLaps, 1);
  assert.equal(lapDone.lap, 2);
  assert.equal(lapDone.nextGate, 1);
  assert.equal(lapDone.bestLapMs, 45210);
  assert.equal(lapDone.lastLapMs, 45210);
});

test('getTrackSample reports when a point is outside the drivable track surface', () => {
  const track = createTrack(1000, 700);
  const centerSample = getTrackSample(track, track.points[0]);
  const grassSample = getTrackSample(track, { x: 30, y: 30 });

  assert.equal(centerSample.onTrack, true);
  assert.equal(grassSample.onTrack, false);
  assert.ok(grassSample.distance > track.halfWidth);
});

test('normalizeSteeringInput clamps swipe distance to a stable range', () => {
  assert.equal(normalizeSteeringInput(0, 360), 0);
  assert.equal(normalizeSteeringInput(18, 360) > 0, true);
  assert.equal(normalizeSteeringInput(-300, 360), -1);
  assert.equal(normalizeSteeringInput(300, 360), 1);
});

test('rankRaceEntries sorts racers by lap count and track progress', () => {
  const ranked = rankRaceEntries([
    { id: 'player', completedLaps: 1, progress: 0.52 },
    { id: 'ai-1', completedLaps: 2, progress: 0.12 },
    { id: 'ai-2', completedLaps: 1, progress: 0.83 },
  ]);

  assert.deepEqual(
    ranked.map((entry) => entry.id),
    ['ai-1', 'ai-2', 'player'],
  );
});

test('formatLapTime renders a readable motorsport style timer', () => {
  assert.equal(formatLapTime(null), '--:--.--');
  assert.equal(formatLapTime(45210), '45.21');
  assert.equal(formatLapTime(123456), '2:03.45');
});

test('createInitialLapState starts on lap one and expects the first checkpoint', () => {
  assert.deepEqual(createInitialLapState(3), {
    lap: 1,
    totalLaps: 3,
    nextGate: 1,
    completedLaps: 0,
    bestLapMs: null,
    lastLapMs: null,
    finished: false,
  });
});

test('getPointAtProgress returns a stable point along the loop and wraps over one full lap', () => {
  const track = createTrack(1000, 700);
  const start = getPointAtProgress(track, 0);
  const wrapped = getPointAtProgress(track, 1);
  const quarter = getPointAtProgress(track, 0.25);

  assert.ok(Math.abs(start.position.x - wrapped.position.x) < 0.0001);
  assert.ok(Math.abs(start.position.y - wrapped.position.y) < 0.0001);
  assert.ok(Math.abs(quarter.tangent.x) + Math.abs(quarter.tangent.y) > 0.5);
});

test('wrapProgress keeps loop progress inside the 0 to 1 range', () => {
  assert.equal(wrapProgress(1.25), 0.25);
  assert.equal(wrapProgress(-0.2), 0.8);
});
