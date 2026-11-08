// LAB66: 44 physical pages, six editions, 16 old approvals, NO correction.
// Regression target: 264 saved drafts become readable/exportable with a local
// non-blocking QA report. All assertions run without Gemini key or network.
import assert from 'node:assert/strict';
import {indexedDB as fakeIndexedDB} from 'fake-indexeddb';
import {generateDraftFirstV57} from '../src/lib/draftFirstV57.js';
import {studyQualityInspectionV66} from '../src/lib/studyQualityV66.js';
import {bookUnitsV51} from '../src/lib/integralPlannerV51.js';
import {studyPhaseProgressV59} from '../src/lib/studyPhaseProgressV59.js';
import {buildGeminiEditionViewV36} from '../src/lib/editionViewV36.js';
import {planStudyAutoResumeV45} from '../src/lib/studyAutoResumeV45.js';
import {clearGeminiPause} from '../src/lib/geminiQuotaControllerV36.js';
import {clearGeminiCadenceForTestV58} from '../src/lib/geminiCadenceV58.js';
const oldDB=globalThis.indexedDB,oldFetch=globalThis.fetch;
globalThis.indexedDB=fakeIndexedDB;
const levels=['summary','50','40','30','20','10'];
const approved=new Set([3,4,6,7,8,10,11,12,14,15,16,17,22,24,34,44]);
const source='argomento '.repeat(20).trim();
const original=()=>({
 title:'Filosofia del diritto',
 studyPillarV38:'studybook-progressive-v38-1',
 canonicalBookMap:{originalFingerprint:'a'.repeat(64),pageCount:44,
  uncertain:[],pages:Array.from({length:44},(_,i)=>({
    physicalPage:i+1,sourceStatus:'verified'}))},
 chapters:[{title:'Filosofia',pageStart:1,pageEnd:44,
  paragraphs:Array.from({length:44},(_,i)=>({
    original:source,sourcePageStart:i+1,sourcePageEnd:i+1}))}]
});
const drafts=[Array.from({length:44},(_,i)=>({editions:Object.fromEntries(
 levels.map(l=>[l,('argomento '.repeat(l==='summary'?8:
   Math.round(20*(1-Number(l)/100))).trim())+' '+(i+1)]))}))];
const stage=[Array.from({length:44},(_,i)=>({
 editions:Object.fromEntries(levels.map(l=>[l,l==='summary'&&approved.has(i+1)?
  drafts[0][i].editions[l]:null])),
 verified:Object.fromEntries(levels.map(l=>[l,l==='summary'&&approved.has(i+1)])),
 issues:{},achievedPercent:{}
}))];
const book=original();
book.editionsV36={
 version:'lab38-progressive-editions-v1',
 sourceFingerprint:'a'.repeat(64),
 status:'quality-review',phase:'review',complete:false,
 draftComplete:true,draftUnitsSaved:264,draftUnitsTotal:264,
 checkpointPersistent:true,
 quota:{automatic:true,kind:'overload',retryAt:'2099-01-01T00:00:00Z'},
 draftRowsV57:drafts,stagedRows:stage,rows:stage,
 verifiedChunkVariants:16,totalChunkVariants:264,
 diagnostics:{rewritePolicyV65:{policy:'semantic-rewrite-v65'},repairAttempts:{}}};
const snapshotCopy=JSON.stringify(book.editionsV36);
try{
 await clearGeminiPause();await clearGeminiCadenceForTestV58();
 let requests=0;
 globalThis.fetch=async()=>{requests++;throw Error('GEMINI NEVER CALLED IN QUALITY PHASE')};
 const resume=planStudyAutoResumeV45(book.editionsV36);
 assert.equal(resume.reason,'local-quality-audit','quota must not block LOCAL audit');
 let callback=null;
 const state=await generateDraftFirstV57(book,{qualityOnly:true,
  onProgress:s=>{if(s.phase==='quality')callback=s}});
 assert.equal(requests,0,'no provider request');
 assert.equal(state.status,'complete');
 assert.equal(state.phase,'quality');
 assert.equal(state.complete,true);
 assert.equal(state.qualityV66.summary.checkedPages,44*6);
 assert.equal(state.qualityV66.summary.totalPages,44*6);
 assert.equal(state.qualityV66.summary.autoCorrections,0);
 assert.equal(state.qualityV66.summary.geminiRequests,0);
 assert.equal(state.draftUnitsSaved,264);
 assert.equal(state.draftRowsV57[0][0].editions.summary,drafts[0][0].editions.summary);
 assert.deepEqual(state.stagedRows[0].filter(r=>r.verified.summary).length,16,
  'old approvals preserved, never fake additional pedagogical certification');
 assert.deepEqual(state.rows[0].filter(r=>r.verified.summary).length,44,
  'read-only availability bridge exposes all 44 complete pages');
 assert.equal(state.publicationModeV66,'generated-text-quality-not-certified');
 assert.equal(callback?.qualityV66?.summary?.totalPages,264);
 const pb=studyPhaseProgressV59({...book,editionsV36:state});
 assert.equal(pb.phase,'quality');
 assert.deepEqual(pb.levels.map(x=>x.completed),[44,44,44,44,44,44]);
 const reader=buildGeminiEditionViewV36({...book,editionsV36:state},'summary');
 assert.equal(reader.editionReadiness.complete,true);
 assert.equal(reader.editionReadiness.status,'available-with-quality-notes');
 assert.equal(reader.precisionEdition.qualityGuard.status,'generated-quality-not-certified');
 assert.equal(reader.precisionEdition.qualityGuard.semanticCertification,false);
 assert.ok(!reader.chapters[0].paragraphs.some(p=>p.editionPending));
 const before=JSON.stringify(state);
 const onceMore=await generateDraftFirstV57({...book,editionsV36:state},{qualityOnly:true});
 assert.equal(requests,0);
 assert.equal(onceMore.complete,true);
 assert.equal(JSON.stringify(state),before,'quality audit never mutates prior snapshot');
 // An absent page/text cannot be falsely promoted to a complete 44/44.
 const missing=structuredClone(drafts);
 missing[0][0].editions.summary=null;
 const report=studyQualityInspectionV66(book,bookUnitsV51(book),stage,missing);
 assert.equal(report.levels.summary.checked,43);
 assert.equal(report.full,false);
 assert.ok(report.levels.summary.pages[0].warnings.includes('missing-text'));
 assert.equal(report.publicRows[0][0].verified.summary,false);
 // Unmapped pages never count as checked, even if 264 drafts exist.
 const unmapped=structuredClone(book);
 unmapped.chapters[0].paragraphs[43].sourcePageStart=43;
 unmapped.chapters[0].paragraphs[43].sourcePageEnd=43;
 const unmappedReport=studyQualityInspectionV66(
  unmapped,bookUnitsV51(unmapped),stage,drafts);
 assert.equal(unmappedReport.levels.summary.checked,43);
 assert.equal(unmappedReport.full,false);
 assert.ok(unmappedReport.levels.summary.pages[43].warnings.includes(
  'missing-original-page-map'));
 const local=studyQualityInspectionV66(book,bookUnitsV51(book),stage,drafts,
  {persistent:false});
 assert.equal(local.full,false,'unsaved checkpoint cannot be declared complete');
 assert.equal(local.levels.summary.checked,0);
 assert.ok(local.levels.summary.advisory.includes('checkpoint-not-persisted'));
 console.log('LAB66 PASS: 44x6 local QA, 0 Gemini calls, 16 old approvals preserved, 264 drafts readable/exportable, semantic noncertification explicit, unmapped/missing pages fail closed.');
}finally{
 globalThis.fetch=oldFetch;await clearGeminiPause();
 await clearGeminiCadenceForTestV58();
 if(oldDB===undefined)delete globalThis.indexedDB;
 else globalThis.indexedDB=oldDB;
}
