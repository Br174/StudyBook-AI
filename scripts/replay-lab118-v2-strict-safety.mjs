// LAB118 V2 actual Gemini response replay under strengthened qualifier guards.
// Uses historical PUBLIC synthetic model answer. NEVER calls Gemini.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {prepareSourceTiersV116} from '../src/lib/studySourceTiersV116.js';
import {validateSourcePatchesV118,composeSourcePatchesV118}
 from '../src/lib/studySourcePatchV118.js';
const raw=JSON.parse(readFileSync('audit/reports/lab118-one-real-source-patches-v2.json','utf8'));
if(raw.lab!=='LAB118-DELTA-V2'||raw.geminiCalls!==1||
 !Array.isArray(raw.rawReply?.units))throw Error('LAB118_V2_REAL_REPLY_REQUIRED');
const f=JSON.parse(readFileSync('audit/test-fixtures/lab109-worker-source.json','utf8'));
const units=f.sources.filter(x=>['scienze','procedura'].includes(x.id))
 .map((x,i)=>({id:i+':0',source:x.text,pageStart:i+1,pageEnd:i+1}));
const plan=prepareSourceTiersV116(units);
const inspected=validateSourcePatchesV118(plan,raw.rawReply);
const rendered=composeSourcePatchesV118(plan,raw.rawReply);
const report={lab:'LAB118-V2-REPLAY',originRun:42960996133,
 originalGeminiCalls:1,additionalGeminiCalls:0,
 originalProposedPatches:raw.rawReply.units.reduce((n,x)=>n+(x.patches?.length||0),0),
 originalAcceptedPatches:raw.acceptedPatches,
 afterHardeningAcceptedPatches:inspected.accepted,
 afterHardeningRejectedPatches:inspected.rejected,
 afterHardeningReasons:inspected.units.map(x=>({page:x.id,rejected:x.rejected})),
 levels:Object.entries(rendered.quality).map(([level,q])=>({
  level,achievedReduction:q.achievedReduction,
  passingPages:q.passingGroups,totalPages:q.totalGroups,
  numericAndRows:q.quantitativePass,
  safeSavingsUpperBoundLetters:q.groups.map(g=>g.maximumSafeSavings),
  feasibility:q.groups.map(g=>g.feasibility)
 })),
 numericLevelPasses:Object.values(rendered.quality).filter(x=>x.quantitativePass).length,
 semanticCertified:false,approvedForApp:false};
mkdirSync('audit/reports',{recursive:true});
writeFileSync('audit/reports/lab118-v2-safety-replay.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({lab:report.lab,additionalGeminiCalls:0,
 beforeAccepted:report.originalAcceptedPatches,
 nowAccepted:report.afterHardeningAcceptedPatches,
 nowRejected:report.afterHardeningRejectedPatches,
 reasons:report.afterHardeningReasons,
 numericLevelPasses:report.numericLevelPasses,
 levels:report.levels.map(x=>({level:x.level,percent:x.achievedReduction,
  pass:x.numericAndRows,reason:x.feasibility})),approvedForApp:false},null,2));
