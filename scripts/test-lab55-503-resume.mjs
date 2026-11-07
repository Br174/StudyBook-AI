// LAB55: emulate the real 73/714 incident: first Gemini 503, successful
// partial answer, second 503. Both waits must be bounded independently;
// all source/checkpoint material must survive intact.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {indexedDB as fakeIndexedDB} from 'fake-indexeddb';
import {generateIntegralEditionsV51} from '../src/lib/generativeIntegralV51.js';
import {readGeminiPause,clearGeminiPause} from '../src/lib/geminiQuotaControllerV36.js';
import {planStudyAutoResumeV45,geminiResumeDisplayV55,
  autoResumeWakeDecisionV54} from '../src/lib/studyAutoResumeV45.js';

const now=Date.UTC(2026,10,7,18,50,0);
const fakeNow=Date.now,oldDB=globalThis.indexedDB,oldFetch=globalThis.fetch;
let clock=now;
Date.now=()=>clock;
globalThis.indexedDB=fakeIndexedDB;
const original='argomento '.repeat(20).trim();
const paragraphs=Array.from({length:119},(_,i)=>({
 original,sourcePageStart:Math.floor(i*44/119)+1,
 sourcePageEnd:Math.floor(i*44/119)+1
}));
const verified=paragraphs.map((_,i)=>({
 editions:{summary:i<73?'argomento '.repeat(8).trim():null},
 verified:{summary:i<73},issues:{},achievedPercent:{},partialFragments:{}
}));
const fp='e'.repeat(64);
const book={
 title:'Filosofia del diritto 44 pagine',
 studyPillarV38:'studybook-progressive-v38-1',
 canonicalBookMap:{pageCount:44,originalFingerprint:fp,uncertain:[],
  pages:Array.from({length:44},(_,i)=>({physicalPage:i+1,sourceStatus:'verified'}))},
 chapters:[{title:'Filosofia del diritto',pageStart:1,pageEnd:44,paragraphs}],
 editionsV36:{sourceFingerprint:fp,stagedRows:[verified],rows:[verified],
  verifiedChunkVariants:73,totalChunkVariants:714,status:'partial',complete:false,
  integralInputLimit:900000}
};
let calls=0;
const overload=()=>new Response(JSON.stringify({
 code:'AI_TEMPORARY_OVERLOAD',error:'Busy, retry later',
 quota:{kind:'overload',estimated:true,automatic:true,httpStatus:503,
  retryAfterSeconds:20}
}),{status:503,headers:{'Content-Type':'application/json'}});
globalThis.fetch=async(url,options)=>{
 assert.ok(String(url).endsWith('/api/editions/bulk/v51'));
 calls++;
 if(calls===1||calls===3)return overload();
 const input=JSON.parse(options.body);
 if(calls===2){
   assert.equal(input.level,'summary');
   // A valid 200 response salvages a few more paragraphs, but its remaining
   // unverified content must NOT be declared complete.
   return new Response(JSON.stringify({engine:'ai',version:'integral-v51',
    level:'summary',parts:input.units.slice(0,78).map(u=>({
      id:u.id,text:'argomento '.repeat(8).trim()
    }))}),{status:200,headers:{'Content-Type':'application/json'}});
 }
 const reps=input.level==='summary'?8:20*(1-Number(input.level)/100);
 return new Response(JSON.stringify({engine:'ai',version:'integral-v51',
  level:input.level,parts:input.units.map(u=>({id:u.id,
    text:'argomento '.repeat(reps).trim()}))
 }),{status:200,headers:{'Content-Type':'application/json'}});
};
try{
 await clearGeminiPause();
 const one=await generateIntegralEditionsV51(book);
 assert.equal(one.status,'quota-paused');
 assert.equal(one.verifiedChunkVariants,73);
 assert.equal(one.quota.kind,'overload');
 assert.equal(one.quota.attempts,1);
 assert.equal(calls,1,'do not send another request before cooldown');
 const plan=planStudyAutoResumeV45(one,clock);
 assert.equal(plan.reason,'provider-cooldown');
 assert.equal(geminiResumeDisplayV55(one,clock).waiting,true);
 assert.match(geminiResumeDisplayV55(one,clock).label,/stima locale/);
 assert.equal(autoResumeWakeDecisionV54(plan,{
   now:plan.at,visible:true,inFlight:false}),'ready');
 const before=await generateIntegralEditionsV51({...book,editionsV36:one});
 assert.equal(before.status,'quota-paused');
 assert.equal(calls,1,'manual early retry must not contact Gemini');
 assert.equal(before.verifiedChunkVariants,73);
 clock=Date.parse(one.quota.retryAt)+100;
 const two=await generateIntegralEditionsV51({...book,editionsV36:one});
 assert.equal(two.status,'quota-paused');
 assert.equal(two.quota.attempts,1,
   'valid partial 200 MUST reset the previous 503 backoff history');
 assert.equal(calls,3);
 assert.ok(two.verifiedChunkVariants>73,'save the 200 response verified pieces');
 assert.ok(two.verifiedChunkVariants<714,'do not publish unchecked parts');
 assert.equal(two.diagnostics.providerRecovered,true);
 assert.ok(two.integralInputLimit<one.integralInputLimit);
 assert.equal(geminiResumeDisplayV55(two,clock).waiting,true);
 assert.equal(geminiResumeDisplayV55(two,
   Date.parse(two.quota.retryAt)+1).expired,true);
 assert.match(geminiResumeDisplayV55(two,
   Date.parse(two.quota.retryAt)+1).button,/Verifica e riprendi/);
 clock=Date.parse(two.quota.retryAt)+100;
 const three=await generateIntegralEditionsV51({...book,editionsV36:two});
 assert.equal(three.complete,true,'must finish after cooldown');
 assert.equal(three.verifiedChunkVariants,714);
 assert.equal(three.publishedThroughPage.summary,44);
 assert.equal(await readGeminiPause(),null,'provider recovery clears cooldown');
 const count=calls;
 const restored=await generateIntegralEditionsV51({...book,editionsV36:three});
 assert.equal(restored.complete,true);
 assert.equal(calls,count,'restore verified results without further Gemini calls');
}finally{
 globalThis.fetch=oldFetch;Date.now=fakeNow;
 await clearGeminiPause();
 if(oldDB===undefined)delete globalThis.indexedDB;
 else globalThis.indexedDB=oldDB;
}
const app=readFileSync(new URL('../src/AppV15.jsx',import.meta.url),'utf8');
const home=readFileSync(new URL('../src/components/HomeDashboardV16.jsx',import.meta.url),'utf8');
const studio=readFileSync(new URL('../src/components/AppScreens.jsx',import.meta.url),'utf8');
const generator=readFileSync(new URL('../src/lib/generativeIntegralV51.js',import.meta.url),'utf8');
assert.match(app,/if\(resumeBusy\|\|generating\)\{schedule\(\);return;\}/);
assert.match(app,/resumeEdition=\{studyBook\?\.editionsV36/);
assert.match(home,/resumeWait\.label/);
assert.match(home,/resumeWait\.button/);
assert.match(studio,/resumeWait\.label/);
assert.match(studio,/resumeWait\.button/);
assert.match(generator,/if\(review\.structural&&review\.numeric\.received>0\)/);
assert.ok(!generator.includes('await clearGeminiPause();continue;'),
 'old full-block-only cooldown reset route must be retired');
console.log('LAB55 PASS: 73/714, 503 -> partial Gemini 200 -> 503 with independent pause, manual early check, auto wake and exact checkpoint reuse.');
