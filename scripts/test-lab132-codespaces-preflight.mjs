#!/usr/bin/env node
// LAB132: fail closed before Java/Gradle, signing or publication; no Worker deployment.
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const branch='trial/studybook-lab132-reformulation-library-20261114';
const root='scripts/codespaces-lab132-';
const files=['autobuild','build','publish'].map(n=>root+n+'.sh');
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
const pkg=JSON.parse(readFileSync('package.json','utf8'));
const tasks=JSON.parse(readFileSync('.vscode/tasks.json','utf8'));
assert.ok(pkg.scripts['test:lab130']?.includes('test-lab130-study-on-demand'));
assert.ok(pkg.scripts['test:lab131']?.includes('test-lab131-ui-layout'));
assert.ok(pkg.scripts['test:lab132']?.includes('test-lab132-reformulation'));
assert.ok(build.includes('X-StudyBook-Recovery-Contract:[[:space:]]*lab127'));
assert.ok(build.includes('X-StudyBook-Phase-Contract:[[:space:]]*lab126'));
assert.ok(build.includes('test-lab127-nonblocking-recovery')&&
 build.includes('test-lab127-worker-contract')&&
 build.includes('test-lab128-503-recovery')&&
 build.includes('test-lab129-mobile-reader')&&
 build.includes('test-lab130-study-on-demand')&&
 build.includes('test-lab132-codespaces-preflight')&&
 build.includes('test-lab131-ui-layout'));

assert.ok(build.includes('scudo360-gate.mjs')&&build.includes('prepare-android.mjs'));
assert.ok(build.includes('STUDYBOOK_ORIGINAL_KEYSTORE'));
assert.ok(build.includes('2026113201')&&publish.includes('2026113201'));
assert.ok(build.includes('it.studybook.ai.lab.trial111')&&
 publish.includes('it.studybook.ai.lab.trial111'));
assert.ok(build.includes('D7BB9315C9C4351872495478610C484725086E2BABBC04BEC65EC823455FBDCC'));
assert.ok(publish.includes('D7BB9315C9C4351872495478610C484725086E2BABBC04BEC65EC823455FBDCC'));
assert.ok(build.includes('X-StudyBook-Tools-Contract:[[:space:]]*lab130')); // preserved LAB130 service endpoint
assert.equal(pkg.dependencies['@capacitor-community/file-opener'],'8.0.1');
assert.ok(build.includes('FileOpener')||build.includes('file-opener@8.0.1'));
assert.ok(autobuild.includes('flock -n 9'),'Build lock must prevent duplicates');
assert.ok(!autobuild.includes('gh workflow run'),'No GitHub Actions request permitted');
assert.ok(Array.isArray(tasks.tasks)&&tasks.tasks.length===2);
assert.equal(tasks.tasks[0].runOptions.runOn,'folderOpen');
assert.ok(tasks.tasks[0].args[1]?.includes(branch));
assert.equal(tasks.tasks[1].args.length,1,
 'LAB132 manual build must not require deploy arguments.');
console.log('LAB132 PASS: Codespaces syntax, source family, Worker contract,');
console.log('original Android signing, no new Worker deploy or paid runner, Scudo360 and tasks.');
