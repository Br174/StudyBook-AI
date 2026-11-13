#!/usr/bin/env node
// LAB129: fail closed before Java/Gradle, signing or publication; no Worker deployment.
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const branch='trial/studybook-lab129-mobile-reader-tools-layout-20261113';
const root='scripts/codespaces-lab129-';
const files=['autobuild','build','publish','backend-and-build'].map(n=>root+n+'.sh');
for(const path of files){
 assert.ok(existsSync(path),'Missing Codespaces script: '+path);
 const test=spawnSync('bash',['-n',path],{encoding:'utf8',timeout:10_000});
 assert.equal(test.status,0,'Shell syntax invalid in '+path+': '+String(test.stderr||''));
 const text=readFileSync(path,'utf8');
 assert.ok(text.includes(branch),'Wrong branch in '+path);
 assert.ok(!text.includes('trial/studybook-lab126-deep-content-recovery-20261113'),
  'Old LAB126 branch still referenced by '+path);
}
const build=readFileSync(root+'build.sh','utf8');
const publish=readFileSync(root+'publish.sh','utf8');
const autobuild=readFileSync(root+'autobuild.sh','utf8');
const backend=readFileSync(root+'backend-and-build.sh','utf8');
const pkg=JSON.parse(readFileSync('package.json','utf8'));
const tasks=JSON.parse(readFileSync('.vscode/tasks.json','utf8'));
assert.ok(pkg.scripts['test:lab129']?.includes('test-lab129-mobile-reader'));
assert.ok(build.includes('X-StudyBook-Recovery-Contract:[[:space:]]*lab127'));
assert.ok(backend.includes('X-StudyBook-Recovery-Contract:[[:space:]]*lab127'));
assert.ok(build.includes('X-StudyBook-Phase-Contract:[[:space:]]*lab126'));
assert.ok(build.includes('test-lab127-nonblocking-recovery')&&
 build.includes('test-lab127-worker-contract')&&
 build.includes('test-lab128-503-recovery')&&
 build.includes('test-lab129-mobile-reader'));
assert.ok(build.includes('scudo360-gate.mjs')&&build.includes('prepare-android.mjs'));
assert.ok(build.includes('STUDYBOOK_ORIGINAL_KEYSTORE'));
assert.ok(build.includes('2026112901')&&publish.includes('2026112901'));
assert.ok(build.includes('it.studybook.ai.lab.trial111')&&
 publish.includes('it.studybook.ai.lab.trial111'));
assert.ok(build.includes('D7BB9315C9C4351872495478610C484725086E2BABBC04BEC65EC823455FBDCC'));
assert.ok(publish.includes('D7BB9315C9C4351872495478610C484725086E2BABBC04BEC65EC823455FBDCC'));
assert.ok(backend.includes("api/explained/v126"));
assert.ok(!backend.includes('wrangler deploy'),
 'The LAB129 client-only update must never deploy Cloudflare.');
assert.ok(autobuild.includes('flock -n 9'),'Build lock must prevent duplicates');
assert.ok(!autobuild.includes('gh workflow run'),'No GitHub Actions request permitted');
assert.ok(Array.isArray(tasks.tasks)&&tasks.tasks.length===2);
assert.equal(tasks.tasks[0].runOptions.runOn,'folderOpen');
assert.ok(tasks.tasks[0].args[1]?.includes(branch));
assert.equal(tasks.tasks[1].args.length,1,
 'LAB129 worker verification must not require a deploy argument.');
console.log('LAB129 PASS: Codespaces script syntax, branch, Worker contract,');
console.log('same signing identity, no paid runner or Cloudflare deploy, Scudo360 and tasks.');
