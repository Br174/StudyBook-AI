import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';

const patchUrl = new URL('./cancel-feature.patch.b64', import.meta.url);
const encoded = readFileSync(patchUrl, 'utf8').trim();
const patch = gunzipSync(Buffer.from(encoded, 'base64')).toString('utf8');

function check(args = []) {
  execFileSync('git', ['apply', ...args, '--check', '-'], {
    input: patch,
    stdio: ['pipe', 'ignore', 'ignore'],
  });
}

function apply() {
  execFileSync('git', ['apply', '-'], {
    input: patch,
    stdio: ['pipe', 'inherit', 'inherit'],
  });
}

try {
  check();
  apply();
  console.log('StudyBook AI: safe cancel/delete patch applied.');
} catch {
  try {
    check(['--reverse']);
    console.log('StudyBook AI: safe cancel/delete patch already applied.');
  } catch {
    console.error('StudyBook AI: cannot apply safe cancel/delete patch cleanly.');
    process.exit(1);
  }
}
