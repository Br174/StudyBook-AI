// LAB52 regression: exactly the 44/44 acquired, 0/714 verified incident.
// A warning for absent printed page labels must NOT block the first Gemini call.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildCanonicalBookMap} from '../src/lib/libroSpecchioV35.js';
import {classifySourceReadinessV52,generateIntegralEditionsV51} from '../src/lib/generativeIntegralV51.js';
import {indexedDB as fakeIndexedDB} from 'fake-indexeddb';
import {studyLetters} from '../src/lib/studyPillarV38.js';

const hash='f'.repeat(64);
const original='La filosofia del diritto affronta il rapporto tra norma e giustizia. ';
const pages=Array.from({length:44},(_,i)=>({
 pageNumber:i+1,status:'verified',text:original,rawText:original
}));
const paragraphs=pages.map((p,i)=>({
 original:p.text,sourcePageStart:i+1,sourcePageEnd:i+1,sourceSection:'Sezione '+Math.floor(i/11)
}));
const chapters=[{title:'Filosofia del diritto',pageStart:1,pageEnd:44,
  paragraphs,sections:[]}];
const map=buildCanonicalBookMap({
  pages,chapters,outline:[],pageLabels:[],originalFingerprint:hash,pdfPageCount:44,
  visualAnchors:[]
});
assert.ok(map.uncertain.includes('printed-page-numbering-needs-review'));
assert.equal(map.pages.length,44);
assert.equal(classifySourceReadinessV52({canonicalBookMap:map}).ok,true,
  'advisory PDF page-number warnings must not suppress Gemini');
map.uncertain.push('pdf-outline-page-order-uncertain');
map.uncertain.push('pdf-outline-chapter-titles-not-confirmed:2/3');
map.uncertain.push('chapter-title-or-page-unresolved');
assert.equal(classifySourceReadinessV52({canonicalBookMap:map}).ok,true,
  'outline and heading review remains advisory when 44 original pages are verified');
const badMap={...map,pages:map.pages.map(p=>({...p}))};
badMap.pages[3].sourceStatus='text-unavailable';
const bad=classifySourceReadinessV52({canonicalBookMap:badMap});
assert.equal(bad.ok,false,'missing real page text blocks generation');
assert.deepEqual(bad.blockingPages,[4]);
const wrongHash=classifySourceReadinessV52({canonicalBookMap:{...map,
  originalFingerprint:'not-a-sha256'}});
assert.equal(wrongHash.ok,false,'unverified original PDF fingerprint blocks generation');
const badCount=classifySourceReadinessV52({canonicalBookMap:{...map,pageCount:45}});
assert.equal(badCount.ok,false);
const invalidChapter={...map,pages:map.pages};
const invalidUnit=classifySourceReadinessV52({canonicalBookMap:invalidChapter},
  [{pageStart:1,pageEnd:45}]);
assert.equal(invalidUnit.ok,false,'never silently allow source coverage outside original PDF');

const actualFetch=globalThis.fetch,actualDb=globalThis.indexedDB;
globalThis.indexedDB=fakeIndexedDB;
const studyBook={
 title:'Filosofia del diritto appunti+sbobine',
 canonicalBookMap:map,chapters,studyPillarV38:'studybook-progressive-v38-1'};
let calls=0;
globalThis.fetch=async(_url,options)=>{
 assert.ok(String(_url).endsWith('/api/editions/bulk/v51'));
 calls++;
 const body=JSON.parse(options.body);
 const target=body.level==='summary'?null:body.targetLetters;
 let parts=body.units.map(u=>({id:u.id,text:u.source}));
 const repeatUnit='argomento';
 // Mock response fulfills exact global letters while preserving each output id.
 // This verifies the outer executor and source gate, not Gemini semantics.
 if(body.level==='summary')
   parts=body.units.map(u=>({id:u.id,text:repeatUnit}));
 else {
   let remaining=target;
   parts=body.units.map((u,i)=>{
     const n=i===body.units.length-1?remaining:
       Math.floor(target/body.units.length);
     remaining-=n;
     return {id:u.id,text:'a'.repeat(n)};
   });
 }
 return new Response(JSON.stringify({engine:'ai',version:'integral-v51',
   sourceVersion:'original',level:body.level,parts}),{
     status:200,headers:{'Content-Type':'application/json'}});
};
try{
 const statuses=[];
 const result=await generateIntegralEditionsV51(studyBook,{
   onProgress:state=>statuses.push(state)
 });
 // Content in the mock is purposefully not semantically related, so quality
 // must reject it, BUT a request must be made. This is the reported regression.
 assert.ok(calls>0,'Gemini must be called even with harmless structural warnings');
 assert.notEqual(result.status,'source-review-needed');
 assert.ok(statuses.every(s=>s.execution?.haltedOn!=='SOURCE_REVIEW'));
 assert.ok(studyLetters(original)>0);
}finally{
 globalThis.fetch=actualFetch;
 if(actualDb===undefined)delete globalThis.indexedDB;else globalThis.indexedDB=actualDb;
}
const generator=readFileSync(new URL('../src/lib/generativeIntegralV51.js',import.meta.url),'utf8');
assert.ok(!generator.includes("if((map.uncertain||[]).length)return 'SOURCE_REVIEW'"));
assert.ok(generator.includes("&&classifySourceReadinessV52(book).ok"));
console.log('LAB52 PASS: 44/44 source pages, advisory warnings do not prevent Gemini; hard page/sha guards intact.');
