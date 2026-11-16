#!/usr/bin/env node
// LAB136 offline regression: preview, 2000-page storage, non-progress retries,
// adaptive quality blocks and HTTP503 cooldown. No live AI, billing or secrets.
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import {saveLibraryBook,getLibraryBook,listLibraryBooks,
  saveExplainedCheckpoint} from '../src/lib/library.js';
import {generateExplainedBookV126} from '../src/lib/explainedGeneratorV126.js';
import {EXPLAINED_POLICY_V126,lessonInstructionOnePassV135}
 from '../src/lib/explainedStagesV126.js';
import {composeExplainedSheetsV122} from '../src/lib/explainedLayoutV122.js';
import {buildExplainedEditionViewV122} from '../src/lib/explainedViewV122.js';
import {planStudyAutoResumeV45} from '../src/lib/studyAutoResumeV45.js';

const fp='b'.repeat(64);
const PHRASE='Il mare è calmo e la barca naviga vicino al porto. ';
const book=(n=44,repeat=24)=>({
 canonicalBookMap:{originalFingerprint:fp,pageCount:n,chapters:[],
  pages:Array.from({length:n},(_,i)=>({physicalPage:i+1,
   label:String(i+1),text:PHRASE.repeat(repeat),sourceStatus:'verified',
   widthPt:595,heightPt:842}))},
 chapters:[],
 editionsV36:{version:EXPLAINED_POLICY_V126,sourceFingerprint:fp,
  onePassV135:true,originalPages:n,pages:[],complete:false,status:'partial'}
});
const dbRequest=request=>new Promise((resolve,reject)=>{
 request.onsuccess=()=>resolve(request.result);
 request.onerror=()=>reject(request.error);
});
function fakeResponse(q,short=true){
 return {engine:'ai',repairContractV127:'lab127-automatic-recovery-v1',
  version:EXPLAINED_POLICY_V126,phase:q.phase,model:'gemini-3.1-flash-lite',
  pages:q.pages.map(p=>({id:p.id,glossary:[],
   segments:p.segments.map(s=>({id:s.id,text:short?'Testo troppo breve.':
    PHRASE.repeat(Math.max(1,Math.floor(s.source.length/PHRASE.length/2)))}))}))};
}
const source=book(44),first=source.canonicalBookMap.pages[0];
const draft={id:'p1',sourcePage:1,segments:[
 {id:'p1-s0',text:'Questa pagina spiega che la barca naviga vicino al porto.'}],
 glossary:[],review:{ready:false,issues:['V126_PAGE_REDUCTION_OUT_OF_RANGE']}};
const pending={...source,editionsV36:{...source.editionsV36,
 pages:[draft],verifiedChunkVariants:0,totalChunkVariants:44}};
const layout=composeExplainedSheetsV122(pending);
assert.equal(layout.pages[0].ready,false);
assert.equal(layout.pages[0].draft,true,'A structurally complete draft must be visible');
assert.ok(layout.pages[0].rows.some(r=>r.text?.includes('barca')));
assert.throws(()=>composeExplainedSheetsV122(pending,{requireComplete:true}),
 /non verificata/iu,'Draft must not leak into final PDF');
assert.equal(buildExplainedEditionViewV122(pending).editionReadiness.verifiedPages,0);
assert.ok(lessonInstructionOnePassV135().includes('targetBodyUnits'));
assert.ok(!lessonInstructionOnePassV135().includes('40–60'),
 'Keep the private numerical acceptance band out of Gemini instructions');

// A 2000-page source must be stored ONCE. Each incremental save holds only the
// AI edition and does not clone canonicalBookMap, originalFile or sourceData.
const large=book(2000,3);
const raw='Originale privato '.repeat(12000);
const stored=await saveLibraryBook({id:'lab136-large',fileName:'Manuale.pdf',
 sourceData:{fullText:raw},studyBook:large,
 originalFile:new Blob(['%PDF-LAB136'],{type:'application/pdf'})});
const update={...large.editionsV36,pages:[draft],verifiedChunkVariants:0,
 qualityBlockCharsV136:16000};
await saveExplainedCheckpoint(stored.id,{...large,editionsV36:update});
const handle=await dbRequest(indexedDB.open('studybook-ai',3));
const tx=handle.transaction('bookStudyCheckpoints','readonly');
const persisted=await dbRequest(tx.objectStore('bookStudyCheckpoints').get(stored.id));
handle.close();
assert.ok(persisted.editionV36);
assert.ok(!('studyBook' in persisted),'Checkpoint cannot duplicate source book');
assert.ok(!JSON.stringify(persisted).includes(raw.slice(0,200)));
const hydrated=await getLibraryBook(stored.id);
assert.equal(hydrated.studyBook.canonicalBookMap.pages.length,2000);
assert.equal(hydrated.studyBook.editionsV36.qualityBlockCharsV136,16000);
assert.equal(hydrated.sourceData.fullText,raw);
const listings=await listLibraryBooks({});
assert.equal(listings.length,1);
assert.ok(!('studyBook' in listings[0]));
// Legacy full-book checkpoints must still recover without data loss.
const legacyDb=await dbRequest(indexedDB.open('studybook-ai',3));
const legacyTx=legacyDb.transaction('bookStudyCheckpoints','readwrite');
await dbRequest(legacyTx.objectStore('bookStudyCheckpoints').put({
 id:stored.id,studyBook:{...large,editionsV36:{...update,diagnostics:{legacy:true}}},
 updatedAt:'2026-11-15T12:00:00.000Z'}));
legacyDb.close();
assert.equal((await getLibraryBook(stored.id)).studyBook.editionsV36.diagnostics.legacy,true);
await saveExplainedCheckpoint(stored.id,{...large,editionsV36:update});

// When a large 200 response yields no conforming pages, lower future batch
// size rather than making five duplicate corrections for unchanged drafts.
const oldFetch=globalThis.fetch;
try{
 const calls=[];
 globalThis.fetch=async(_,options)=>{
  const q=JSON.parse(options.body);
  calls.push({phase:q.phase,pages:q.pages.length,
   chars:q.pages.reduce((n,p)=>n+p.segments.reduce((z,s)=>z+s.source.length,0),0),
   ids:q.pages.map(p=>p.id)});
  return {ok:true,status:200,headers:{get:()=>null},
   json:async()=>fakeResponse(q)};
 };
 const response=await generateExplainedBookV126(source);
 assert.equal(calls.some(c=>c.phase==='comprehend'),false);
 assert.ok(calls.length>=3);
 assert.equal(response.qualityBlockCharsV136<40000,true,
  'Poor yield should shrink only FUTURE content batches');
 assert.equal(response.providerRecoveryV128.maxBlockChars,40000,
  'HTTP200 quality backpressure is independent of 503 transport budget');
 assert.equal(response.status,'complete-with-reservations');
 assert.equal(response.verifiedChunkVariants,0,
  'Unverified drafts must never be counted as conforming');
 assert.equal(response.reservedPagesV127.length,44);
 assert.ok(response.pages.every(p=>p?.review?.acceptedWithReserve===true));
 assert.ok(response.pages.every(p=>p.review.sourceTextFallback===true),
  'A trivial one-line draft must fall back to the original, not masquerade as a study explanation');
 assert.equal(response.pages[0].segments[0].text,source.canonicalBookMap.pages[0].text);
 assert.equal(response.repairStateV127.p1.corrections,5);
 assert.ok(calls.length<60,'Do not spin on five unchanged repairs per page');
 assert.ok(calls.every(c=>c.pages>=1));
 // A Gemini 503 must preserve the last safe batch size, remain retryable
 // and never trigger content backpressure.
 globalThis.fetch=async()=>({ok:false,status:503,
  headers:{get:()=>null},json:async()=>({code:'AI_TEMPORARY_OVERLOAD'})});
 const paused=await generateExplainedBookV126(book(4,24));
 assert.equal(paused.status,'quota-paused');
 assert.equal(paused.providerRecoveryV128.maxBlockChars,40000);
 assert.equal(paused.qualityBlockCharsV136,40000);
 assert.ok(planStudyAutoResumeV45(paused,Date.now(),0));
 console.log('LAB136 PASS: visible-but-unverified drafts, lightweight 2000-page checkpoints,');
 console.log('legacy restoration, adaptive quality batches, no duplicate stagnation, 503 recovery.');
}finally{globalThis.fetch=oldFetch;}
