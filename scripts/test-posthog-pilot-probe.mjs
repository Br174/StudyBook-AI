import assert from 'node:assert/strict';
import {
  schedulePostHogPilotProbe,
  shouldRunPostHogPilotProbe,
} from '../src/lib/posthogPilotProbe.js';

const enabledEnv = { VITE_MOTORLAB_POSTHOG_TEST: '1' };
const probeQuery = '?motorlab_posthog_probe=1';

assert.equal(shouldRunPostHogPilotProbe({}, ''), false, 'no gates means disabled');
assert.equal(shouldRunPostHogPilotProbe(enabledEnv, ''), false, 'flag alone is insufficient');
assert.equal(shouldRunPostHogPilotProbe({}, probeQuery), false, 'query alone is insufficient');
assert.equal(
  shouldRunPostHogPilotProbe(enabledEnv, probeQuery),
  true,
  'both gates enable the pilot probe',
);

let scheduledCount = 0;
let scheduledCallback = null;
const scheduler = (callback) => {
  scheduledCount += 1;
  scheduledCallback = callback;
};

assert.equal(schedulePostHogPilotProbe({}, probeQuery, scheduler), false);
assert.equal(schedulePostHogPilotProbe(enabledEnv, '', scheduler), false);
assert.equal(scheduledCount, 0, 'partial gates never schedule a probe');

assert.equal(schedulePostHogPilotProbe(enabledEnv, probeQuery, scheduler), true);
assert.equal(scheduledCount, 1, 'fully gated probe schedules exactly once');
assert.equal(typeof scheduledCallback, 'function');

const rejection = new Promise((resolve) => {
  process.once('unhandledRejection', resolve);
});
scheduledCallback();
const error = await rejection;
assert.equal(error instanceof Error, true);
assert.equal(error.message, 'MOTORLAB_POSTHOG_PILOT_TEST');
assert.equal(error.message.includes('StudyBook'), false);

console.log('PostHog pilot probe contract: PASS');
