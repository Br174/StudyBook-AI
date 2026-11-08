// MotorLab Scudo360 native P1 adapter for the LAB73 complete-page
// first-draft, 674-unit and no-progress recovery contract.
import {spawnSync} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
const file='scripts/test-lab73-network-recovery.mjs';
const r=spawnSync(process.execPath,[file],{
 encoding:'utf8',timeout:90000,maxBuffer:2500000});
const safe=r.status===0&&!r.error&&
 (r.stdout||'').includes('LAB73_NETWORK_RECOVERY_PASS')&&
 (r.stdout||'').includes('LAB73_FAIL_CLOSED_PASS');
const dir='.motorlab/scudo360-test-results';
mkdirSync(dir,{recursive:true});
const error=String((r.stderr||r.stdout||'').slice(-1800))
 .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
 .replaceAll('"','&quot;');
const xml='<?xml version="1.0" encoding="UTF-8"?>\n'+
 '<testsuite name="studybook.StudyBookLab73Network" tests="2" failures="'+
 (safe?0:1)+'" errors="0" skipped="0">'+
 '<testcase classname="studybook.StudyBookLab73Network" name="Recover674UnitsAfterFirstNetworkError">'+
 (safe?'':'<failure message="LAB73 network or source preservation failed">'+error+'</failure>')+
 '</testcase><testcase classname="studybook.StudyBookLab73Network" name="BoundedPersistentOutage"/>'+
 '</testsuite>\n';
writeFileSync(dir+'/TEST-studybook.StudyBookLab73Network.xml',xml);
console.log('SCUDO_LAB73_NATIVE',JSON.stringify({tests:2,failures:safe?0:1,sourceSafe:safe}));
if(!safe)process.exitCode=1;
