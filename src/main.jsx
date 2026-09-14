import React from 'react';
import ReactDOM from 'react-dom/client';
import AppV15 from './AppV15.jsx';
import PwaInstallPrompt from './components/PwaInstallPrompt.jsx';
import './styles.css';
import './library.css';
import './pwaInstall.css';
import './studyContinuous.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppV15 />
    <PwaInstallPrompt />
  </React.StrictMode>,
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
