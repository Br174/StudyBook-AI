// LAB116: exactly ONE real free-tier Gemini request on PUBLIC synthetic fixtures.
// No private user book is read or uploaded; no retries; no paid fallback.
// This does not install or update the user's existing Android app.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {prepareSourceTiersV116,sourceTierInstructionV116,sourceTierUserV116,
 composeSourceTiersV116,STUDY_SOURCE_TIERS_V116}
 from '../src/lib/studySourceTiersV116.js';
import {auditFidelity} from '../src/lib/fidelityEngine.js';
import {STUDY_LEVELS_V67} from '../src/lib/studyRebalancePolicyV67.js';
const reportPath='audit/reports/lab116-one-real-gemini.json';
const report={lab:'LAB116',method:STUDY_SOURCE_TIERS_V116,
 freeOnly:true,privateUserPdf:false,model:'gemini-3.5-flash-lite',
 scheduledModelCalls:1,actualModelCalls:0,
 semanticCertified:false,approvedForApp:false,results:[],error:null,
 createdAt:new Date().toISOString()};
const save=()=>{mkdirSync('audit/reports',{recursive:true});writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n')};
save();
const key=process.env.AI_TEST_KEY||'';
if(!key){report.error='EXISTING_FREE_TEST_KEY_NOT_CONNECTED';save();process.exit(2)}
const fixture=JSON.parse(readFileSync('audit/test-fixtures/lab109-worker-source.json','utf8'));
const sources=fixture.sources.filter(x=>['scienze','procedura'].includes(x.id));
const units=sources.map((x,i)=>({id:String(i)+':0',pageStart:i+1,pageEnd:i+1,source:x.text}));
const plan=prepareSourceTiersV116(units);
const SCHEMA={type:'json_schema',json_schema:{name:'studybook_lab116_anchored_edits',
 strict:true,schema:{type:'object',additionalProperties:false,
 properties:{units:{type:'array',items:{type:'object',additionalProperties:false,
 properties:{id:{type:'string'},variants:{type:'array',items:{
  type:'object',additionalProperties:false,properties:{
   compact:{type:'string'},brief:{type:'string'},
   importance:{type:'integer'},essential:{type:'boolean'}
  },required:['compact','brief','importance','essential']
 }}}},required:['id','variants']}}},required:['units']}}};
const started=Date.now();
try{
 const signal=AbortSignal.timeout(110000);
 report.actualModelCalls=1;
 const response=await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',{
  method:'POST',signal,headers:{'Content-Type':'application/json',Authorization:'Bearer '+key},
  body:JSON.stringify({model:report.model,temperature:0.1,reasoning_effort:'low',
   max_tokens:8000,response_format:SCHEMA,messages:[
    {role:'system',content:sourceTierInstructionV116(plan)},
    {role:'user',content:JSON.stringify(sourceTierUserV116(plan))}]})
 });
 report.httpStatus=response.status;report.elapsedMs=Date.now()-started;
 const payload=await response.json().catch(()=>null);
 if(!response.ok){
  report.error='GEMINI_HTTP_'+response.status;
  report.providerMessageCode=String(payload?.error?.status||'UNKNOWN').slice(0,65);
  save();console.log(JSON.stringify({lab:report.lab,httpStatus:report.httpStatus,error:report.error,requests:1}));
  process.exit(2);
 }
 const content=payload?.choices?.[0]?.message?.content;
 let edits;
 try{edits=JSON.parse(content)}catch{throw Error('MODEL_INVALID_JSON')}
 report.finishReason=payload?.choices?.[0]?.finish_reason||null;
 report.outputTokensUsed=payload?.usage?.completion_tokens||null;
 report.inputTokensUsed=payload?.usage?.prompt_tokens||null;
 const modelResult=composeSourceTiersV116(plan,edits);
 report.validEditStructure=true;
 report.shortOptionsReturned=edits.units.reduce((n,u)=>n+u.variants.length,0)*2;
 report.results=STUDY_LEVELS_V67.map(level=>{
  const parts=modelResult.partsByLevel[level];
  const metrics=modelResult.quality[level];
  const check=parts.map((part,i)=>{
   const audit=auditFidelity(units[i].source,part.text);
   return{id:part.id,actualText:part.text,
    originalSha256:createHash('sha256').update(units[i].source).digest('hex'),
    outputLetters:metrics.groups[i]?.letterCount||0,
    heuristicProtectedMissing:audit.missingProtected.length,
    heuristicHighValueMissing:audit.missingHighValue.length,
    heuristicQualifierMismatches:audit.qualifierMismatches.length,
    heuristicCoveragePercent:audit.coveragePercent,
    heuristicPassed:audit.passed};
  });
  return{level,achievedReduction:metrics.achievedReduction,
   compliantPages:metrics.compliantGroups,totalPages:metrics.totalGroups,
   allQuantitative:metrics.allQuantitative,semanticCertified:false,
   qualitativeWarnings:check.map(c=>({id:c.id,missingProtected:c.heuristicProtectedMissing,
    missingHighValue:c.heuristicHighValueMissing,qualifierMismatches:c.heuristicQualifierMismatches,
    heuristicPassed:c.heuristicPassed})),reviewText:check};
 });
 report.numericallyCompliantLevels=report.results.filter(x=>x.allQuantitative).length;
 report.finishedAt=new Date().toISOString();save();
 console.log(JSON.stringify({lab:report.lab,providerRequests:1,
  segments:plan.count,elapsedMs:report.elapsedMs,
  numericallyCompliantLevels:report.numericallyCompliantLevels,
  metrics:report.results.map(r=>({level:r.level,percent:r.achievedReduction,
   pagePass:r.compliantPages,of:r.totalPages,
   heuristicNotCertified:r.qualitativeWarnings.map(w=>w.heuristicPassed)})),
  semanticCertified:false,approvedForApp:false},null,2));
 if(report.numericallyCompliantLevels!==6)process.exitCode=2;
}catch(e){report.error=String(e?.message||e).slice(0,130);report.elapsedMs=Date.now()-started;save();
 console.error(JSON.stringify({lab:report.lab,error:report.error,requests:report.actualModelCalls}));
 process.exitCode=2;
}
