// StudyBook LAB99 final recheck, NO additional Gemini calls.
// Replay the four first-pass and one follow-up real model sentences using updated synonyms.
// All generated texts kept exactly as returned; only the classifier is re-evaluated.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {FIXTURES} from './lab93-semantic-gate.mjs';
import {analyzeCandidate} from './lab99-targeted-sentence-patch.mjs';
import {relationshipGuard,sentences,relationRulesFor} from './lab99-relational-guard.mjs';
const first=JSON.parse(readFileSync('audit/reports/lab99-gemini-sentence-repairs.json','utf8'));
const retry=JSON.parse(readFileSync('audit/reports/lab99-one-retry-gemini.json','utf8'));
const list=JSON.parse(readFileSync('audit/test-fixtures/lab99-sentence-repair-cases.json','utf8')).cases;
const source=id=>FIXTURES.find(x=>x.id===id);
const results=[],issues=[];
for(const entry of list){
 const prior=first.results.find(x=>x.caseId===entry.id);
 const s=source(entry.source);
 const original=s.concepts.join(' ');
 const firstRecheck=analyzeCandidate(s,entry.level,prior.check.oldText,entry,prior.modelOutputSentence);
 const follow=retry.result?.caseId===entry.id
  ?analyzeCandidate(s,entry.level,prior.check.oldText,entry,retry.result.output)
  :null;
 const best=follow?.acceptedMathematically?follow:firstRecheck;
 results.push({
  caseId:entry.id,level:entry.level,subject:entry.source,
  priorFirstPassAccepted:firstRecheck.acceptedMathematically,
  followUpAttempted:!!follow,
  followUpAccepted:follow?.acceptedMathematically??null,
  finalPreliminaryAccepted:best.acceptedMathematically,
  acceptedModelSentence:best.acceptedMathematically?best.replacementSentence:null,
  remainingRelationalAlerts:best.next?.relationAlerts||[],
  otherContentsStillRequireQA:true,
  productionEligible:false,
  firstReasons:firstRecheck.forbiddenReasons,followUpReasons:follow?.forbiddenReasons||null,
  finalMath:best.next?{letters:best.next.letters,reduction:best.next.reduction,rows:best.next.rows,cap:best.next.cap}:null
 });
 if(!best.acceptedMathematically)issues.push({case:entry.id,reason:'No corrected sentence passed mathematical gates'});
 if(!best.targetRecovered)issues.push({case:entry.id,reason:'Target relation still missing'});
}
if(results.filter(x=>x.followUpAttempted).length!==1)issues.push({reason:'Exactly one follow-up expected'});
const originals=FIXTURES.map(s=>({source:s.id,alerts:relationshipGuard(s.id,s.concepts.join(' '),s.concepts.join(' ')).alerts.length}));
if(originals.some(x=>x.alerts))issues.push({reason:'Original sources falsely flagged'});
const cases=[];
for(const s of FIXTURES){
 const original=s.concepts.join(' ');
 for(const rule of relationRulesFor(s.id)){
  if(!rule.orig.test(original))continue;
  const parts=sentences(original);
  const i=parts.findIndex(x=>rule.words.every(w=>w.test(x)));
  if(i<0)issues.push({source:s.id,rule:rule.id,reason:'Positive source relation not found'});
  else cases.push({source:s,original,parts,i,rule});
 }
}
let seed=202611099,stress=0,detected=0;
const rnd=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
for(let i=0;i<10000;i++){
 const test=cases[Math.floor(rnd()*cases.length)];
 const broken=test.parts.map((x,index)=>index===test.i?'Informazione specifica assente.':x).join(' ');
 const d=relationshipGuard(test.source.id,test.original,broken);
 stress++;if(d.alerts.some(x=>x.id===test.rule.id))detected++;
 else issues.push({id:i,source:test.source.id,rule:test.rule.id,reason:'deletion missed'});
 if(issues.length>5)break;
}
const summary={realFirstPass:first.results.filter(x=>x.received).length,
 distinctModelPatchTargets:results.length,
 firstPassMathematical:results.filter(x=>x.priorFirstPassAccepted).length,
 additionalModelAttempts:retry.attempts,
 finalPreliminaryPatches:results.filter(x=>x.finalPreliminaryAccepted).length,
 remainingPagesCertifiedForStudy:0,
 originalFalseAlerts:originals.reduce((sum,x)=>sum+x.alerts,0),
 seededMutationChecks:stress,seededDetected:detected,issues:issues.length};
const report={study:'LAB99 final offline model-output recheck with synonym correction',date:new Date().toISOString(),
 note:'All five Gemini outputs are preserved from first experiment and one follow-up; this run makes ZERO provider calls. Four patched sentences may be mathematically valid but all entire pages still have unchecked/known missing facts and are NOT release-ready.',
 summary,results,issues};
mkdirSync('audit/reports',{recursive:true});
writeFileSync('audit/reports/lab99-final-offline-recheck.json',JSON.stringify(report,null,2)+'\n');
console.log('LAB99_FINAL_OFFLINE',JSON.stringify(summary));
if(issues.length||summary.finalPreliminaryPatches!==4||detected!==stress)process.exitCode=1;
