import assert from 'node:assert/strict';
import { getPostHogConfig } from '../src/lib/posthogConfig.js';

assert.equal(getPostHogConfig({}), null, 'missing configuration disables telemetry');
assert.equal(
  getPostHogConfig({ VITE_POSTHOG_PROJECT_TOKEN: 'phc_test' }),
  null,
  'token-only configuration disables telemetry',
);
assert.equal(
  getPostHogConfig({ VITE_POSTHOG_HOST: 'https://eu.i.posthog.com' }),
  null,
  'host-only configuration disables telemetry',
);

const config = getPostHogConfig({
  VITE_POSTHOG_PROJECT_TOKEN: 'phc_test',
  VITE_POSTHOG_HOST: 'https://eu.i.posthog.com',
});

assert.deepEqual(config, {
  apiKey: 'phc_test',
  options: {
    api_host: 'https://eu.i.posthog.com',
    defaults: '2026-05-30',
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: false,
    disable_session_recording: true,
    capture_exceptions: {
      capture_unhandled_errors: true,
      capture_unhandled_rejections: true,
      capture_console_errors: false,
    },
  },
});

console.log('PostHog config contract: PASS');
