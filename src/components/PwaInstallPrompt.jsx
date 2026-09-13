import { useEffect, useState } from 'react';

function isStandalone() {
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

export default function PwaInstallPrompt() {
  const [installEvent, setInstallEvent] = useState(null);
  const [installed, setInstalled] = useState(() => isStandalone());

  useEffect(() => {
    function handlePrompt(event) {
      event.preventDefault();
      setInstallEvent(event);
    }
    function handleInstalled() {
      setInstalled(true);
      setInstallEvent(null);
    }

    window.addEventListener('beforeinstallprompt', handlePrompt);
    window.addEventListener('appinstalled', handleInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handlePrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  if (installed || !installEvent) return null;

  async function install() {
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice?.outcome === 'accepted') setInstalled(true);
    setInstallEvent(null);
  }

  return (
    <aside className="pwa-install-card" role="status">
      <img src="/studybook-icon.svg" alt="" />
      <div>
        <strong>Installa StudyBook AI</strong>
        <span>Aprila come un’app dal telefono.</span>
      </div>
      <button type="button" onClick={install}>Installa</button>
      <button type="button" className="pwa-install-close" onClick={() => setInstallEvent(null)} aria-label="Chiudi">×</button>
    </aside>
  );
}
