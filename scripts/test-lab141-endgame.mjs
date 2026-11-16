#!/usr/bin/env node
// LAB141 — deterministic 41/44 endgame regression. NO live AI or cost.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {EXPLAINED_POLICY_V126,auditExplainedPageV139}
 from '../src/lib/explainedStagesV126.js';
import {lessonInstructionOnePassV141,lessonPayloadOnePassV141}
 from '../src/lib/explainedTailV141.js';
import {generateExplainedBookV126} from '../src/lib/explainedGeneratorV126.js';
import {reserveAcceptedV127,reservedExplainedPageV127,MAX_CORRECTIONS_V127}
 from '../src/lib/explainedRepairV127.js';
import {planStudyAutoResumeV45} from '../src/lib/studyAutoResumeV45.js';
import {composeExplainedSheetsV122} from '../src/lib/explainedLayoutV122.js';
import explainedV141Handler from '../api/explainedV141.js';
import explainedV140Handler from '../api/explainedV140.js';
const sourceText=Array.from({length:6},()=>('a'.repeat(100))).join('\n');
const goodText='b'.repeat(300);
const badText='c'.repeat(420); // 30% reduction, outside 40-60 private band
const makePage=(n,t=goodText,ready=true,reserve=false)=>({
 id:'p'+n,sourcePage:n,physicalPage:n,label:String(n),
 segments:[{id:'p'+n+'-s0',text:t}],glossary:[],
 review:{ready,issues:ready?[]:['V139_PAGE_REDUCTION_OUT_OF_RANGE'],
  acceptedWithReserve:reserve,sourceTextFallback:false,
  correctionAttempts:reserve?2:0,exactReduction:ready?50:30,
  semanticCertified:false}
});
const sourcePages=Array.from({length:44},(_,i)=>({
 physicalPage:i+1,label:String(i+1),text:sourceText,
 sourceStatus:'verified',widthPt:595,heightPt:842
}));
const fp='a'.repeat(64),state={p42:{initial:true,corrections:2},
 p43:{initial:true,corrections:2},p44:{initial:true,corrections:2}};
const makeBook=(repairState=state)=>({
 canonicalBookMap:{originalFingerprint:fp,pageCount:44,chapters:[],
  pages:sourcePages},
 chapters:[],
 editionsV36:{version:EXPLAINED_POLICY_V126,onePassV135:true,
  sourceFingerprint:fp,status:'quality-review',complete:false,
  originalPages:44,totalChunkVariants:44,
  pages:[
   ...Array.from({length:41},(_,i)=>makePage(i+1)),
   makePage(42,'c'.repeat(90),false),
   makePage(43,badText,false,true),
   makePage(44,badText,false)
  ],verifiedChunkVariants:41,acceptedWithReserveV127:0,
  draftUnitsSaved:44,repairStateV127:repairState}
});
const mockRes=()=>({statusCode:200,headers:{},data:null,
 setHeader(k,v){this.headers[k]=v;return this},
 status(n){this.statusCode=n;return this},
 json(d){this.data=d;return d}});
const oldFetch=globalThis.fetch;
try{
 assert.equal(MAX_CORRECTIONS_V127,5,'Legacy maximum stays unchanged');
 const source={id:'p1',segments:[{id:'p1-s0',source:sourceText}],
  sourceLineCount:6};
 const rejected=makePage(1,badText,false);
 assert.equal(auditExplainedPageV139(source,rejected).ready,false);
 const fastReserve=reservedExplainedPageV127(source,rejected,
  {corrections:2},{terminalCorrectionLimit:2});
 assert.equal(fastReserve.review.correctionAttempts,2);
 assert.equal(fastReserve.review.ready,false);
 assert.equal(fastReserve.review.fastTerminalV141,true);
 assert.equal(reserveAcceptedV127(source,fastReserve),true);
 assert.equal(reserveAcceptedV127(source,
  reservedExplainedPageV127(source,rejected,{corrections:2})),false,
  'An old legacy five-attempt reserve must not become terminal at two');
 assert.equal(reserveAcceptedV127(source,
  reservedExplainedPageV127(source,rejected,{corrections:5})),true);
 const fallback=reservedExplainedPageV127(source,makePage(1,'x',false),
  {corrections:2},{terminalCorrectionLimit:2});
 assert.equal(fallback.review.sourceTextFallback,true);
 assert.equal(fallback.segments[0].text,sourceText);
 assert.equal(reserveAcceptedV127(source,fallback),true,
  'A source-identical fallback is readable WITH RESERVE, not 50% conforming');
 assert.equal(fallback.review.ready,false);
 assert.ok(!lessonInstructionOnePassV141().includes('40–60'));
 assert.ok(lessonInstructionOnePassV141().includes('CORREZIONE MIRATA'));

 const input=[{id:'p42',sourceLineCount:6,
  segments:[{id:'p42-s0',source:sourceText}],repair:{
   previousDraft:{segments:[{id:'p42-s0',text:badText}],glossary:[]},
   previousReduction:30,correctionCycle:2,correctionStrategy:'guidata',
   issueCodes:['V139_PAGE_REDUCTION_OUT_OF_RANGE']}}];
 const numeric=lessonPayloadOnePassV141(input,[],1).pages[0];
 assert.equal(numeric.repair.previousBodyUnits,420);
 assert.equal(numeric.repair.targetBodyUnits,300);
 assert.equal(numeric.repair.lengthDirection,'shorten');
 assert.equal(numeric.repair.lengthAdjustmentUnits,120);
 assert.equal(numeric.targetBodyUnits,300);
 assert.equal(lessonPayloadOnePassV141(input,[],1.1).pages[0].repair.targetBodyUnits,
  330,'Scaled numerical guidance must agree with page target');
 assert.ok(!JSON.stringify(numeric).includes('acceptanceMinimum'));

 const head141=mockRes();
 await explainedV141Handler({method:'HEAD',env:{}},head141);
 assert.equal(head141.statusCode,405);
 assert.equal(head141.headers['X-StudyBook-Tail-Contract'],
  'lab141-endgame-two-repairs-one-pass-v1');
 const head140=mockRes();
 await explainedV140Handler({method:'HEAD',env:{}},head140);
 assert.ok(!('X-StudyBook-Tail-Contract' in head140.headers),
  'Previously installed LAB140 contract must remain unchanged');

 // Reproduce the exact 41/44 deadlock from LAB140: three retained pages
 // already exhausted a TWO-correction budget but the old five-attempt
 // reservation gate refused them. LAB141 MUST finish LOCALLY without Gemini.
 let calls=0;
 globalThis.fetch=async()=>{calls++;throw Error('No network permitted during migration');};
 const migrated=await generateExplainedBookV126(makeBook(),{
  fastLengthV139:true,glossaryPrecisionV140:true,tailReliableV141:true});
 assert.equal(calls,0,'Do not re-request exhausted final pages');
 assert.equal(migrated.complete,true);
 assert.equal(migrated.status,'complete-with-reservations');
 assert.equal(migrated.verifiedChunkVariants,41);
 assert.equal(migrated.acceptedWithReserveV127,3);
 assert.equal(migrated.reservedPagesV127.length,3);
 assert.equal(migrated.blockedCells,0);
 assert.equal(migrated.diagnostics.qualityReview,0,
  'All 41 valid pages must NOT be re-counted as missing understanding');
 assert.equal(planStudyAutoResumeV45(migrated,Date.now(),0),null,
  'Completed WITH RESERVATIONS cannot trigger another endless wake');
 assert.equal(migrated.pages[41].review.sourceTextFallback,true);
 assert.equal(migrated.pages[41].review.ready,false);
 assert.ok(migrated.pages.slice(0,41).every(p=>p.review.ready===true));
 assert.ok(migrated.pages.slice(41).every(p=>p.review.ready===false));
 assert.ok(composeExplainedSheetsV122({
  ...makeBook(),editionsV36:migrated},{requireComplete:true}).pages.length>=44,
  'Partial noncompliant pages must be readable and reported, not silently omitted');

 // When the final three still have ONE correction available, the app must
 // request ONLY pages 42-44 in ONE existing fast Gemini batch, with 300-unit
 // per-page guidance and 3 pages conforming after one response.
 const oneTry={p42:{initial:true,corrections:1},
  p43:{initial:true,corrections:1},p44:{initial:true,corrections:1}};
 const book=makeBook(oneTry);
 // All three drafts in this scenario still have exactly ONE real correction
 // available; none has been finalized with reserve in its saved review.
 book.editionsV36.pages[42].review.acceptedWithReserve=false;
 book.editionsV36.pages[42].review.correctionAttempts=1;
 const routes=[];
 globalThis.fetch=async(url,options)=>{
  const payload=JSON.parse(options.body);
  routes.push({url,ids:payload.pages.map(p=>p.id)});
  return {ok:true,status:200,headers:{get:()=>null},
   json:async()=>({engine:'ai',version:EXPLAINED_POLICY_V126,
    phase:'explain',repairContractV127:'lab127-automatic-recovery-v1',
    pages:payload.pages.map(p=>({id:p.id,glossary:[],
     segments:p.segments.map(s=>({id:s.id,text:goodText}))}))})};
 };
 const completed=await generateExplainedBookV126(book,{
  fastLengthV139:true,glossaryPrecisionV140:true,tailReliableV141:true});
 assert.equal(routes.length,1,'No slow extra call or unnecessary repeated passes');
 assert.ok(routes[0].url.includes('/api/explained/v141'));
 assert.deepEqual(routes[0].ids,['p42','p43','p44']);
 assert.equal(completed.complete,true);
 assert.equal(completed.status,'complete');
 assert.equal(completed.verifiedChunkVariants,44);
 assert.equal(completed.acceptedWithReserveV127,0);
 assert.ok(completed.pages.every(p=>p.review.ready===true));
 assert.equal(completed.diagnostics.qualityReview,0);

 // The same final attempt can still miss 50%: finish honestly with THREE
 // reservations rather than stalling forever at 41/44 or adding calls.
 const stillBad=makeBook(oneTry);
 stillBad.editionsV36.pages[42].review.acceptedWithReserve=false;
 stillBad.editionsV36.pages[42].review.correctionAttempts=1;
 let finalCalls=0;
 globalThis.fetch=async(url,options)=>{
  finalCalls++;
  const payload=JSON.parse(options.body);
  return {ok:true,status:200,headers:{get:()=>null},
   json:async()=>({engine:'ai',version:EXPLAINED_POLICY_V126,
    phase:'explain',repairContractV127:'lab127-automatic-recovery-v1',
    pages:payload.pages.map(p=>({id:p.id,glossary:[],
     segments:p.segments.map(seg=>({id:seg.id,text:badText}))}))})};
 };
 const honest=await generateExplainedBookV126(stillBad,{
  fastLengthV139:true,glossaryPrecisionV140:true,tailReliableV141:true});
 assert.equal(finalCalls,1);
 assert.equal(honest.status,'complete-with-reservations');
 assert.equal(honest.verifiedChunkVariants,41);
 assert.equal(honest.acceptedWithReserveV127,3);
 assert.equal(honest.diagnostics.qualityReview,0);
 assert.equal(planStudyAutoResumeV45(honest,Date.now(),0),null);

 // Actual isolated Worker route: previous body of 420, desired 300, model
 // sees ONLY the numerical target and no private acceptance band.
 let providerCalls=0;
 globalThis.fetch=async(url,options)=>{
  const p=JSON.parse(options.body);providerCalls++;
  assert.equal(p.model,'gemini-3.1-flash-lite');
  assert.ok(p.messages[0].content.includes('previousBodyUnits'));
  assert.ok(!p.messages[0].content.includes('40–60'));
  const entry=JSON.parse(p.messages[1].content).pages[0];
  assert.equal(entry.repair.targetBodyUnits,300);
  return {ok:true,status:200,headers:{get:()=>null},
   json:async()=>({choices:[{finish_reason:'stop',
    message:{content:JSON.stringify({pages:[{id:'p42',
     segments:[{id:'p42-s0',text:goodText}],glossary:[]}]})}}]})};
 };
 const out=mockRes();
 await explainedV141Handler({method:'POST',env:{AI_API_KEY:'OFFLINE_TEST'},
  body:{policy:EXPLAINED_POLICY_V126,phase:'explain',onePassV135:true,
   modelCandidate:'gemini-3.1-flash-lite',pages:input,bookContext:[],
   targetScaleV140:1}},out);
 assert.equal(out.statusCode,200);
 assert.equal(out.data.tailReliableV141,true);
 assert.equal(out.data.validated,1);
 assert.equal(providerCalls,1);
 const app=readFileSync('src/AppV15.jsx','utf8');
 assert.ok(app.includes('tailReliableV141:true'));
 console.log('LAB141 PASS: exhausted 41/44 terminal migration without Gemini;');
 console.log('remaining pages 42-44 repaired in one call with 50% guidance;');
 console.log('legacy 5-repair contract, 2-repair limit and reservations intact.');
}finally{globalThis.fetch=oldFetch;}
