// MotorLab StudyBook LAB99 — transactional, single-sentence edit with hard rollback.
// Never overwrites source, never regenerates entire page, never silently certifies meaning.
import {evaluateLean} from './lab96-eval.mjs';
import {relationshipGuard} from './lab99-relational-guard.mjs';
export const normalize=s=>String(s||'').normalize('NFC').replace(/\s+/gu,' ').trim();
const countOccurrence=(str,frag)=>str.split(frag).length-1;
export function analyzeCandidate(source,level,originalGenerated,caseInfo,replacementSentence){
 const originalText=normalize(source.concepts.join(' '));
 const oldText=normalize(originalGenerated);
 const target=normalize(caseInfo.target);
 const replacement=normalize(replacementSentence);
 const forbiddenReasons=[];
 if(!originalText.includes(normalize(caseInfo.evidence)))forbiddenReasons.push('SOURCE_EVIDENCE_MISMATCH');
 if(countOccurrence(oldText,target)!==1)forbiddenReasons.push('TARGET_NOT_EXACTLY_ONCE');
 if(!replacement||replacement.length>360)forbiddenReasons.push('REPLACEMENT_MISSING_OR_TOO_LONG');
 if(/[\r\n]/u.test(String(replacementSentence||'')))forbiddenReasons.push('NEWLINE_NOT_ALLOWED');
 if(!/[.!?]$/u.test(replacement))forbiddenReasons.push('SENTENCE_FINAL_PUNCTUATION_REQUIRED');
 if(countOccurrence(oldText,target)!==1||forbiddenReasons.length){
  return{candidateValid:false,approvedForApp:false,forbiddenReasons,oldText,
   source:source.id,level,caseId:caseInfo.id};
 }
 const [before,after]=oldText.split(target);
 // Only one exact sentence can change; all surrounding text is retained.
 const candidate=before+replacement+after;
 if(candidate===oldText)forbiddenReasons.push('NO_CHANGE');
 const oldMetrics=evaluateLean(source,level,oldText);
 const newMetrics=evaluateLean(source,level,candidate);
 const oldGuard=relationshipGuard(source.id,originalText,oldText);
 const newGuard=relationshipGuard(source.id,originalText,candidate);
 const oldMissing=new Set(oldGuard.alerts.map(x=>x.id));
 const newMissing=new Set(newGuard.alerts.map(x=>x.id));
 const targetRecovered=oldMissing.has(caseInfo.relationId)&&!newMissing.has(caseInfo.relationId);
 const newRelationRegressions=[...newMissing].filter(id=>!oldMissing.has(id));
 const oldLexical=new Set(oldMetrics.facts.missing.map(x=>x.fact));
 const lexicalRegressions=newMetrics.facts.missing.filter(x=>!oldLexical.has(x.fact)).map(x=>x.fact);
 if(!targetRecovered)forbiddenReasons.push('TARGET_RELATION_NOT_RESTORED');
 if(newRelationRegressions.length)forbiddenReasons.push('OTHER_RELATIONS_WORSENED');
 if(lexicalRegressions.length)forbiddenReasons.push('OTHER_FACT_ALERTS_WORSENED');
 if(!newMetrics.grid.passes)forbiddenReasons.push('PAGE_OVERFLOW');
 if(!newMetrics.band.passes)forbiddenReasons.push('LETTER_BAND_OUTSIDE');
 if(newMetrics.spellingSignals.length>oldMetrics.spellingSignals.length)forbiddenReasons.push('ORTHOGRAPHY_WORSENED');
 const acceptedMathematically=forbiddenReasons.length===0;
 return{
  source:source.id,level,caseId:caseInfo.id,
  candidateValid:true,acceptedMathematically,approvedForApp:false,
  verdict:acceptedMathematically?'PRELIMINARY_ACCEPT_NEEDS_SEMANTIC_REVIEW':'REJECT_ROLLBACK',
  preservedUnchangedPrefix:before.length,preservedUnchangedSuffix:after.length,
  oldText,newText:candidate,originalTargetSentence:target,replacementSentence:replacement,
  old:{letters:oldMetrics.actualLetters,reduction:oldMetrics.reduction,rows:oldMetrics.grid.rows,cap:oldMetrics.grid.maxRows,letterBand:oldMetrics.band.passes,
    relationAlerts:oldGuard.alerts.map(x=>x.id),lexicalAlerts:oldMetrics.facts.missing.map(x=>x.fact)},
  next:{letters:newMetrics.actualLetters,reduction:newMetrics.reduction,rows:newMetrics.grid.rows,cap:newMetrics.grid.maxRows,letterBand:newMetrics.band.passes,
    relationAlerts:newGuard.alerts.map(x=>x.id),lexicalAlerts:newMetrics.facts.missing.map(x=>x.fact)},
  targetRecovered,newRelationRegressions,lexicalRegressions,forbiddenReasons,
  disclaimer:'This replaces only an exact target sentence in a test copy. Numerical/lexical checks do not certify semantic correctness. Never publish automatically.'
 };
}
