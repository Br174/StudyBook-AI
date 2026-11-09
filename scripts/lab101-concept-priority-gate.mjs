// MotorLab StudyBook LAB101b — conservative priority risk gate.
// This gate NEVER changes model priorities or source claims; it only requires
// targeted editorial review when a significant concept or modal/negative clause
// might be incorrectly downgraded.
import {splitSentences} from './lab100-first-read-ledger.mjs';

export function mapSentencesToConcepts(source){
 const map=new Map();let next=1;
 for(let ci=0;ci<source.concepts.length;ci++){
  const parts=splitSentences(source.concepts[ci]);
  for(const _ of parts){map.set('S'+next,'C'+(ci+1));next++}
 }
 const full=splitSentences(source.concepts.join(' '));
 if(map.size!==full.length)throw Error('SOURCE_CONCEPT_SENTENCE_BOUNDARIES_MISMATCH');
 return map;
}
export function priorityRiskAudit(source,ledger){
 if(!ledger||ledger.sourceId!==source.id||!Array.isArray(ledger.facts))throw Error('UNVERIFIED_SOURCE_LEDGER');
 const map=mapSentencesToConcepts(source);
 const facts=ledger.facts;
 const flags=[],byConcept=[];
 const danger=/(?:\bnon\b|\bsenza\b|\bpuò\b|\bpotrebbe\b|\bsoltanto\b|\bsolo\b|\bse\b|\bdeve\b|\bdevono\b|\bperentori\w*|\banche se\b|\bnonostante\b)/iu;
 const sourceParts=splitSentences(source.concepts.join(' '));
 for(let i=0;i<source.concepts.length;i++){
  const concept='C'+(i+1),contained=facts.filter(f=>map.get(f.sourceSentence)===concept);
  const core=contained.filter(f=>f.priority==='fondamentale');
  const support=contained.filter(f=>f.priority==='supporto');
  const context=contained.filter(f=>f.priority==='contesto');
  byConcept.push({concept,sourceRows:splitSentences(source.concepts[i]).length,
   facts:contained.length,fundamental:core.length,support:support.length,context:context.length});
  if(!contained.length)flags.push({type:'EMPTY_CONCEPT',concept,highRisk:true});
  if(contained.length&&core.length===0&&support.length>0)
   flags.push({type:'CONCEPT_HAS_SUPPORT_BUT_NO_FUNDAMENTAL',concept,factIds:support.map(x=>x.id),highRisk:true});
 }
 for(const sentence of sourceParts){
  const same=facts.filter(f=>f.sourceSentence===sentence.id);
  if(!same.length)flags.push({type:'SOURCE_SENTENCE_NOT_REPRESENTED',sentenceId:sentence.id,highRisk:true});
  if(danger.test(sentence.text)&&same.length&&!same.some(f=>f.priority==='fondamentale'))
   flags.push({type:'SOURCE_MODAL_SENTENCE_WITHOUT_CORE',sentenceId:sentence.id,
    factIds:same.map(f=>f.id),highRisk:true});
 }
 for(const f of facts){
  if(f.priority!=='fondamentale'&&danger.test(f.evidence))
   flags.push({type:'MODAL_NEGATIVE_OR_CONDITION_DOWNGRADED',factId:f.id,
    priority:f.priority,evidence:f.evidence,highRisk:true,
    note:'Source phrase contains risk-sensitive wording; a model may still have reasonable grounds for support, so human review required.'});
 }
 return{source:source.id,byConcept,flags,highRiskFlags:flags.filter(f=>f.highRisk).length,
  autoPromotable:false,meaningCertified:false,
  warning:'Rules are lexical and conservative. Flags indicate review, not guaranteed mistakes. No generated study texts tested.'};
}
