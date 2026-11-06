import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import {auditGeminiLevels,generateGeminiEditionsV36,GEMINI_LEVELS} from '../src/lib/generativeEditionsV36.js';
import {clearGeminiPause,readGeminiPause} from '../src/lib/geminiQuotaControllerV36.js';
const source='Articolo 7: la regola non cambia, salvo eccezione. La condizione rimane necessaria.';
const good=Object.fromEntries(GEMINI_LEVELS.map(id=>[id,source]));
let audit=auditGeminiLevels(source,good);
assert.ok(GEMINI_LEVELS.every(id=>audit.verified[id]));
assert.equal(audit.achievedPercent['50'],0);
audit=auditGeminiLevels(source,{...good,'50':'La regola cambia.'});
assert.equal(audit.verified['50'],false);
const book={chapters:[{title:'Capitolo 1',pageStart:1,paragraphs:[
 {original:source,sourcePageStart:1,sourcePageEnd:1}
]}],canonicalBookMap:{originalFingerprint:'e'.repeat(64),uncertain:[],pages:[{physicalPage:1,sourceStatus:'verified'}]}};
const oldFetch=globalThis.fetch;let calls=0;
try{
  globalThis.fetch=async(_url,options)=>{
    calls++;
    const data=JSON.parse(options.body);assert.equal(data.source,source);
    return new Response(JSON.stringify({engine:'ai',sourceVersion:'original',editions:good}),
      {status:200,headers:{'Content-Type':'application/json'}});
  };
  const progress=[];
  await clearGeminiPause();
  const first=await generateGeminiEditionsV36(book,{onProgress:(x)=>progress.push(x),maxConcurrency:1,paceMs:0});
  assert.equal(first.complete,true);assert.equal(first.verifiedCells,1);assert.equal(first.rows[0][0].editions['50'],source);
  assert.ok(first.checkpointPersistent);assert.equal(calls,1);
  const again=await generateGeminiEditionsV36(book,{maxConcurrency:1,paceMs:0});
  assert.equal(again.execution.resumedFromCache,1);assert.equal(calls,1);
  const broken={...book,canonicalBookMap:{...book.canonicalBookMap,originalFingerprint:'f'.repeat(64)}};
  globalThis.fetch=async()=>new Response(JSON.stringify({error:'Quota Gemini'}),{status:429,headers:{'Content-Type':'application/json'}});
  const partial=await generateGeminiEditionsV36(broken,{maxConcurrency:1,paceMs:0});
  assert.equal(partial.complete,false);
  assert.equal(partial.rows[0][0].verified['10'],false);
  assert.equal(partial.status,'quota-paused');
  assert.equal(partial.execution.haltedOn,'AI_QUOTA_LIMIT');
  const pause=await readGeminiPause();assert.equal(pause.kind,'unknown');
  const refused=await generateGeminiEditionsV36(broken,{maxConcurrency:1,paceMs:0});
  assert.equal(refused.execution.waves,0,'Do not call Gemini while the persistent pause is active');
  await clearGeminiPause();
  let retryCalls=0;
  const recover={...book,canonicalBookMap:{...book.canonicalBookMap,originalFingerprint:'g'.repeat(64)}};
  globalThis.fetch=async()=>{retryCalls++;const incomplete={...good,'50':'La regola cambia.'};
    return new Response(JSON.stringify({engine:'ai',sourceVersion:'original',editions:incomplete}),
      {status:200,headers:{'Content-Type':'application/json'}});};
  const firstIncomplete=await generateGeminiEditionsV36(recover,{maxConcurrency:1,paceMs:0});
  assert.equal(firstIncomplete.complete,false);
  assert.equal(firstIncomplete.rows[0][0].verified['50'],false);
  assert.equal(retryCalls,2);
  globalThis.fetch=async()=>{retryCalls++;return new Response(JSON.stringify({engine:'ai',sourceVersion:'original',editions:good}),
      {status:200,headers:{'Content-Type':'application/json'}});};
  const fixed=await generateGeminiEditionsV36(recover,{maxConcurrency:1,paceMs:0});
  assert.equal(fixed.complete,true);
  assert.equal(retryCalls,3,'Un checkpoint incompleto deve essere ritentato');
  // Multi-paragraph book: stop after first quota refusal; keep previously verified
  // content; no extra requests until the actual cooldown is over.
  await clearGeminiPause();
  const partSources=[source+' Parte A.',source+' Parte B.',source+' Parte C.'];
  const large={
    chapters:[{title:'Capitolo lungo',pageStart:1,paragraphs:partSources.map(t=>({
      original:t,sourcePageStart:1,sourcePageEnd:1
    }))}],
    canonicalBookMap:{originalFingerprint:'h'.repeat(64),uncertain:[],
      pages:[{physicalPage:1,sourceStatus:'verified'}]}
  };
  let multiCalls=0;
  globalThis.fetch=async(_url,opts)=>{
    multiCalls++;
    const text=JSON.parse(opts.body).source;
    if(multiCalls===2)return new Response(JSON.stringify({
      error:'Quota al minuto',code:'AI_QUOTA_LIMIT',
      quota:{kind:'requests-minute',automatic:true,estimated:false,retryAfterSeconds:120}
    }),{status:429,headers:{'Content-Type':'application/json'}});
    return new Response(JSON.stringify({engine:'ai',sourceVersion:'original',
      editions:Object.fromEntries(GEMINI_LEVELS.map(id=>[id,text]))}),
      {status:200,headers:{'Content-Type':'application/json'}});
  };
  const stopped=await generateGeminiEditionsV36(large,{paceMs:0,maxConcurrency:1});
  assert.equal(multiCalls,2);
  assert.equal(stopped.status,'quota-paused');
  assert.equal(stopped.rows[0][0].verified['10'],true);
  assert.equal(stopped.rows[0][2].verified['10'],false);
  const unchanged=await generateGeminiEditionsV36(large,{paceMs:0,maxConcurrency:1});
  assert.equal(unchanged.execution.waves,0);
  assert.equal(multiCalls,2);
  await clearGeminiPause();
  globalThis.fetch=async(_url,opts)=>{
    multiCalls++;
    const text=JSON.parse(opts.body).source;
    return new Response(JSON.stringify({engine:'ai',sourceVersion:'original',
      editions:Object.fromEntries(GEMINI_LEVELS.map(id=>[id,text]))}),
      {status:200,headers:{'Content-Type':'application/json'}});
  };
  const resumed=await generateGeminiEditionsV36(large,{paceMs:0,maxConcurrency:1});
  assert.equal(resumed.complete,true);
  assert.equal(resumed.execution.resumedFromCache,1);
  assert.equal(multiCalls,4,'Only two unfinished paragraphs may be sent again');
  await clearGeminiPause();

  console.log('LAB36 source-first six editions, semantic rejection, live checkpoint reuse and quota partial status: OK');
}finally{globalThis.fetch=oldFetch;}
