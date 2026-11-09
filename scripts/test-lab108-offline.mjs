// LAB108: offline regression / contract assertions, no network or Gemini.
import assert from 'node:assert/strict';
import {FIXTURES} from './lab93-semantic-gate.mjs';
import {virtualRowsV106} from '../src/lib/studySingleCallGateV106.js';
import {buildSourcePreservingPromptV108} from '../src/lib/studySourcePreservingV108.js';
import {sourceLetterBudgetV74} from '../src/lib/studyPageBudgetsV74.js';
import {studyLetters} from '../src/lib/studyPillarV38.js';
import {classifyMeasuredResultV107} from '../src/lib/studyInverseCalibrationV107.js';
let checks=0;
function ok(x,label){assert.ok(x,label);checks++}
function eq(x,y,label){assert.deepEqual(x,y,label);checks++}
function reject(f,why){assert.throws(f,why);checks++}
for(const fixture of FIXTURES.filter(x=>['scienze','procedura'].includes(x.id))){
 const original=fixture.concepts.join(' ').replace(/\s+/gu,' ').trim();
 for(const level of ['10','20','40']){
  const b=sourceLetterBudgetV74(studyLetters(original),level),rows=Math.ceil(b.targetLetters/46.346);
  for(const arm of ['COPY_EDIT','ANCHORED_SECTIONS']){
   const p=buildSourcePreservingPromptV108({source:original,level,arm,maxRows:rows});
   eq(p.approvedForApp,false);eq(p.semanticCertified,false);eq(p.requestCallsExpected,1);
   eq(p.originalLetters,studyLetters(original));eq(p.letterBudget.targetLetters,b.targetLetters);
   ok(p.prompt.includes('massimo '+rows+' righe'),arm);
   ok(p.prompt.includes('Mantieni circa '+b.targetLetters+' LETTERE'),arm);
   ok(p.prompt.includes('NON omettere un fatto indispensabile'),arm);
   ok(p.prompt.includes('TESTO FONTE'),arm);
   if(arm==='ANCHORED_SECTIONS'){
    eq(p.softSentenceBudgets.reduce((x,y)=>x+y,0),b.targetLetters);
    ok(p.prompt.includes('S1:'));
   }else{eq(p.softSentenceBudgets,null);ok(p.prompt.includes(original))}
   const failed=classifyMeasuredResultV107({budget:b,outputLetters:Math.round(b.originalLetters*.2),originalPageRows:10,gridPass:true});
   eq(failed.fullyApproved,false);
  }
 }
}
const fixture=FIXTURES.find(x=>x.id==='procedura'),source=fixture.concepts.join(' ');
reject(()=>buildSourcePreservingPromptV108({source,level:'50',maxRows:10}),/INVALID_ORIGINAL_OR_LEVEL/);
reject(()=>buildSourcePreservingPromptV108({source,level:'20',arm:'NOT_REAL',maxRows:10}),/INVALID_CALIBRATION_ARM/);
reject(()=>buildSourcePreservingPromptV108({source,level:'20',maxRows:0}),/INVALID_FIXED_GRID/);
const l=virtualRowsV106(source);ok(l.rows>0);
console.log(JSON.stringify({lab:'LAB108',checksPassed:checks,networkRequests:0,productionModified:false,semanticCertified:false}));
