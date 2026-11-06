import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import {generateGeminiEditionsV36,GEMINI_LEVELS,splitGeminiSourceV36}
  from '../src/lib/generativeEditionsV36.js';
import {clearGeminiPause} from '../src/lib/geminiQuotaControllerV36.js';
const source='Articolo 7: la regola non si applica ai minori di 18 anni, salvo specifica eccezione prevista dalla legge. La modifica è del 12 marzo 2026.';
const long=Array.from({length:25},()=>source).join(' ');
const parts=splitGeminiSourceV36(long);
assert.ok(parts.length>2);
assert.ok(parts.every(x=>x.length<=680));
assert.equal(parts.join(' '),long);
const book={canonicalBookMap:{originalFingerprint:'s'.repeat(64),pages:[
  {physicalPage:1,sourceStatus:'verified'}],uncertain:[]},
  chapters:[{title:'Prova di fedeltà',pageStart:1,pageEnd:1,paragraphs:[
    {original:source,sourcePageStart:1,sourcePageEnd:1}
  ]}]};
let calls=[];
const originalFetch=globalThis.fetch;
await clearGeminiPause();
try{
  let quotaSent=false;
  globalThis.fetch=async(_url,opts)=>{
    const body=JSON.parse(opts.body);
    assert.equal(body.source,source);
    assert.ok(GEMINI_LEVELS.includes(body.level));
    calls.push(body.level);
    if(body.level==='30'&&!quotaSent){
      quotaSent=true;
      return new Response(JSON.stringify({code:'AI_QUOTA_LIMIT',
        quota:{kind:'requests-minute',automatic:true,retryAfterSeconds:60,estimated:false},
        error:'Limite temporaneo'}),{status:429,headers:{'Content-Type':'application/json'}});
    }
    return new Response(JSON.stringify({engine:'ai',sourceVersion:'original',
      editions:{[body.level]:source}}),{status:200,headers:{'Content-Type':'application/json'}});
  };
  const first=await generateGeminiEditionsV36(book,{paceMs:0,maxConcurrency:1});
  assert.deepEqual(calls,['10','20','30']);
  assert.equal(first.status,'quota-paused');
  assert.equal(first.verifiedVariants,2);
  assert.equal(first.rows[0][0].verified['10'],true);
  assert.equal(first.rows[0][0].verified['20'],true);
  assert.equal(first.rows[0][0].verified['30'],false);
  const paused=await generateGeminiEditionsV36(book,{paceMs:0,maxConcurrency:1});
  assert.equal(paused.execution.waves,0);
  assert.equal(calls.length,3);
  await clearGeminiPause();
  const fixed=await generateGeminiEditionsV36(book,{paceMs:0,maxConcurrency:1});
  assert.deepEqual(calls,['10','20','30','30','40','50','summary']);
  assert.equal(fixed.verifiedVariants,6);
  assert.equal(fixed.complete,true);
  assert.equal(fixed.rows[0][0].verified['summary'],true);
  const again=await generateGeminiEditionsV36(book,{paceMs:0,maxConcurrency:1});
  assert.equal(again.complete,true);
  assert.equal(calls.length,7);
  console.log('LAB36 real per-edition request plan: quota at 30%, persistent 10%/20%, safe resume and all six editions OK');
}finally{globalThis.fetch=originalFetch;await clearGeminiPause();}
