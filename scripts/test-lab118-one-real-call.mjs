// LAB118: one provider call, public synthetic sources ONLY, strictly free tier.
// The response is saved even on failure, no retries, no release.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {prepareSourceTiersV116} from '../src/lib/studySourceTiersV116.js';
import {buildClaimLedgerV118,claimPromptV118,claimUserV118,composeAndAuditClaimsV118}
 from '../src/lib/studyClaimLedgerV118.js';
import {STUDY_LEVELS_V67} from '../src/lib/studyRebalancePolicyV67.js';
import {auditFidelity} from '../src/lib/fidelityEngine.js';
const path='audit/reports/lab118-one-real-claim-evidence.json';
mkdirSync('audit/reports',{recursive:true});
const doc={lab:'LAB118',model:'gemini-3.5-flash-lite',
 privateBook:false,pages:2,modelCalls:0,noRetry:true,freeOnly:true,
 semanticCertified:false,approvedForApp:false,stage:'INITIALIZED',
 error:null,modelReply:null,levels:[],evidence:[]};
const save=()=>writeFileSync(path,JSON.stringify(doc,null,2)+'\n');
save();
const key=process.env.AI_TEST_KEY||'';
if(!key){doc.error='FREE_KEY_NOT_ACCESSIBLE';doc.stage='BLOCKED';save();process.exit(2)}
const fixture=JSON.parse(readFileSync('audit/test-fixtures/lab109-worker-source.json','utf8'));
const source=fixture.sources.filter(x=>['scienze','procedura'].includes(x.id))
 .map((x,i)=>({id:i+':0',pageStart:i+1,pageEnd:i+1,source:x.text}));
const plan=prepareSourceTiersV116(source),ledger=buildClaimLedgerV118(plan);
const edit={type:'object',additionalProperties:false,
 properties:{compact:{type:'string'},brief:{type:'string'},
  importance:{type:'integer'},essential:{type:'boolean'}},
 required:['compact','brief','importance','essential']};
const evidence={type:'object',additionalProperties:false,
 properties:{id:{type:'string'},quote:{type:'string'}},
 required:['id','quote']};
const unit={type:'object',additionalProperties:false,
 properties:{id:{type:'string'},variants:{type:'array',items:edit},
  macro50:{type:'string'},macroSummary:{type:'string'},
  claimEvidence50:{type:'array',items:evidence},
  claimEvidenceSummary:{type:'array',items:evidence}},
 required:['id','variants','macro50','macroSummary','claimEvidence50','claimEvidenceSummary']};
const schema={type:'json_schema',json_schema:{name:'studybook_lab118_source_claims',
 strict:true,schema:{type:'object',additionalProperties:false,
  properties:{units:{type:'array',items:unit}},required:['units']}}};
try{
 const start=Date.now();
 doc.stage='REQUEST_SUBMITTED';doc.modelCalls=1;save();
 const response=await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',{
  method:'POST',signal:AbortSignal.timeout(110000),
  headers:{'Content-Type':'application/json',Authorization:'Bearer '+key},
  body:JSON.stringify({model:doc.model,reasoning_effort:'low',temperature:0.1,
   max_tokens:16000,response_format:schema,messages:[
    {role:'system',content:claimPromptV118(plan,ledger)},
    {role:'user',content:JSON.stringify(claimUserV118(plan,ledger))}]})
 });
 doc.elapsedMs=Date.now()-start;doc.httpStatus=response.status;
 const payload=await response.json().catch(()=>null);
 if(!response.ok){
  doc.stage='PROVIDER_REFUSED';doc.error='HTTP_'+response.status;
  doc.providerCode=String(payload?.error?.status||'UNKNOWN').slice(0,75);
  save();console.log(JSON.stringify({lab:doc.lab,modelCalls:1,status:doc.error}));
  process.exit(2);
 }
 doc.inputTokens=payload?.usage?.prompt_tokens??null;
 doc.outputTokens=payload?.usage?.completion_tokens??null;
 doc.finishReason=payload?.choices?.[0]?.finish_reason??null;
 let reply;
 try{reply=JSON.parse(payload?.choices?.[0]?.message?.content||'')}
 catch{throw Error('MODEL_RETURNED_INVALID_JSON')}
 doc.modelReply=reply;save(); // No secrets, only publicly synthetic source.
 const result=composeAndAuditClaimsV118(plan,reply);
 doc.evidence=result.claimAudit.units.map(u=>({
  id:u.id,claimCount:u.claimCount,distinctClaims:u.distinctClaims,
  fifty:{actual:u.levels['50'].actualReduction,
   numeric:u.levels['50'].numericInBand,
   evidenceComplete:u.levels['50'].evidence.complete,
   missingRequired:u.levels['50'].evidence.missingRequired,
   globalSafety:u.levels['50'].globalSafety,
   evidence:u.levels['50'].evidence.claimResults},
  summary:{actual:u.levels.summary.actualReduction,
   numeric:u.levels.summary.numericInBand,
   evidenceComplete:u.levels.summary.evidence.complete,
   missingRequired:u.levels.summary.evidence.missingRequired,
   globalSafety:u.levels.summary.globalSafety,
   evidence:u.levels.summary.evidence.claimResults}
 }));
 doc.levels=STUDY_LEVELS_V67.map(level=>{
  const raw=result.quality[level];
  const macro=['50','summary'].includes(level);
  const pages=result.partsByLevel[level];
  const warnings=pages.map((p,i)=>{
   const f=auditFidelity(source[i].source,p.text);
   return{page:i+1,protectedMissing:f.missingProtected.length,
    highValueMissing:f.missingHighValue.length,
    qualifierMismatches:f.qualifierMismatches.length};
  });
  return{level,actualReduction:raw.achievedReduction,
   pagePasses:macro?raw.compliantPages:raw.compliantGroups,
   totalPages:macro?raw.pageCount:raw.totalGroups,
   numericAndRows:macro?raw.numericAndRows:raw.allQuantitative,
   warnings,semanticCertified:false};
 });
 doc.numericLevels=doc.levels.filter(x=>x.numericAndRows).length;
 doc.evidenceUnits=doc.evidence.filter(x=>
  x.fifty.evidenceComplete&&x.summary.evidenceComplete).length;
 doc.protectedWarnings=doc.levels.reduce((n,l)=>n+
  l.warnings.filter(x=>x.protectedMissing||x.highValueMissing||x.qualifierMismatches).length,0);
 doc.stage=doc.numericLevels===6&&doc.evidenceUnits===2&&!doc.protectedWarnings
  ?'NUMERIC_AND_PRELIMINARY_EVIDENCE_PASS_NOT_SEMANTIC_CERTIFIED':
   'FAIL_AT_LEAST_ONE_QUANTITATIVE_OR_EVIDENCE_GATE';
 save();
 console.log(JSON.stringify({lab:doc.lab,providerCalls:1,elapsedMs:doc.elapsedMs,
  originalClaims:ledger.totalClaims,distinctClaims:ledger.uniqueClaims,
  numericLevels:doc.numericLevels,preliminaryEvidenceUnits:doc.evidenceUnits,
  protectedWarnings:doc.protectedWarnings,
  levels:doc.levels.map(x=>({name:x.level,reduction:x.actualReduction,
   numeric:x.numericAndRows,pagePasses:x.pagePasses})),
  semanticCertified:false,approvedForApp:false},null,2));
 if(doc.stage.startsWith('FAIL'))process.exitCode=2;
}catch(e){doc.stage='RESEARCH_ERROR';doc.error=String(e?.message||e).slice(0,250);
 save();console.error(JSON.stringify({lab:doc.lab,stage:doc.stage,
 error:doc.error,modelCalls:doc.modelCalls}));process.exitCode=2;}
