import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [home, shell, app, previous] = await Promise.all([
  'src/components/HomeDashboardV16.jsx',
  'src/appShellV16.css',
  'src/AppV15.jsx',
  'scripts/test-lab16-home-approved.mjs',
].map(name => readFile(name,'utf8')));

// LAB17: only scan mode hides the icon thumbnails from Recenti.
assert.ok(home.includes('const scannerActive = Boolean(scanContent)'), 'scanner mode detected from active scanner panel');
assert.ok(home.includes("sb-home-scanning"), 'dedicated scrolling class');
assert.ok(home.includes("{!scannerActive && <section className=\"sb-home-recent\""), 'recent thumbnails never overlay scanner content');
assert.ok(home.includes('onScanner') && home.includes('onImport'), 'regular Home buttons preserved');
assert.ok(home.includes('sb-home-source-actions') && home.includes('sb-home-library-actions'), 'approved layout remains');
assert.ok(home.includes('sb-home-recent-track') && home.includes('scrollBy({left:220'), 'horizontal Recenti remain enabled outside scanning');
assert.ok(!home.includes('Nuovo libro'), 'obsolete Home section not reintroduced');

// Scanner action row remains mounted, never hidden or under a fixed toolbar.
assert.ok(app.includes('const scannerPanel = scanPages.length > 0'), 'scan content remains visible when active');
assert.ok(app.includes('className="scan-basket-actions"'), 'scan action row retained');
for(const label of ['Svuota','Aggiungi pagina','Fine scansione · Crea libro']) assert.ok(app.includes(label),label+' still accessible');
assert.ok(app.includes('<BottomNav'), 'fixed app navigation preserved');
assert.ok(shell.includes('.sb-home-v16.sb-home-scanning {') && shell.includes('height: auto;') && shell.includes('overflow: visible;'), 'scanning uses continuous document scroll');
assert.ok(shell.includes('padding-bottom: calc(126px + env(safe-area-inset-bottom, 0px))'), 'bottom reserve for fixed navigation and Android safe area');
assert.ok(shell.includes('.sb-home-v16.sb-home-scanning .scan-basket-actions button'), 'tap-safe full-width scan controls');
assert.ok(shell.includes('.sb-app-frame:has(.sb-home-scanning)'), 'extra mobile viewport safe bottom');
assert.ok(shell.includes('.sb-bottom-nav { position:fixed'), 'Home/Libreria/Studio structure untouched');
assert.ok(previous.includes('LAB16 approved Home'), 'previous visual contract maintained');

console.log('LAB17: scan icons removed, visible scrollable actions, safe mobile bottom, LAB16 normal home protected: PASS');
