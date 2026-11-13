#!/usr/bin/env node
// LAB127: deterministic provider-mock regression. No live Gemini and no paid calls.
import assert from 'node:assert/strict';
import {studyUnitsV126,auditComprehensionV126,auditExplainedPageV126,
 EXPLAINED_POLICY_V126} from '../src/lib/explainedStagesV126.js';
import {generateExplainedBookV126} from '../src/lib/explainedGeneratorV126.js';
import {originalExplainedPagesV122} from '../src/lib/explainedPolicyV122.js';
import {planStudyAutoResumeV45} from '../src/lib/studyAutoResumeV45.js';

const sourceText=[
 'Il sistema giuridico distingue norme di condotta e norme di competenza.',
 'Una norma può vietare un comportamento soltanto a determinate condizioni.',
 'La validità di una norma non coincide necessariamente con la sua efficacia.',
 'Le definizioni e le eccezioni devono essere comprese e conservate.'
].join(' ').repeat(9);
const makeBook=(count,text=sourceText)=>({canonicalBookMap:{
 originalFingerprint:'a'.repeat(64),pageCount:count,chapters:[],
 pages:Array.from({length:count},(_,i)=>({
  physicalPage:i+1,label:String(i+1),text,sourceStatus:'verified',
  widthPt:595.28,heightPt:841.89
 }))
}});
const calls=[];
let p17BadAttempts=0,splitP22=false;
const originalFetch=globalThis.fetch;
globalThis.fetch=async(_url,opts)=>{
 const {phase,pages,policy}=JSON.parse(opts.body);
 assert.equal(policy,EXPLAINED_POLICY_V126);
 calls.push({phase,ids:pages.map(p=>p.id)});
 if(splitP22&&phase==='comprehend'&&pages.some(p=>p.id==='p22'))
  return {ok:false,status:422,headers:{get:()=>null},
   json:async()=>({code:'V126_OUTPUT_TRUNCATED'})};
 const answer=pages.map(p=>({
  id:p.id,...(phase==='comprehend'?{
    connections:[],segments:p.segments.map(seg=>{
      const bad=p.id==='p17'&&p17BadAttempts++<5;
      return {id:seg.id,concepts:bad?['BAD']:
       [seg.source.slice(0,450),seg.source.slice(450,800)].filter(Boolean)};
    })
   }:{
    segments:p.segments.map(seg=>({id:seg.id,
     text:seg.source.slice(0,Math.floor(seg.source.length/2))})),
    glossary:[]
   })
 }));
 return {ok:true,status:200,headers:{get:()=>null},
  json:async()=>({engine:'ai',version:EXPLAINED_POLICY_V126,phase,pages:answer})};
};
try{
 assert.equal(studyUnitsV126('A, B! 123'),4);
 const input=makeBook(44);
 const source=originalExplainedPagesV122(input);
 const minimal={
  id:source[0].id,connections:[],
  segments:source[0].segments.map(seg=>({id:seg.id,
   concepts:['Il contenuto è stato ricevuto e identificato.']}))
 };
 assert.equal(auditComprehensionV126(source[0],minimal).ready,true,
  'Reading must not impose quantitative or semantic quality gates.');
 let state=await generateExplainedBookV126(input);
 assert.equal(state.comprehensionV126.verifiedPages,43);
 assert.ok(calls.some(c=>c.phase==='explain'&&!c.ids.includes('p17')),
  'Other pages must start rewriting even if one comprehension page failed.');
 assert.ok(!calls.some(c=>c.phase==='explain'&&c.ids.includes('p17')),
  'A page without a technical comprehension map must not be rewritten.');
 assert.ok(state.status==='quality-review');
 const fixed=Number(state.diagnostics?.understandingPending);
 assert.equal(fixed,1);
 for(let i=0;i<4;i++){
  const first=calls.length;
  state=await generateExplainedBookV126({...input,editionsV36:state});
  assert.equal(state.comprehensionV126.verifiedPages,43);
  const retry=calls.slice(first).filter(c=>c.phase==='comprehend');
  assert.equal(retry.length,1);
  assert.deepEqual(retry[0].ids,['p17']);
 }
 const before=calls.length;
 state=await generateExplainedBookV126({...input,editionsV36:state});
 assert.equal(state.comprehensionV126.verifiedPages,44,
  'The fifth user-initiated repair must remain available.');
 assert.deepEqual(calls.slice(before).filter(c=>c.phase==='comprehend')[0]?.ids,['p17']);
 assert.ok(calls.slice(before).some(c=>c.phase==='explain'&&c.ids.includes('p17')));
 assert.equal(auditExplainedPageV126(source[0],{
  id:'p1',segments:source[0].segments.map(s=>({id:s.id,text:'La legge è importante.'})),
  glossary:[]
 },state.comprehensionV126.pages[0]).ready,false,
  'Teaching quality checks must remain on the rewriting stage.');

 // A page returning HTTP422 must split to its own request. Others continue.
 splitP22=true;
 const other=makeBook(44,'Le norme stabiliscono diritti e doveri nelle relazioni.');
 const callIndex=calls.length;
 const failed=await generateExplainedBookV126(other);
 assert.equal(failed.comprehensionV126.verifiedPages,43);
 assert.ok(failed.diagnostics.failedPages.includes(22));
 assert.ok(calls.slice(callIndex).some(c=>c.phase==='explain'&&!c.ids.includes('p22')));
 assert.ok(!calls.slice(callIndex).some(c=>c.phase==='explain'&&c.ids.includes('p22')));
 assert.ok(planStudyAutoResumeV45(failed,Date.now(),0),
  'Single foreground scheduler must offer bounded automatic repair.');
 assert.equal(planStudyAutoResumeV45(failed,Date.now(),2),null,
  'Automatic retries must avoid unbounded quota consumption.');
 splitP22=false;

 // No arbitrary 44-page ceiling: check 2,000 short pages with provider mock.
 const big=makeBook(2000,'La norma descrive un comportamento e le sue condizioni.');
 const large=await generateExplainedBookV126(big);
 assert.equal(large.comprehensionV126.verifiedPages,2000);
 assert.equal(large.originalPages,2000);
 console.log('LAB127 PASS: reading-only technical checks; partial 43/44 continues;');
 console.log('manual repair beyond four retries; failed HTTP422 page isolation;');
 console.log('quality remains on rewriting; 2000-page simulated traversal; no live Gemini.');
}finally{globalThis.fetch=originalFetch;}
