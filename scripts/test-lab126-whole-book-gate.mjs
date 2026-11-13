#!/usr/bin/env node
// LAB126: deterministic provider-mock regression, no Gemini call, no deploy.
import assert from 'node:assert/strict';
import {studyUnitsV126,lessonInstructionV126,auditExplainedPageV126,
 EXPLAINED_POLICY_V126} from '../src/lib/explainedStagesV126.js';
import {generateExplainedBookV126} from '../src/lib/explainedGeneratorV126.js';
import {originalExplainedPagesV122} from '../src/lib/explainedPolicyV122.js';

const sourceText=[
 'Il sistema giuridico distingue norme di condotta e norme di competenza.',
 'Una norma può vietare un comportamento soltanto a determinate condizioni.',
 'La validità di una norma non coincide necessariamente con la sua efficacia.',
 'Le definizioni e le eccezioni devono essere comprese e conservate.'
].join(' ').repeat(9);
const fingerprint='a'.repeat(64);
const input={canonicalBookMap:{
 originalFingerprint:fingerprint,pageCount:44,chapters:[],
 pages:Array.from({length:44},(_,i)=>({
  physicalPage:i+1,label:String(i+1),text:sourceText,sourceStatus:'verified',
  widthPt:595.28,heightPt:841.89
 }))
}};
const source=originalExplainedPagesV122(input);
let faulty=true;
const calls=[];
const originalFetch=globalThis.fetch;
globalThis.fetch=async(_url,opts)=>{
 const request=JSON.parse(opts.body);
 assert.equal(request.policy,EXPLAINED_POLICY_V126);
 const {phase,pages}=request;
 calls.push({phase,ids:pages.map(p=>p.id),repair:pages.map(p=>p.comprehensionRepair||[])});
 const answer=pages.map(p=>{
  if(phase==='comprehend'){
   return {id:p.id,connections:[],segments:p.segments.map(seg=>({
    id:seg.id,concepts:p.id==='p17'&&faulty?['BAD']:
      [seg.source.slice(0,450),seg.source.slice(451,800)]
   }))};
  }
  return {id:p.id,segments:p.segments.map(seg=>({
   id:seg.id,text:seg.source.slice(0,Math.floor(seg.source.length/2))
  })),glossary:[]};
 });
 return {ok:true,status:200,headers:{get:()=>null},
  json:async()=>({engine:'ai',version:EXPLAINED_POLICY_V126,phase,pages:answer})};
};
try{
 assert.equal(studyUnitsV126('A, B! 123'),4);
 const instruction=lessonInstructionV126().toLowerCase();
 assert.match(instruction,/lettere unicode/);
 assert.doesNotMatch(instruction,/per pagine originali con cinque righe/);
 const first=await generateExplainedBookV126(input,{onProgress:async()=>{}});
 assert.equal(first.comprehensionV126.verifiedPages,43);
 assert.equal(first.verifiedChunkVariants,0);
 assert.equal(calls.filter(x=>x.phase==='explain').length,0,
  'Never explain when the whole-book comprehension gate is incomplete');
 const priorCount=calls.length;
 faulty=false;
 const resumed=await generateExplainedBookV126({...input,editionsV36:first},{
  onProgress:async()=>{}});
 assert.equal(resumed.comprehensionV126.verifiedPages,44);
 const extraUnderstanding=calls.slice(priorCount).filter(x=>x.phase==='comprehend');
 assert.equal(extraUnderstanding.length,1);
 assert.deepEqual(extraUnderstanding[0].ids,['p17']);
 assert.ok(extraUnderstanding[0].repair[0].length>0,
  'Retry must carry the original map failure reason');
 assert.ok(calls.slice(priorCount).some(x=>x.phase==='explain'),
  'Book rewrite must start after all 44 maps are accepted');
 const oneLine={id:'p1',segments:[{id:'p1-s0',
  text:'La legge è importante.'}],glossary:[]};
 const review=auditExplainedPageV126(source[0],oneLine,
  resumed.comprehensionV126.pages[0]);
 assert.equal(review.ready,false);
 assert.ok(review.issues.includes('V126_PAGE_REDUCTION_OUT_OF_RANGE'));
 console.log('LAB126 PASS: 44/44 global understanding gate; one-page targeted resume; no premature explanation; metric and one-line rejection.');
 console.log('Provider calls: simulated only; no Gemini live or Android runtime tests.');
}finally{globalThis.fetch=originalFetch;}
