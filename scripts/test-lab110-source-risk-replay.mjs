// LAB110 zero-Gemini source risk regression, on ORIGINAL fixtures and saved
// real model outputs. Alerts are source triggered, never semantic certificates.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sourceRiskReviewV110} from '../src/lib/studySourceRiskV110.js';
const dir='audit/reports/',fixture=JSON.parse(readFileSync('audit/test-fixtures/lab109-worker-source.json','utf8'));
const science=fixture.sources.find(x=>x.id==='scienze').text;
const procedure=fixture.sources.find(x=>x.id==='procedura').text;
const trials=[
 ...JSON.parse(readFileSync(dir+'lab110-real-worker-ledger.json','utf8')).results,
 ...JSON.parse(readFileSync(dir+'lab110b-real-worker-clause-budget.json','utf8')).results
];
let assertions=0;
const yes=(x,msg)=>{assert.ok(x,msg);assertions++};
const expected={
 'LAB110-scienze':['ECLIPSE_NOT_EVERY_LUNATION_MISSING','DESCRIPTION_VS_CAUSES_OF_VARIATIONS_MISSING','TIDES_INFLUENCE_CHANGED_TO_CAUSE'],
 'LAB110-procedura':['INTERNAL_RULE_12_UNCLEAR','TITLE_MUST_BE_REGISTERED_BEFORE_LOAN_MISSING'],
 'LAB110B-scienze':['ECLIPSE_NOT_EVERY_LUNATION_MISSING','DESCRIPTION_VS_CAUSES_OF_VARIATIONS_MISSING'],
 'LAB110B-procedura':['INTERNAL_RULE_12_UNCLEAR','TITLE_MUST_BE_REGISTERED_BEFORE_LOAN_MISSING']
};
const results=[];
for(let i=0;i<trials.length;i++){
 const t=trials[i],src=t.fixture==='scienze'?science:procedure;
 const key=(i<2?'LAB110-':'LAB110B-')+t.fixture;
 const a=sourceRiskReviewV110([{id:'1:1',source:src}],[{id:'1:1',text:t.outputText}]);
 yes(a.policy==='original-triggered-relation-risk-v110',key);
 yes(a.readyForStudy===false&&a.semanticCertified===false,key+' must remain unapproved');
 for(const rule of expected[key])yes(a.groups[0].warningCodes.includes(rule),key+':'+rule);
 results.push({key,warnings:a.groups[0].warningCodes,warningCount:a.signalCount,releaseApproved:a.readyForStudy});
}
const manual=fixture.manuallyAuthoredScience40Feasibility.text;
const manualCheck=sourceRiskReviewV110([{id:'1:1',source:science}],[{id:'1:1',text:manual}]);
yes(manualCheck.groups[0].warningCodes.length===0,'manual viable source should not get these high risk warnings');
yes(manualCheck.readyForStudy===false,'zero warning must NOT certify source');
const cases=[
 {id:'remove eclipse negation',text:manual.replace('non avvengono a ogni lunazione','avvengono a ogni lunazione'),code:'ECLIPSE_NOT_EVERY_LUNATION_MISSING'},
 {id:'invert tides influence',text:manual.replace('Le maree risentono di Luna e Sole','La Luna e il Sole causano le maree'),code:'TIDES_INFLUENCE_CHANGED_TO_CAUSE'},
 {id:'lose description and cause',text:manual.replace('Descrivere il moto non spiega le cause delle variazioni.',''),code:'DESCRIPTION_VS_CAUSES_OF_VARIATIONS_MISSING'}
];
for(const c of cases){
 const r=sourceRiskReviewV110([{id:'1:1',source:science}],[{id:'1:1',text:c.text}]);
 yes(r.groups[0].warningCodes.includes(c.code),'missed adversarial mutation '+c.id);
}
const empty=sourceRiskReviewV110([{id:'1:1',source:science}],[{id:'1:1',text:''}]);
yes(empty.groups[0].warningCodes.includes('SOURCE_PART_MISSING'),'incomplete source must be marked');
console.log(JSON.stringify({lab:'LAB110 source-risk',assertions,
 outcomes:results,manualReferenceWarnings:manualCheck.signalCount,
 adversarialMutationsDetected:cases.length,
 semanticCertified:false,productionApproved:false,providerCalls:0},null,2));
