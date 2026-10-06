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
assert.equal(pkg.dependencies['@capacitor/file-viewer'], '2.0.4');
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
assert.ok(workflow.includes('StudyBook-AI-LAB-02-AGGIORNAMENTO'));
assert.ok(workflow.includes('StudyBook-AI-LAB-02-RIPRISTINO'));
assert.ok(workflow.includes('lab/studybook-core-android-01-update-02'));
assert.ok(workflow.includes('lab/recovery-studybook-core-android-02'));
assert.ok(workflow.includes('it.studybook.ai.lab.recovery02'));
assert.ok(workflow.includes('StudyBook-LAB01-signing-recovery'));
assert.ok(workflow.includes('D7:BB:93:15:C9:C4:35:18:72:49:54:78:61:0C:48:47:25:08:6E:2B:AB:BC:04:BE:C6:5E:C8:23:45:5F:BD:CC'));

console.log(JSON.stringify({
  ok: true,
  appId: config.appId,
  capacitor: pkg.dependencies['@capacitor/core'],
  nativeApi: 'https://studybook-ai.brunoverlezza.workers.dev',
}, null, 2));
