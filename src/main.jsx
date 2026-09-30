import React from 'react';
import ReactDOM from 'react-dom/client';
import { PostHogProvider } from '@posthog/react';
import AppV15 from './AppV15.jsx';
import PwaInstallPrompt from './components/PwaInstallPrompt.jsx';
import { getPostHogConfig } from './lib/posthogConfig.js';
import { schedulePostHogPilotProbe } from './lib/posthogPilotProbe.js';
import './styles.css';
import './library.css';
import './pwaInstall.css';
import './studyContinuous.css';

const appTree = (
  <React.StrictMode>
    <AppV15 />
    <PwaInstallPrompt />
  </React.StrictMode>
);

const postHogConfig = getPostHogConfig(import.meta.env);

ReactDOM.createRoot(document.getElementById('root')).render(
  postHogConfig ? (
    <PostHogProvider apiKey={postHogConfig.apiKey} options={postHogConfig.options}>
      {appTree}
    </PostHogProvider>
  ) : appTree,
);

schedulePostHogPilotProbe(import.meta.env, window.location.search);

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
