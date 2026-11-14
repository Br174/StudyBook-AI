#!/usr/bin/env node
// Riformula-only LAB132.3 regression: real local code, mocked existing Worker.
import assert from 'node:assert/strict';
import {checkedOriginalPageV132,requestPageReformulationV132,auditRiformulaLengthV132,
 applyApprovedReformulationsV132,RIFORMULA_LENGTH_AUDIT_V132} from '../src/lib/pageReformulationV132.js';
import {EXPLAINED_POLICY_V126} from '../src/lib/explainedStagesV126.js';
import {composeExplainedSheetsV122} from '../src/lib/explainedLayoutV122.js';

const fingerprint='a'.repeat(64);
const phrase='Questa norma indica il significato di un principio ed espone le conseguenze.';
const original=Array(20).fill(phrase).join(' ');
const halfway=Array(10).fill(phrase).join(' ');
const book={canonicalBookMap:{pageCount:33,originalFingerprint:fingerprint,chapters:[],
 pages:Array.from({length:33},(_,i)=>({physicalPage:i+1,label:String(i+1),
 sourceStatus:'verified',text:i===32?original:phrase}))},
 editionsV36:{version:EXPLAINED_POLICY_V126,sourceFingerprint:fingerprint,
 comprehensionV126:{pages:Array.from({length:33},(_,i)=>({
 id:'p'+(i+1),segments:[{id:'p'+(i+1)+'-s0',concepts:[phrase]}],connections:[]}))},
 pages:[{id:'p33',sourcePage:33,segments:[{id:'p33-s0',text:'Testo precedente.'}],
 glossary:[],review:{ready:true}}]}};
const snapshot=JSON.stringify(book);
const {source}=checkedOriginalPageV132(book,33);
const valid={id:'p33',segments:[{id:'p33-s0',text:halfway}],glossary:[],
 review:{ready:false,issues:['V122_LEGAL_GLOSSARY_REQUIRED','V122_PROTECTED_MEANING_MISSING']}};
const invalidLength={...valid,segments:[{id:'p33-s0',text:original}]};
assert.ok(auditRiformulaLengthV132(source,valid).ready,
 'Previous worker semantic rejections must not block this button');
assert.equal(auditRiformulaLengthV132(source,invalidLength).ready,false);
assert.equal(auditRiformulaLengthV132(source,{...valid,id:'p34'}).ready,false);
const previousFetch=globalThis.fetch,seen=[],attempts=[];
const reply=(code,result)=>({ok:code>=200&&code<300,status:code,json:async()=>result});
const wrapped=answer=>({version:EXPLAINED_POLICY_V126,phase:'explain',pages:[answer]});
try{
 globalThis.fetch=async(url,request)=>{
  seen.push(JSON.parse(request.body));
  return reply(200,wrapped(seen.length===1?invalidLength:valid));
 };
 const proposal=await requestPageReformulationV132(book,33,{onAttempt:a=>attempts.push(a)});
 assert.deepEqual(attempts,[1,2]);
 assert.equal(seen.length,2);
 assert.ok(seen.every(p=>p.pages.length===1&&p.pages[0].id==='p33'&&p.pages[0].segments[0].source===original));
 assert.ok(seen.every(p=>!JSON.stringify(p).includes('previousDraft')));
 assert.deepEqual(seen[1].pages[0].repair.issueCodes,['V126_PAGE_REDUCTION_OUT_OF_RANGE']);
 assert.equal(seen[1].pages[0].repair.previousReduction,0);
 assert.equal(proposal.review.reduction,50);
 assert.equal(proposal.review.auditRevision,RIFORMULA_LENGTH_AUDIT_V132);
 assert.equal(proposal.sourcePage,33);
 assert.equal(JSON.stringify(book),snapshot);
 const applied=applyApprovedReformulationsV132(book,{sourceFingerprint:fingerprint,
  accepted:{'33':proposal}});
 assert.equal(applied.editionsV36.pages[0].segments[0].text,halfway);
 assert.ok(composeExplainedSheetsV122(applied).pages.some(p=>p.sourcePage===33&&p.ready),
  'No second semantic gate may hide an accepted Riformula');
 assert.equal(JSON.stringify(book),snapshot);
 seen.length=0;globalThis.fetch=async(url,request)=>{
  seen.push(JSON.parse(request.body));return reply(200,wrapped(invalidLength));};
 await assert.rejects(()=>requestPageReformulationV132(book,33),
  e=>e.code==='V132_LENGTH_NOT_REACHED'&&e.attempts===8);
 assert.equal(seen.length,8,'No unlimited requests on free quota');
 for(const status of [429,503]){
  seen.length=0;globalThis.fetch=async()=>{seen.push(1);return reply(status,{
   code:status===429?'AI_QUOTA_LIMIT':'AI_TEMPORARY_OVERLOAD',error:'Quota provider'});};
  await assert.rejects(()=>requestPageReformulationV132(book,33),
   e=>e.code===(status===429?'AI_QUOTA_LIMIT':'AI_TEMPORARY_OVERLOAD'));
  assert.equal(seen.length,1);
 }
 const ctrl=new AbortController();ctrl.abort();seen.length=0;
 globalThis.fetch=async()=>{seen.push(1);throw Error('Unexpected fetch');};
 await assert.rejects(()=>requestPageReformulationV132(book,33,{signal:ctrl.signal}),
  e=>e.name==='AbortError');
 assert.equal(seen.length,0);
 seen.length=0;globalThis.fetch=async()=>{seen.push(1);return reply(200,wrapped({...valid,id:'p34'}));};
 await assert.rejects(()=>requestPageReformulationV132(book,33),
  e=>e.code==='V132_RESPONSE_MISMATCH');
 assert.equal(seen.length,1);
 seen.length=0;globalThis.fetch=async()=>{seen.push(1);return reply(200,wrapped({...valid,segments:[]}));};
 await assert.rejects(()=>requestPageReformulationV132(book,33),
  e=>e.code==='V132_INVALID_RESPONSE_STRUCTURE');
 assert.equal(seen.length,1);
 console.log('LAB132.3 PASS: single original page, length-only, auto length retry, readable saved result, quota safe, abort, unchanged original.');
}finally{globalThis.fetch=previousFetch;}
