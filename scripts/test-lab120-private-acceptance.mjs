// LAB120 isolated tests; no real Gemini calls, no Android app change.
// Prove model sees ONLY the precise center; the wider validation is PRIVATE.
import assert from 'node:assert/strict';
import {studyLetters} from '../src/lib/studyPillarV38.js';
import {STUDY_USER_STAGES_V120,privateBandV120,providerTargetV120,
 geminiStrictBriefV120,privateReviewV120,
 assessExistingDraftsV120,assertPrivateNotLeakedV120}
 from '../src/lib/studyPrivateAcceptanceV120.js';
const cases=[
 ['10',15,10,20],
 ['20',25,20,30],
 ['30',35,30,40],
 ['40',45,40,50],
 ['summary',55,50,60]
];
let checks=0;function eq(a,b,m){assert.deepEqual(a,b,m);checks++}
function ok(x,m){assert.ok(x,m);checks++}
eq(STUDY_USER_STAGES_V120,['10','20','30','40','summary']);
const original='a'.repeat(1000);
const model=geminiStrictBriefV120([{id:'P1',source:original}]);
ok(assertPrivateNotLeakedV120(model));
eq(Object.keys(model.sourceUnits[0].goals[0]),
 ['stage','reductionTarget','retainedTarget','targetLetters']);
ok(!JSON.stringify(model).includes('10-20'));
ok(!JSON.stringify(model).includes('50-60'));
for(const [stage,center,min,max] of cases){
 const p=privateBandV120(stage);
 eq(p.idealReduction,center);
 eq(p.acceptanceMinimum,min);
 eq(p.acceptanceMaximum,max);
 const provider=providerTargetV120(stage,1000);
 eq(provider.reductionTarget,center);
 eq(provider.targetLetters,1000*(100-center)/100);
 ok(!('acceptanceMinimum' in provider));
 const a=privateReviewV120({stage,originalLetters:1000,
  outputLetters:1000*(100-center)/100,
  contentVerified:true,gridVerified:true});
 eq(a.actualReductionPercent,center);
 eq(a.accepted,true);
 eq(a.distanceFromIdealPercentagePoints,0);
 for(const reduction of [min,max]){
  const bounds=privateReviewV120({stage,originalLetters:1000,
   outputLetters:1000*(100-reduction)/100,
   contentVerified:true,gridVerified:true});
  eq(bounds.quantityPass,true,'Both tolerance ends are inclusive');
 }
 for(const reduction of [min-.1,max+.1]){
  const extra=privateReviewV120({stage,originalLetters:1000,
   outputLetters:1000*(100-reduction)/100,
   contentVerified:true,gridVerified:true});
  eq(extra.quantityPass,false,'Outside acceptance is rejected');
 }
 const wrongMeaning=privateReviewV120({stage,originalLetters:1000,
  outputLetters:1000*(100-center)/100,
  contentVerified:false,gridVerified:true});
 eq(wrongMeaning.quantityPass,true);
 eq(wrongMeaning.accepted,false,'Correct numbers without meanings NEVER pass');
 const wrongRows=privateReviewV120({stage,originalLetters:1000,
  outputLetters:1000*(100-center)/100,
  contentVerified:true,gridVerified:false});
 eq(wrongRows.accepted,false);
}
assert.throws(()=>providerTargetV120('50',1000),/NOT_IN_NEW_FIVE_BANDS/);checks++;
assert.throws(()=>geminiStrictBriefV120([{id:'P1',source:original},
 {id:'P1',source:original}]),/DUPLICATED/);checks++;
assert.throws(()=>assertPrivateNotLeakedV120({
 system:'I margini accettabili sono 10-20',
 acceptanceMaximum:20
}),/PRIVATE_ACCEPTANCE_LEAK/);checks++;
const drafts=Object.fromEntries(STUDY_USER_STAGES_V120.map(stage=>{
 const b=providerTargetV120(stage,1000);
 return [stage,[{id:'P1',text:'a'.repeat(b.targetLetters)}]];
}));
const measured=assessExistingDraftsV120([{id:'P1',source:original}],drafts,{
 contentVerified:false,gridVerified:true
});
eq(measured.length,5);
ok(measured.every(m=>m.quantityPass));
ok(measured.every(m=>m.accepted===false),'Quantity alone never certifies education');
const missing=assessExistingDraftsV120([{id:'P1',source:original}],
 {...drafts,summary:[]},{contentVerified:true,gridVerified:true});
eq(missing[4].completeSource,false);
eq(missing[4].accepted,false);
console.log(JSON.stringify({lab:'LAB120',checks,
 modelGoalCenters:cases.map(([stage,ideal])=>({stage,ideal})),
 acceptanceBandsPrivate:cases.map(([stage,_,min,max])=>({stage,min,max})),
 wideBandsExposedToGemini:false,
 semanticVerificationRequired:true,existingInstalledAppChanged:false,
 modelCalls:0,apkReady:false},null,2));
