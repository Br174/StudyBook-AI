// LAB117: reuse EXACT stored Gemini answer; no token spending.
// Read-only diagnosis: Why model macros fail count and/or fidelity.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {prepareSourceTiersV116} from '../src/lib/studySourceTiersV116.js';
import {composeSourceMacroV117,inspectMacroCandidateV117}
 from '../src/lib/studyConceptMacroV117.js';
import {inspectBestOfV76} from '../src/lib/studyBestOfV76.js';
import {STUDY_LEVELS_V67} from '../src/lib/studyRebalancePolicyV67.js';
const input=process.argv[2]||'audit/reports/lab117-one-real-request.json';
const saved=JSON.parse(readFileSync(input,'utf8'));
if(saved.lab!=='LAB117'||saved.actualRequests!==1||!saved.modelReply)
 throw Error('LAB117_REQUIRES_EXACT_SAVED_GEMINI_REPLY');
const fixture=JSON.parse(readFileSync('audit/test-fixtures/lab109-worker-source.json','utf8'));
const units=fixture.sources.filter(x=>['scienze','procedura'].includes(x.id))
 .map((x,i)=>({id:i+':0',pageStart:i+1,pageEnd:i+1,source:x.text}));
const plan=prepareSourceTiersV116(units);
const results=composeSourceMacroV117(plan,saved.modelReply);
const diagnosis={lab:'LAB117',mode:'NO_PROVIDER_REPLAY',sourceRun:42951777342,
 additionalGeminiCalls:0,originalGeminiCalls:1,
 macroDetails:[],levels:[],semanticCertified:false,approvedForApp:false};
for(let i=0;i<units.length;i++){
 const original=units[i],reply=saved.modelReply.units[i];
 const records=['50','summary'].map(level=>{
  const item=level==='50'?'macro50':'macroSummary';
  return{level,...inspectMacroCandidateV117(original.source,reply[item],level)};
 });
 diagnosis.macroDetails.push({page:i+1,records});
}
for(const level of STUDY_LEVELS_V67){
 const parts=results.partsByLevel[level];
 const q=results.quality[level];
 const isMacro=['summary','50'].includes(level);
 const warnings=parts.map((part,i)=>{
  const v=inspectBestOfV76(units[i].source,part.text,level);
  return{page:i+1,sourceScopedSemanticAdvisories:v.semanticAdvisories,
   semanticCertified:v.semanticCertified};
 });
 diagnosis.levels.push({level,
  achievedPercent:q.achievedReduction,
  numericAndRows:isMacro?q.numericAndRows:q.allQuantitative,
  passingPages:isMacro?q.compliantPages:q.compliantGroups,
  totalPages:isMacro?q.pageCount:q.totalGroups,
  meaningRiskWarnings:warnings,
  status:isMacro?q.groups.map(x=>x.feasibility):null
 });
}
diagnosis.numericLevelPasses=diagnosis.levels.filter(x=>x.numericAndRows).length;
diagnosis.candidateMacroSafetyPasses=diagnosis.macroDetails.flatMap(x=>x.records)
 .filter(x=>x.safetyCandidateAccepted).length;
mkdirSync('audit/reports',{recursive:true});
writeFileSync('audit/reports/lab117-offline-replay.json',JSON.stringify(diagnosis,null,2)+'\n');
console.log(JSON.stringify({lab:'117',replay:true,additionalGeminiCalls:0,
 numericLevelPasses:diagnosis.numericLevelPasses,
 macroCandidateSafetyPasses:diagnosis.candidateMacroSafetyPasses,
 sampledMacros:4,
 macros:diagnosis.macroDetails.map(g=>({page:g.page,
  checks:g.records.map(x=>({level:x.level,actual:x.actualReduction,
   target:x.target,withinUnitLetterBand:x.withinUnitLetterBand,
   safety:x.safetyCandidateAccepted,protected:x.missingProtected,
   highValue:x.missingHighValue,qualifiers:x.qualifierMismatches,
   directional:x.directionalAdvisories}))})),
 warningLevels:diagnosis.levels.filter(x=>x.meaningRiskWarnings.some(w=>
  w.sourceScopedSemanticAdvisories.length)).map(x=>x.level),
 semanticCertified:false,approvedForApp:false},null,2));
if(diagnosis.numericLevelPasses<6)process.exitCode=2;
