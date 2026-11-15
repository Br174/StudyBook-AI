#!/usr/bin/env node
// LAB132.4 manual Riformula uses EXACTLY one original page and one request.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {checkedOriginalPageV132,requestPageReformulationV132,
 applyApprovedReformulationsV132,auditRiformulaLengthV132} from '../src/lib/pageReformulationV132.js';
import {EXPLAINED_POLICY_V126} from '../src/lib/explainedStagesV126.js';
import {composeExplainedSheetsV122} from '../src/lib/explainedLayoutV122.js';
const fingerprint='a'.repeat(64),phrase='Questa norma descrive le condizioni e le conseguenze di un obbligo.';
const original=Array(20).fill(phrase).join(' ');
const book={canonicalBookMap:{pageCount:33,pages:Array.from({length:33},(_,i)=>({
 physicalPage:i+1,label:String(i+1),sourceStatus:'verified',text:i===32?original:phrase})),
 originalFingerprint:fingerprint,chapters:[]},
 editionsV36:{version:EXPLAINED_POLICY_V126,sourceFingerprint:fingerprint,
 comprehensionV126:{pages:Array.from({length:33},(_,i)=>({
 id:'p'+(i+1),segments:[{id:'p'+(i+1)+'-s0',concepts:[phrase]}],connections:[]}))},
 pages:[{id:'p33',sourcePage:33,segments:[{id:'p33-s0',text:'Pagina iniziale salvata.'}],
 glossary:[],review:{ready:true}}]}};
const frozen=JSON.stringify(book),{source}=checkedOriginalPageV132(book,33);
const oldFetch=globalThis.fetch;
const reply=(status,data)=>({ok:status>=200&&status<300,status,json:async()=>data});
const answer=n=>({mode:'lab132-manual-riformula-v2',engine:'gemini-live',
 sourcePage:33,page:{id:'p33',segments:[{id:'p33-s0',text:Array(n).fill(phrase).join(' ')}],
 glossary:[],review:{ready:false}}});
try{
 for(const [n,reduction] of [[6,70],[10,50],[14,30]]){
  let count=0,body=null;
  globalThis.fetch=async(url,opts)=>{
   count++;assert.ok(url.includes('/api/reformulate/v132'));body=JSON.parse(opts.body);
   return reply(200,answer(n));};
  const result=await requestPageReformulationV132(book,33,{variant:19});
  assert.equal(count,1,'A button tap never retries automatically');
  assert.deepEqual(Object.keys(body).sort(),['mode','page','variant']);
  assert.equal(body.variant,19);
  assert.equal(body.page.id,'p33');
  assert.equal(body.page.segments[0].source,original);
  assert.ok(Math.abs(result.review.reduction-reduction)<1);
  assert.equal(result.review.ready,true);
  const applied=applyApprovedReformulationsV132(book,{
   sourceFingerprint:fingerprint,accepted:{'33':result}});
  assert.equal(applied.editionsV36.pages[0].segments[0].text,answer(n).page.segments[0].text);
  assert.ok(composeExplainedSheetsV122(applied).pages.some(p=>p.sourcePage===33&&p.ready));
  assert.equal(JSON.stringify(book),frozen,'No original text is overwritten');
 }
 let count=0;
 globalThis.fetch=async()=>{count++;return reply(200,answer(10));};
 await requestPageReformulationV132(book,33);
 assert.equal(count,1);
 await requestPageReformulationV132(book,33);
 assert.equal(count,2,'Only a second user tap causes second request');
 for(const status of [429,503]){
  count=0;globalThis.fetch=async()=>{count++;return reply(status,{code:'AI_QUOTA_LIMIT',error:'Quota'});};
  await assert.rejects(()=>requestPageReformulationV132(book,33));
  assert.equal(count,1);
 }
 const aborted=new AbortController();aborted.abort();count=0;
 globalThis.fetch=async()=>{count++;throw Error('Unexpected fetch');};
 await assert.rejects(()=>requestPageReformulationV132(book,33,{signal:aborted.signal}),
  e=>e.name==='AbortError');
 assert.equal(count,0);
 const ui=readFileSync('src/components/ExplainedReaderV122.jsx','utf8');
 assert.ok(ui.includes('Tieni versione corrente'));
 assert.ok(ui.includes("setCandidate(null);setRewriteError('');"));
 assert.ok(!ui.includes('deleteReformulationsV132('));
 assert.ok(ui.includes('variant:++rewriteVariant.current'));
 assert.ok(auditRiformulaLengthV132(source,answer(10).page).ready);
 console.log('LAB132.4 PASS client: original-only, 30/50/70, manual retry, old version kept.');
}finally{globalThis.fetch=oldFetch;}
