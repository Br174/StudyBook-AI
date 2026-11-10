// LAB112 technical audit of the exact LAB111 planner, no Gemini, no user PDF.
// All page lengths in this file are SYNTHETIC examples, not real phone telemetry.
import assert from 'node:assert/strict';
import {planNaturalBlocksLinearV111} from '../src/lib/studyLinearPlannerV111.js';
import {planNaturalBlocksV51} from '../src/lib/integralPlannerV51.js';
import {makeGeminiPause} from '../src/lib/geminiQuotaControllerV36.js';
import {throughputFailureV77} from '../src/lib/geminiThroughputV77.js';
const levels=['summary','50','40','30','20','10'];
const cases=[1500,2000,3000,4000,5000];
const base='Il libro presenta concetti, definizioni e argomenti che spiegano distintamente le condizioni e le eccezioni. ';
function unitsWithChars(chars){
 const unitText=(base.repeat(Math.ceil(chars/base.length))).slice(0,chars);
 return Array.from({length:44},(_,i)=>({
  id:'0:'+i,ci:0,pi:i,pageStart:i+1,pageEnd:i+1,
  chapterTitle:'Filosofia del diritto',source:unitText
 }));
}
let assertions=0;
const samples=cases.map(charsPerPage=>{
 const units=unitsWithChars(charsPerPage);
 const requestsByLevel={};
 for(const level of levels){
  const opts={maxInputTokens:900000,maxOutputTokens:50000};
  const actual=planNaturalBlocksLinearV111(units,level,opts);
  const legacy=planNaturalBlocksV51(units,level,opts);
  assert.deepEqual(actual.map(b=>b.map(u=>u.id)),legacy.map(b=>b.map(u=>u.id)));
  assertions++;
  assert.deepEqual(actual.flatMap(b=>b.map(u=>u.id)),units.map(u=>u.id));
  assertions++;
  requestsByLevel[level]=actual.map(block=>({
   firstPage:block[0].pageStart,lastPage:block.at(-1).pageEnd,
   pageCount:block.length,sourceChars:block.reduce((n,x)=>n+x.source.length,0)
  }));
 }
 return {syntheticSourceCharsPerPage:charsPerPage,
  syntheticTotalSourceChars:charsPerPage*44,
  modelGenerationsIfNoFailures:Object.values(requestsByLevel).reduce((n,b)=>n+b.length,0),
  requestsByLevel};
});
const now=Date.parse('2026-11-10T15:00:00Z');
const quota={kind:'overload',estimated:true,retryAfterSeconds:90,httpStatus:503,automatic:true};
let p=null;const pauseSeconds=[];
for(let i=0;i<3;i++){
 p=makeGeminiPause(quota,p,now+i*1000);
 pauseSeconds.push(Math.round((Date.parse(p.retryAt)-(now+i*1000))/1000));
}
assert.deepEqual(pauseSeconds,[90,180,360]);assertions++;
const throughput=throughputFailureV77(null,{now});
assert.equal(throughput.gapMs,90000);assertions++;
console.log(JSON.stringify({
 audit:'LAB112',actualCode:'studyLinearPlannerV111.js',
 booksActualSourceAvailable:false,realPhoneRequestsObserved:null,
 syntheticSamples:samples,assertions,
 fallbackRetryLogic:{
  observedHTTP503CanCreateLocalCooldownWithoutNewProviderCall:true,
  estimatedOverloadPauseSecondsForConsecutiveUnsuccessfulAttempts:pauseSeconds,
  initialOverloadSpacingMs:throughput.gapMs,
  note:'This is not proof that user saw 3 503 errors; illustrates current code behavior'
 },
 note:'No Gemini calls or remote telemetry. Numbers are planning counts for hypothetical 44-page lengths ONLY.'
},null,2));
