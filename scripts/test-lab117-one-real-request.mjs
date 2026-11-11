// LAB117 real experimental proof: exactly ONE Gemini request on two PUBLIC
// fixture pages. No APK, no production Worker, no user PDF, no fallback/retry.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {prepareSourceTiersV116} from '../src/lib/studySourceTiersV116.js';
import {macroInstructionV117,macroUserV117,composeSourceMacroV117}
 from '../src/lib/studyConceptMacroV117.js';
import {auditFidelity} from '../src/lib/fidelityEngine.js';
import {STUDY_LEVELS_V67} from '../src/lib/studyRebalancePolicyV67.js';
const dir='audit/reports',outPath=dir+'/lab117-one-real-request.json';
mkdirSync(dir,{recursive:true});
const report={lab:'LAB117',date:'2026-11-11',method:'one-real-request-two-macros-per-original-unit',
 model:'gemini-3.5-flash-lite',freeTierOnly:true,
 userPdfUsed:false,expectedRequests:1,actualRequests:0,
 status:'NOT_STARTED',semanticCertified:false,approvedForApp:false,
 numericCompliantLevels:0,results:[],error:null};
const save=()=>writeFileSync(outPath,JSON.stringify(report,null,2)+'\n');
save();
const key=process.env.AI_TEST_KEY||'';
if(!key){report.error='EXISTING_FREE_KEY_UNAVAILABLE';save();process.exit(2)}
const fixtures=JSON.parse(readFileSync('audit/test-fixtures/lab109-worker-source.json','utf8'));
const units=fixtures.sources.filter(x=>['scienze','procedura'].includes(x.id))
 .map((x,i)=>({id:String(i)+':0',pageStart:i+1,pageEnd:i+1,source:x.text}));
const plan=prepareSourceTiersV116(units);
const editItem={type:'object',additionalProperties:false,
 properties:{compact:{type:'string'},brief:{type:'string'},
  importance:{type:'integer'},essential:{type:'boolean'}},
 required:['compact','brief','importance','essential']};
const unitItem={type:'object',additionalProperties:false,
 properties:{id:{type:'string'},variants:{type:'array',items:editItem},
  macro50:{type:'string'},macroSummary:{type:'string'}},
 required:['id','variants','macro50','macroSummary']};
const schema={type:'json_schema',json_schema:{name:'lab117_source_macro',
 strict:true,schema:{type:'object',additionalProperties:false,
 properties:{units:{type:'array',items:unitItem}},required:['units']}}};
try{
 const start=Date.now();
 report.actualRequests=1;
 report.status='PROVIDER_CALL_PENDING';
 save();
 const response=await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',{
  method:'POST',signal:AbortSignal.timeout(115000),
  headers:{'Content-Type':'application/json',Authorization:'Bearer '+key},
  body:JSON.stringify({model:report.model,temperature:0.1,reasoning_effort:'low',
   max_tokens:11000,response_format:schema,messages:[
    {role:'system',content:macroInstructionV117(plan)},
    {role:'user',content:JSON.stringify(macroUserV117(plan))}]})
 });
 report.elapsedMs=Date.now()-start;
 report.httpStatus=response.status;
 const payload=await response.json().catch(()=>null);
 if(!response.ok){report.error='UPSTREAM_HTTP_'+response.status;
  report.status='BLOCKED_PROVIDER';report.providerStatus=String(payload?.error?.status||'UNKNOWN').slice(0,50);
  save();console.log(JSON.stringify({lab:report.lab,status:report.status,
   httpStatus:report.httpStatus,requests:1}));process.exit(2);}
 report.finishReason=payload?.choices?.[0]?.finish_reason||null;
 report.inputTokensUsed=payload?.usage?.prompt_tokens||null;
 report.outputTokensUsed=payload?.usage?.completion_tokens||null;
 let edits;try{edits=JSON.parse(payload?.choices?.[0]?.message?.content||'')}
 catch{throw Error('INVALID_JSON_ANSWER')}
 report.modelReply=edits; // PUBLIC synthetic pages only; replay with zero provider requests.
 save();
 const computed=composeSourceMacroV117(plan,edits);
 for(const level of STUDY_LEVELS_V67){
  const q=computed.quality[level],parts=computed.partsByLevel[level];
  const standard=['50','summary'].includes(level)?{
   numericAndRows:q.numericAndRows,compliantPages:q.compliantPages,
   totalPages:q.pageCount,percent:q.achievedReduction,
   composerGroups:q.groups
  }:{
   numericAndRows:q.allQuantitative,compliantPages:q.compliantGroups,
   totalPages:q.totalGroups,percent:q.achievedReduction,
   composerGroups:null
  };
  const safety=parts.map((part,i)=>{
   const audit=auditFidelity(units[i].source,part.text);
   return{sourcePage:i+1,fullText:part.text,
    missingProtected:audit.missingProtected.length,
    missingHighValue:audit.missingHighValue.length,
    qualifierMismatches:audit.qualifierMismatches.length,
    heuristicCoverage:audit.coveragePercent,
    heuristicPassed:audit.passed};
  });
  report.results.push({level,...standard,safety,
   numericPass:Boolean(standard.numericAndRows),semanticCertified:false});
 }
 report.numericCompliantLevels=report.results.filter(x=>x.numericPass).length;
 report.heuristicProtectedLevels=report.results.filter(x=>x.safety.every(y=>
  !y.missingProtected&&!y.missingHighValue&&!y.qualifierMismatches)).length;
 report.status=report.numericCompliantLevels===6&&report.heuristicProtectedLevels===6
  ?'NUMERIC_PASS_SEMANTIC_UNVERIFIED':'RESEARCH_NOT_CONFORMANT';
 save();
 console.log(JSON.stringify({lab:report.lab,providerCalls:1,
  elapsedMs:report.elapsedMs,numericLevelPasses:report.numericCompliantLevels,
  protectedHeuristicLevelPasses:report.heuristicProtectedLevels,
  results:report.results.map(x=>({level:x.level,percent:x.percent,
   pages:x.compliantPages,total:x.totalPages,numeric:x.numericPass,
   protectedHeuristic:x.safety.every(y=>!y.missingProtected&&!y.missingHighValue&&!y.qualifierMismatches)})),
  approvedForApp:false},null,2));
 if(report.numericCompliantLevels!==6||report.heuristicProtectedLevels!==6)
  process.exitCode=2;
}catch(e){report.error=String(e?.message||e).slice(0,190);
 report.status='RESEARCH_ERROR';save();console.error(JSON.stringify({
 lab:report.lab,requests:report.actualRequests,status:report.status,error:report.error}));
 process.exitCode=2;}
