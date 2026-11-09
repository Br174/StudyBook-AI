// StudyBook LAB101b: inspect five saved priority first reads; zero new model calls.
// Stress 20k deliberate priority regressions and verify source-concept hierarchy.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {FIXTURES} from './lab93-semantic-gate.mjs';
import {priorityRiskAudit} from './lab101-concept-priority-gate.mjs';
import {rankFirstRead} from './lab101-priority-ledger.mjs';
const raw=JSON.parse(readFileSync('audit/reports/lab101-real-priorities.json','utf8'));
let errors=[],pages=[];
for(const src of FIXTURES){
 const prior=raw.pages.find(x=>x.source===src.id);
 if(!prior?.anchorValidated||!prior.ledger)errors.push({source:src.id,reason:'MISSING_VALID_BASELINE'});
 const risk=priorityRiskAudit(src,prior.ledger);
 pages.push({
  source:src.id,priorities:prior.summary,priorityRisk:risk,
  editorialDisagreements:prior.calibration?.matchedPairs.filter(x=>!x.equal).map(x=>({
   modelFact:x.newId,manualFact:x.referenceId,modelTier:x.predicted,editorialTier:x.manual,evidenceOverlap:x.score
  }))||[],
  unverifiedPriorityApproved:false
 });
 if(src.id==='procedura'&&!risk.flags.some(f=>f.type==='CONCEPT_HAS_SUPPORT_BUT_NO_FUNDAMENTAL'&&f.concept==='C4'))
  errors.push({source:src.id,reason:'MISSING_KNOWN_REGISTRY_CONCEPT_WARNING'});
}
let seed=101101,stress=0,detected=0,modeTests=0;
const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
const danger=/(?:\bnon\b|\bsenza\b|\bpuò\b|\bpotrebbe\b|\bsoltanto\b|\bsolo\b|\bse\b|\bdeve\b|\bdevono\b|\bperentori\w*|\banche se\b|\bnonostante\b)/iu;
for(let k=0;k<20000;k++){
 const src=FIXTURES[Math.floor(random()*FIXTURES.length)];
 const prior=raw.pages.find(x=>x.source===src.id);
 const cloned=JSON.parse(JSON.stringify(prior.ledger));
 let expectedFlag=null;
 if(k%2===0){
  const groups=priorityRiskAudit(src,cloned).byConcept.filter(x=>x.fundamental>0);
  const group=groups[Math.floor(random()*groups.length)];
  const groupLetters=new Set();
  // Exact mapping via mapping helper: cannot rely on adjacent sentence numbering.
  const sentences=src.concepts.map((v,i)=>({i,rows:v.match(/[^.!?]+[.!?]?/gu)||[]}));
  let sid=1;
  for(const c of sentences){for(const _ of c.rows){if('C'+(c.i+1)===group.concept)groupLetters.add('S'+sid);sid++}}
  cloned.facts.forEach(f=>{if(groupLetters.has(f.sourceSentence))f.priority='supporto'});
  expectedFlag='CONCEPT_HAS_SUPPORT_BUT_NO_FUNDAMENTAL';
 }else{
  const critical=cloned.facts.filter(f=>f.priority==='fondamentale'&&danger.test(f.evidence));
  if(!critical.length)continue;
  const f=critical[Math.floor(random()*critical.length)];
  f.priority='supporto';
  expectedFlag='MODAL_NEGATIVE_OR_CONDITION_DOWNGRADED';modeTests++;
 }
 const checked=priorityRiskAudit(src,cloned);
 stress++;
 if(checked.flags.some(x=>x.type===expectedFlag))detected++;
 else errors.push({case:k,source:src.id,reason:'MUTATED_PRIORITY_NOT_FLAGGED',expectedFlag});
 if(errors.length>5)break;
}
const summary={
 sources:pages.length,actualModelFacts:raw.summary.totalExtractedFacts,
 fundamental:raw.summary.fundamental,support:raw.summary.support,context:raw.summary.context,
 priorityDisagreements:pages.reduce((n,p)=>n+p.editorialDisagreements.length,0),
 realPagesFlagged:pages.filter(p=>p.priorityRisk.highRiskFlags>0).length,
 highRiskAlerts:pages.reduce((n,p)=>n+p.priorityRisk.highRiskFlags,0),
 noCoreConceptGroups:pages.reduce((n,p)=>n+p.priorityRisk.flags.filter(f=>f.type==='CONCEPT_HAS_SUPPORT_BUT_NO_FUNDAMENTAL').length,0),
 moderatorSafetyFlags:pages.reduce((n,p)=>n+p.priorityRisk.flags.filter(f=>f.type==='MODAL_NEGATIVE_OR_CONDITION_DOWNGRADED').length,0),
 testedReclassifications:stress,detected,modalRiskMutationChecks:modeTests,modelCalls:0,issues:errors.length
};
const report={study:'LAB101b fact priority coherence and downgraded-condition alerts',
 date:new Date().toISOString(),summary,pages,errors,
 caveat:'All flags are provisional and source-specific; they do not establish independent scholarly accuracy. No model claims modified. This stage is for quality review before any six-level generation.'};
mkdirSync('audit/reports',{recursive:true});
writeFileSync('audit/reports/lab101-priority-risk-review.json',JSON.stringify(report,null,2)+'\n');
console.log('LAB101_PRIORITY_RISK',JSON.stringify(summary));
if(errors.length||detected!==stress||summary.noCoreConceptGroups<1)process.exitCode=1;
