import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import {auditGeminiLevels,generateGeminiEditionsV36,GEMINI_LEVELS} from '../src/lib/generativeEditionsV36.js';
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
  const first=await generateGeminiEditionsV36(book,{onProgress:(x)=>progress.push(x),maxConcurrency:1});
  assert.equal(first.complete,true);assert.equal(first.verifiedCells,1);assert.equal(first.rows[0][0].editions['50'],source);
  assert.ok(first.checkpointPersistent);assert.equal(calls,1);
  const again=await generateGeminiEditionsV36(book,{maxConcurrency:1});
  assert.equal(again.execution.resumedFromCache,1);assert.equal(calls,1);
  const broken={...book,canonicalBookMap:{...book.canonicalBookMap,originalFingerprint:'f'.repeat(64)}};
  globalThis.fetch=async()=>new Response(JSON.stringify({error:'Quota Gemini'}),{status:429,headers:{'Content-Type':'application/json'}});
  const partial=await generateGeminiEditionsV36(broken,{maxConcurrency:1});
  assert.equal(partial.complete,false);
  assert.equal(partial.rows[0][0].verified['10'],false);
  console.log('LAB36 source-first six editions, semantic rejection, live checkpoint reuse and quota partial status: OK');
}finally{globalThis.fetch=oldFetch;}
