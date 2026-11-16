#!/usr/bin/env node
// LAB132: fail closed before Java/Gradle, signing or publication; no Worker deployment.
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const branch='trial/studybook-lab132-reformulation-library-20261114';
const root='scripts/codespaces-lab132-';
const files=['autobuild','build','publish','riformula-worker'].map(n=>root+n+'.sh');
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
assert.ok(build.includes('X-StudyBook-Model-Compare-Contract:[[:space:]]*lab133-free-models-v1'));
assert.ok(build.includes('X-StudyBook-Fixed-Model-Contract:[[:space:]]*lab134-fixed-gemini-3.1-flash-lite-v1'));
assert.ok(build.includes('X-StudyBook-One-Pass-Contract:[[:space:]]*lab135-explain-first-v1'));
assert.ok(build.includes('test-lab135-speed')&&build.includes('test-lab135-worker'));
assert.ok(build.includes('test-lab134-fixed-model'));
assert.ok(pkg.scripts['test:lab132'].includes('test-lab133-free-models'));
assert.ok(pkg.scripts['test:lab132'].includes('test-lab134-fixed-model'));
assert.ok(pkg.scripts['test:lab132'].includes('test-lab135-speed'));
assert.ok(pkg.scripts['test:lab132'].includes('test-lab135-worker'));
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
assert.ok(build.includes('2026113207')&&publish.includes('2026113207'));
assert.ok(build.includes('it.studybook.ai.lab.trial111')&&
 publish.includes('it.studybook.ai.lab.trial111'));
assert.ok(build.includes('D7BB9315C9C4351872495478610C484725086E2BABBC04BEC65EC823455FBDCC'));
assert.ok(publish.includes('D7BB9315C9C4351872495478610C484725086E2BABBC04BEC65EC823455FBDCC'));
assert.ok(build.includes('X-StudyBook-Riformula-Contract:[[:space:]]*lab132-manual-riformula-v2'));
assert.ok(build.includes('X-StudyBook-Tools-Contract:[[:space:]]*lab130')); // preserved LAB130 service endpoint
assert.equal(pkg.dependencies['@capacitor-community/file-opener'],'8.0.1');
assert.ok(build.includes('FileOpener')||build.includes('file-opener@8.0.1'));
assert.ok(autobuild.includes('codespaces-lab132-riformula-worker.sh'));
assert.ok(autobuild.includes('flock -n 9'),'Build lock must prevent duplicates');
assert.ok(!autobuild.includes('gh workflow run'),'No GitHub Actions request permitted');
// The historical LAB132 build scripts and security gates remain immutable.
// The VS Code DEFAULT task, however, belongs to the CURRENT trial branch.
// Before LAB141 it was LAB132 / folderOpen; LAB141 deliberately removed
// that dangerous startup action after it launched on the wrong branch.
assert.ok(Array.isArray(tasks.tasks)&&tasks.tasks.length===2);
const defaultBuild=tasks.tasks.filter(t=>t.group?.kind==='build'&&
 t.group?.isDefault===true);
assert.equal(defaultBuild.length,1,'Exactly one default Codespaces build task');
const active=defaultBuild[0];
if(active.label.startsWith('LAB132')){
 assert.equal(active.runOptions.runOn,'folderOpen',
  'Historical LAB132 auto-start contract changed');
 assert.ok(active.args[1]?.includes(branch));
 const manual=tasks.tasks.find(t=>t!==active);
 assert.equal(manual?.args?.length,1,
  'LAB132 manual build must not require deploy arguments.');
}else{
 // No automatic work on opening a remote Codespace. A manual build must
 // select the explicitly pinned LAB141 script with a SINGLE safe argument.
 assert.equal(active.label,'LAB141 — Compilazione APK+ZIP (Codespaces, manuale)');
 assert.equal(active.type,'process');
 assert.equal(active.command,'bash');
 assert.deepEqual(active.args,['scripts/codespaces-lab141-autobuild.sh']);
 assert.equal(active.options?.cwd,'${workspaceFolder}');
 assert.equal(active.runOptions?.instanceLimit,1);
 assert.equal(active.runOptions?.instancePolicy,'silent');
 assert.ok(tasks.tasks.every(t=>t.runOptions?.runOn!=='folderOpen'),
  'LAB141 must never auto-compile on Codespace folder open');
 const regression=tasks.tasks.find(t=>t!==active);
 assert.equal(regression?.label,
  'LAB141 — Test del completamento 41/44 (nessun deploy)');
 assert.equal(regression?.command,'npm');
 assert.deepEqual(regression?.args,['run','test:lab141']);
 assert.ok(regression.group==='test');
 assert.ok(existsSync('scripts/codespaces-lab141-autobuild.sh'));
 const live=readFileSync('scripts/codespaces-lab141-autobuild.sh','utf8');
 assert.ok(live.includes('trial/studybook-lab141-final-tail-50pct-20261116'));
 assert.ok(live.includes('flock -n 9'),'LAB141 build must retain its lock');
 assert.ok(!live.includes('gh workflow run'),'No GitHub Actions');
}
console.log('LAB132 PASS: historical signing and Worker preflight intact;');
console.log('current Codespaces build task checked against safe manual-only policy.');
