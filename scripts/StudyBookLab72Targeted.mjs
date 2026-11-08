// Scudo360 native adapter for the EXACT existing LAB72 tests.
// No new scheduler, no external provider, no deployment or credentials.
import {spawnSync} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
const suites=[
 'scripts/test-lab72-negative-closure.mjs',
 'scripts/test-lab72-protocol.mjs',
 'scripts/test-lab72-targeted-repair.mjs',
 'scripts/test-lab71-unit-budgets.mjs',
 'scripts/test-lab69-strict-bands.mjs',
 'scripts/test-lab67-simplified-precise-rebalance.mjs',
 'scripts/test-lab66-nonblocking-quality.mjs'
];
const xmlEscape=value=>String(value).replaceAll('&','&amp;')
 .replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
let passed=0;
const cases=[];
for(const script of suites){
 const result=spawnSync(process.execPath,[script],
  {encoding:'utf8',timeout:80000,maxBuffer:2000000});
 const safe=result.status===0&&!result.error;
 if(safe)passed++;
 const label=script.split('/').at(-1);
 console.log('SCUDO_LAB72',label,safe?'PASS':'FAIL');
 if(!safe)process.stderr.write((result.stderr||result.stdout||'').slice(-1800));
 cases.push('<testcase classname="studybook.StudyBookLab72Targeted" name="'+
  xmlEscape(label)+'">'+(safe?'':'<failure message="LAB72 regression failed">'+
  xmlEscape((result.stderr||result.stdout||'').slice(-1200))+'</failure>')+
  '</testcase>');
}
const dir='.motorlab/scudo360-test-results';
mkdirSync(dir,{recursive:true});
writeFileSync(join(dir,'TEST-studybook.StudyBookLab72Targeted.xml'),
 '<?xml version="1.0" encoding="UTF-8"?>\n<testsuite name="studybook.StudyBookLab72Targeted" tests="'+
 suites.length+'" failures="'+(suites.length-passed)+'" errors="0" skipped="0">'+
 cases.join('')+'</testsuite>\n');
console.log('SCUDO_LAB72_CONTRACT',JSON.stringify({tests:suites.length,passed,
 failed:suites.length-passed}));
if(passed!==suites.length)process.exitCode=1;
