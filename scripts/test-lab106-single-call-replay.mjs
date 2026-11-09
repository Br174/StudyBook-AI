// LAB106 one-call reproducibility & safety tests: 12 real archived Gemini
// outputs REPLAYED OFFLINE. No model quota, no APK or production promotion.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {FIXTURES} from './lab93-semantic-gate.mjs';
import {budget} from './lab92-stop-complete-engine.mjs';
import {relationshipGuard} from './lab99-relational-guard.mjs';
import {oxygenDirectionRisk} from './lab103-source-direction-risk.mjs';
import {runSingleCallV106,measuredPageV106,localOrthographyV106,localSourcePatchV106} from '../src/lib/studySingleCallGateV106.js';
const data=JSON.parse(readFileSync('audit/reports/lab105-real-six-levels-pilot.json','utf8'));
const lab104=JSON.parse(readFileSync('audit/reports/lab104-fact-by-fact-editorial-review.json','utf8'));
const source=new Map(FIXTURES.map(x=>[x.id,x]));
const cases=data.results.filter(x=>x.valid&&['scienze','procedura'].includes(x.source));
assert.equal(cases.length,12,'EXPECTED_TWELVE_REAL_ARCHIVED_OUTPUTS');
const summary={
 name:'LAB106 one Gemini call per page block and level + deterministic StudyBook checks',
 createdAt:new Date().toISOString(),scope:'Replay of 12 unchanged REAL previous Gemini texts through new isolated coordinator',
 originalRealModelOutputs:cases.length,realModelRequestsThisRun:0,providerSimulatedDispatches:0,
 failuresWithoutSecondCall:0,changedOrthography:0,unchangedOriginalResponses:12,
 sourceAnchoredPatchChecks:0,regressionBlocks:0,numericGridPass:0,
 semanticCertified:0,approvedForApp:0,unexpected:[],cases:[],adversarial:[],
 callsPerBlockExactlyOne:true,appIntegrated:false,androidBuilt:false
};
for(const item of cases){
 const fixture=source.get(item.source);
 assert(fixture,'SOURCE_NOT_FOUND');
 const input=fixture.concepts.join(' ');
 const plan=budget(fixture,item.level);
 let calls=0;
 const result=await runSingleCallV106({
  source:input,sourceId:item.source,level:item.level,maxRows:plan.targetCap,
  shortPageExempt:plan.short,invokeOnce:async ()=>{
   calls++;return{text:item.metrics.text};
  },
  sourceRiskChecks:[
   ({source:original,text})=>{
    const g=relationshipGuard(item.source,original,text);
    return{risk:g.alerts.length?'RELATION_LEXICAL_WARNING':null};
   },
   ({source:original,text})=>{
    const g=oxygenDirectionRisk(item.source,original,text);
    return{risk:g.risk||null};
   }
  ]
 });
 assert.equal(calls,1,'MULTIPLE_DISPATCHES');
 assert.equal(result.dispatches,1);
 assert.equal(result.approvedForApp,false);
 assert.equal(result.semanticCertified,false);
 const sourceN=item.metrics.originalLetters,rawN=item.metrics.actualLetters;
 const rawAudit=measuredPageV106(input,item.metrics.text,item.level,{maxRows:plan.targetCap,shortPageExempt:plan.short});
 assert.equal(rawAudit.sourceLetters,sourceN);
 assert.equal(rawAudit.actualLetters,rawN);
 assert.equal(rawAudit.rows,item.metrics.grid.rows,'PHYSICAL_VIRTUAL_ROW_DRIFT');
 assert.equal(rawAudit.numericGridPass,item.metrics.completeMathPass,'MATH_BASELINE_DRIFT');
 summary.providerSimulatedDispatches++;
 if(result.selectedFrom==='LOCAL_ORTHOGRAPHY')summary.changedOrthography++;
 if(result.numeric?.numericGridPass)summary.numericGridPass++;
 summary.cases.push({
  source:item.source,level:item.level,
  inputActualReduction:item.metrics.reduction,
  originalMathConforming:item.metrics.completeMathPass,
  finalReduction:result.numeric.actualReductionPercent,
  finalMathConforming:result.numeric.numericGridPass,
  finalRows:result.numeric.rows,rowsCap:plan.targetCap,
  selectedFrom:result.selectedFrom,
  localEdits:result.localEdits,
  sourceWarnings:result.semanticWarnings,
  calls,
  status:result.status,semanticCertified:false
 });
}
const scienze=source.get('scienze'),originalScience=scienze.concepts.join(' ');
const oldSummary=lab104.candidates.find(x=>x.source==='scienze'&&x.level===65);
assert(oldSummary);
let onlyOne=0;
const preserved=await runSingleCallV106({
 source:originalScience,sourceId:'scienze',level:65,maxRows:budget(scienze,65).targetCap,
 prior:{source:originalScience,level:65,text:oldSummary.finalText,editorialBaseline:true},
 sourceRiskChecks:[],
 invokeOnce:async ()=>{
  onlyOne++;return{text:cases.find(x=>x.source==='scienze'&&x.level===65).metrics.text};
 }
});
assert.equal(onlyOne,1);
assert.equal(preserved.selectedFrom,'FROZEN_INCUMBENT','BEST_PREVIOUS_TEXT_REPLACED');
assert.equal(preserved.selected,oldSummary.finalText,'INCUMBENT_TEXT_MUTATED');
assert.equal(preserved.numeric.numericGridPass,true);
summary.regressionBlocks++;
summary.adversarial.push({test:'frozen_best_previous_numerical_and_editorial_candidate',passed:true});

const spelling=localOrthographyV106(originalScience,
 "La Terra ruota poiche l altra resta al buio, con dell asse inclinato.");
assert(spelling.changed&&spelling.text.includes('poiché')&&spelling.text.includes("l'altra")&&spelling.text.includes("dell'asse"));
summary.adversarial.push({test:'source-anchored apostrophe and Italian accent without model',passed:true});

const forbidden=localSourcePatchV106(originalScience,'Le eclissi sono fenomeni.',{
 oldSpan:'Le eclissi sono fenomeni.',newSpan:'Le eclissi avvengono sempre.'});
assert.equal(forbidden.applied,false);
assert.equal(forbidden.reason,'REPLACEMENT_NOT_IN_ORIGINAL');
const supported=localSourcePatchV106(originalScience,'Le eclissi sono fenomeni.',{
 oldSpan:'Le eclissi sono fenomeni.',newSpan:'Le eclissi richiedono un allineamento particolare e non avvengono a ogni lunazione.'});
assert.equal(supported.applied,true);
assert.equal(supported.text,'Le eclissi richiedono un allineamento particolare e non avvengono a ogni lunazione.');
summary.sourceAnchoredPatchChecks+=2;
summary.adversarial.push({test:'reject hallucinated edit and accept literal source evidence only',passed:true});

const genuine=cases.find(x=>x.source==='scienze'&&x.level===20);
const noExtra=await runSingleCallV106({
 source:originalScience,level:20,maxRows:budget(scienze,20).targetCap,
 invokeOnce:async ()=>{const e=Error('Quota esaurita');e.code='HTTP_429';throw e;}
});
assert.equal(noExtra.dispatches,1);
assert.equal(noExtra.status,'PROVIDER_UNAVAILABLE');
assert.equal(noExtra.providerError,'HTTP_429');
summary.failuresWithoutSecondCall++;
summary.adversarial.push({test:'HTTP429 has no automatic retry or paid fallback',passed:true});

let emptyCalls=0;
const noOutput=await runSingleCallV106({
 source:originalScience,level:20,maxRows:budget(scienze,20).targetCap,
 invokeOnce:async ()=>{emptyCalls++;return{text:''}}
});
assert.equal(emptyCalls,1);
assert.equal(noOutput.status,'INVALID_PROVIDER_RESPONSE');
summary.failuresWithoutSecondCall++;
summary.adversarial.push({test:'empty/truncated provider response rejected with one dispatch',passed:true});

// The APP summary uses 60% target (55–65%), unlike historical 65%±5.
// This research gate deliberately does NOT replace the app-level policy.
summary.summaryPolicy={
 historicalResearchTargetPercent:65,historicalResearchRange:'60..70',
 existingProductionSummaryTargetPercent:60,existingProductionSummaryRange:'55..65',
 resolvedForProduction:false,
 requirement:'One canonical policy must be chosen before APK promotion. Do not silently use research policy in production.'
};
summary.evaluation={
 inputMathPass:cases.filter(x=>x.metrics.completeMathPass).length,
 freshModelGeneration:false,
 singleDispatchPerSourceBatchLevel:true,
 strictlyLocalCorrectionsOnly:true,
 trueSemanticValidation:'NOT_PROVEN',
 nativeAppBackendWiring:'PENDING',
 safeForExperimentalAPK:false,
 furtherNeeded:'Integration test must instrument actual fetch and disable legacy LAB75 plan+write/rebalance second calls on new mode.'
};
assert.equal(summary.evaluation.inputMathPass,3);
assert.equal(summary.providerSimulatedDispatches,12);
assert.equal(summary.cases.length,12);
assert.equal(summary.summaryPolicy.resolvedForProduction,false);
mkdirSync('audit/reports',{recursive:true});
writeFileSync('audit/reports/lab106-single-call-replay.json',JSON.stringify(summary,null,2)+'\n');
console.log('LAB106_ONE_CALL_REPLAY',JSON.stringify({simulatedDispatches:summary.providerSimulatedDispatches,
 baselineMath:summary.evaluation.inputMathPass,localMath:summary.numericGridPass,
 localOrthographicSelections:summary.changedOrthography,
 regressionBlocks:summary.regressionBlocks,
 cases:summary.cases.map(x=>({id:x.source+'-'+x.level,percent:x.finalReduction,math:x.finalMathConforming,selection:x.selectedFrom,alerts:x.sourceWarnings}))}));
