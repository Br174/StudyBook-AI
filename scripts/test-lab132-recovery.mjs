#!/usr/bin/env node
// LAB132 manual-only Riformula: exact one Gemini call per tap, always preview.
import assert from 'node:assert/strict';
import {checkedOriginalPageV132,requestPageReformulationV132,auditRiformulaLengthV132,
 applyApprovedReformulationsV132,RIFORMULA_LENGTH_AUDIT_V132} from '../src/lib/pageReformulationV132.js';
import {EXPLAINED_POLICY_V126} from '../src/lib/explainedStagesV126.js';
import {composeExplainedSheetsV122} from '../src/lib/explainedLayoutV122.js';
const fingerprint='a'.repeat(64);
const phrase='Questo principio giuridico descrive una situazione e le sue conseguenze.';
const original=Array(20).fill(phrase).join(' ');
const book={canonicalBookMap:{pageCount:33,originalFingerprint:fingerprint,chapters:[],
 pages:Array.from({length:33},(_,i)=>({physicalPage:i+1,label:String(i+1),
 sourceStatus:'verified',text:i===32?original:phrase}))},
 editionsV36:{version:EXPLAINED_POLICY_V126,sourceFingerprint:fingerprint,
 comprehensionV126:{pages:Array.from({length:33},(_,i)=>({
 id:'p'+(i+1),segments:[{id:'p'+(i+1)+'-s0',concepts:[phrase]}],connections:[]}))},
 pages:[{id:'p33',sourcePage:33,segments:[{id:'p33-s0',text:'Precedente.'}],
 glossary:[],review:{ready:true}}]}};
const snapshot=JSON.stringify(book),{source}=checkedOriginalPageV132(book,33);
const responseText=n=>Array(n).fill(phrase).join(' ');
const response=n=>({id:'p33',segments:[{id:'p33-s0',text:responseText(n)}],glossary:[],
 review:{ready:false,issues:['V122_PROTECTED_MEANING_MISSING']}});
const respond=answer=>({version:EXPLAINED_POLICY_V126,phase:'explain',pages:[answer]});
const reply=(status,body)=>({status,ok:status>=200&&status<300,json:async()=>body});
const previousFetch=globalThis.fetch;
try {
 for(const [n,expected,within] of [[6,70,false],[7,65,false],[10,50,true],[14,30,false]]){
  const audit=auditRiformulaLengthV132(source,response(n));
  assert.equal(audit.ready,true,'Length can never block a valid proposal');
  assert.equal(audit.sizeCompliant,within);
  assert.ok(Math.abs(audit.reduction-expected)<1.5,'Percent must be accurate');
  let calls=0;const seen=[];
  globalThis.fetch=async(url,options)=>{
   calls++;seen.push(JSON.parse(options.body));return reply(200,respond(response(n)));
  };
  const result=await requestPageReformulationV132(book,33);
  assert.equal(calls,1,'Never retry automatically');
  assert.equal(result.review.ready,true);
  assert.equal(result.review.auditRevision,RIFORMULA_LENGTH_AUDIT_V132);
  assert.equal(result.review.sizeCompliant,within);
  assert.equal(seen[0].pages.length,1);
  assert.equal(seen[0].pages[0].segments[0].source,original);
  assert.ok(!JSON.stringify(seen[0]).includes('previousDraft'));
  assert.ok(!JSON.stringify(seen[0]).includes('minReduction'));
  const revised=applyApprovedReformulationsV132(book,{
   sourceFingerprint:fingerprint,accepted:{'33':result}});
  assert.equal(revised.editionsV36.pages[0].segments[0].text,responseText(n));
  assert.ok(composeExplainedSheetsV122(revised).pages.some(p=>p.sourcePage===33&&p.ready));
 }
 // The UI will offer "Riformula ancora" to request an independent fresh draft.
 let requests=0;globalThis.fetch=async()=>{
  requests++;return reply(200,respond(response(7)));
 };
 await requestPageReformulationV132(book,33);
 assert.equal(requests,1);
 await requestPageReformulationV132(book,33);
 assert.equal(requests,2,'Second request occurs only after an explicit invocation');
 for(const status of [429,503]){
  let count=0;
  globalThis.fetch=async()=>{count++;return reply(status,{code:status===429?
   'AI_QUOTA_LIMIT':'AI_TEMPORARY_OVERLOAD',error:'Gemini temporaneamente indisponibile'});};
  await assert.rejects(()=>requestPageReformulationV132(book,33),err=>
   err.code===(status===429?'AI_QUOTA_LIMIT':'AI_TEMPORARY_OVERLOAD'));
  assert.equal(count,1);
 }
 let calls=0;
 globalThis.fetch=async()=>{calls++;return reply(200,respond({...response(10),id:'p34'}));};
 await assert.rejects(()=>requestPageReformulationV132(book,33),e=>e.code==='V132_RESPONSE_MISMATCH');
 assert.equal(calls,1);
 globalThis.fetch=async()=>{calls++;return reply(200,respond({...response(10),segments:[]}));};
 await assert.rejects(()=>requestPageReformulationV132(book,33),e=>e.code==='V132_INVALID_RESPONSE_STRUCTURE');
 assert.equal(calls,2);
 const controller=new AbortController();controller.abort();
 await assert.rejects(()=>requestPageReformulationV132(book,33,{signal:controller.signal}),e=>e.name==='AbortError');
 assert.equal(calls,2);
 assert.equal(JSON.stringify(book),snapshot,'Original book and current text stay untouched');
 console.log('LAB132 manual Riformula PASS: 30/50/65/70 previews, one request per tap, manual retry, source/page, saved view, quota and protocol safety.');
} finally {globalThis.fetch=previousFetch;}
