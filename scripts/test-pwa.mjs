import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const manifest = JSON.parse(await readFile(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8'));
const sw = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');
const main = await readFile(new URL('../src/main.jsx', import.meta.url), 'utf8');
const index = await readFile(new URL('../index.html', import.meta.url), 'utf8');

assert.equal(manifest.display, 'standalone');
assert.equal(manifest.start_url, '/');
assert.ok(Array.isArray(manifest.icons) && manifest.icons.length >= 1);
assert.ok(manifest.icons.some((icon) => icon.src === '/studybook-icon.svg'));
assert.match(sw, /pathname\.startsWith\('\/api\/'\)/);
assert.match(sw, /studybook-shell-v4/);
assert.match(sw, /studybook-runtime-v4/);
assert.match(sw, /\['script', 'style'\]\.includes\(request\.destination\)/);
assert.match(sw, /cache: 'no-store'/);
assert.match(main, /serviceWorker\.register\('\/sw\.js', \{ updateViaCache: 'none' \}\)/);
assert.match(main, /registration\.update\(\)/);
assert.match(main, /PwaInstallPrompt/);
assert.match(index, /manifest\.webmanifest/);

console.log('PWA shell: OK');
