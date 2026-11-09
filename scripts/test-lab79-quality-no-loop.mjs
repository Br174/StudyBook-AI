// LAB79 incident: real user book had 44/44 pages for EACH of six levels,
 // yet stayed forever in Phase 3 because completed local QA looped instead
 // of enabling the targeted correction controller. NO Gemini requests here.
import assert from 'node:assert/strict';
import {finalizeStudyQualityV66} from '../src/lib/studyQualityV66.js';
import {studyPhaseProgressV59} from '../src/lib/studyPhaseProgressV59.js';
import {planStudyAutoResumeV45} from '../src/lib/studyAutoResumeV45.js';
import {
 STUDY_QUALITY_RECOVERY_V79,recoveryActionV79,
 requiresRecalibrationV79,hasFinishedLocalAuditV79
} from '../src/lib/studyQualityRecoveryV79.js';
import {canRebalanceBookV67} from '../src/lib/studyRebalanceV67.js';
import {studyGeometryReviewV78} from '../src/lib/studyGeometryV78.js';
import {pageLetterReviewV74} from '../src/lib/studyPageBudgetsV74.js';

const original="Secondo il diritto, l'interpretazione delle norme richiede il rispetto delle condizioni scritte nella fonte. La data indica quando una regola diventa efficace e il soggetto a cui si applica. Le eccezioni devono essere conservate perché cambiano l'ambito dell'obbligo. Non basta riportare un'affermazione isolata senza controllare la fonte e il suo contesto.";
const short="Le norme hanno delle condizioni.";
const chapters=[{title:'Fonti del diritto',pageStart:1,pageEnd:44,
 paragraphs:Array.from({length:44},(_,i)=>({original,
   sourcePageStart:i+1,sourcePageEnd:i+1}))}];
const fp='a'.repeat(64);
const book={studyPillarV38:'studybook-progressive-v38-1',title:'44 page simulated',
 canonicalBookMap:{originalFingerprint:fp,pageCount:44},
 chapters};
const levels=['summary','50','40','30','20','10'];
const units=Array.from({length:44},(_,i)=>({ci:0,pi:i,id:'0:'+i,
 source:original,pageStart:i+1,pageEnd:i+1}));
const drafts=[units.map(()=>({editions:Object.fromEntries(levels.map(x=>[x,short]))}))];
const staged=[units.map(()=>({editions:{},verified:{},issues:{}}))];
const old={complete:false,sourceFingerprint:fp,
 status:'quality-review',phase:'review',draftComplete:true,
 draftRowsV57:drafts,checkpointPersistent:true,
 verifiedChunkVariants:0,totalChunkVariants:264,
 draftUnitsSaved:264,draftUnitsTotal:264,execution:{haltedOn:'AI_QUALITY_REVIEW',remainingBatches:4}};
assert.equal(recoveryActionV79(old),'local-audit');
assert.equal(planStudyAutoResumeV45(old,0)?.reason,'local-quality-audit');
let callbackCount=0;
const checked=finalizeStudyQualityV66(book,units,staged,drafts,old,()=>{
 callbackCount++;
});
assert.equal(callbackCount,1);
assert.equal(checked.phase,'quality');
assert.equal(checked.complete,false);
assert.equal(checked.status,'quality-notes');
assert.equal(checked.draftComplete,true);
assert.equal(checked.draftUnitsSaved,264);
assert.equal(checked.qualityV66.summary.checkedPages,264);
assert.equal(hasFinishedLocalAuditV79(checked),true);
assert.equal(requiresRecalibrationV79(checked),true);
assert.equal(recoveryActionV79(checked),'manual-recalibration');
assert.equal(planStudyAutoResumeV45(checked,0),null,
 'no 1.2-second repeated local quality audit');
assert.equal(canRebalanceBookV67({...book,editionsV36:checked}),true,
 'Gemini corrective action must be accessible for quality-notes book');
const progress=studyPhaseProgressV59({...book,editionsV36:checked});
assert.equal(progress.phase,'quality');
for(const x of progress.levels){
 assert.equal(x.completed,44,'44 source pages have been examined');
 assert.equal(x.available,44,'44 source pages still saved');
 assert.equal(x.conformant,0,'not one 44-page draft can be accepted as conforming');
 assert.equal(x.fullNumericPass,false);
}
assert.equal(checked.draftRowsV57,drafts,'the original six draft arrays must survive');
assert.equal(checked.execution.remainingBatches,0,'quality pass requires no pending Gemini tasks');
// Numeric accuracy cannot be implied merely because output falls in the
// global band. A source page with 60-cell overflow must be reparable.
const one=[{id:'0:0',ci:0,pi:0,
 source:'responsabilità '.repeat(22).trim(),pageStart:1,pageEnd:1}];
const rowHeavy=[{id:'0:0',text:'la '.repeat(123).trim()}];
const letter=pageLetterReviewV74(one,rowHeavy,'20');
const geometry=studyGeometryReviewV78(one,rowHeavy,'20');
assert.equal(letter.withinBand,true,'80% letter count should be valid');
assert.equal(geometry.allNumeric,true);
assert.equal(geometry.allRows,false,'many short words overflow 60 cell rows');
assert.equal(geometry.complete,false);
assert.deepEqual(geometry.groups[0].ids,['0:0'],'identify page to repair locally');

console.log('LAB79_NO_STALL_AND_SAVED_DRAFTS_PASS',JSON.stringify({
 originalPages:44,savedPageVersions:264,
 verifiedLocally:264,numericConformantPages:0,
 automaticGeminiCalls:0,afterQAResumePlan:null,
 manualTargetedCorrectionEnabled:true,rowOverflowCaught:true,
 originalDraftsPreserved:true,semanticCertified:false,
 policy:STUDY_QUALITY_RECOVERY_V79
}));
