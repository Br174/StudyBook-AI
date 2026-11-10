// LAB116 offline replay: REUSE EXACTLY ONE previous real Gemini answer.
// No provider calls. This is a synthetic fixture, never the user's PDF.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {prepareSourceTiersV116,composeSourceTiersV116}
 from '../src/lib/studySourceTiersV116.js';
import {STUDY_LEVELS_V67} from '../src/lib/studyRebalancePolicyV67.js';
import {auditFidelity} from '../src/lib/fidelityEngine.js';
const saved=JSON.parse(readFileSync(process.argv[2]||
 'audit/reports/lab116-one-real-gemini.json','utf8'));
if(saved.lab!=='LAB116'||!saved.modelEdits||saved.actualModelCalls!==1)
 throw Error('LAB116_PREVIOUS_SINGLE_REAL_ANSWER_REQUIRED');
const fixture=JSON.parse(readFileSync('audit/test-fixtures/lab109-worker-source.json','utf8'));
const units=fixture.sources.filter(x=>['scienze','procedura'].includes(x.id))
 .map((x,i)=>({id:String(i)+':0',pageStart:i+1,pageEnd:i+1,source:x.text}));
const plan=prepareSourceTiersV116(units);
const result=composeSourceTiersV116(plan,saved.modelEdits);
const output={lab:'LAB116',replayedFrom:'real-call-ci-42921705373',providerCalls:0,
 originalProviderCalls:1,privatePdfUsed:false,
 semanticCertified:false,approvedForApp:false,results:[]};
for(const level of STUDY_LEVELS_V67){
 const metrics=result.quality[level],parts=result.partsByLevel[level];
 const flags=parts.map((part,i)=>{
  const a=auditFidelity(units[i].source,part.text);
  return{page:i+1,missingHighValue:a.missingHighValue.length,
   missingProtected:a.missingProtected.length,
   qualifierMismatches:a.qualifierMismatches.length,
   heuristicPassed:a.passed,coveragePercent:a.coveragePercent,
   outputText:part.text};
 });
 output.results.push({level,percent:metrics.achievedReduction,
   numericPass:metrics.allQuantitative,conformingPages:metrics.compliantGroups,
   totalPages:metrics.totalGroups,protectedHeuristicPass:
     flags.every(x=>!x.missingHighValue&&!x.missingProtected&&!x.qualifierMismatches),
   flags});
}
output.numericLevelPasses=output.results.filter(x=>x.numericPass).length;
output.heuristicLevelPasses=output.results.filter(x=>x.protectedHeuristicPass).length;
mkdirSync('audit/reports',{recursive:true});
writeFileSync('audit/reports/lab116-replay-from-real-answer.json',JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({lab:output.lab,offline:true,providerCalls:0,
 numericLevelPasses:output.numericLevelPasses,
 heuristicLevelPasses:output.heuristicLevelPasses,
 results:output.results.map(r=>({level:r.level,percent:r.percent,pages:r.conformingPages,
  protectedHeuristicPass:r.protectedHeuristicPass}))},null,2));
if(output.numericLevelPasses!==6||output.heuristicLevelPasses!==6)process.exitCode=2;
