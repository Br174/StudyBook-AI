// LAB58: same LARGE blocks, same number of calls. Assess real engine and
// simulated minute-limit time-to-completion WITHOUT consuming Gemini quota.
import assert from 'node:assert/strict';
import {indexedDB as fakeIndexedDB} from 'fake-indexeddb';
import {generateDraftFirstV57} from '../src/lib/draftFirstV57.js';
import {STUDY_DRAFT_PROTOCOL_V72} from '../src/lib/studyDraftProtocolV72.js';
import {studyLetters} from '../src/lib/studyPillarV38.js';
import {clearGeminiPause} from '../src/lib/geminiQuotaControllerV36.js';
import {
 cadenceFromQuotaV58,cadenceDelayV58,cadenceAfterSuccessV58,
 learnGeminiCadenceV58,readGeminiCadenceV58,
 clearGeminiCadenceForTestV58,restoredLargeBlockLimitV58
} from '../src/lib/geminiCadenceV58.js';

const original='argomento '.repeat(20).trim();
const book=(fp,previous)=>({
 title:'Comparazione 44 pagine / 119 paragrafi',
 studyPillarV38:'studybook-progressive-v38-1',
 canonicalBookMap:{originalFingerprint:fp.repeat(64),pageCount:44,uncertain:[],
   pages:Array.from({length:44},(_,i)=>({
     physicalPage:i+1,sourceStatus:'verified'}))},
 chapters:[{title:'Libro',pageStart:1,pageEnd:44,
  paragraphs:Array.from({length:119},(_,i)=>({original,
    sourcePageStart:Math.floor(i*44/119)+1,
    sourcePageEnd:Math.floor(i*44/119)+1}))}],
 ...(previous?{editionsV36:previous}:{})
});
const makeReply=p=>{
 const parts=p.units.map(u=>({id:u.id,
  text:'argomento '.repeat(p.level==='summary'?8:
   20*(1-Number(p.level)/100)).trim()}));
 const sourceLetters=p.units.reduce((n,u)=>n+studyLetters(u.source),0);
 const observedLetters=parts.reduce((n,x)=>n+studyLetters(x.text),0);
 return {engine:'ai',version:'integral-v51',level:p.level,parts,
  completeParts:true,draftProtocol:STUDY_DRAFT_PROTOCOL_V72,
  outputTokenLimit:6000,finishReason:'stop',
  lengthReview:{sourceLetters,observedLetters,withinBand:true,compliant:true}};
};
function simulate({limitRpm=3,latencyMs=5000,total=6,pauseOn429Ms=120000,gapMs=0}={}){
 let now=0,rejections=0,requestCount=0,success=0,rolling=[];
 while(success<total&&requestCount<50){
   if(gapMs&&success)now=Math.max(now,success*gapMs);
   rolling=rolling.filter(t=>now-t<60000);
   requestCount++;
   if(rolling.length>=limitRpm){
     rejections++;now+=pauseOn429Ms;
   }else{
     rolling.push(now);now+=latencyMs;success++;
   }
 }
 return {completionMs:now,successfulRequests:success,
   actualRequests:requestCount,rejections};
}
const fast=simulate({limitRpm:10});
const many429=simulate({limitRpm:3,pauseOn429Ms:120000});
const rpmCap=cadenceFromQuotaV58({kind:'requests-minute',limit:3},
 null,100000);
const paced=simulate({limitRpm:3,pauseOn429Ms:120000,gapMs:rpmCap.gapMs});
assert.equal(fast.actualRequests,6);
assert.equal(fast.rejections,0);
assert.equal(many429.rejections>0,true);
assert.equal(paced.rejections,0);
assert.equal(paced.actualRequests,6,'cadence must not add or split requests');
assert.ok(paced.completionMs<many429.completionMs,
 'with real RPM saturation, spacing may reduce TOTAL completion time');
const noEvidence=cadenceFromQuotaV58({kind:'unknown'},null,100000);
assert.equal(noEvidence,null,'unknown limit is NOT a reason for invented delay');
assert.equal(cadenceFromQuotaV58({kind:'daily'},null,100000),null);
assert.equal(cadenceFromQuotaV58({kind:'overload'},null,100000),null);
assert.equal(cadenceFromQuotaV58({kind:'tokens-minute',limit:1000},
 null,100000),null,'no TPM cadence without actual input token evidence');
const tokenCadence=cadenceFromQuotaV58({kind:'tokens-minute',limit:10000},
 {kind:'tokens-minute',lastInputTokens:3500},100000);
assert.ok(tokenCadence.gapMs>0);
const impossible=cadenceFromQuotaV58({kind:'tokens-minute',limit:10000},
 {kind:'tokens-minute',lastInputTokens:12000},100000);
assert.equal(impossible,null,'a single block bigger than TPM cannot be fixed by pauses');
const after=cadenceAfterSuccessV58(rpmCap,{
 now:106000,requestStartedAt:100000,inputTokens:3500
});
assert.equal(after.gapMs,rpmCap.gapMs);
assert.equal(cadenceDelayV58(after,106000),rpmCap.gapMs-6000);
assert.equal(cadenceDelayV58(after,100000+rpmCap.gapMs),0);
assert.equal(cadenceDelayV58(null),0);
assert.equal(restoredLargeBlockLimitV58({integralInputLimit:1600}),900000,
 'historical 503 shrink is NOT persisted as mandatory segmentation');
assert.equal(restoredLargeBlockLimitV58({integralInputLimit:3500,
 diagnostics:{lastCode:'AI_TEMPORARY_OVERLOAD'}}),900000);

const oldDB=globalThis.indexedDB,oldFetch=globalThis.fetch;
globalThis.indexedDB=fakeIndexedDB;
let requests=[];
try{
 await clearGeminiPause();
 await clearGeminiCadenceForTestV58();
 assert.equal(await readGeminiCadenceV58(),null);
 globalThis.fetch=async(url,opt)=>{
   assert.ok(String(url).endsWith('/api/editions/bulk/v51'));
   const p=JSON.parse(opt.body);
   requests.push({level:p.level,phase:p.phase,units:p.units.length,
     from:p.units[0].pageStart,to:p.units.at(-1).pageEnd});
   return new Response(JSON.stringify(makeReply(p)),
     {status:200,headers:{'Content-Type':'application/json'}});
 };
 const oldProgress={status:'quota-paused',sourceFingerprint:'a'.repeat(64),
  integralInputLimit:1600,
  diagnostics:{lastCode:'AI_TEMPORARY_OVERLOAD'},
  rows:[Array.from({length:119},(_,i)=>({
    editions:{summary:i<76?'argomento '.repeat(8).trim():null},
    verified:{summary:i<76}
  }))],
  stagedRows:[Array.from({length:119},(_,i)=>({
    editions:{summary:i<76?'argomento '.repeat(8).trim():null},
    verified:{summary:i<76}
  }))]};
 const resumed=await generateDraftFirstV57(book('a',oldProgress));
 assert.equal(resumed.complete,true);
 assert.equal(resumed.verifiedChunkVariants,714);
 assert.equal(resumed.draftUnitsSaved,714);
 assert.equal(resumed.integralInputLimit,900000);
 assert.equal(requests.length,6);
 const unitInputs=requests.reduce((n,x)=>n+x.units,0);
 assert.ok(unitInputs>=714-76&&unitInputs<=714,
   'a page-boundary request can include a previously verified unit but not extra calls');
 assert.equal(requests[0].to,44,'the resumed summary ends on original page 44');
 assert.ok(requests.slice(1).every(r=>r.from===1&&r.to===44),
  'all other full draft editions use exactly one whole-book block');
 assert.deepEqual(requests.map(x=>x.level),['summary','50','40','30','20','10']);
 assert.equal(await readGeminiCadenceV58(),null,
  'provider success without any RPM evidence must NOT introduce a delay');

 const remembered=await learnGeminiCadenceV58({kind:'requests-minute',limit:3});
 assert.equal(remembered.gapMs,22000);
 assert.equal((await readGeminiCadenceV58()).kind,'requests-minute');
}finally{
 globalThis.fetch=oldFetch;
 await clearGeminiPause();
 await clearGeminiCadenceForTestV58();
 if(oldDB===undefined)delete globalThis.indexedDB;
 else globalThis.indexedDB=oldDB;
}
console.log('LAB58_COMPARISON='+JSON.stringify({
 sameSixBlocks:true,without429:fast,
 simulatedRpmOverflow:many429,
 simulatedLearnedCadence:paced,
 providerLimitExample:'3 RPM purely simulated, NOT the user real quota',
 retainedVerified:76,restoredBigBlocks:6,splitOnlyOnProvenHardSize:true
}));
console.log('LAB58 PASS: 76 verified parts preserved, 6 large 44-page requests, no automatic spacing without 429, documented RPM pacing improves simulated completion');
