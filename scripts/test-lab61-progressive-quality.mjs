// LAB61: actual two-phase runner with 44 physical pages, MULTIPLE semantic
// failures, whole-book numeric precision, 503 resume and bounded bad answers.
// Uses mock Gemini, no key, no paid services.
import assert from 'node:assert/strict';
import {indexedDB as fakeIndexedDB} from 'fake-indexeddb';
import {generateDraftFirstV57} from '../src/lib/draftFirstV57.js';
import {studyPhaseProgressV59} from '../src/lib/studyPhaseProgressV59.js';
import {planStudyAutoResumeV45,autoResumeWakeDecisionV54} from '../src/lib/studyAutoResumeV45.js';
import {clearGeminiPause,readGeminiPause} from '../src/lib/geminiQuotaControllerV36.js';
import {clearGeminiCadenceForTestV58} from '../src/lib/geminiCadenceV58.js';
import {studyLetters,exactRetained} from '../src/lib/studyPillarV38.js';
const oldDb=globalThis.indexedDB,oldFetch=globalThis.fetch;
globalThis.indexedDB=fakeIndexedDB;
const levels=['summary','50','40','30','20','10'];
const original='argomento '.repeat(20).trim();
const book=mark=>({
 title:'44 pagine · test LAB61',studyPillarV38:'studybook-progressive-v38-1',
 canonicalBookMap:{originalFingerprint:mark.repeat(64),pageCount:44,uncertain:[],
  pages:Array.from({length:44},(_,i)=>({physicalPage:i+1,sourceStatus:'verified'}))},
 chapters:[{title:'Libro',pageStart:1,pageEnd:44,paragraphs:Array.from({length:44},(_,i)=>({
  original,sourcePageStart:i+1,sourcePageEnd:i+1}))}]
});
const wrong='testo completamente inventato';
function answer(p,{badPages=[],numeric=false}={}){
 const reps=p.level==='summary'?8:20*(1-Number(p.level)/100);
 return {engine:'ai',version:'integral-v51',level:p.level,
   parts:p.units.map(u=>({
    id:u.id,
    text:badPages.includes(u.pageStart)&&p.level==='summary'?wrong:
      ('argomento '.repeat(reps).trim()+
        (numeric&&p.level==='50'&&u.pageStart===44?'x':''))
   }))};
}
const okay=(p,opts)=>new Response(JSON.stringify(answer(p,opts)),{
 status:200,headers:{'Content-Type':'application/json'}});
const overloaded=()=>new Response(JSON.stringify({
 code:'AI_TEMPORARY_OVERLOAD',error:'Temporary 503',
 quota:{kind:'overload',automatic:true,httpStatus:503,
   retryAfterSeconds:35,estimated:false,retrySource:'provider-header'}
}),{status:503,headers:{'Content-Type':'application/json'}});
try{
 await clearGeminiPause();
 await clearGeminiCadenceForTestV58();
 // Three problematic whole pages, no global approval before real corrections.
 let calls=[],states=[],repairs=0;
 globalThis.fetch=async(url,init)=>{
  const p=JSON.parse(init.body);
  calls.push({phase:p.phase,level:p.level,pages:p.units.map(x=>x.pageStart)});
  if(p.phase==='draft')return okay(p,{badPages:[17,25,38]});
  repairs++;
  if(repairs===1)return okay(p,{badPages:[25,38]});
  return overloaded();
 };
 const b=book('a');
 const paused=await generateDraftFirstV57(b,{onProgress:s=>states.push({
  phase:s.phase,status:s.status,approved:s.verifiedChunkVariants,
  summary:studyPhaseProgressV59({...b,editionsV36:s}).levels[0]?.completed||0
 })});
 assert.equal(paused.status,'quota-paused');
 assert.equal(paused.phase,'repair');
 assert.equal(paused.draftComplete,true);
 assert.equal(paused.draftUnitsSaved,44*6);
 assert.deepEqual(calls.filter(x=>x.phase==='draft').map(x=>x.level),levels);
 assert.equal(calls.filter(x=>x.phase==='draft').length,6);
 assert.equal(calls.filter(x=>x.phase==='repair').length,2);
 assert.deepEqual(calls.filter(x=>x.phase==='repair').map(x=>x.pages),
  [[17,25,38],[25,38]]);
 assert.ok(states.some(x=>x.summary===16),'real first 16 pages approved');
 assert.ok(states.some(x=>x.summary===24),'after page 17 correction 24/44 approved');
 assert.equal(studyPhaseProgressV59({...b,editionsV36:paused}).levels[0].completed,24);
 assert.equal(paused.repairAttemptsV57['summary:17-17'],1);
 assert.equal(paused.repairAttemptsV57['summary:25-25'],1,
  'HTTP 503 must NOT count a second failed attempt');
 assert.equal(paused.repairAttemptsV57['summary:38-38'],1);
 assert.equal(planStudyAutoResumeV45(paused)?.reason,'provider-cooldown');
 assert.ok(await readGeminiPause());
 const before=calls.length;
 await generateDraftFirstV57({...b,editionsV36:paused});
 assert.equal(calls.length,before,'no early Gemini quota request');
 await clearGeminiPause();
 await clearGeminiCadenceForTestV58();
 calls=[];
 globalThis.fetch=async(url,init)=>{
  const p=JSON.parse(init.body);
  calls.push({phase:p.phase,level:p.level,pages:p.units.map(x=>x.pageStart)});
  return okay(p);
 };
 const done=await generateDraftFirstV57({...b,editionsV36:paused});
 assert.equal(done.complete,true,'multi-defect book completes after targeted repairs');
 assert.equal(done.verifiedChunkVariants,44*6);
 assert.equal(done.draftUnitsSaved,44*6);
 assert.deepEqual(calls,[{phase:'repair',level:'summary',pages:[25,38]}],
   'all 264 drafts reused; only remaining two pages corrected');
 for(const level of ['50','40','30','20','10']){
  const full=done.stagedRows.flat().map(x=>x.editions[level]).join(' ');
  assert.equal(studyLetters(full),
   exactRetained(studyLetters(original)*44,Number(level)),
   'exact WHOLE BOOK percent '+level);
 }
 // Unhelpful 200 is retried only within a bounded quality-review policy.
 await clearGeminiPause();await clearGeminiCadenceForTestV58();
 let badCalls=0;
 globalThis.fetch=async(url,init)=>{
  const p=JSON.parse(init.body);
  if(p.phase==='draft')return okay(p,{badPages:[17]});
  badCalls++;return okay(p,{badPages:[17]});
 };
 const q=book('b');
 let state=await generateDraftFirstV57(q);
 assert.equal(state.status,'quality-review');
 assert.equal(state.verifiedChunkVariants,16);
 assert.equal(state.repairAttemptsV57['summary:17-17'],1);
 const auto=planStudyAutoResumeV45(state,Date.now(),0);
 assert.equal(auto?.reason,'quality-continue');
 assert.equal(autoResumeWakeDecisionV54(auto,{now:auto.at-1}),'too-early');
 assert.equal(autoResumeWakeDecisionV54(auto,{now:auto.at+1}),'ready');
 for(let i=2;i<=3;i++){
  state=await generateDraftFirstV57({...q,editionsV36:state});
  assert.equal(state.repairAttemptsV57['summary:17-17'],i);
  assert.equal(state.verifiedChunkVariants,16);
 }
 assert.equal(badCalls,3,'three total attempts, no infinite loop');
 assert.equal(state.execution.remainingBatches,0);
 assert.equal(state.diagnostics.pendingQualityV61.attentionRequired,true);
 assert.equal(planStudyAutoResumeV45(state),null,
   'no auto-loop after exhausting bounded attempts');
 // LAB62 grants ONE recovery on the old exhausted LAB61 checkpoint
 // after the repair strategy changes, never an unbounded rearm.
 state=await generateDraftFirstV57({...q,editionsV36:state});
 assert.equal(badCalls,4,'one targeted retry allowed after new repair strategy');
 assert.equal(state.diagnostics.qualityRecoveryV62?.resetOnce,true);
 for(let i=0;i<3;i++)
   state=await generateDraftFirstV57({...q,editionsV36:state});
 assert.equal(badCalls,6,'no infinite quota usage after one-time recovery');
 assert.equal(state.complete,false,'no false 44/44 for bad pedagogical text');
 // Numeric exact target is a final global gate, NOT a page-by-page quota.
 await clearGeminiPause();await clearGeminiCadenceForTestV58();
 let numericRequests=[],seenProgress=[];
 globalThis.fetch=async(url,init)=>{
  const p=JSON.parse(init.body);
  numericRequests.push({phase:p.phase,level:p.level,
    pages:p.units.map(x=>x.pageStart)});
  return okay(p,{numeric:p.phase==='draft'});
 };
 const n=book('c');
 const numericDone=await generateDraftFirstV57(n,{onProgress:s=>{
  if(s.draftComplete&&s.phase!=='draft'){
   const p=studyPhaseProgressV59({...n,editionsV36:s});
   seenProgress.push({level50:p.levels[1]?.completed,complete:s.complete});
  }
 }});
 assert.equal(numericDone.complete,true,'one extra letter repaired globally');
 assert.ok(seenProgress.some(p=>p.level50===43&&!p.complete),
   'keep final original page pending until whole-book exact length verified');
 assert.deepEqual(numericRequests.filter(x=>x.phase==='repair'),
  [{phase:'repair',level:'50',pages:[44]}]);
 const all50=numericDone.stagedRows.flat().map(r=>r.editions['50']).join(' ');
 assert.equal(studyLetters(all50),exactRetained(studyLetters(original)*44,50));
 let unexpected=0;
 globalThis.fetch=async()=>{unexpected++;throw Error('approved work must not rerun')};
 assert.equal((await generateDraftFirstV57({...n,editionsV36:numericDone})).complete,true);
 assert.equal(unexpected,0);
 console.log('LAB61 PASS: 44-page multi-failure progression 16->24->44, simulated 503 cooldown, two leftover repair pages only, 264 drafts retained, strict edition order, global exact % target, three bounded unhelpful attempts, persistent quality checkpoints, no false approval.');
}finally{
 globalThis.fetch=oldFetch;
 await clearGeminiPause();await clearGeminiCadenceForTestV58();
 if(oldDb===undefined)delete globalThis.indexedDB;
 else globalThis.indexedDB=oldDb;
}
