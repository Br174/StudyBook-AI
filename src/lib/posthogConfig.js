export function getPostHogConfig(env) {
  const apiKey = typeof env?.VITE_POSTHOG_PROJECT_TOKEN === 'string'
    ? env.VITE_POSTHOG_PROJECT_TOKEN.trim()
    : '';
  const apiHost = typeof env?.VITE_POSTHOG_HOST === 'string'
    ? env.VITE_POSTHOG_HOST.trim()
    : '';

  if (!apiKey || !apiHost) return null;

  return {
    apiKey,
    options: {
      api_host: apiHost,
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
  };
}
