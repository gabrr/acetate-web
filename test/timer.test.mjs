import test from 'node:test';
import assert from 'node:assert/strict';
import { trackStep, formatStepTime, formatDuration } from '../public/timer.js';

test('step duration advances while running and freezes after completion', () => {
  const running = trackStep(undefined, { id: 'convert', state: 'running' }, 1000);
  assert.equal(formatStepTime(running, 3500), '2.5 seconds');
  const completed = trackStep(running, { id: 'convert', state: 'completed' }, 4000);
  assert.equal(formatStepTime(completed, 9000), '3 seconds');
});

test('durations normalize into hours, minutes and seconds', () => {
  assert.equal(formatDuration(87000), '1 minute and 27 seconds');
  assert.equal(formatDuration(80000), '1 minute and 20 seconds');
  assert.equal(formatDuration(60000), '1 minute');
  assert.equal(formatDuration(3601000), '1 hour and 1 second');
  assert.equal(formatDuration(0), '0 seconds');
  assert.equal(formatDuration(-1000), '0 seconds');
});
