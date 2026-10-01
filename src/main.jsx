import React from 'react';
import ReactDOM from 'react-dom/client';
import { PostHogProvider } from '@posthog/react';
import AppV15 from './AppV15.jsx';
import PwaInstallPrompt from './components/PwaInstallPrompt.jsx';
import { getPostHogConfig } from './lib/posthogConfig.js';
import { schedulePostHogPilotProbe, shouldRunPostHogPilotProbe } from './lib/posthogPilotProbe.js';
import './styles.css';
import './library.css';
import './pwaInstall.css';
import './studyContinuous.css';

const postHogConfig = getPostHogConfig(import.meta.env);
const appContent = (
  <React.StrictMode>
    <AppV15 />
    <PwaInstallPrompt />
    {postHogConfig && shouldRunPostHogPilotProbe(import.meta.env, window.location.search) && (
      <button
        type="button"
        onClick={(event) => {
          event.currentTarget.disabled = true;
          schedulePostHogPilotProbe(import.meta.env, window.location.search);
        }}
      >
        Verifica PostHog
      </button>
    )}
  </React.StrictMode>
);

const rootContent = postHogConfig ? (
  <PostHogProvider apiKey={postHogConfig.apiKey} options={postHogConfig.options}>
    {appContent}
  </PostHogProvider>
) : appContent;

ReactDOM.createRoot(document.getElementById('root')).render(rootContent);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' });
      await registration.update();
    } catch {
      // La PWA continua a funzionare anche se il controllo aggiornamenti non riesce.
    }
  });
}
