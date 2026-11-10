// StudyBook LAB113: exact local metadata accounting + bounded 503 policy.
// NO provider calls, NO keys, NO book text, NO timers or extra schedulers.
import assert from 'node:assert/strict';
import {emptyGeminiTrafficV113,applyGeminiTrafficV113,
 geminiTrafficSummaryV113,STUDY_GEMINI_TRAFFIC_V113}
 from '../src/lib/studyGeminiTrafficV113.js';
import {estimatedOverloadSecondsV113,makeGeminiPause}
 from '../src/lib/geminiQuotaControllerV36.js';
import {throughputFailureV77} from '../src/lib/geminiThroughputV77.js';

let assertions=0;
function eq(a,b,msg){assert.deepEqual(a,b,msg);assertions++}
function ok(v,msg){assert.ok(v,msg);assertions++}
const now=Date.parse('2026-11-10T16:00:00Z');
let state=emptyGeminiTrafficV113();
const secret='sk-gemini-test-must-not-be-saved',privateText='TESTO_PRIVATO_PDF_44P';
const scenarios=[{httpStatus:200,parts:3,inputTokens:5000,outputTokens:1000,code:'OK'},
 {httpStatus:503,parts:0,inputTokens:7500,outputTokens:0,code:'AI_TEMPORARY_OVERLOAD'},
 {httpStatus:429,parts:0,inputTokens:7500,outputTokens:0,code:'AI_QUOTA_LIMIT'},
 {httpStatus:0,parts:0,inputTokens:0,outputTokens:0,code:'AI_CLIENT_NETWORK'}];
for(let i=0;i<4;i++){
 const result=applyGeminiTrafficV113(state,{type:'dispatch',level:['summary','50','40','30'][i],
  pageStart:1+i*8,pageEnd:8+i*8,units:8,sourceChars:18000,
  estimatedInputTokens:10500,outputTokenLimit:20000,
  text:privateText,apiKey:secret},now+i*1000);
 state=result.state;
 eq(geminiTrafficSummaryV113(state).dispatched,i+1);
 if(i===3){ // genuine in-flight entry persisted across app relaunch/crash
  const restored=JSON.parse(JSON.stringify(state));
  eq(restored.recent.at(-1).state,'sent');
  state=restored;
 }
 state=applyGeminiTrafficV113(state,{type:'result',id:result.id,
  ...scenarios[i],elapsedMs:1100,bookText:privateText},now+10000+i).state;
}
const summary=geminiTrafficSummaryV113(state);
eq(summary.policy,STUDY_GEMINI_TRAFFIC_V113);
eq(summary.dispatched,4);
eq(summary.worker200,1);
eq(summary.workerFailures,3);
eq(summary.confirmedParts,1);
eq(summary.http503,1);
eq(summary.http429,1);
eq(summary.inputTokensReported,20000);
eq(summary.outputTokensReported,1000);
ok(!JSON.stringify(state).includes(secret));
ok(!JSON.stringify(state).includes(privateText));
const cloned=JSON.parse(JSON.stringify(state));
cloned.recent.at(-1).state='sent';
const duplicate=applyGeminiTrafficV113(state,{type:'result',id:1,httpStatus:503}).state;
eq(duplicate.http503,1,'completed request must be idempotent');
let resumed=JSON.parse(JSON.stringify(state));
for(let i=0;i<2000;i++){
 const dispatch=applyGeminiTrafficV113(resumed,{type:'dispatch',level:'10',
  pageStart:i+1,pageEnd:i+1,sourceChars:9000,estimatedInputTokens:5000},now);
 resumed=applyGeminiTrafficV113(dispatch.state,
  {type:'result',id:dispatch.id,httpStatus:200,code:'OK',parts:1,inputTokens:5000},now).state;
}
eq(resumed.dispatched,2004);
eq(resumed.confirmedParts,2001);
ok(resumed.recent.length<=80,'journal memory is capped');
ok(JSON.stringify(resumed).length<24000,'journal remains small after 2000 dispatches');
const observed=[1,2,3,4,5,20].map(estimatedOverloadSecondsV113);
eq(observed,[35,51,72,103,120,120]);
const official=makeGeminiPause({
 kind:'overload',estimated:false,retryAfterSeconds:420,
 retrySource:'provider-header',httpStatus:503},null,now);
eq(Math.round((Date.parse(official.retryAt)-now)/1000),420,
 'provider header is never shortened by the LAB113 local estimator');
const quota=makeGeminiPause({kind:'tokens-minute',estimated:true,
 retryAfterSeconds:75,httpStatus:429},null,now);
ok(Math.round((Date.parse(quota.retryAt)-now)/1000)>=75);
const existing=throughputFailureV77(null,{now});
eq(existing.gapMs,90000,'LAB77 old behavior unchanged outside LAB113 trial');
console.log(JSON.stringify({lab:'LAB113',assertions,
 syntheticDispatches:2004,retainedEvents:resumed.recent.length,
 localEstimated503Seconds:observed,providerRetryAfter420Preserved:true,
 oldQuotaAndPacingDefaultsPreserved:true,modelCalls:0,
 noBookTextOrSecretsStored:true,archiveBytes:JSON.stringify(resumed).length}));
