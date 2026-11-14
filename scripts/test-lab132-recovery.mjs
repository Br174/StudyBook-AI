#!/usr/bin/env node
// LAB132 regression: only local synthetic books and network mocks; no Gemini charges.
import assert from 'node:assert/strict';
import {checkedOriginalPageV132,requestPageReformulationV132,
 reformulationFeedbackV132} from '../src/lib/pageReformulationV132.js';
import {EXPLAINED_POLICY_V126} from '../src/lib/explainedStagesV126.js';
const fingerprint='a'.repeat(64),target=33;
const pages=Array.from({length:33},(_,i)=>({
 physicalPage:i+1,label:String(i+1),sourceStatus:'verified',
 text:i+1===target?'La norma indica che cosa è necessario fare.':'Testo di controllo.'
}));
const book={canonicalBookMap:{pageCount:33,pages,originalFingerprint:fingerprint,chapters:[]},
 editionsV36:{version:EXPLAINED_POLICY_V126,sourceFingerprint:fingerprint,
 comprehensionV126:{pages:Array.from({length:33},(_,i)=>i+1===target?{
  id:'p33',segments:[{id:'p33-s0',concepts:['La norma indica che cosa è necessario fare.']}],
  connections:[]
 }:null)}}};
const snapshot=JSON.stringify(book);
assert.equal(checkedOriginalPageV132(book,target).source.physicalPage,target);
const feedback=reformulationFeedbackV132(
 {issues:['V126_PAGE_REDUCTION_OUT_OF_RANGE','V122_PROTECTED_MEANING_MISSING']},
 {issues:['V122_SEGMENT_ORDER_OR_COUNT']});
assert.match(feedback.summary,/riduzione/u);
assert.match(feedback.summary,/fedeltà/u);
assert.match(feedback.summary,/struttura/u);
const previousFetch=globalThis.fetch;
let calls=[],attempts=[];
const invalidResponse={version:EXPLAINED_POLICY_V126,phase:'explain',pages:[{
 id:'p33',segments:[{id:'p33-s0',text:' ' }],glossary:[],
 review:{ready:false,issues:['V126_PAGE_REDUCTION_OUT_OF_RANGE']}
}]};
const reply=(status,body)=>({ok:status>=200&&status<300,status,
 json:async()=>body});
try {
 globalThis.fetch=async(url,options)=>{
  calls.push({url,payload:JSON.parse(options.body)});
  return reply(200,invalidResponse);
 };
 await assert.rejects(
  ()=>requestPageReformulationV132(book,target,{onAttempt:n=>attempts.push(n)}),
  err=>err.code==='V132_PROPOSAL_REJECTED'&&err.attempts===3&&
   /riduzione/u.test(err.message)
 );
 assert.deepEqual(attempts,[1,2,3]);
 assert.equal(calls.length,3,'Bounded three attempts');
 assert.ok(calls.every(call=>call.payload.pages[0].id==='p33'));
 assert.ok(calls.every(call=>call.payload.pages[0].segments[0].source===pages[32].text));
 assert.ok(calls.every(call=>!JSON.stringify(call.payload).includes('previousDraft')));
 assert.ok(calls[1].payload.pages[0].repair.issueCodes.includes('V126_PAGE_REDUCTION_OUT_OF_RANGE'));
 assert.ok(!JSON.stringify(calls).includes('40–60'),'Private bands stay local');
 calls=[];
 globalThis.fetch=async()=>{
  calls.push(1);
  return reply(429,{code:'AI_QUOTA_LIMIT',error:'Limite Gemini raggiunto',retryAfterSeconds:90});
 };
 await assert.rejects(
  ()=>requestPageReformulationV132(book,target),
  err=>err.code==='AI_QUOTA_LIMIT'&&err.retryAfterSeconds===90
 );
 assert.equal(calls.length,1,'No automatic retry after 429');
 calls=[];
 globalThis.fetch=async()=>{
  calls.push(1);
  return reply(503,{code:'AI_TEMPORARY_OVERLOAD',error:'Gemini occupato'});
 };
 await assert.rejects(
  ()=>requestPageReformulationV132(book,target),
  err=>err.code==='AI_TEMPORARY_OVERLOAD'
 );
 assert.equal(calls.length,1,'No automatic retry after 503');
 calls=[];
 const controller=new AbortController();controller.abort();
 globalThis.fetch=async()=>{calls.push(1);throw Error('Should not fetch');};
 await assert.rejects(
  ()=>requestPageReformulationV132(book,target,{signal:controller.signal}),
  err=>err.name==='AbortError'
 );
 assert.equal(calls.length,0,'Abort before network');
 calls=[];
 globalThis.fetch=async()=>{
  calls.push(1);
  return reply(200,{version:EXPLAINED_POLICY_V126,phase:'explain',pages:[{
   ...invalidResponse.pages[0],id:'p34',review:{ready:true}
  }]});
 };
 await assert.rejects(
  ()=>requestPageReformulationV132(book,target),
  err=>err.code==='V132_RESPONSE_MISMATCH'
 );
 assert.equal(calls.length,1,'No protocol-mismatch retry');
 assert.equal(JSON.stringify(book),snapshot,'The original book is never mutated');
 console.log('LAB132 recovery PASS: 33/bis source mapping, 3 bounded attempts, diagnostics, 429/503, abort, safe original.');
} finally {
 globalThis.fetch=previousFetch;
}
