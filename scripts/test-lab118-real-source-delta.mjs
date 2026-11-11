// LAB118 one NEW real free Gemini request for DELTA-ONLY source patches.
// Two PUBLIC test fixtures, never user PDF or new Worker / Android build.
// Any failed patch remains unapplied and the original source survives.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {prepareSourceTiersV116} from '../src/lib/studySourceTiersV116.js';
import {validateSourcePatchesV118,composeSourcePatchesV118,
 sourcePatchPromptV118} from '../src/lib/studySourcePatchV118.js';
import {STUDY_LEVELS_V67} from '../src/lib/studyRebalancePolicyV67.js';
import {auditFidelity} from '../src/lib/fidelityEngine.js';
const path='audit/reports/lab118-one-real-source-patches.json';
mkdirSync('audit/reports',{recursive:true});
const state={lab:'LAB118-DELTA',model:'gemini-3.5-flash-lite',
 realPrivateBook:false,publicFixtures:true,geminiCalls:0,
 noRetries:true,freeOnly:true,stage:'INITIALIZED',semanticCertified:false,
 approvedForApp:false,results:[],errors:[],rawReply:null};
const save=()=>writeFileSync(path,JSON.stringify(state,null,2)+'\n');
save();
const key=process.env.AI_TEST_KEY||'';
if(!key){state.stage='NO_FREE_KEY';save();process.exit(2)}
const f=JSON.parse(readFileSync('audit/test-fixtures/lab109-worker-source.json','utf8'));
const units=f.sources.filter(x=>['scienze','procedura'].includes(x.id))
 .map((x,i)=>({id:i+':0',source:x.text,pageStart:i+1,pageEnd:i+1}));
const plan=prepareSourceTiersV116(units);
const patch={type:'object',additionalProperties:false,
 properties:{from:{type:'string'},to:{type:'string'},
  occurrence:{type:'integer'},importance:{type:'integer'}},
 required:['from','to','occurrence','importance']};
const unit={type:'object',additionalProperties:false,
 properties:{id:{type:'string'},patches:{type:'array',items:patch},
  macro50:{type:'string'},macroSummary:{type:'string'}},
 required:['id','patches','macro50','macroSummary']};
const schema={type:'json_schema',json_schema:{name:'studybook_lab118_delta_edits',
 strict:true,schema:{type:'object',additionalProperties:false,
  properties:{units:{type:'array',items:unit}},required:['units']}}};
try{
 const started=Date.now();
 state.geminiCalls=1;state.stage='REQUEST_SENT';save();
 const response=await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',{
  method:'POST',signal:AbortSignal.timeout(110000),
  headers:{'Content-Type':'application/json',Authorization:'Bearer '+key},
  body:JSON.stringify({model:state.model,temperature:0.1,
   reasoning_effort:'low',max_tokens:7500,response_format:schema,
   messages:[{role:'system',content:sourcePatchPromptV118()},
    {role:'user',content:JSON.stringify({units:units.map(x=>({
     id:x.id,original:x.source,pageStart:x.pageStart,pageEnd:x.pageEnd
    }))})}]})
 });
 state.elapsedMs=Date.now()-started;state.httpStatus=response.status;
 const payload=await response.json().catch(()=>null);
 if(!response.ok){state.stage='PROVIDER_NOT_AVAILABLE';
  state.errors.push('HTTP_'+response.status);
  state.providerCode=String(payload?.error?.status||'UNKNOWN').slice(0,64);
  save();console.log(JSON.stringify({lab:state.lab,status:state.stage,
   error:state.errors,providerRequests:1}));process.exit(2);}
 state.inputTokens=payload?.usage?.prompt_tokens||null;
 state.outputTokens=payload?.usage?.completion_tokens||null;
 state.finishReason=payload?.choices?.[0]?.finish_reason||null;
 let reply;try{reply=JSON.parse(payload?.choices?.[0]?.message?.content||'')}
 catch{throw Error('PROVIDER_INVALID_JSON')}
 state.rawReply=reply;save(); // Only two PUBLIC synthetic fixtures.
 const inspected=validateSourcePatchesV118(plan,reply);
 const result=composeSourcePatchesV118(plan,reply);
 state.acceptedPatches=inspected.accepted;
 state.rejectedPatches=inspected.rejected;
 state.patchRejections=inspected.units.map(u=>({id:u.id,reasons:u.rejected}));
 state.results=STUDY_LEVELS_V67.map(level=>{
  const q=result.quality[level];
  const original=units;
  const candidates=result.partsByLevel[level];
  const safety=candidates.map((p,i)=>{
   const a=auditFidelity(original[i].source,p.text);
   return{page:i+1,protectedMissing:a.missingProtected.length,
    highValueMissing:a.missingHighValue.length,
    qualifierMismatches:a.qualifierMismatches.length,
    coveragePercent:a.coveragePercent};
  });
  return{level,actualReduction:q.achievedReduction,
   totalPages:q.totalGroups,passingPages:q.passingGroups,
   numericAndRows:q.quantitativePass,
   safety,semanticCertified:false};
 });
 state.numericalPassLevels=state.results.filter(x=>x.numericAndRows).length;
 state.preliminaryFidelityWarnings=state.results.reduce((n,x)=>n+
  x.safety.filter(s=>s.protectedMissing||s.highValueMissing||s.qualifierMismatches).length,0);
 state.stage=state.numericalPassLevels===6&&!state.preliminaryFidelityWarnings?
  'NUMERIC_PASS_BUT_SEMANTIC_UNCERTIFIED':'NOT_READY_INCOMPLETE_NUMERIC_OR_CONCEPTS';
 save();
 console.log(JSON.stringify({lab:state.lab,providerCalls:1,
  elapsedMs:state.elapsedMs,acceptedPatches:state.acceptedPatches,
  rejectedPatches:state.rejectedPatches,
  numericalPassLevels:state.numericalPassLevels,
  preliminaryFidelityWarnings:state.preliminaryFidelityWarnings,
  levels:state.results.map(x=>({level:x.level,reduction:x.actualReduction,
   pagePasses:x.passingPages,totalPages:x.totalPages,numeric:x.numericAndRows})),
  semanticCertified:false,approvedForApp:false},null,2));
 if(state.stage.startsWith('NOT_READY'))process.exitCode=2;
}catch(e){state.stage='RESEARCH_ERROR';
 state.errors.push(String(e?.message||e).slice(0,220));save();
 console.error(JSON.stringify({lab:state.lab,status:state.stage,
  errors:state.errors,geminiCalls:state.geminiCalls}));process.exitCode=2;}
