// LAB69 strictly bounded compression on saved 44-page books.
// No real Gemini request, no paid service, no changes to import flow.
import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {STUDY_TARGET_V67,editionReductionV67,betterReductionV67} from '../src/lib/studyRebalancePolicyV67.js';
import {rebalanceSavedStudyBookV67} from '../src/lib/studyRebalanceV67.js';
import {buildGeminiEditionViewV36} from '../src/lib/editionViewV36.js';
import {studyLetters} from '../src/lib/studyPillarV38.js';
import {clearGeminiPause} from '../src/lib/geminiQuotaControllerV36.js';
import {clearGeminiCadenceForTestV58} from '../src/lib/geminiCadenceV58.js';
const levels=['summary','50','40','30','20','10'];
for(const x of [10,20,30,40,50]){
 const policy=STUDY_TARGET_V67[String(x)];
 assert.deepEqual([policy.min,policy.max],[x-2,x+2]);
 assert.equal(betterReductionV67({within:false,distance:50},
  {within:false,missing:0,measured:25,distance:15}),false,
  'Closer but outside is NOT allowed');
 assert.equal(betterReductionV67({within:false,distance:50},
  {within:true,missing:0,measured:x,distance:0}),true);
}
const text=('La teoria spiega il rapporto fra le regole e la vita sociale. ').repeat(16);
function trimTo(source,reduction){
 const desired=Math.round(studyLetters(source)*(1-reduction/100));
 const matches=[...source.matchAll(/\p{L}/gu)];
 return source.slice(0,(matches[Math.max(0,desired-1)]?.index??0)+1);
}
const original=Array.from({length:44},(_,i)=>({
 original:text,sourcePageStart:i+1,sourcePageEnd:i+1
}));
const allDrafts=[original.map(()=>({
 editions:Object.fromEntries(levels.map(l=>[l,trimTo(text,l==='10'?72:
 l==='summary'?60:Number(l))]))
}))];
const legacy=[original.map((_,i)=>({verified:Object.fromEntries(levels.map(l=>[l,i<16])),
 editions:Object.fromEntries(levels.map(l=>[l,i<16?allDrafts[0][i].editions[l]:null])),
 issues:{},achievedPercent:{}}))];
const makeBook=()=>({
 title:'Test 44 pagine',studyPillarV38:'studybook-progressive-v38-1',
 canonicalBookMap:{originalFingerprint:'b'.repeat(64),pageCount:44,
  pages:original.map((_,i)=>({physicalPage:i+1,sourceStatus:'verified'})),uncertain:[]},
 chapters:[{title:'Capitolo',pageStart:1,pageEnd:44,paragraphs:structuredClone(original)}],
 editionsV36:{
  version:'lab38-progressive-editions-v1',complete:true,draftComplete:true,
  checkpointPersistent:true,sourceFingerprint:'b'.repeat(64),
  publicationModeV66:'generated-text-quality-not-certified',
  draftRowsV57:structuredClone(allDrafts),rows:structuredClone(legacy),
  stagedRows:structuredClone(legacy),
  rebalanceV67:{version:'lab67-source-based-v1',sourceFingerprint:'b'.repeat(64),
   status:'complete-with-notes',completed:{'10':{accepted:true,measured:72}},
   attempted:{'10':true},accepted:1}
 }
});
function mockLengthProof(request,percent){
 const sourceLetters=request.units.reduce((n,u)=>n+studyLetters(u.source),0);
 const outputLetters=request.units.reduce((n,u)=>n+studyLetters(trimTo(u.source,percent)),0);
 const within=percent>=8&&percent<=12;
 return {sourceLetters,observedLetters:outputLetters,withinBand:within,compliant:within};
}
const oldFetch=globalThis.fetch;
try{
 await clearGeminiPause();await clearGeminiCadenceForTestV58();
 const book=makeBook(),calls=[];
 const before=buildGeminiEditionViewV36(book,10);
 // Legacy rows may have sparse approved text, the raw draft measurement is 72%.
 const originalCount=original.reduce((n,p)=>n+studyLetters(p.original),0);
 const oldCount=allDrafts[0].reduce((n,p)=>n+studyLetters(p.editions['10']),0);
 assert.ok(Math.abs(100*(1-oldCount/originalCount)-72)<1);
 globalThis.fetch=async(_,opts)=>{
  const request=JSON.parse(opts.body);
  calls.push(request);
  assert.equal(request.level,'10');
  assert.equal(request.targetLetters>0,true);
  const percent=calls.length===1?40:10;
  return new Response(JSON.stringify({engine:'ai',version:'integral-v51',level:'10',
   inputTokens:1200,draftProtocol:'lab72-canonical-range-observability-v1',finishReason:'stop',outputTokenLimit:6000,
   lengthReview:mockLengthProof(request,percent),
   parts:request.units.map(u=>({id:u.id,text:trimTo(u.source,percent)}))}),{
    status:200,headers:{'Content-Type':'application/json'}
   });
 };
 const snapshots=[];
 const result=await rebalanceSavedStudyBookV67(book,{
  onProgress:async state=>snapshots.push(state)
 });
 assert.equal(calls.length,2,'one extra attempt, then stop');
 assert.deepEqual(calls.map(c=>c.phase),['recalibrate-v72','repair-v72']);
 assert.equal(result.rebalanceV67.version,'lab69-strict-range-v1');
 assert.equal(result.rebalanceV67.accepted,1);
 assert.equal(result.rebalanceV67.remaining.length,0);
 assert.equal(result.rebalanceV67.completed['10'].withinTolerance,true);
 assert.equal(result.qualityV66.levels['10'].checked,44);
 assert.ok(result.qualityV66.levels['10'].actualReduction>=8&&
  result.qualityV66.levels['10'].actualReduction<=12);
 assert.equal(result.qualityV66.levels['50'].actualReduction,50);
 assert.deepEqual(result.draftRowsV57[0].map(x=>x.editions['50']),
  allDrafts[0].map(x=>x.editions['50']));
 assert.deepEqual(result.stagedRows[0].filter(x=>x.verified.summary).length,16);
 assert.deepEqual(book.editionsV36.draftRowsV57,allDrafts,
   'input and old drafts never changed');
 const updatedBook={...book,editionsV36:result};
 const rendered=buildGeminiEditionViewV36(updatedBook,10);
 assert.equal(rendered.precisionEdition.targetReached,true);
 assert.equal(rendered.precisionEdition.reductionCompliant,true);
 // A new request that produces 60% and 72% for the 10% edition
 // must never replace the saved 72% legacy version.
 const badBook=makeBook();
 await clearGeminiCadenceForTestV58();
 let badRequests=0;
 globalThis.fetch=async(_,opts)=>{
  const request=JSON.parse(opts.body);
  badRequests++;
  return new Response(JSON.stringify({engine:'ai',version:'integral-v51',
   level:'10',inputTokens:1200,draftProtocol:'lab72-canonical-range-observability-v1',finishReason:'stop',outputTokenLimit:6000,
   lengthReview:mockLengthProof(request,60),
   parts:request.units.map(u=>({id:u.id,text:trimTo(u.source,60)}))}),{
    status:200,headers:{'Content-Type':'application/json'}
   });
 };
 const rejected=await rebalanceSavedStudyBookV67(badBook);
 assert.equal(badRequests,2);
 assert.equal(rejected.rebalanceV67.accepted,0);
 assert.equal(rejected.rebalanceV67.completed['10'].accepted,false);
 assert.equal(rejected.rebalanceV67.remaining.length,1);
 assert.equal(rejected.rebalanceV67.remaining[0].level,'10');
 assert.deepEqual(rejected.draftRowsV57,badBook.editionsV36.draftRowsV57,
  'Never publish a 60% result as 10% or remove original checkpoint');
 // Next explicit tap must be possible despite legacy accepted/out-of-range status.
 const second=await rebalanceSavedStudyBookV67({...badBook,editionsV36:rejected});
 assert.equal(second.rebalanceV67.version,'lab69-strict-range-v1');
 assert.equal(badRequests,4,'two additional calls only after a second user action');
 const ui=readFileSync(new URL('../src/components/AppScreens.jsx',import.meta.url),'utf8');
 assert.ok(ui.includes('Fuori obiettivo: testo da ricalibrare'));
 assert.ok(ui.includes('Margine '));
 console.log('LAB69 PASS strict ±2 for 10/20/30/40/50; old 72% cannot be accepted as 10%; bounded two trials; legacy 44-page and 16 approvals intact; explicit manual restart permitted.');
}finally{
 globalThis.fetch=oldFetch;
 await clearGeminiPause();await clearGeminiCadenceForTestV58();
}
