// LAB67: offline test. No Gemini key or billable request.
// Verify simple but not simplistic text policy, exact-law/math guard,
// persisted legacy 44-page drafts and a single nonblocking phase-two
// recalibration that improves 40% while keeping other editions immutable.
import assert from 'node:assert/strict';
import {indexedDB as fakeIndexedDB} from 'fake-indexeddb';
import {editionRewriteInstructionV67} from '../api/editionsBulkV51.js';
import {immutableFragmentsV67,immutableViolationsV67} from
 '../src/lib/immutableFragmentsV67.js';
import {STUDY_TARGET_V67,editionReductionV67,planRebalanceV67} from
 '../src/lib/studyRebalancePolicyV67.js';
import {rebalanceSavedStudyBookV67,canRebalanceBookV67} from
 '../src/lib/studyRebalanceV67.js';
import {bookUnitsV51} from '../src/lib/integralPlannerV51.js';
import {studyLetters} from '../src/lib/studyPillarV38.js';
import {clearGeminiPause} from '../src/lib/geminiQuotaControllerV36.js';
import {clearGeminiCadenceForTestV58} from '../src/lib/geminiCadenceV58.js';
const levels=['summary','50','40','30','20','10'];
const oldDB=globalThis.indexedDB,oldFetch=globalThis.fetch;
globalThis.indexedDB=fakeIndexedDB;
const norm='Secondo l’art. 3 Cost., «Tutti i cittadini hanno pari dignità sociale».';
const formula='La formula è E=mc². Questa frase spiega la formula per gli studenti.';
const sourceImmutable=norm+' '+formula;
const fragments=immutableFragmentsV67(sourceImmutable);
assert.ok(fragments.some(f=>f.kind==='legal-reference'));
assert.ok(fragments.some(f=>f.kind==='formula'&&f.value==='E=mc²'));
assert.ok(fragments.some(f=>f.kind==='normative-quotation'&&
 f.value==='Tutti i cittadini hanno pari dignità sociale'));
assert.deepEqual(immutableViolationsV67(sourceImmutable,sourceImmutable),[]);
assert.ok(immutableViolationsV67(sourceImmutable,
 'Secondo l’art. 4 Cost., «Tutti hanno pari dignità». Formula E=mc³.')
 .some(x=>x.kind==='invented-legal-reference'));
assert.ok(immutableViolationsV67(sourceImmutable,
 'Secondo l’art. 3 Cost., la formula resta E=mc³.')
 .some(x=>x.kind==='formula'));
assert.ok(immutableViolationsV67(sourceImmutable,
 'Secondo l’art. 3 Cost., «Tutti hanno pari dignità». Formula E=mc².')
 .some(x=>x.kind==='altered-normative-quotation'));
for(const level of levels){
 const cfg=STUDY_TARGET_V67[level];
 const instructions=editionRewriteInstructionV67(
  level,'recalibrate',level==='summary'?null:600,400,1000);
 assert.ok(instructions.includes('PIÙ SEMPLICE'));
 assert.ok(instructions.includes('NON SEMPLICISTICO'));
 assert.ok(instructions.includes('formule')&&instructions.includes('citazioni'));
 assert.ok(instructions.includes(String(cfg.target)+'%'));
}
const source=('Lo studente interpreta una spiegazione articolata e chiarisce le idee. ').repeat(10);
const trimTo=(v,ratio)=>{
 const target=Math.round(studyLetters(v)*ratio);
 const letters=[...v.matchAll(/\p{L}/gu)];
 return v.slice(0,letters[Math.max(0,target-1)]?.index+1||1);
};
const book={
 title:'Filosofia del diritto',studyPillarV38:'studybook-progressive-v38-1',
 canonicalBookMap:{originalFingerprint:'a'.repeat(64),pageCount:44,
  uncertain:[],pages:Array.from({length:44},(_,i)=>({
   physicalPage:i+1,sourceStatus:'verified'}))},
 chapters:[{title:'Capitolo 1',pageStart:1,pageEnd:44,
  paragraphs:Array.from({length:44},(_,i)=>({
   original:source,sourcePageStart:i+1,sourcePageEnd:i+1}))}]
};
const ratios={summary:.40,'50':.50,'40':.85,'30':.70,'20':.80,'10':.90};
const drafts=[Array.from({length:44},()=>({
 editions:Object.fromEntries(levels.map(l=>[l,trimTo(source,ratios[l])]))
}))];
const stage=[Array.from({length:44},(_,i)=>({
 editions:Object.fromEntries(levels.map(l=>[l,
   i<16&&l==='summary'?drafts[0][i].editions.summary:null])),
 verified:Object.fromEntries(levels.map(l=>[l,i<16&&l==='summary'])),
 issues:{},achievedPercent:{}
}))];
book.editionsV36={
 sourceFingerprint:book.canonicalBookMap.originalFingerprint,version:'lab38-progressive-editions-v1',
 complete:true,draftComplete:true,checkpointPersistent:true,phase:'quality',
 publicationModeV66:'generated-text-quality-not-certified',
 draftRowsV57:drafts,stagedRows:stage,rows:stage,
 qualityV66:{},
};
const before=JSON.stringify(book.editionsV36.draftRowsV57);
const units=bookUnitsV51(book);
const targets=planRebalanceV67(units,drafts);
assert.deepEqual(targets.map(x=>x.level),['40']);
assert.equal(canRebalanceBookV67(book),true);
try{
 await clearGeminiPause();await clearGeminiCadenceForTestV58();
 const calls=[],snapshots=[];
 globalThis.fetch=async(_url,options)=>{
  const body=JSON.parse(options.body);
  calls.push(body);
  assert.equal(body.phase,'recalibrate-v70');
  assert.equal(body.level,'40');
  return new Response(JSON.stringify({engine:'ai',version:'integral-v51',
   level:'40',inputTokens:2100,draftProtocol:'lab70-draft-length-v1',
   lengthReview:{sourceLetters:body.units.reduce((n,u)=>n+studyLetters(u.source),0)},
   parts:body.units.map(u=>({id:u.id,text:trimTo(u.source,.60)}))}),
   {status:200,headers:{'Content-Type':'application/json'}});
 };
 const after=await rebalanceSavedStudyBookV67(book,{
  onProgress:async snapshot=>snapshots.push(snapshot)
 });
 assert.equal(calls.length,1,'one Gemini request only for deficient level');
 assert.equal(after.complete,true);
 assert.equal(after.rebalanceV67.accepted,1);
 assert.equal(after.rebalanceV67.remaining.length,0);
 assert.ok(after.qualityV66.levels['40'].actualReduction>=35);
 assert.ok(after.qualityV66.levels['40'].actualReduction<=45);
 assert.deepEqual(after.stagedRows[0].filter(p=>p.verified.summary).length,16);
 assert.deepEqual(after.draftRowsV57[0].map(p=>p.editions.summary),
  drafts[0].map(p=>p.editions.summary),'summary untouched');
 assert.deepEqual(after.draftRowsV57[0].map(p=>p.editions['30']),
  drafts[0].map(p=>p.editions['30']),'30% untouched');
 assert.deepEqual(after.rebalanceV67.backups['40'].length,44);
 assert.ok(snapshots.some(s=>s.rebalanceV67.status==='running'));
 assert.equal(book.editionsV36.draftRowsV57[0][0].editions['40'],
  drafts[0][0].editions['40'],'saved originals not mutated');
 // Completed state must not perform any duplicate provider calls.
 const second=await rebalanceSavedStudyBookV67({...book,editionsV36:after});
 assert.equal(second.complete,true);
 assert.equal(calls.length,1);
 console.log('LAB67 PASS: 44x6 saved, changed only 40%, real reduction within 35-45%; simpler-than-original prompts all levels; exact law/formula protections and old approvals preserved; no phase-3 correction or repeat requests.');
}finally{
 globalThis.fetch=oldFetch;await clearGeminiPause();await clearGeminiCadenceForTestV58();
 if(oldDB===undefined)delete globalThis.indexedDB;
 else globalThis.indexedDB=oldDB;
}
