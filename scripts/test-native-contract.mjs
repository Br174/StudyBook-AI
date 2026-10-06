import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const pkg = JSON.parse(await readFile('package.json', 'utf8'));
const config = JSON.parse(await readFile('capacitor.config.json', 'utf8'));
const apiEndpoint = await readFile('src/lib/apiEndpoint.js', 'utf8');
const main = await readFile('src/main.jsx', 'utf8');
const worker = await readFile('worker/index.js', 'utf8');
const prep = await readFile('scripts/prepare-android.mjs', 'utf8');
const workflow = await readFile('.github/workflows/android-apk.yml', 'utf8');

assert.equal(pkg.dependencies['@capacitor/core'], '8.5.2');
assert.equal(pkg.dependencies['@capacitor/android'], '8.5.2');
assert.equal(pkg.devDependencies['@capacitor/cli'], '8.5.2');
assert.equal(config.appId, 'it.studybook.ai.lab');
assert.equal(config.webDir, 'dist');
assert.equal(config.server?.androidScheme, 'https');
assert.equal(config.plugins?.CapacitorHttp?.enabled, true);
assert.ok(apiEndpoint.includes('https://studybook-ai.brunoverlezza.workers.dev'));
assert.ok(main.includes("Capacitor.isNativePlatform()"));
assert.ok(main.includes("!nativeApp && 'serviceWorker' in navigator"));
assert.ok(worker.includes("'https://localhost'"));
assert.ok(prep.includes('android.permission.CAMERA'));
assert.ok(workflow.includes('assembleDebug'));
assert.ok(workflow.includes('StudyBook-AI-LAB-01.apk'));

console.log(JSON.stringify({
  ok: true,
  appId: config.appId,
  capacitor: pkg.dependencies['@capacitor/core'],
  nativeApi: 'https://studybook-ai.brunoverlezza.workers.dev',
}, null, 2));
