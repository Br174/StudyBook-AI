import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import {generateGeminiEditionsV36,GEMINI_LEVELS} from '../src/lib/generativeEditionsV36.js';
import {clearGeminiPause,readGeminiPause} from '../src/lib/geminiQuotaControllerV36.js';
await clearGeminiPause();
const count=50;
const pages=Array.from({length:count},(_,i)=>({
  physicalPage:i+1,sourceStatus:'verified'}));
const sentences=Array.from({length:count},(_,i)=>
  'Articolo 7: la regola non cambia, salvo eccezione. La condizione rimane necessaria. '+
  'La sezione numero '+(i+1)+' descrive una situazione completa.');
const book={canonicalBookMap:{originalFingerprint:'z'.repeat(64),uncertain:[],pages},
  chapters:[{title:'Manuale di prova',pageStart:1,pageEnd:count,paragraphs:
    sentences.map((original,i)=>({original,sourcePageStart:i+1,sourcePageEnd:i+1}))}]};
let calls=0;
const actualFetch=globalThis.fetch;
try{
  globalThis.fetch=async(_url,options)=>{
    calls++;
    const source=JSON.parse(options.body).source;
    if(calls===8)return new Response(JSON.stringify({code:'AI_QUOTA_LIMIT',error:'RPD temporarily exhausted',
      quota:{kind:'daily',automatic:true,estimated:true,retryAfterSeconds:3600}}),
      {status:429,headers:{'Content-Type':'application/json'}});
    return new Response(JSON.stringify({engine:'ai',sourceVersion:'original',
      editions:Object.fromEntries(GEMINI_LEVELS.map(id=>[id,source]))}),
      {status:200,headers:{'Content-Type':'application/json'}});
  };
  const interrupted=await generateGeminiEditionsV36(book,{maxConcurrency:1,paceMs:0});
  assert.equal(calls,8,'Stop immediately on RPD exhaustion');
  assert.equal(interrupted.complete,false);
  assert.equal(interrupted.status,'quota-paused');
  assert.equal(interrupted.rows[0].filter(x=>x.verified['10']).length,7);
  assert.equal((await readGeminiPause()).kind,'daily');
  const blocked=await generateGeminiEditionsV36(book,{paceMs:0});
  assert.equal(blocked.execution.waves,0);
  assert.equal(calls,8,'No Gemini request before reset');
  await clearGeminiPause();
  const restored=await generateGeminiEditionsV36(book,{maxConcurrency:1,paceMs:0});
  assert.equal(restored.complete,true);
  assert.equal(restored.execution.resumedFromCache,7);
  assert.equal(calls,51,'Seven valid pages reused, only 43 pages regenerated');
  assert.equal(restored.rows[0].length,count);
  for(let i=0;i<count;i++)for(const id of GEMINI_LEVELS){
    assert.equal(restored.rows[0][i].verified[id],true);
    assert.equal(restored.rows[0][i].editions[id],sentences[i]);
  }
  assert.equal(book.chapters[0].paragraphs[0].original,sentences[0]);
  console.log('LAB36 50-page synthetic book: daily quota, persistent reuse, safe resume and all six editions OK');
}finally{globalThis.fetch=actualFetch;await clearGeminiPause();}
