export function shouldRunPostHogPilotProbe(env, search) {
  if (env?.VITE_MOTORLAB_POSTHOG_TEST !== '1') return false;
  const params = new URLSearchParams(search || '');
  return params.get('motorlab_posthog_probe') === '1';
}

export function schedulePostHogPilotProbe(env, search, schedule = setTimeout) {
  if (!shouldRunPostHogPilotProbe(env, search)) return false;

  schedule(() => {
    Promise.reject(new Error('MOTORLAB_POSTHOG_PILOT_TEST'));
  }, 0);

  return true;
}
