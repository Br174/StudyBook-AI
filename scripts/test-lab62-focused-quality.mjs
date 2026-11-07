// LAB62: no-cost evidence for the real LAB61 failure mode: 44 pages,
// seven chapters, Riassunto frozen 16/44, quality-repair attempts exhausted.
// Do not weaken semantic, source, global-letter or original-PDF safeguards.
import assert from 'node:assert/strict';
import {indexedDB as fakeIndexedDB} from 'fake-indexeddb';
import {repairFocusForUnitV62} from '../src/lib/editionRepairV53.js';
import {generateDraftFirstV57} from '../src/lib/draftFirstV57.js';
import {studyPhaseProgressV59} from '../src/lib/studyPhaseProgressV59.js';
import {progressDiagnostic} from '../src/lib/geminiRecoveryV39.js';
import {planStudyAutoResumeV45} from '../src/lib/studyAutoResumeV45.js';
import {clearGeminiPause} from '../src/lib/geminiQuotaControllerV36.js';
import {clearGeminiCadenceForTestV58} from '../src/lib/geminiCadenceV58.js';

const originalIndexedDB=globalThis.indexedDB;
const oldFetch=globalThis.fetch;
globalThis.indexedDB=fakeIndexedDB;
const levels=['summary','50','40','30','20','10'];
const source='argomento '.repeat(20).trim();
const makeBook=mark=>{
 const sizes=[7,6,5,6,8,5,7];
 let page=0;
 const chapters=sizes.map((size,i)=>{
   const start=page+1;
   const paragraphs=Array.from({length:size},()=>{
     const physicalPage=++page;
     return {original:source,sourcePageStart:physicalPage,
       sourcePageEnd:physicalPage};
   });
   return {title:'Capitolo '+(i+1),pageStart:start,pageEnd:page,paragraphs};
 });
 assert.equal(page,44);
 return {title:'Filosofia del diritto: prova strutturata',
   studyPillarV38:'studybook-progressive-v38-1',
   canonicalBookMap:{pageCount:44,originalFingerprint:mark.repeat(64),
     uncertain:[],pages:Array.from({length:44},(_,i)=>({
       physicalPage:i+1,sourceStatus:'verified'}))},
   chapters};
};
const bad='testo interamente inventato';
const response=(req,broken=false)=>new Response(JSON.stringify({
 engine:'ai',version:'integral-v51',level:req.level,
 parts:req.units.map(u=>({
   id:u.id,text:broken&&req.level==='summary'&&u.pageStart===17?bad:
   'argomento '.repeat(req.level==='summary'?8:20*(1-Number(req.level)/100)).trim()
 }))
}),{status:200,headers:{'Content-Type':'application/json'}});
const counts=(book,snap)=>
 studyPhaseProgressV59({...book,editionsV36:snap}).levels.map(x=>x.completed);

try{
 await clearGeminiPause();
 await clearGeminiCadenceForTestV58();
 const legal='La legge non permette la cessione senza autorizzazione. '+
   'L’articolo 10 del 2021 tutela il patrimonio e le eccezioni previste.';
 const invented='La legge permette la cessione. L’articolo 88 del 2025 '+
   'elimina ogni eccezione prevista.';
 const hint=repairFocusForUnitV62({
   source:legal,summaryCapLetters:90,pageStart:17,pageEnd:17
 },'summary',invented,
 ['source-topic-support-insufficient','new-protected-fact-not-in-source']);
 assert.ok(hint.missingProtected.some(x=>x.value==='non'),
   'source negation cannot silently disappear');
 assert.ok(hint.missingProtected.some(x=>x.kind.startsWith('remove-unsupported')),
   'provider must receive the unsupported newly invented fact');
 assert.ok(hint.highValueContexts.some(x=>x.originalClause.includes('articolo 10')),
   'provider must receive authentic missing source context');
 assert.ok(hint.highValueContexts.every(x=>legal.includes(x.originalClause)),
   'originalClause must be original only, never invented text');
 assert.ok(hint.highValueContexts.length<=5&&hint.missingProtected.length<=14,
   'must fit the deployed LAB57 Worker schema');

 let requests=[];
 globalThis.fetch=async(_url,opts)=>{
   const req=JSON.parse(opts.body);
   requests.push({phase:req.phase,level:req.level,
     pages:req.units.map(u=>u.pageStart)});
   return response(req,true);
 };
 const book=makeBook('a');
 let stopped=await generateDraftFirstV57(book);
 for(let i=0;i<2;i++)
   stopped=await generateDraftFirstV57({...book,editionsV36:stopped});
 assert.equal(stopped.status,'quality-review');
 assert.equal(stopped.draftUnitsSaved,stopped.draftUnitsTotal);
 assert.equal(stopped.draftUnitsTotal,264);
 assert.equal(stopped.verifiedChunkVariants,16,
   'Riassunto must not bypass the bad page at physical 17');
 assert.deepEqual(counts(book,stopped),[16,0,0,0,0,0]);
 assert.equal(stopped.repairAttemptsV57['summary:17-17'],3);
 assert.equal(stopped.diagnostics.pendingQualityV61.attentionRequired,true);
 assert.equal(planStudyAutoResumeV45(stopped),null,
   'old LAB61 cap prevents further quality recovery');
 assert.deepEqual(requests.filter(x=>x.phase==='draft').map(x=>x.level),levels);

 await clearGeminiPause();await clearGeminiCadenceForTestV58();
 const repairedCalls=[];
 globalThis.fetch=async(_url,opts)=>{
   const req=JSON.parse(opts.body);
   repairedCalls.push({phase:req.phase,level:req.level,
     pages:req.units.map(u=>u.pageStart),
     focus:req.repairDrafts?.[0]?.repairFocus});
   return response(req,false);
 };
 const recovered=await generateDraftFirstV57({...book,editionsV36:stopped});
 assert.equal(recovered.complete,true,
   'new focused strategy must complete the stalled 44-page fixture');
 assert.equal(recovered.draftUnitsSaved,264,
   'all saved drafts preserved; no regeneration');
 assert.deepEqual(repairedCalls.map(x=>({phase:x.phase,level:x.level,
   pages:x.pages})),[{phase:'repair',level:'summary',pages:[17]}],
   'repair only first blocked physical page after one-time recovery');
 assert.deepEqual(counts(book,recovered),[44,44,44,44,44,44]);
 assert.equal(recovered.diagnostics.qualityRecoveryV62?.policy,'focused-v62');
 assert.equal(recovered.diagnostics.qualityRecoveryV62?.page,17);
 assert.equal(recovered.diagnostics.qualityRecoveryV62?.resetOnce,true);
 assert.equal(recovered.repairAttemptsV57['summary:17-17'],1);
 let accidental=0;
 globalThis.fetch=async()=>{accidental++;throw new Error('Do not repeat approved work')};
 assert.equal((await generateDraftFirstV57({...book,editionsV36:recovered})).complete,true);
 assert.equal(accidental,0,'fully verified checkpoint never regenerates content');

 // An independent source hash isolates this negative-test cache from the
 // successful recovery above; otherwise cached page17 would preempt the test.
 const blockedBook=makeBook('b');
 const blockedCheckpoint={...stopped,sourceFingerprint:'b'.repeat(64)};
 await clearGeminiPause();await clearGeminiCadenceForTestV58();
 let retryCalls=0,extraDrafts=0;
 globalThis.fetch=async(_url,opts)=>{
   const req=JSON.parse(opts.body);
   if(req.phase==='draft')extraDrafts++;
   else retryCalls++;
   return response(req,true);
 };
 let refusing=await generateDraftFirstV57({
   ...blockedBook,editionsV36:blockedCheckpoint});
 assert.equal(refusing.complete,false);
 assert.deepEqual(counts(blockedBook,refusing),[16,0,0,0,0,0]);
 assert.equal(refusing.repairAttemptsV57['summary:17-17'],1);
 assert.equal(refusing.diagnostics.qualityRecoveryV62?.resetOnce,true);
 const report=progressDiagnostic(refusing);
 assert.ok(report.description.includes('17') &&
   report.description.includes('Riassunto'),
   'quality diagnostics must show first blocked original page');
 for(let i=0;i<3;i++)
   refusing=await generateDraftFirstV57({...blockedBook,editionsV36:refusing});
 assert.equal(refusing.complete,false);
 assert.equal(refusing.repairAttemptsV57['summary:17-17'],3);
 assert.equal(retryCalls,3,'only three bounded attempts after a strategy change');
 assert.equal(extraDrafts,0,'no replay of 264 completed drafts');
 assert.equal(refusing.diagnostics.pendingQualityV62.needsManualReview,true);
 assert.equal(planStudyAutoResumeV45(refusing),null);
 assert.deepEqual(counts(blockedBook,refusing),[16,0,0,0,0,0]);
 console.log('LAB62 PASS: 7 chapters 44 pages, 264 saved drafts, strict 16/44 quality gate, authentic legal/negation/reference hints sent using existing Worker schema, one-time LAB61 rearm only page17, recovery to 44/44, bad provider bounded 3 attempts, no false approval, page-specific explanation.');
}finally{
 globalThis.fetch=oldFetch;
 await clearGeminiPause();
 await clearGeminiCadenceForTestV58();
 if(originalIndexedDB===undefined)delete globalThis.indexedDB;
 else globalThis.indexedDB=originalIndexedDB;
}
