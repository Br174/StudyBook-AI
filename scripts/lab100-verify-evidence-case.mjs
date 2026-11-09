// StudyBook LAB100b: normalize ONLY the capitalization of an evidence quotation.
// The quote is metadata, NOT the student's text and NOT the atom claim.
// Exact unicode-insensitive unique match within the SAME original source sentence required.
// No substitution of text, synonyms, punctuation, missing facts or newly invented claims.
import {splitSentences,normalize,validateLedger,makeSixPlans} from './lab100-first-read-ledger.mjs';
export function caseOnlyEvidenceFix(source,raw){
 const sentences=splitSentences(source.concepts.join(' '));
 if(!raw||!Array.isArray(raw.facts))return{changed:false,valid:false,reason:'NO_FACTS',facts:[]};
 const sourceMap=new Map(sentences.map(x=>[x.id,x.text]));
 const facts=raw.facts.map(x=>({...x}));
 const changes=[],rejections=[];
 for(let i=0;i<facts.length;i++){
  const f=facts[i],origin=sourceMap.get(f.sourceSentence);
  if(!origin||typeof f.evidence!=='string'){
   rejections.push({i,reason:'NO_SOURCE_SENTENCE_OR_EVIDENCE'});
   continue;
  }
  const quoted=normalize(f.evidence);
  if(origin.includes(quoted))continue;
  const lower=origin.toLocaleLowerCase('it'),query=quoted.toLocaleLowerCase('it');
  if(lower.length!==origin.length||query.length!==quoted.length){
   rejections.push({i,reason:'CASEFOLD_LENGTH_CHANGED'});continue;
  }
  const first=lower.indexOf(query);
  if(first<0||lower.indexOf(query,first+1)!==-1){
   rejections.push({i,reason:first<0?'NOT_CASE_ONLY_MATCH':'AMBIGUOUS_CASE_ONLY_MATCH'});continue;
  }
  const corrected=origin.slice(first,first+quoted.length);
  if(corrected.toLocaleLowerCase('it')!==query||corrected.length!==quoted.length){
   rejections.push({i,reason:'CASE_ONLY_VERIFICATION_FAILED'});continue;
  }
  f.evidence=corrected;
  changes.push({factId:f.id,sentenceId:f.sourceSentence,before:quoted,after:corrected,
   meaningEdited:false,claimEdited:false});
 }
 const result=validateLedger(source,{facts});
 return{changed:changes.length>0,valid:result.valid,changes,rejections,
  facts,ledger:result.valid?result.payload:null,
  detail:result.completeness,validationErrors:result.errors,validationWarnings:result.warnings};
}
export function recheckSixPlans(source,patched){
 if(!patched?.valid||!patched.ledger)throw Error('INVALID_LEDGER_CANNOT_REUSE');
 return makeSixPlans(source,patched.ledger);
}
