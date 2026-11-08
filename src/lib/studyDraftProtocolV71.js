// LAB71: one numerical owner for both the first-draft generation and
// explicit phase-two recalibration. No text, source or provider credentials are stored here.
import {studyLetters,exactRetained} from './studyPillarV38.js';
import {STUDY_TARGET_V67} from './studyRebalancePolicyV67.js';

export const STUDY_DRAFT_PROTOCOL_V71='lab71-unit-length-budget-v1';

export function unitLengthBudgetV71(source,level){
 const letters=studyLetters(source);
 const band=STUDY_TARGET_V67[String(level)];
 if(!band||!letters)throw Object.assign(new Error('Original source or level is missing'),{
   code:'AI_SOURCE_OR_LEVEL_UNAVAILABLE'});
 const targetLetters=level==='summary'
   ?Math.round(letters*.40)
   :exactRetained(letters,Number(level));
 return {
  sourceLetters:letters,
  targetLetters:level==='summary'?null:targetLetters,
  summaryTargetLetters:level==='summary'?targetLetters:null,
  minLetters:Math.max(0,Math.ceil(letters*(100-band.max)/100)),
  maxLetters:Math.floor(letters*(100-band.min)/100)
 };
}

export function buildUnitBudgetsV71(units,level){
 return Object.fromEntries(units.map(u=>[u.id,unitLengthBudgetV71(u.source,level)]));
}

export function verifyStudyDraftResponseV71(response,sourceLetters,level){
 const safe=Number(sourceLetters);
 if(response?.draftProtocol!==STUDY_DRAFT_PROTOCOL_V71||
    !Number.isFinite(safe)||safe<=0||
    response?.lengthReview?.sourceLetters!==safe||
    response?.level!==String(level))
   return {ok:false,code:'AI_DRAFT_BACKEND_VERSION_MISMATCH',
     message:'Il servizio Gemini non corrisponde al protocollo LAB71: le versioni salvate restano intatte.'};
 return {ok:true};
}
