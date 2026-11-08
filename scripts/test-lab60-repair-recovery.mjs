// LAB60 no-cost regression: reproduces 16/44 -> HTTP 503 -> cooldown -> resume.
// Also restores LAB59's legacy premature attempt marker, without regenerating
// six drafts or approving any text merely because Gemini returned HTTP 200.
import assert from 'node:assert/strict';
import {indexedDB as fakeIndexedDB} from 'fake-indexeddb';
import {generateDraftFirstV57} from '../src/lib/draftFirstV57.js';
import {studyPhaseProgressV59} from '../src/lib/studyPhaseProgressV59.js';
import {planStudyAutoResumeV45,autoResumeWakeDecisionV54} from '../src/lib/studyAutoResumeV45.js';
import {clearGeminiPause,readGeminiPause} from '../src/lib/geminiQuotaControllerV36.js';
import {clearGeminiCadenceForTestV58} from '../src/lib/geminiCadenceV58.js';

const oldDb=globalThis.indexedDB,oldFetch=globalThis.fetch;
globalThis.indexedDB=fakeIndexedDB;
const levels=['summary','50','40','30','20','10'];
const original='argomento '.repeat(20).trim();
const buildBook=(mark)=>({
 title:'Filosofia del diritto - test 44 pagine',
 studyPillarV38:'studybook-progressive-v38-1',
 canonicalBookMap:{
   originalFingerprint:mark.repeat(64),pageCount:44,uncertain:[],
   pages:Array.from({length:44},(_,i)=>({physicalPage:i+1,sourceStatus:'verified'}))
 },
 chapters:[{title:'Libro',pageStart:1,pageEnd:44,
   paragraphs:Array.from({length:44},(_,i)=>({
     original,sourcePageStart:i+1,sourcePageEnd:i+1
   }))}
 ]
});
function responseFor(p,badDraft=false){
 const reps=p.level==='summary'?8:20*(1-Number(p.level)/100);
 return {engine:'ai',version:'integral-v51',level:p.level,
   parts:p.units.map(u=>({
     id:u.id,text:badDraft&&p.phase==='draft'&&p.level==='summary'&&u.pageStart===17
       ?'testo completamente inventato'
       :'argomento '.repeat(reps).trim()
   }))};
}
const good=(p,bad=false)=>new Response(JSON.stringify(responseFor(p,bad)),{
 status:200,headers:{'Content-Type':'application/json'}});
const overload=()=>new Response(JSON.stringify({
 code:'AI_TEMPORARY_OVERLOAD',error:'Gemini temporarily overloaded',
 quota:{kind:'overload',automatic:true,httpStatus:503,estimated:false,
 retryAfterSeconds:15,retrySource:'provider-header'}
}),{status:503,headers:{'Content-Type':'application/json'}});
let cases=0;
try {
 await clearGeminiPause();
 await clearGeminiCadenceForTestV58();
 for(const legacy of [false,true]){
   cases++;
   const book=buildBook(legacy?'b':'a');
   const initialCalls=[],resumeCalls=[];
   globalThis.fetch=async(_url,options)=>{
     const p=JSON.parse(options.body);
     initialCalls.push({phase:p.phase,level:p.level,
       pages:p.units.map(u=>u.pageStart)});
     if(p.phase==='repair')return overload();
     return good(p,true);
   };
   const paused=await generateDraftFirstV57(book);
   assert.equal(paused.status,'quota-paused','503 pauses, not final approval');
   assert.equal(paused.phase,'repair','all drafts were saved before 503');
   assert.equal(paused.draftComplete,true);
   assert.equal(paused.draftUnitsSaved,44*6);
   assert.deepEqual(initialCalls.slice(0,6).map(x=>x.level),levels);
   assert.equal(initialCalls.filter(x=>x.phase==='draft').length,6);
   assert.equal(initialCalls.filter(x=>x.phase==='repair').length,1);
   assert.deepEqual(initialCalls[6].pages,[17],
     'only physical page 17 is the repair scope');
   assert.equal(paused.verifiedChunkVariants,16,
     '16 independently checked pages survive 503; bad page 17 not approved');
   const repairId='summary:17-17';
   if(legacy)paused.repairAttemptsV57[repairId]=1; // LAB59 defective historical checkpoint
   else assert.equal(paused.repairAttemptsV57[repairId],undefined,
     'LAB60 does not record failed requests as successful');
   // Reproduce the screenshot's 16 verified pages, kept during the recovery.
   const rows=paused.stagedRows[0];
   for(let i=0;i<16;i++){
     rows[i].verified.summary=true;
     rows[i].editions.summary=paused.draftRowsV57[0][i].editions.summary;
   }
   const visible=studyPhaseProgressV59({...book,editionsV36:paused});
   assert.equal(visible.phase,'correction');
   assert.equal(visible.levels[0].completed,16);
   assert.deepEqual(visible.levels.slice(1).map(x=>x.completed),[0,0,0,0,0]);
   const wait=planStudyAutoResumeV45(paused);
   assert.equal(wait?.reason,'local-quality-audit',
     'the one foreground owner finalizes locally when drafts are complete');
   assert.equal(autoResumeWakeDecisionV54(wait,{now:wait.at-1,visible:true}),
     'too-early','retry must not bypass cooldown');
   assert.equal(autoResumeWakeDecisionV54(wait,{now:wait.at+1,visible:false}),
     'foreground-required','Android background cannot trigger duplicate request');
   assert.equal(autoResumeWakeDecisionV54(wait,{now:wait.at+1,visible:true}),
     'ready','automatic foreground wake after cooldown');
   assert.ok(await readGeminiPause(),
     'pause persisted so immediate manual retry cannot storm Gemini');
   const before=initialCalls.length;
   await generateDraftFirstV57({...book,editionsV36:paused});
   assert.equal(initialCalls.length,before,
     'during real 503 cooldown not a single new request is sent');
   await clearGeminiPause(); // deterministic simulation of provider cooldown expiry
   await clearGeminiCadenceForTestV58();
   globalThis.fetch=async(_url,options)=>{
     const p=JSON.parse(options.body);
     resumeCalls.push({phase:p.phase,level:p.level,pages:p.units.map(u=>u.pageStart)});
     return good(p,false);
   };
   const repaired=await generateDraftFirstV57({...book,editionsV36:paused});
   assert.equal(repaired.complete,true,
     'after recovered 503 the 44-page book must reach verified completion');
   assert.equal(repaired.draftUnitsSaved,44*6);
   assert.equal(repaired.verifiedChunkVariants,44*6);
   assert.deepEqual(resumeCalls,[{phase:'repair',level:'summary',pages:[17]}],
     'reuse all six full drafts; retry the single missing page only');
   assert.equal(repaired.repairAttemptsV57[repairId],1);
   if(legacy)assert.equal(repaired.diagnostics.recoveredLegacyRepairV60,repairId,
     'LAB59 failed persisted repair marker is reset once');
   else assert.equal(repaired.diagnostics.recoveredLegacyRepairV60,null);
   assert.equal(studyPhaseProgressV59({...book,editionsV36:repaired}).levels[0].completed,44);
   let unexpected=0;
   globalThis.fetch=async()=>{unexpected++;throw new Error('Do not rerun approved work')};
   const cached=await generateDraftFirstV57({...book,editionsV36:repaired});
   assert.equal(cached.complete,true);
   assert.equal(unexpected,0,'no Gemini call after verified approval');
   await clearGeminiPause();
   await clearGeminiCadenceForTestV58();
 }
 console.log('LAB60 PASS: '+cases+' 503/44-page scenarios, 16/44 preserved, LAB59 legacy marker recovery, no early retry, automatic foreground wake, one targeted page, 6 drafts reused, no false approvals or duplicate calls.');
}finally{
 globalThis.fetch=oldFetch;
 await clearGeminiPause();
 await clearGeminiCadenceForTestV58();
 if(oldDb===undefined)delete globalThis.indexedDB;
 else globalThis.indexedDB=oldDb;
}
