#!/usr/bin/env node
// LAB127: deterministic non-network tests. No live Gemini or paid traffic.
import assert from 'node:assert/strict';
import {generateExplainedBookV126} from '../src/lib/explainedGeneratorV126.js';
import {originalExplainedPagesV122} from '../src/lib/explainedPolicyV122.js';
import {auditComprehensionV126,lessonPayloadV126,
 EXPLAINED_POLICY_V126} from '../src/lib/explainedStagesV126.js';
import {reservationReportV127} from '../src/lib/explainedRepairV127.js';
import {planStudyAutoResumeV45} from '../src/lib/studyAutoResumeV45.js';

const PHRASE='Il mare è calmo e la barca naviga vicino al porto. ';
const sourceText=PHRASE.repeat(20);
function makeBook(n,text=sourceText){
 return {canonicalBookMap:{originalFingerprint:'f'.repeat(64),
  pageCount:n,chapters:[],pages:Array.from({length:n},(_,i)=>({
   physicalPage:i+1,label:String(i+1),text,
   sourceStatus:'verified',widthPt:595,heightPt:842}))}};
}
const reply=(phase,pages,code=0)=>code?{
 ok:false,status:code,headers:{get:()=>null},
 json:async()=>({code:code===429?'AI_QUOTA_LIMIT':'V126_OUTPUT_TRUNCATED',
  retryAfterSeconds:90})
}:{
 ok:true,status:200,headers:{get:()=>null},
 json:async()=>({engine:'ai',version:EXPLAINED_POLICY_V126,phase,pages})
};
const calls=[];
const originalFetch=globalThis.fetch;
let mode='mixed',pauseOne=false;
globalThis.fetch=async (_url,options)=>{
 const q=JSON.parse(options.body);
 assert.equal(q.policy,EXPLAINED_POLICY_V126);
 calls.push({phase:q.phase,ids:q.pages.map(p=>p.id),
  cycles:q.pages.map(p=>p.repair?.correctionCycle||0),
  payload:q.pages});
 if(mode==='mixed'&&q.phase==='comprehend'&&q.pages.some(p=>p.id==='p9'))
  return reply(q.phase,[],422);
 if(mode==='quota'&&q.phase==='explain'&&
   q.pages.some(p=>p.repair?.correctionCycle===1)&&!pauseOne){
  pauseOne=true;return reply(q.phase,[],429);
 }
 const pages=q.pages.map(p=>q.phase==='comprehend'?{
  id:p.id,connections:[],
  segments:p.segments.map(s=>({id:s.id,
   concepts:[s.source.slice(0,500)]}))
 }:{
  id:p.id,glossary:[],
  segments:p.segments.map(s=>({id:s.id,
   text:(mode==='quota'&&!p.repair?.correctionCycle)||
    (mode==='mixed'&&
    (p.id==='p5'||p.id==='p6'&&Number(p.repair?.correctionCycle||0)<2))
      ?'Testo non sufficiente.':
    mode==='large'?'Il mare è tranquillo e la barca viaggia vicino al porto.':
      PHRASE.repeat(10)}))
 });
 return reply(q.phase,pages);
};
try{
 const sample=makeBook(1);
 const source=originalExplainedPagesV122(sample);
 assert.equal(source.length,1);
 const lowDensity={id:source[0].id,connections:[],
  segments:source[0].segments.map(s=>({id:s.id,concepts:['Concetto letto.']}))};
 assert.equal(auditComprehensionV126(source[0],lowDensity).ready,true,
  'Reading must not enforce a concept length/coverage gate.');

 mode='mixed';
 const fortyFour=await generateExplainedBookV126(makeBook(44));
 assert.equal(fortyFour.originalPages,44);
 assert.equal(fortyFour.comprehensionV126.verifiedPages,43);
 assert.equal(fortyFour.complete,true,'One failed source map must not block the book.');
 assert.equal(fortyFour.status,'complete-with-reservations');
 assert.deepEqual(fortyFour.reservedPagesV127.map(p=>p.page),[5,9]);
 assert.equal(fortyFour.repairStateV127.p5.corrections,5);
 assert.equal(fortyFour.repairStateV127.p6.corrections,2);
 assert.equal(fortyFour.reservedPagesV127.find(p=>p.page===9).sourceTextFallback,true);
 assert.equal(fortyFour.reservedPagesV127.find(p=>p.page===5).corrections,5);
 assert.equal(calls.some(c=>c.phase==='explain'&&c.ids.includes('p9')),false);
 const correctionCalls=calls.filter(c=>c.phase==='explain'&&c.ids.includes('p5'));
 assert.deepEqual(correctionCalls.map(c=>c.cycles[c.ids.indexOf('p5')]),
  [0,1,2,3,4,5],'No sixth Gemini correction call.');
 const guided=correctionCalls.find(c=>c.cycles.includes(2));
 assert.ok(guided.payload.find(p=>p.id==='p5').repair?.previousDraft,
  'The previous incorrect draft must be delivered to Gemini.');
 const guide=guided.payload.find(p=>p.id==='p5');
 const prompt=lessonPayloadV126([guide],[guide.comprehension],[]);
 assert.equal(prompt.pages[0].repair.correctionCycle,2);
 assert.ok(prompt.pages[0].repair.previousDraft.segments.length);
 assert.ok(!JSON.stringify(prompt).includes('40–60'),
  'Private acceptance bands must not be disclosed.');

 // Once a book is complete, restart must not touch any page again.
 const countBefore=calls.length;
 const resumed=await generateExplainedBookV126({
  ...makeBook(44),editionsV36:fortyFour});
 assert.equal(resumed.reservedPagesV127.length,2);
 assert.equal(calls.length,countBefore);

 // Quota: no quality-retry budget consumed by HTTP429.
 mode='quota';pauseOne=false;calls.length=0;
 const one=makeBook(1);
 // The first draft is poor; the first correction hits HTTP429.
 const first=await generateExplainedBookV126(one);
 assert.equal(first.status,'quota-paused');
 assert.equal(first.repairStateV127.p1.corrections,0);
 assert.ok(planStudyAutoResumeV45(first,Date.now(),0));
 const second=await generateExplainedBookV126({...one,editionsV36:first});
 assert.equal(second.complete,true);
 assert.equal(second.reservedPagesV127.length,0);
 assert.equal(calls.filter(c=>c.phase==='comprehend').length,1,
  'Provider retry must reuse the comprehension checkpoint.');

 mode='large';calls.length=0;
 const large=await generateExplainedBookV126(makeBook(2000,PHRASE.trim()));
 assert.equal(large.originalPages,2000);
 assert.equal(large.comprehensionV126.verifiedPages,2000);
 assert.equal(large.complete,true);
 assert.equal(reservationReportV127(large.pages).length,0);
 assert.ok(calls.length<200,'2000 short pages should be batched.');
 console.log('LAB127 PASS: 44-page automatic repair, five cycles, transparent fallback,');
 console.log('429 cooldown/checkpoint, 2000-page batch traversal; no real Gemini calls.');
}finally{
 globalThis.fetch=originalFetch;
}
