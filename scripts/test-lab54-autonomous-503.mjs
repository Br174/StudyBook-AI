// LAB54: 61/714 original user incident: 503 -> cooldown -> 503 -> adaptive
// full-page chunks -> automatic foreground resume with NO duplicate workers.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {indexedDB as fakeIndexedDB} from 'fake-indexeddb';
import {planStudyAutoResumeV45,autoResumeWakeDecisionV54,autoResumeNextWakeMsV54}
  from '../src/lib/studyAutoResumeV45.js';
import {adaptiveOverloadBudgetV54,planNaturalBlocksV51,bookUnitsV51}
  from '../src/lib/integralPlannerV51.js';
import {generateIntegralEditionsV51} from '../src/lib/generativeIntegralV51.js';
import {clearGeminiPause} from '../src/lib/geminiQuotaControllerV36.js';

const origin='argomento '.repeat(20).trim();
const count=119,pageCount=44;
const sha='d'.repeat(64);
const paragraphs=Array.from({length:count},(_,i)=>({
  original:origin,sourcePageStart:Math.floor(i*pageCount/count)+1,
  sourcePageEnd:Math.floor(i*pageCount/count)+1
}));
const staged=paragraphs.map((_,i)=>({
  editions:{'50':i<61?'argomento '.repeat(10).trim():null},
  verified:{'50':i<61},issues:{},achievedPercent:{},partialFragments:{}
}));
const book={title:'Filosofia del diritto 44 pagine',
  canonicalBookMap:{pageCount,originalFingerprint:sha,uncertain:[],
    pages:Array.from({length:pageCount},(_,i)=>({physicalPage:i+1,sourceStatus:'verified'}))},
  studyPillarV38:'studybook-progressive-v38-1',
  chapters:[{title:'Introduzione',pageStart:1,pageEnd:44,paragraphs}],
  editionsV36:{sourceFingerprint:sha,rows:[staged],stagedRows:[staged],status:'partial',
    totalChunkVariants:714,verifiedChunkVariants:61,complete:false}};

const units=bookUnitsV51(book);
const initialLimit=900000;
const a=adaptiveOverloadBudgetV54(units,'summary',initialLimit,1);
assert.ok(a.inputLimit<initialLimit,'First 503 reduces huge requests');
assert.ok(a.largestWholePage<a.inputLimit);
const planned=planNaturalBlocksV51(units,'summary',{maxInputTokens:a.inputLimit});
assert.ok(planned.length>1,'after overload generate fewer full-page blocks');
for(const section of planned){
  const end=section.at(-1),lastIndex=units.findIndex(u=>u.id===end.id);
  const next=units[lastIndex+1];
  assert.ok(!next||end.pageEnd<next.pageStart||end.ci!==next.ci,
    'never split in the middle of a PDF page');
}
const time=Date.UTC(2026,10,7,17,50,0);
const pauseUntil=time+90_000;
const plan=planStudyAutoResumeV45({
  status:'quota-paused',complete:false,
  quota:{kind:'overload',automatic:true,retryAt:new Date(pauseUntil).toISOString()}
},time,0);
assert.equal(plan.reason,'provider-cooldown');
assert.equal(plan.at,pauseUntil);
assert.equal(autoResumeWakeDecisionV54(plan,{now:pauseUntil-1,visible:true}),'too-early',
 'early timer must not lose its chance to retry');
assert.equal(autoResumeNextWakeMsV54(plan,pauseUntil-1),81);
assert.equal(autoResumeWakeDecisionV54(plan,{now:pauseUntil,visible:false}),
  'foreground-required','never use Gemini in Android background');
assert.equal(autoResumeWakeDecisionV54(plan,{now:pauseUntil,visible:true}),
  'ready','resume on returning to foreground');
assert.equal(autoResumeWakeDecisionV54(plan,{now:pauseUntil,visible:true,inFlight:true}),
  'in-flight','single-writer guard');
assert.equal(autoResumeWakeDecisionV54(plan,{now:pauseUntil+4000,visible:true}),
  'ready','missed background deadline must be recovered after return');
assert.equal(autoResumeNextWakeMsV54(plan,time),60000,
  'periodic recheck within existing scheduler');

const app=readFileSync(new URL('../src/AppV15.jsx',import.meta.url),'utf8');
assert.match(app,/autoResumeWakeDecisionV54\(plan/);
assert.match(app,/autoResumeNextWakeMsV54\(plan/);
assert.match(app,/window.addEventListener\('focus',tryResume\)/);
assert.match(app,/window.addEventListener\('pageshow',tryResume\)/);
assert.match(app,/document.addEventListener\('visibilitychange',tryResume\)/);
assert.match(app,/cancelled=true;/);
assert.match(app,/resumeExecutionRef.current/);

const oldFetch=globalThis.fetch,oldDb=globalThis.indexedDB,oldClock=Date.now;
globalThis.indexedDB=fakeIndexedDB;
let now=time,calls=0,overloads=2;
Date.now=()=>now;
globalThis.fetch=async (url,options)=>{
  assert.ok(String(url).endsWith('/api/editions/bulk/v51'));
  calls++;
  if(overloads-->0){
    return new Response(JSON.stringify({
      code:'AI_TEMPORARY_OVERLOAD',error:'Temporarily busy',
      quota:{kind:'overload',automatic:true,httpStatus:503,
        retryAfterSeconds:15,estimated:false}
    }),{status:503,headers:{'Content-Type':'application/json'}});
  }
  const request=JSON.parse(options.body);
  const repeat=request.level==='summary'?8:20*(1-Number(request.level)/100);
  return new Response(JSON.stringify({
    engine:'ai',version:'integral-v51',level:request.level,
    parts:request.units.map(u=>({id:u.id,
      text:'argomento '.repeat(repeat).trim()}))
  }),{status:200,headers:{'Content-Type':'application/json'}});
};
try{
  await clearGeminiPause();
  const run1=await generateIntegralEditionsV51(book);
  assert.equal(run1.status,'quota-paused');
  assert.equal(run1.verifiedChunkVariants,61,'the 61 verified parts must remain');
  assert.equal(run1.totalChunkVariants,714);
  assert.equal(run1.publishedThroughPage.summary,0);
  assert.ok(run1.integralInputLimit<900000,'persist first 503 adaptive budget');
  assert.equal(calls,1,'no second request during provider cooldown');
  const plan1=planStudyAutoResumeV45(run1,now);
  assert.equal(plan1.reason,'provider-cooldown');
  now=Date.parse(run1.quota.retryAt)+200;
  const run2=await generateIntegralEditionsV51({...book,editionsV36:run1});
  assert.equal(run2.status,'quota-paused');
  assert.equal(run2.verifiedChunkVariants,61);
  assert.ok(run2.integralInputLimit<run1.integralInputLimit,
    'repeated 503 narrows full-page requests again');
  const callsBeforeCooldown=calls;
  const blocked=await generateIntegralEditionsV51({...book,editionsV36:run2});
  assert.equal(blocked.status,'quota-paused');
  assert.equal(calls,callsBeforeCooldown,'no quota retry storm before expiry');
  now=Date.parse(run2.quota.retryAt)+200;
  const events=[];
  const resumed=await generateIntegralEditionsV51({...book,editionsV36:run2},
    {onProgress:s=>events.push(s.verifiedChunkVariants)});
  assert.equal(resumed.complete,true,'completed after cooldown');
  assert.equal(resumed.verifiedChunkVariants,714);
  assert.equal(resumed.publishedThroughPage.summary,44);
  assert.ok(events.every(x=>x>=61),'never lose saved verification');
  assert.ok(calls<35,'bounded large natural-page requests, not 714 fragments');
  const finalAgain=await generateIntegralEditionsV51({...book,editionsV36:resumed});
  assert.equal(finalAgain.complete,true);
  const previousCalls=calls;
  assert.ok(previousCalls<35);
  assert.equal(calls,previousCalls);
}finally{
  globalThis.fetch=oldFetch;Date.now=oldClock;
  await clearGeminiPause();
  if(oldDb===undefined)delete globalThis.indexedDB;
  else globalThis.indexedDB=oldDb;
}
console.log('LAB54 PASS: 61/714 restored, 503 twice, full-page downsizing, cooldown and foreground wakeup, all 714 verified without duplication.');
