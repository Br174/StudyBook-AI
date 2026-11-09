// LAB107 no-Gemini regression checks; run with node scripts/test-lab107-inverse-calibration.mjs.
import assert from 'node:assert/strict';
import {LAB79_AGGREGATE_OBSERVATIONS_V107,inverseEstimateV107,
  prepareLetterFirstTrialV107,classifyMeasuredResultV107
} from '../src/lib/studyInverseCalibrationV107.js';
let checks=0;
function eq(a,b){assert.deepEqual(a,b);checks++}
function yes(a){assert.ok(a);checks++}
function fails(f,re){assert.throws(f,re);checks++}
const levels=[60,50,40,30,20,10];
const actual=LAB79_AGGREGATE_OBSERVATIONS_V107.map(x=>x.observedReduction);
for(let i=1;i<actual.length;i++)yes(actual[i-1]>actual[i]);
const inverse=levels.map(x=>inverseEstimateV107(x));
eq(inverse[0].estimatedInternalRequest,17.68);
eq(inverse[1].estimatedInternalRequest,12.85);
for(let i=2;i<6;i++){
 eq(inverse[i].status,'OUTSIDE_OBSERVED_RESPONSE_RANGE');
 eq(inverse[i].estimatedInternalRequest,null);
}
for(const x of inverse)eq(x.reliableForNewPage,false);
fails(()=>inverseEstimateV107(-1),/INVALID_TARGET/);
fails(()=>inverseEstimateV107(10,[
 {requestedReduction:10,observedReduction:55},{requestedReduction:20,observedReduction:50}
]),/NON_MONOTONE/);
function budget(pct){return {originalLetters:1000,reductionPercent:pct,
 targetLetters:1000-pct*10,
 minLetters:Math.ceil(1000*(100-pct-5)/100),
 maxLetters:Math.floor(1000*(100-pct+5)/100)}}
const source='a'.repeat(1000);
for(const p of [10,20,30,40,50]){
 const b=budget(p);
 const test=prepareLetterFirstTrialV107({source,level:String(p),budget:b,originalPageRows:17});
 eq(test.targetLetters,1000*(1-p/100));
 eq(test.retainedPercent,100-p);
 yes(test.prompt.includes('minimo '+b.minLetters+', massimo '+b.maxLetters));
 eq(test.noBlindInversePromptInjection,true);
 eq(test.approvedForApp,false);
}
const summary60=prepareLetterFirstTrialV107({source,level:'summary',budget:budget(60),originalPageRows:17});
const summary65=prepareLetterFirstTrialV107({source,level:'summary',budget:budget(65),originalPageRows:17});
eq(summary60.targetLetters,400);
eq(summary65.targetLetters,350);
eq(summary60.summaryPolicy,'APP_60_OR_STANDARD');
eq(summary65.summaryPolicy,'RESEARCH_65');
fails(()=>prepareLetterFirstTrialV107({source,level:'10',budget:budget(20)}),/LEVEL_POLICY_MISMATCH/);
fails(()=>prepareLetterFirstTrialV107({source:'ab',level:'10',budget:budget(10)}),/SOURCE_BUDGET_MISMATCH/);
const before=classifyMeasuredResultV107({budget:budget(10),outputLetters:559,originalPageRows:17,gridPass:true});
eq(before.achievedReduction,44.1);
eq(before.displayReduction,44.1);
eq(before.quantitativePass,false);
eq(before.fullyApproved,false);
const after=classifyMeasuredResultV107({budget:budget(10),outputLetters:903,originalPageRows:17,gridPass:true});
eq(after.quantitativePass,true);
eq(after.fullyApproved,false);
const short=prepareLetterFirstTrialV107({source,level:'10',budget:budget(10),originalPageRows:5});
eq(short.shortPageExempt,true);
const exceptional=classifyMeasuredResultV107({budget:budget(10),outputLetters:400,originalPageRows:5,gridPass:true});
eq(exceptional.quantitativePass,true);
eq(exceptional.semanticReviewPassed,false);
eq(exceptional.fullyApproved,false);
const report={lab:'LAB107',date:'2026-11-10',mathAssertionsPassed:checks,
 GeminiCalls:0,approvedForApp:false,liveTrialPassed:false,semanticCertified:false,
 estimates:levels.map((target,i)=>({level:LAB79_AGGREGATE_OBSERVATIONS_V107[i].level,target,
  observed:actual[i],inverse:inverse[i]}))};
console.log(JSON.stringify(report,null,2));
