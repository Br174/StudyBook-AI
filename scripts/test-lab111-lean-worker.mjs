// LAB111: actual Worker route with fake Gemini for all six versions;
// verifies one model call, no token-count request on small bounded blocks.
// No API cost, no original text logged, no application deployment.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import handler from '../api/editionsBulkV51.js';
import {STUDY_DRAFT_PROTOCOL_V74} from '../src/lib/studyDraftProtocolV74.js';
import {STUDY_GEOMETRY_V78} from '../src/lib/studyGeometryV78.js';
import {pageLetterBudgetsV74} from '../src/lib/studyPageBudgetsV74.js';
import {buildUnitBudgetsV71} from '../src/lib/studyDraftProtocolV71.js';
import {studyLetters} from '../src/lib/studyPillarV38.js';
import {STUDY_LEAN_PERCENT_V111} from '../src/lib/studyLeanPercentV111.js';
import {STUDY_TARGET_V67} from '../src/lib/studyRebalancePolicyV67.js';
const f=JSON.parse(readFileSync('audit/test-fixtures/lab109-worker-source.json','utf8'));
const text=f.sources.find(x=>x.id==='scienze').text;
let assertions=0,geminiFakeCalls=0,tokenFakeCalls=0;
const yes=(v,msg)=>{assert.ok(v,msg);assertions++};
const eq=(a,b,msg)=>{assert.deepEqual(a,b,msg);assertions++};
const u={id:'1:1',source:text,pageStart:1,pageEnd:1};
function body(level,pilot=true){
 const units=[u],budget=pageLetterBudgetsV74(units,level);
 return {level,phase:'draft-v74',draftProtocol:STUDY_DRAFT_PROTOCOL_V74,
  geometryPolicyV78:STUDY_GEOMETRY_V78,units,
  targetLetters:level==='summary'?null:budget[0].targetLetters,
  summaryCapLetters:level==='summary'?budget[0].targetLetters:null,
  unitBudgets:buildUnitBudgetsV71(units,level),pageBudgetsV74:budget,
  maxOutputTokens:6000,timeoutMs:60000,
  ...(pilot?{experimentV111:STUDY_LEAN_PERCENT_V111}:{})
 };
}
async function run(level,{pilot=true,flag=true,mutate=false,conflict=false,largeSource=null}={}){
 let b=body(level,pilot);
 if(largeSource){
  b.units=[{...u,source:largeSource}];
  b.pageBudgetsV74=pageLetterBudgetsV74(b.units,level);
  b.unitBudgets=buildUnitBudgetsV71(b.units,level);
  const target=b.pageBudgetsV74[0].targetLetters;
  b.targetLetters=level==='summary'?null:target;
  b.summaryCapLetters=level==='summary'?target:null;
 }
 if(mutate)b.pageBudgetsV74[0].targetLetters+=7;
 if(conflict)b.experimentV110b='source-clause-soft-budget-40-optin-v110b';
 let model=0,countTokens=0,modelPrompt='';
 const req={method:'POST',body:b,headers:{},env:{
  AI_API_KEY:'fake-only',AI_MODEL:'gemini-3.5-flash-lite',
  STUDYBOOK_LEAN_PERCENT_V111:flag?'1':'0'}};
 const res={code:200,jsonBody:null,status(n){this.code=n;return this},
  json(v){this.jsonBody=v;return this},setHeader(){}};
 const oldFetch=globalThis.fetch;
 globalThis.fetch=async(uri,opts)=>{
  if(String(uri).includes(':countTokens')){countTokens++;tokenFakeCalls++;return Response.json({totalTokens:2000})}
  model++;geminiFakeCalls++;
  modelPrompt=JSON.parse(opts.body).messages?.[0]?.content||'';
  return Response.json({choices:[{message:{content:JSON.stringify({parts:[{id:'1:1',text:f.historicalScience40.text}]})},finish_reason:'stop'}]});
 };
 try{await handler(req,res)}finally{globalThis.fetch=oldFetch}
 return {status:res.code,result:res.jsonBody,model,countTokens,modelPrompt};
}
for(const level of ['summary','50','40','30','20','10']){
 const r=await run(level);
 eq(r.status,200,level+' returned HTTP200');
 eq(r.model,1,level+' exactly one generated response');
 eq(r.countTokens,0,level+' no extra provider token-count call');
 eq(r.result.leanPercentPilotV111,STUDY_LEAN_PERCENT_V111);
 eq(r.result.draftProtocol,STUDY_DRAFT_PROTOCOL_V74);
 eq(r.result.semanticCertified,false);
 eq(r.result.approvedForApp,false);
 eq(r.result.bestOfInstruction,null);
 const reduction=STUDY_TARGET_V67[level].target;
 yes(r.modelPrompt.includes('elimina '+reduction+'%'),level+' displayed proper reduction');
 yes(r.modelPrompt.includes('CONSERVA circa '+(100-reduction)+'%'),level+' proper letters retained');
 yes(r.modelPrompt.includes('~'+r.result.lengthReview.pageReviewV74.groups[0].targetLetters),level+' source official budget present');
 yes(!r.modelPrompt.includes('PAGINA C1')&&!r.modelPrompt.includes('LAB97–99'),level+' no legacy stacked prompt');
}
const old=await run('20',{pilot:false,flag:false});
eq(old.status,200);eq(old.model,1);eq(old.countTokens,1);eq(old.result.leanPercentPilotV111,undefined);
const unauthorized=await run('10',{flag:false});
eq(unauthorized.status,409);eq(unauthorized.model,0);eq(unauthorized.countTokens,0);
const falsified=await run('30',{mutate:true});
eq(falsified.status,409);eq(falsified.model,0);eq(falsified.countTokens,0);
const conflicted=await run('40',{conflict:true});
eq(conflicted.status,409);eq(conflicted.model,0);eq(conflicted.countTokens,0);
console.log(JSON.stringify({lab:'LAB111',assertions,sourceLetters:studyLetters(text),
 levels:6,modelCallsMadeToRealProvider:0,mockedGenerations:geminiFakeCalls,
 mockedTokenCounts:tokenFakeCalls,defaultLAB79Preserved:true,
 zeroUnrequestedRepairs:true,noAutomaticDidacticApproval:true}));
