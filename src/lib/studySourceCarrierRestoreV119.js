// MotorLab StudyBook LAB119D — conservative source-carrier restoration.
// RESEARCH ONLY. No Gemini/Worker/Android wiring, no synthesis of new words.
// A dangerous generated claim may be replaced only by ONE original sentence
// with very strong lexical/source relation, not by a newly invented paraphrase.
// The replacement may exceed a letter budget: we report the true percentage.
import {studyLetters} from './studyPillarV38.js';
import {auditFidelity} from './fidelityEngine.js';
import {inspectBestOfV76} from './studyBestOfV76.js';
import {prepareSemanticLadderV119,composeSemanticLadderV119}
 from './studySemanticLadderV119.js';
const clean=x=>String(x||'').normalize('NFC').replace(/\s+/gu,' ').trim();
const split=x=>(clean(x).match(/[^.!?]+(?:[.!?]+|$)/gu)||[])
 .map(clean).filter(Boolean);
const DROP=new Set(['della','dalle','degli','dallo','dalla','delle','perché',
 'anche','questa','questo','quella','quello','sono','nella','nelle','sulla',
 'sulle','alla','alle','agli','dopo','prima','solo','come','mentre','loro',
 'ogni','quando','essere','dalla','dalle','dello','degli']);
const terms=x=>new Set((clean(x).toLocaleLowerCase('it-IT')
 .match(/[\p{L}]{4,}/gu)||[]).filter(w=>!DROP.has(w)));
function similarity(source,rewritten){
 const a=terms(source),b=terms(rewritten);
 if(a.size<2||b.size<2)return {hits:0,sourceRatio:0,outputRatio:0};
 const common=[...b].filter(k=>a.has(k)).length;
 return {hits:common,sourceRatio:common/a.size,outputRatio:common/b.size};
}
function riskForPair(src,out){
 const a=src.toLocaleLowerCase('it-IT'),b=out.toLocaleLowerCase('it-IT');
 const reasons=[];
 if(/\binfluisc\w*\b/u.test(a)&&
   /\b(?:causa\w*|provoca\w*|determina\w*)\b/u.test(b)&&
   !/\b(?:causa\w*|provoca\w*|determina\w*)\b/u.test(a))
  reasons.push('INFLUENCE_TO_CAUSE');
 if(/\bpuò(?=\s|[.,:;!?])/u.test(a)&&!/(?:\bpuò(?=\s|[.,:;!?])|\bpossono\b|\bpotrebbe\b|\bpotrebbero\b)/u.test(b))
  reasons.push('POSSIBILITY_MADE_UNCONDITIONAL');
 if(/\b(?:soprattutto|principalmente)\b/u.test(a)&&
   !/\b(?:soprattutto|principalmente|prevalentemente)\b/u.test(b))
  reasons.push('PRIMARY_QUALIFIER_LOST');
 if(/\b(?:solo se|soltanto se)\b/u.test(a)&&
   !/\b(?:solo se|soltanto se)\b/u.test(b))
  reasons.push('EXCEPTION_CONDITION_LOST');
 if(/\bnon\b/u.test(a)&&!/\b(?:non|nessun\w*|senza)\b/u.test(b))
  reasons.push('SCOPED_NEGATION_LOST');
 if(/\bprima\s+del\s+prestito\b/u.test(a)&&
   !/\bprima\s+del\s+prestito\b/u.test(b))
  reasons.push('BEFORE_LOAN_SCOPE_LOST');
 if(/\bcirca\b/u.test(a)&&!/\b(?:circa|approssimativamente)\b/u.test(b))
  reasons.push('APPROXIMATION_LOST');
 if(/\bverificabil[ei]\b/u.test(a)&&!/\bverificabil[ei]\b/u.test(b))
  reasons.push('VERIFIABILITY_LOST');
 if(/\bripetibil[ei]\b/u.test(a)&&!/\b(?:ripetibil[ei]|riproducibil[ei])\b/u.test(b))
  reasons.push('REPEATABILITY_LOST');
 if(/\bscritt[aoie]\b/u.test(a)&&!/\b(?:scritt[aoie]|per iscritto)\b/u.test(b))
  reasons.push('WRITTEN_CONDITION_LOST');
 if(/\b(?:essenzial[ei]|indispensabil[ei])\b/u.test(a)&&
    !/\b(?:essenzial[ei]|indispensabil[ei]|necessar[ioe])\b/u.test(b))
  reasons.push('ESSENTIALITY_LOST');
 return reasons;
}
export const STUDY_CARRIER_RESTORE_V119='lab119d-original-sentence-carrier-restore-v1';
export function restoreSourceCarriersV119(plan,reply){
 if(plan?.policy!=='lab119-core-plus-five-progressive-expansions-v1'||
   !Array.isArray(reply?.units)||reply.units.length!==plan.units.length)
   throw Error('LAB119D_SOURCE_RESPONSE_INVALID');
 const accepted=[],alerts=[];
 const newReply={units:reply.units.map((row,i)=>{
  const unit=plan.units[i];
  if(row?.id!==unit.id||typeof row.core!=='string')
   throw Error('LAB119D_UNIT_ID_INVALID');
  const original=split(unit.source);
  const core=split(row.core);
  const converted=core.map((text,j)=>{
   const ranked=original.map((source,index)=>{
    const sim=similarity(source,text);
    return {source,index,...sim,risk:riskForPair(source,text)};
   }).sort((a,b)=>b.hits-a.hits||b.outputRatio-a.outputRatio||
       b.sourceRatio-a.sourceRatio);
   const best=ranked[0];
   if(!best||best.hits<2||best.outputRatio<0.55){
    alerts.push({unit:unit.id,coreSentence:j,
     status:'NO_CERTAIN_ONE_TO_ONE_SOURCE_CARRIER'});
    return text;
   }
   if(!best.risk.length)return text;
   const competing=ranked[1];
   if(competing?.hits===best.hits&&
     competing.outputRatio>=best.outputRatio-0.10){
    alerts.push({unit:unit.id,coreSentence:j,
     status:'SOURCE_CARRIER_AMBIGUOUS',risks:best.risk});
    return text;
   }
   // A generated sentence combining multiple original assertions is not
   // reversible to one source carrier. Lack of clear term support vetoes it.
   if(best.sourceRatio<0.22){
    alerts.push({unit:unit.id,coreSentence:j,
     status:'TOO_FEW_SOURCE_TERMS_FOR_RESTORATION',risks:best.risk});
    return text;
   }
   accepted.push({unit:unit.id,coreSentence:j,sourceSentence:best.index,
    reasons:best.risk,oldLetters:studyLetters(text),
    restoredLetters:studyLetters(best.source)});
   return best.source;
  });
  return {...row,core:converted.join(' ')};
 })};
 const after=composeSemanticLadderV119(plan,newReply);
 const before=composeSemanticLadderV119(plan,reply);
 const comparisons=Object.keys(after.quality).map(level=>({
  level,
  beforeReduction:before.quality[level].achievedReduction,
  afterReduction:after.quality[level].achievedReduction,
  beforeNumericalPass:before.quality[level].numericAndRowsPass,
  afterNumericalPass:after.quality[level].numericAndRowsPass,
  beforePreliminarySafety:before.quality[level].strictPreliminarySafe,
  afterPreliminarySafety:after.quality[level].strictPreliminarySafe
 }));
 return {policy:STUDY_CARRIER_RESTORE_V119,
  restoredReply:newReply,changes:accepted,ambiguous:alerts,comparisons,
  restoredSourceSentences:accepted.length,modelCalls:0,
  semanticCertified:false,approvedForApp:false};
}
