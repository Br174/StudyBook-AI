// LAB119 old real model response, NO NEW Gemini calls.
// Assert that model-generated filler/metadata never qualifies as educational prose.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {prepareSemanticLadderV119,composeSemanticLadderV119}
 from '../src/lib/studySemanticLadderV119.js';
import {STUDY_LEVELS_V67} from '../src/lib/studyRebalancePolicyV67.js';
const report=JSON.parse(readFileSync('audit/reports/lab119-one-real-response.json','utf8'));
assert.equal(report.lab,'LAB119');
assert.equal(report.requests,1);
const f=JSON.parse(readFileSync('audit/test-fixtures/lab109-worker-source.json','utf8'));
const units=f.sources.filter(x=>['scienze','procedura'].includes(x.id))
 .map((x,i)=>({id:i+':0',source:x.text,pageStart:i+1,pageEnd:i+1}));
const plan=prepareSemanticLadderV119(units);
const out=composeSemanticLadderV119(plan,report.rawReply);
const invalid=out.quality['10'].meaningDiagnostics.flatMap(x=>
 x.invalidGeneratedFields.map(f=>({unit:x.id,...f})));
assert.equal(invalid.length,2,'Both real extra10 strings were placeholders');
assert.ok(invalid.every(v=>v.field==='extra10'),'Only last field is fabricated in this fixture');
assert.equal(out.allSixNumeric,false);
assert.equal(out.allSixPreliminarySafe,false);
const observations={
 lab:'LAB119',mode:'REPLAY_ONE_REAL_ANSWER_ZERO_PROVIDER_CALLS',
 originalRealCall:42985330555,additionalGeminiCalls:0,
 source:'two PUBLIC synthetic pages',
 numericPassedLevels:STUDY_LEVELS_V67.filter(l=>out.quality[l].numericAndRowsPass),
 invalidGeneratedFields:invalid,
 contentRiskByLevel:STUDY_LEVELS_V67.map(level=>({
  level,percent:out.quality[level].achievedReduction,
  pagesPass:out.quality[level].compliantPages,
  allPages:out.quality[level].pageCount,
  preliminaryContentSafe:out.quality[level].strictPreliminarySafe,
  perPage:out.quality[level].meaningDiagnostics.map(x=>({
   page:x.id,invalidFields:x.invalidGeneratedFields,
   missingProtected:x.protectedMissing,missingHighValue:x.highValueMissing,
   ungroundedAdditions:x.ungroundedAdditions,
   directional:x.directionalAdvisories
  }))
 })),
 semanticCertified:false,approvedForApp:false
};
mkdirSync('audit/reports',{recursive:true});
writeFileSync('audit/reports/lab119-replay-placeholder-diagnosis.json',
 JSON.stringify(observations,null,2)+'\n');
console.log(JSON.stringify({lab:observations.lab,requests:0,
 numericPassedLevels:observations.numericPassedLevels,
 placeholdersRejected:invalid.length,
 sourceOrAdditionalFactRiskDetected:true,approvedForApp:false},null,2));
