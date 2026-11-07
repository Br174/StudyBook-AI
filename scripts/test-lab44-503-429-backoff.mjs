import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import handler from '../api/editionsV36.js';
import {diagnoseGeminiQuota} from '../api/geminiQuotaV36.js';
import {makeGeminiPause,registerGeminiPause,readGeminiPause,clearGeminiPause,
 quotaDisplayV36} from '../src/lib/geminiQuotaControllerV36.js';
import {progressDiagnostic} from '../src/lib/geminiRecoveryV39.js';
import {generateGeminiEditionsV36} from '../src/lib/generativeEditionsV36.js';

const oldFetch=globalThis.fetch,oldKey=process.env.AI_API_KEY,oldUrl=process.env.AI_API_URL;
process.env.AI_API_KEY='test-lab44-key-private';
process.env.AI_API_URL='https://provider.test.invalid';
const cleanups=async()=>{
 globalThis.fetch=oldFetch;
 if(oldKey===undefined)delete process.env.AI_API_KEY;else process.env.AI_API_KEY=oldKey;
 if(oldUrl===undefined)delete process.env.AI_API_URL;else process.env.AI_API_URL=oldUrl;
 await clearGeminiPause();
};
function recorder(){return {code:200,headers:{},payload:null,setHeader(k,v){this.headers[k]=v;return this},
 status(n){this.code=n;return this},json(j){this.payload=j;return this}};}
async function server(body){const response=recorder();await handler({method:'POST',body},response);return response;}
const example='La norma giuridica disciplina i rapporti sociali.';
try{
 await clearGeminiPause();
 let requests=[];
 globalThis.fetch=async(_url,{body})=>{
   requests.push(JSON.parse(body));
   return new Response(JSON.stringify({error:{status:'UNAVAILABLE',message:'Model overloaded'}}),{status:503});
 };
 const unavailable=await server({source:example,level:'summary'});
 assert.equal(unavailable.code,503);
 assert.equal(unavailable.payload.code,'AI_TEMPORARY_OVERLOAD');
 assert.equal(unavailable.payload.quota.kind,'overload');
 assert.equal(unavailable.payload.quota.httpStatus,503);
 assert.equal(unavailable.payload.quota.retrySource,'local-estimate');
 assert.equal(unavailable.payload.quota.estimated,true);
 assert.equal(unavailable.payload.diagnostic.reason,'PROVIDER_503_OVERLOAD');
 assert.equal(unavailable.payload.diagnostic.httpStatus,503);
 assert.equal(unavailable.payload.diagnostic.providerStatus,'UNAVAILABLE');
 assert.equal(requests.length,1,'503 must not call a second free model immediately');
 assert.equal(unavailable.headers['Retry-After'],undefined,'Never invent provider Retry-After');
 assert.ok(!JSON.stringify(unavailable.payload).includes('test-lab44-key-private'));

 requests=[];
 globalThis.fetch=async(_url,{body})=>{
   requests.push(JSON.parse(body));
   return new Response(JSON.stringify({error:{status:'RESOURCE_EXHAUSTED',message:'Per minute requests limit',
    details:[{'@type':'type.googleapis.com/google.rpc.QuotaFailure',
      violations:[{quotaMetric:'requests_per_minute',quotaId:'free_rpm',quotaValue:15}]}]}}),
      {status:429,headers:{'Retry-After':'75'}});
 };
 const limited=await server({source:example,level:'summary'});
 assert.equal(limited.code,429);
 assert.equal(limited.payload.code,'AI_QUOTA_LIMIT');
 assert.equal(limited.payload.quota.kind,'requests-minute');
 assert.equal(limited.payload.quota.estimated,false);
 assert.equal(limited.payload.quota.retrySource,'provider-header');
 assert.equal(limited.payload.quota.retryAfterSeconds,75);
 assert.equal(limited.payload.diagnostic.reason,'PROVIDER_429_LIMIT');
 assert.equal(limited.headers['Retry-After'],'75');
 assert.equal(requests.length,1,'Project-shared 429 must not spend another request');
 assert.ok(!JSON.stringify(limited.payload).includes('test-lab44-key-private'));

 requests=[];
 globalThis.fetch=async()=> {
   requests.push(1);
   return new Response(JSON.stringify({error:{status:'UNAVAILABLE',message:'Provider busy'}}),
     {status:503,headers:{'Retry-After':'240'}});
 };
 const official=await server({source:example,level:'summary'});
 assert.equal(official.payload.quota.estimated,false);
 assert.equal(official.payload.quota.retryAfterSeconds,240);
 assert.equal(official.headers['Retry-After'],'240');
 assert.equal(requests.length,1);

 let now=Date.parse('2026-11-07T03:20:00Z');
 const quota={kind:'overload',automatic:true,estimated:true,
   retrySource:'local-estimate',retryAfterSeconds:90,httpStatus:503,model:'gemini-3.5-flash-lite'};
 const p1=makeGeminiPause(quota,null,now);
 const p2=makeGeminiPause(quota,p1,now+90_000);
 const p3=makeGeminiPause(quota,p2,now+270_000);
 assert.deepEqual([p1.attempts,p2.attempts,p3.attempts],[1,2,3]);
 assert.deepEqual([Date.parse(p1.retryAt)-now,
  Date.parse(p2.retryAt)-(now+90_000),
  Date.parse(p3.retryAt)-(now+270_000)],[90_000,180_000,360_000]);
 assert.ok(p3.estimated);
 assert.match(quotaDisplayV36(p3),/stima/i);
 assert.match(quotaDisplayV36(p3),/Tentativo 3/);
 let previous=p3;
 for(let i=0;i<16;i++){
   const next=makeGeminiPause(quota,previous,now);
   const delay=Date.parse(next.retryAt)-now;
   assert.ok(delay<=6*3600_000&&delay>=90_000,'Bounded persistent backoff');
   previous=next;
 }
 assert.equal(previous.attempts,19);
 const actual=makeGeminiPause({kind:'requests-minute',automatic:true,
   estimated:false,retrySource:'provider-header',retryAfterSeconds:75,httpStatus:429},null,now);
 assert.equal(Date.parse(actual.retryAt)-now,75_000,'Respect genuine provider hint');

 const stored1=await registerGeminiPause(quota,{now});
 assert.equal(stored1.persistent,true);
 assert.equal((await readGeminiPause({now:now+1000})).kind,'overload');
 const stored2=await registerGeminiPause(quota,{now:now+90001});
 assert.equal(stored2.attempts,2);
 assert.equal(Date.parse(stored2.retryAt)-(now+90001),180_000);
 assert.equal(await readGeminiPause({now:now+90001+181000}),null,'Elapsed pause must permit controlled resume');
 await clearGeminiPause();

 // One already validated paragraph must remain cached when the next is hit by 503.
 const sourceA='La norma disciplina i rapporti sociali.';
 const sourceB='I diritti tutelano la convivenza sociale.';
 const book={canonicalBookMap:{originalFingerprint:'lab44-gemini-503-checkpoint',
   uncertain:[],pages:[{physicalPage:1,sourceStatus:'verified'}]},
   chapters:[{title:'Teoria del diritto',paragraphs:[
     {original:sourceA,sourcePageStart:1,sourcePageEnd:1},
     {original:sourceB,sourcePageStart:1,sourcePageEnd:1}]}]};
 let unavailableB=true,seen=[];
 globalThis.fetch=async(_url,{body})=>{
   const q=JSON.parse(body);seen.push(q);
   if(unavailableB&&q.source===sourceB)
     return new Response(JSON.stringify({code:'AI_TEMPORARY_OVERLOAD',
       quota:{kind:'overload',automatic:true,estimated:true,model:'gemini-3.5-flash-lite',
         retrySource:'local-estimate',retryAfterSeconds:90,httpStatus:503},
       diagnostic:{reason:'PROVIDER_503_OVERLOAD',httpStatus:503,elapsedMs:200,model:'gemini-3.5-flash-lite'}}),{status:503});
   return new Response(JSON.stringify({engine:'ai',sourceVersion:'original',
      editions:{[q.level]:q.source}}),{status:200});
 };
 const first=await generateGeminiEditionsV36(book,{paceMs:0});
 assert.equal(first.complete,false);
 assert.equal(first.verifiedChunkVariants,6,'Previously verified six editions must survive 503');
 assert.equal(first.execution.haltedOn,'AI_TEMPORARY_OVERLOAD');
 assert.equal(first.quota?.estimated,true);
 assert.equal(first.rows[0][0].verified.summary,true);
 assert.equal(first.rows[0][1].verified.summary,false);
 assert.equal(progressDiagnostic(first).kind,'QUOTA_ATTESA');
 assert.match(progressDiagnostic(first).description,/503/);
 const prior=seen.length;
 const stillPaused=await generateGeminiEditionsV36(book,{paceMs:0});
 assert.equal(stillPaused.verifiedChunkVariants,6);
 assert.equal(seen.length,prior,'No calls while pause is active');
 unavailableB=false;await clearGeminiPause(); // Simulates expiry in a deterministic test.
 const second=await generateGeminiEditionsV36(book,{paceMs:0});
 assert.equal(second.complete,true,'Resume failed chunk after provider is healthy');
 assert.equal(seen.length-prior,6,'Never regenerate verified first paragraph');
 assert.ok(!JSON.stringify(first).includes('test-lab44-key-private'));
 console.log('LAB44 PASS: 429 vs 503 typed diagnosis, no immediate shared-quota fallback, actual Retry-After, escalating estimated cooldown, no 90s retry loop, 503 checkpoint resume');
}finally{await cleanups();}
