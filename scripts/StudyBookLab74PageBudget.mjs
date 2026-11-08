// Native MotorLab Scudo360 P1 adapter for LAB74 per-page source-letter budget.
// No Gemini calls, no user data, no duplicate QA scheduler.
import {spawnSync} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
const r=spawnSync(process.execPath,['scripts/test-lab74-page-letter-budgets.mjs'],
 {encoding:'utf8',timeout:90000,maxBuffer:1500000});
const passed=r.status===0&&(r.stdout||'').includes('LAB74_PAGE_BUDGET_PASS');
const xmlSafe=s=>String(s||'').replaceAll('&','&amp;').replaceAll('<','&lt;')
 .replaceAll('>','&gt;').replaceAll('"','&quot;');
const dir='.motorlab/scudo360-test-results';
mkdirSync(dir,{recursive:true});
writeFileSync(dir+'/TEST-studybook.StudyBookLab74PageBudget.xml',
 '<?xml version="1.0" encoding="UTF-8"?>\n'+
 '<testsuite name="studybook.StudyBookLab74PageBudget" tests="2" failures="'+(passed?0:1)+'" errors="0" skipped="0">'+
 '<testcase classname="studybook.StudyBookLab74PageBudget" name="SixOriginalPageTargetsAndTolerance"/>'+
 '<testcase classname="studybook.StudyBookLab74PageBudget" name="WorkerRejectsFalsePageBudget">'+
 (passed?'':'<failure message="LAB74 source-page budget regression">'+
 xmlSafe((r.stderr||r.stdout||'').slice(-1600))+'</failure>')+
 '</testcase></testsuite>\n');
console.log('SCUDO_LAB74_P1',JSON.stringify({tests:2,passed,source:'immutable page originals',providerCalls:0}));
if(!passed)process.exitCode=1;
