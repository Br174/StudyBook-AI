// LAB79 targeted QA-to-Gemini bridge: use REAL source-based recalibration
// controller with a mock model response, never a canned green snapshot.
import assert from 'node:assert/strict';
import {indexedDB as fakeIndexedDB} from 'fake-indexeddb';
import {bookUnitsV51} from '../src/lib/integralPlannerV51.js';
import {STUDY_LEVELS_V67} from '../src/lib/studyRebalancePolicyV67.js';
import {finalizeStudyQualityV66} from '../src/lib/studyQualityV66.js';
import {canRebalanceBookV67,rebalanceSavedStudyBookV67} from '../src/lib/studyRebalanceV67.js';
import {studyGeometryReviewV78,STUDY_GEOMETRY_V78} from '../src/lib/studyGeometryV78.js';
import {pageLetterReviewV74} from '../src/lib/studyPageBudgetsV74.js';
import {STUDY_DRAFT_PROTOCOL_V74} from '../src/lib/studyDraftProtocolV74.js';
import {studyLetters} from '../src/lib/studyPillarV38.js';
import {clearGeminiPause} from '../src/lib/geminiQuotaControllerV36.js';
import {clearGeminiCadenceForTestV58} from '../src/lib/geminiCadenceV58.js';

const source='responsabilità '.repeat(100).trim();
const texts=Object.fromEntries(STUDY_LEVELS_V67.map(l=>[l,
 'responsabilità '.repeat(l==='20'?15:100*(1-(l==='summary'?60:Number(l))/100)).trim()]));
const valid20='responsabilità '.repeat(80).trim();
const fp='f'.repeat(64),levels=STUDY_LEVELS_V67;
const book={title:'Esempio per QA persistente e correzione mirata',
 studyPillarV38:'studybook-progressive-v38-1',
 canonicalBookMap:{originalFingerprint:fp,pageCount:1,uncertain:[],
 pages:[{physicalPage:1,sourceStatus:'verified'}]},
 chapters:[{title:'Regole',pageStart:1,pageEnd:1,
 paragraphs:[{original:source,sourcePageStart:1,sourcePageEnd:1}]}]};
const units=bookUnitsV51(book);
const drafts=[[{editions:texts}]];
const staged=[[{editions:{},verified:{},issues:{}}]];
const initial={complete:false,status:'quality-review',phase:'review',
 draftComplete:true,checkpointPersistent:true,sourceFingerprint:fp,
 draftRowsV57:drafts,stagedRows:staged,verifiedChunkVariants:0,
 totalChunkVariants:6,draftUnitsSaved:6};
const audited=finalizeStudyQualityV66(book,units,staged,drafts,initial);
assert.equal(audited.complete,false);
assert.equal(audited.qualityV66.levels['20'].quantitativeAndGeometryCompliantV78,false);
for(const l of levels.filter(l=>l!=='20'))
 assert.equal(audited.qualityV66.levels[l].quantitativeAndGeometryCompliantV78,true,
 'initial already-correct level '+l);
assert.equal(canRebalanceBookV67({...book,editionsV36:audited}),true);
let requests=[],checkpoints=0;
const previousFetch=globalThis.fetch,previousDB=globalThis.indexedDB;
globalThis.indexedDB=fakeIndexedDB;
try{
 await clearGeminiPause();await clearGeminiCadenceForTestV58();
 globalThis.fetch=async(_url,opts)=>{
   const request=JSON.parse(opts.body);
   requests.push({level:request.level,phase:request.phase,
     units:request.units.map(u=>u.id),geometryPolicy:request.geometryPolicyV78});
   assert.equal(request.level,'20');
   assert.equal(request.phase,'recalibrate-v74');
   assert.equal(request.geometryPolicyV78,STUDY_GEOMETRY_V78);
   const parts=request.units.map(u=>({id:u.id,text:valid20}));
   const sourceLetters=request.units.reduce((n,u)=>n+studyLetters(u.source),0);
   const outputLetters=parts.reduce((n,p)=>n+studyLetters(p.text),0);
   const pageReview=pageLetterReviewV74(request.units,parts,'20');
   assert.equal(pageReview.withinBand,true);
   assert.equal(studyGeometryReviewV78(request.units,parts,'20').complete,true);
   return new Response(JSON.stringify({engine:'ai',version:'integral-v51',
    level:'20',inputTokens:800,draftProtocol:STUDY_DRAFT_PROTOCOL_V74,
    finishReason:'stop',outputTokenLimit:4096,completeParts:true,
    lengthReview:{sourceLetters,observedLetters:outputLetters,
      withinBand:true,compliant:true,pageReviewV74:pageReview},
    parts}),{status:200,headers:{'content-type':'application/json'}});
 };
 const updated=await rebalanceSavedStudyBookV67({...book,editionsV36:audited},{
  onProgress:async checkpoint=>{checkpoints++;assert(checkpoint.draftRowsV57)},
 });
 assert.equal(requests.length,1,'one targeted regeneration, not six edition calls');
 assert.equal(updated.rebalanceV67.accepted,1);
 assert.equal(updated.rebalanceV67.remaining.length,0);
 assert.equal(updated.qualityV66.levels['20'].quantitativeAndGeometryCompliantV78,true);
 assert.equal(updated.complete,true,'all six maths+60-cell grids now pass');
 assert.equal(updated.qualityV66.summary.semanticCertification,false);
 for(const l of levels.filter(l=>l!=='20'))
  assert.equal(updated.draftRowsV57[0][0].editions[l],texts[l],
   'other five levels must remain untouched');
 assert.equal(book.editionsV36,undefined,'input immutable');
 console.log('LAB79_REAL_RECALIBRATION_CONTROLLER_PASS',JSON.stringify({
  initialSixLevels:6,initialFaultyLevels:1,
  providerCallsMocked:requests.length,onlyChangedLevel:'20',
  archivedOtherFiveVersionsUnchanged:true,qualityGateGreen:true,
  noLiveGeminiCalls:true,sourcePreserved:true,checkpoints
 }));
}finally{
 globalThis.fetch=previousFetch;
 await clearGeminiPause().catch(()=>{});
 await clearGeminiCadenceForTestV58().catch(()=>{});
 if(previousDB===undefined)delete globalThis.indexedDB;
 else globalThis.indexedDB=previousDB;
}
