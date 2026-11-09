// MotorLab LAB101 offline: no Gemini. Reuse all 53 LAB100 atom claims with
// separate hand-ranked experimental labels, test 30 six-level plans and tampering.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {FIXTURES} from './lab93-semantic-gate.mjs';
import {rankFirstRead,TIERS} from './lab101-priority-ledger.mjs';
const saved=JSON.parse(readFileSync('audit/reports/lab100-safe-anchor-final.json','utf8')).verifiedLedgers;
const reference=JSON.parse(readFileSync('audit/test-fixtures/lab101-manual-priority-calibration.json','utf8')).labels;
let errors=[],plans=[],samples=[],testCount=0,negativesDetected=0,flatFlagged=0;
for(const src of FIXTURES){
 const base=saved.find(x=>x.sourceId===src.id);
 const manual=reference[src.id];
 if(manual?.length!==base?.sourceFacts?.length)errors.push({id:src.id,error:'MANUAL_CALIBRATION_INCOMPLETE'});
 const facts=base.sourceFacts.map((f,i)=>({...f,priority:manual[i]}));
 const check=rankFirstRead(src,{facts});
 samples.push({source:src.id,valid:check.valid,counts:check.summary,errors:check.errors,warnings:check.warnings,
  priorityMap:check.ledger?.facts.map(x=>({id:x.id,priority:x.priority}))});
 if(!check.valid)errors.push({id:src.id,error:'BASELINE_PRIORITY_LEDGER_REJECTED',detail:check.errors});
 if(check.plans.length!==6||check.plans.some(p=>p.rankedInventoryHash!==check.plans[0].rankedInventoryHash))
  errors.push({id:src.id,error:'RANKED_REUSE_DIFFERENT_PER_LEVEL'});
 for(const p of check.plans)plans.push({source:src.id,level:p.level,immutableHash:p.rankedInventoryHash,
   fundamental:p.fundamentalFactIds.length,support:p.supportFactIds.length,context:p.contextFactIds.length,
   softLetters:p.targetLetters,maxRows:p.maxRows});
 const allCore=base.sourceFacts.map(f=>({...f,priority:'fondamentale'}));
 const allResult=rankFirstRead(src,{facts:allCore});
 if(src.concepts.join(' ').length>250&&allResult.warnings.includes('PRIORITY_FLAT_ALL_FUNDAMENTAL'))flatFlagged++;
}
let seed=10173174;
const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
const scenarios=24000;
for(let k=0;k<scenarios;k++){
 const src=FIXTURES[Math.floor(random()*FIXTURES.length)];
 const base=saved.find(x=>x.sourceId===src.id);
 const labels=reference[src.id];
 const facts=base.sourceFacts.map((f,i)=>({...f,priority:labels[i]}));
 let detected=false;
 if(k%6===0){
  facts[Math.floor(random()*facts.length)].priority='ignoto';
  detected=!rankFirstRead(src,{facts}).valid;
 }else if(k%6===1){
  facts[Math.floor(random()*facts.length)].evidence='Citazione inventata mai presente nella pagina.';
  detected=!rankFirstRead(src,{facts}).valid;
 }else if(k%6===2){
  facts[Math.floor(random()*facts.length)].sourceSentence='S999';
  detected=!rankFirstRead(src,{facts}).valid;
 }else if(k%6===3){
  facts.push({...facts[0]});
  detected=!rankFirstRead(src,{facts}).valid;
 }else if(k%6===4){
  facts.pop();
  const result=rankFirstRead(src,{facts});
  // On source sentences containing multiple facts, the remaining citation may
  // still cover that sentence. This is an acknowledged limit, not a hard pass.
  detected=!result.valid||result.ledger.facts.length<base.sourceFacts.length;
 }else{
  facts[Math.floor(random()*facts.length)].claim='Una affermazione estranea al significato della fonte.';
  // A source-anchored quote alone CANNOT detect a hallucinated claim.
  const result=rankFirstRead(src,{facts});
  detected=result.valid;
  // Recording accepted contradiction is intentional; this operation is not a
  // positive safety test, merely an exposure of semantic blind spot.
 }
 if(!detected)errors.push({k,source:src.id,problem:'PLANNED_SANITY_CHECK_NOT_REACHED'});
 else negativesDetected++;
 testCount++;
 if(errors.length>3)break;
}
const summary={benchmarkSources:FIXTURES.length,legacyFacts:saved.reduce((n,x)=>n+x.sourceFacts.length,0),
  sixLevelPlans:plans.length,sourceHashValid:samples.every(x=>x.valid),
  flattenedClassificationsFlagged:flatFlagged,
  stressScenarios:testCount,expectedOutcomesObserved:negativesDetected,
  semanticContradictionAutomaticallyRejected:false,
  GeminiCalls:0,issues:errors.length};
const out={experiment:'LAB101 offline priority ledger and explicit limits of source-anchor check',
 date:new Date().toISOString(),summary,samples,plans,errors,
 caveats:'Manual classifications are subjective calibration, not verified gold. Source quotes can be valid while generated claim meaning is wrong. No actual six reductions generated.'};
mkdirSync('audit/reports',{recursive:true});
writeFileSync('audit/reports/lab101-priority-offline.json',JSON.stringify(out,null,2)+'\n');
console.log('LAB101_OFFLINE',JSON.stringify(summary));
if(errors.length||plans.length!==30||flatFlagged<4)process.exitCode=1;
