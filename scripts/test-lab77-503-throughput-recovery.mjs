// LAB77: user report 44/44 Riassunto, 44/44 50%, then Gemini 503.
// Simulate 503 after two completed WHOLE-BOOK drafts, preserve them, and
// recover without splitting or duplicate Gemini requests. Theoretical pacing
// tests use a fake clock and are NOT Google latency/throughput measurements.
import assert from 'node:assert/strict';
import {indexedDB as fakeIndexedDB} from 'fake-indexeddb';
import {generateDraftFirstV57} from '../src/lib/draftFirstV57.js';
import {STUDY_DRAFT_PROTOCOL_V74} from '../src/lib/studyDraftProtocolV74.js';
import {pageLetterReviewV74} from '../src/lib/studyPageBudgetsV74.js';
import {studyLetters} from '../src/lib/studyPillarV38.js';
import {clearGeminiPause} from '../src/lib/geminiQuotaControllerV36.js';
import {clearGeminiCadenceForTestV58,readGeminiCadenceV58}
 from '../src/lib/geminiCadenceV58.js';
import {
 throughputFailureV77,throughputSuccessV77,throughputDelayV77,
 readGeminiThroughputV77,clearGeminiThroughputForTestV77
} from '../src/lib/geminiThroughputV77.js';

const start=Date.UTC(2026,10,9,18,45,0);
const one=throughputSuccessV77(null,{now:start+12000,requestStartedAt:start,inputTokens:10000});
assert.equal(one.kind,'large-block-warmup');
assert.equal(one.gapMs,15000);
assert.equal(throughputDelayV77(one,start+12000),3000);
assert.equal(throughputDelayV77(one,start+15000),0);
assert.equal(throughputSuccessV77(null,{now:start+12000,requestStartedAt:start,inputTokens:1000}),null,
 'do not impose preemptive delays on small work');
const overloaded=throughputFailureV77(one,{now:start+13000});
assert.equal(overloaded.kind,'overload-avoidance');
assert.equal(overloaded.gapMs,90000);
const more=throughputFailureV77(overloaded,{now:start+15000});
assert(more.gapMs>overloaded.gapMs);
let recovered=more;
for(let i=0;i<8;i++)recovered=throughputSuccessV77(recovered,
 {now:start+100000*(i+1),requestStartedAt:start+100000*i,inputTokens:22000});
assert.equal(recovered.overloadCount,0,'healthy responses recover from overload conservative pacing');
assert(throughputDelayV77(recovered,start+1000000)===0);

const bookSource='argomento '.repeat(20).trim(),paragraphCount=119,pageCount=44;
const fp='7'.repeat(64);
const paragraphs=Array.from({length:paragraphCount},(_,i)=>({
 original:bookSource,
 sourcePageStart:Math.floor(i*pageCount/paragraphCount)+1,
 sourcePageEnd:Math.floor(i*pageCount/paragraphCount)+1
}));
const book={
 title:'Libro reale da 44 pagine: simulazione 503 dopo due livelli',
 studyPillarV38:'studybook-progressive-v38-1',
 canonicalBookMap:{originalFingerprint:fp,pageCount,uncertain:[],
  pages:Array.from({length:pageCount},(_,i)=>({physicalPage:i+1,sourceStatus:'verified'}))},
 chapters:[{title:'Capitolo',pageStart:1,pageEnd:44,paragraphs}]
};
const reply=body=>{
 const parts=body.units.map(u=>({id:u.id,text:'argomento '.repeat(
  body.level==='summary'?8:20*(1-Number(body.level)/100)).trim()}));
 const sourceLetters=body.units.reduce((n,u)=>n+studyLetters(u.source),0);
 const observedLetters=parts.reduce((n,p)=>n+studyLetters(p.text),0);
 return{engine:'ai',version:'integral-v51',level:body.level,
  parts,completeParts:true,draftProtocol:STUDY_DRAFT_PROTOCOL_V74,
  finishReason:'stop',outputTokenLimit:6000,inputTokens:0,
  lengthReview:{sourceLetters,observedLetters,compliant:true,withinBand:true,
   pageReviewV74:pageLetterReviewV74(body.units,parts,body.level)}};
};
const oldFetch=globalThis.fetch,oldDB=globalThis.indexedDB,realClock=Date.now,
 realTimer=globalThis.setTimeout;
let clock=start,requests=[],failedAtLevel=null;
try{
 globalThis.indexedDB=fakeIndexedDB;
 Date.now=()=>clock;
 // Model multi-minute provider pacing WITHOUT waiting for real minutes in CI.
 // Keep IndexedDB's normal 0-1ms event loop timers unchanged.
 globalThis.setTimeout=(callback,delay,...args)=>Number(delay)>=5000
  ? realTimer(()=>{clock+=Math.ceil(Number(delay));callback(...args)},0)
  : realTimer(callback,delay,...args);
 await clearGeminiPause();
 await clearGeminiCadenceForTestV58();
 await clearGeminiThroughputForTestV77();
 globalThis.fetch=async(url,options)=>{
  assert(String(url).endsWith('/api/editions/bulk/v51'));
  const data=JSON.parse(options.body);
  requests.push({level:data.level,from:data.units[0].pageStart,
   to:data.units.at(-1).pageEnd,units:data.units.length});
  clock+=1000;
  if(data.level==='40'&&!failedAtLevel){
    failedAtLevel='40';
    return new Response(JSON.stringify({
     code:'AI_TEMPORARY_OVERLOAD',quota:{kind:'overload',automatic:true,
      estimated:true,httpStatus:503,retryAfterSeconds:90},
     error:'Provider busy'
    }),{status:503,headers:{'content-type':'application/json'}});
  }
  return new Response(JSON.stringify(reply(data)),{status:200,
   headers:{'content-type':'application/json'}});
 };
 const first=await generateDraftFirstV57(book);
 assert.equal(first.status,'quota-paused','503 must enter safe cooldown');
 assert.equal(requests.length,3);
 assert.deepEqual(requests.map(x=>x.level),['summary','50','40']);
 assert.equal(first.draftUnitsSaved,paragraphCount*2);
 assert.equal(first.draftRowsV57[0][0].editions.summary.length>0,true);
 assert.equal(first.draftRowsV57[0][0].editions['50'].length>0,true);
 assert.equal(first.draftRowsV57[0][0].editions['40']??null,null);
 const pacing=await readGeminiThroughputV77();
 assert.equal(pacing.kind,'overload-avoidance');
 assert(pacing.gapMs>=90000);
 assert.equal(await readGeminiCadenceV58(),null,'503 is not mislabeled as 429 RPM');
 // The REAL Android scheduler waits until the exact saved cooldown.
 // This fake clock passes its due time without consuming real time.
 clock=Math.max(clock,Date.parse(first.quota.retryAt)+1000);
 const second=await generateDraftFirstV57({...book,editionsV36:first});
 assert.equal(second.complete,true);
 assert.equal(second.draftUnitsSaved,paragraphCount*6);
 assert.deepEqual(requests.map(x=>x.level),
  ['summary','50','40','40','30','20','10'],
  'Resume only the failed and missing levels, never regenerate completed');
 assert(requests.every(x=>x.from===1&&x.to===44),'no small arbitrary blocks');
 const after=await generateDraftFirstV57({...book,editionsV36:second});
 assert.equal(after.complete,true);
 assert.equal(requests.length,7);
 console.log('LAB77_PACING_AND_RECOVERY_PASS',JSON.stringify({
  originalPages:44,completedBefore503:['summary','50'],
  one503At:'40',finalSixLevelsComplete:true,requests:requests.map(x=>x.level),
  preservedSavedDraftUnitsBefore503:paragraphCount*2,
  sourceBlocksKeptWholeBook:true,semanticBookQualityCertified:false,
  newProviderRequestsUsed:0,realProviderThroughputNotMeasured:true
 }));
}finally{
 globalThis.fetch=oldFetch;Date.now=realClock;
 globalThis.setTimeout=realTimer;
 await clearGeminiPause();
 await clearGeminiCadenceForTestV58();
 await clearGeminiThroughputForTestV77();
 if(oldDB===undefined)delete globalThis.indexedDB;
 else globalThis.indexedDB=oldDB;
}
