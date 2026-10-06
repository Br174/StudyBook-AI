import { readFile, writeFile } from 'node:fs/promises';

const manifestPath = 'android/app/src/main/AndroidManifest.xml';
const gradlePath = 'android/app/build.gradle';
const versionCode = Math.max(1, Number(process.env.STUDYBOOK_VERSION_CODE || process.env.GITHUB_RUN_NUMBER || 1));
const versionName = String(process.env.STUDYBOOK_VERSION_NAME || `0.1.${versionCode}`);

let manifest = await readFile(manifestPath, 'utf8');
if (!manifest.includes('android.permission.CAMERA')) {
  manifest = manifest.replace(
    /<manifest([^>]*)>/,
    '<manifest$1>\n    <uses-permission android:name="android.permission.CAMERA" />',
  );
}
await writeFile(manifestPath, manifest);

let gradle = await readFile(gradlePath, 'utf8');
gradle = gradle
  .replace(/versionCode\s+\d+/, `versionCode ${versionCode}`)
  .replace(/versionName\s+"[^"]+"/, `versionName "${versionName}"`);
await writeFile(gradlePath, gradle);

console.log(JSON.stringify({
  ok: true,
  appId: 'it.studybook.ai.lab',
  versionCode,
  versionName,
  cameraPermission: true,
}, null, 2));
