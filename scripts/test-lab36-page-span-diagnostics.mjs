import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import {generateGeminiEditionsV36,GEMINI_LEVELS,sourceWarnings} from '../src/lib/generativeEditionsV36.js';
import {clearGeminiPause} from '../src/lib/geminiQuotaControllerV36.js';

const sample='La regola non cambia, salvo eccezione, e il dato originale rimane verificabile.';
const pages=Array.from({length:6},(_,i)=>({physicalPage:i+1,sourceStatus:'verified'}));
const map={originalFingerprint:'c'.repeat(64),uncertain:[],pages};
assert.deepEqual(sourceWarnings({canonicalBookMap:map},1,4),[],
  'Chapter-wide page spans must not be mistaken for damaged paragraphs');
assert.deepEqual(sourceWarnings({canonicalBookMap:map},2,5),[]);
assert.deepEqual(sourceWarnings({canonicalBookMap:{...map,pages:pages.map((p,i)=>i===3?{...p,sourceStatus:'ocr-pending'}:p)}},1,4),
  ['source-page-not-verified']);
assert.deepEqual(sourceWarnings({canonicalBookMap:map},1,7),['source-page-range-outside-original']);
assert.deepEqual(sourceWarnings({canonicalBookMap:map},null,null),['source-page-owner-unresolved']);

const origFetch=globalThis.fetch;
await clearGeminiPause();
try{
  let calls=0;
  const book={canonicalBookMap:map,chapters:[
    {title:'Capitolo uno',pageStart:1,pageEnd:4,paragraphs:[
      {original:sample,sourcePageStart:1,sourcePageEnd:4}]},
    {title:'Capitolo due',pageStart:5,pageEnd:6,paragraphs:[
      {original:sample+' Ulteriore esempio.',sourcePageStart:5,sourcePageEnd:6}]}
  ]};
  globalThis.fetch=async(_url,options)=>{
    calls++;
    const input=JSON.parse(options.body);
    return new Response(JSON.stringify({engine:'ai',sourceVersion:'original',
      editions:{[input.level]:input.source}}),{status:200,headers:{'Content-Type':'application/json'}});
  };
  const snapshots=[];
  const result=await generateGeminiEditionsV36(book,{paceMs:0,onProgress:s=>snapshots.push(s)});
  assert.equal(result.verifiedVariants,12);
  assert.equal(result.verifiedChunkVariants,12);
  assert.equal(result.complete,true);
  assert.equal(calls,12);
  assert.ok(snapshots.some(s=>s.verifiedChunkVariants>0));
  // A single OCR-pending page blocks only the affected chapter, not the safe one.
  const partiallyUnverified={...book,
    canonicalBookMap:{...map,originalFingerprint:'d'.repeat(64),
      pages:pages.map((p,i)=>i===3?{...p,sourceStatus:'ocr-pending'}:p),
      uncertain:['source-pages-pending']}};
  calls=0;
  const partial=await generateGeminiEditionsV36(partiallyUnverified,{paceMs:0});
  assert.equal(partial.verifiedVariants,6);
  assert.equal(partial.complete,false);
  assert.equal(partial.diagnostics.sourceBlocked,1);
  assert.equal(calls,6);
  // Fatal provider failures must STOP early, not silently spin through all chapters.
  const failBook={...book,canonicalBookMap:{...map,originalFingerprint:'e'.repeat(64)}};
  calls=0;
  globalThis.fetch=async()=>{
    calls++;
    return new Response(JSON.stringify({code:'AI_PROVIDER_400',error:'Provider rejected request'}),
      {status:502,headers:{'Content-Type':'application/json'}});
  };
  const failed=await generateGeminiEditionsV36(failBook,{paceMs:0});
  assert.equal(calls,1);
  assert.equal(failed.status,'provider-blocked');
  assert.equal(failed.execution.haltedOn,'AI_PROVIDER_REJECTED');
  assert.equal(failed.diagnostics.providerErrors,1);
  console.log('LAB36 physical source spans, partial OCR isolation, verified chunks and fail-fast provider diagnostics OK');
}finally{globalThis.fetch=origFetch;await clearGeminiPause();}
