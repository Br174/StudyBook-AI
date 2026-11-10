// StudyBook LAB110: actual Worker route and deterministic source inventory,
// without external API calls, deployment, or app changes.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import handler from '../api/editionsBulkV51.js';
import {studyLetters} from '../src/lib/studyPillarV38.js';
import {STUDY_DRAFT_PROTOCOL_V74} from '../src/lib/studyDraftProtocolV74.js';
import {STUDY_GEOMETRY_V78,studyGeometryPlanV78} from '../src/lib/studyGeometryV78.js';
import {STUDY_FACT_FIRST_V109} from '../src/lib/studyFactFirstV109.js';
import {STUDY_SOURCE_LEDGER_V110,buildSourceLedgerV110,
  sourceLedgerInstructionV110} from '../src/lib/studySourceLedgerV110.js';
import {pageLetterBudgetsV74} from '../src/lib/studyPageBudgetsV74.js';
import {buildUnitBudgetsV71} from '../src/lib/studyDraftProtocolV71.js';

const fixture=JSON.parse(readFileSync('audit/test-fixtures/lab109-worker-source.json','utf8'));
const science=fixture.sources.find(x=>x.id==='scienze').text;
let checks=0;
const eq=(a,b,m)=>{assert.deepEqual(a,b,m);checks++};
const yes=(x,m)=>{assert.ok(x,m);checks++};
const throws=(f,re)=>{assert.throws(f,re);checks++};
const unit=(source=science)=>({id:'1:1',source,pageStart:1,pageEnd:1,chapterTitle:'Scienze'});
function body({pilot=null,level='40',source=science,invalidBudget=false}={}){
 const units=[unit(source)],budgets=pageLetterBudgetsV74(units,level);
 if(invalidBudget)budgets[0].targetLetters++;
 return {level,phase:'draft-v74',draftProtocol:STUDY_DRAFT_PROTOCOL_V74,
  geometryPolicyV78:STUDY_GEOMETRY_V78,units,
  unitBudgets:buildUnitBudgetsV71(units,level),pageBudgetsV74:budgets,
  bookTitle:'LAB110 controlled offline source',targetLetters:Math.round(studyLetters(source)*(1-Number(level)/100)),
  maxOutputTokens:4096,timeoutMs:65000,
  ...(pilot==='110'?{experimentV110:STUDY_SOURCE_LEDGER_V110}:{}),
  ...(pilot==='109'?{experimentV109:STUDY_FACT_FIRST_V109}:{})
 };
}
function response(){
 return {statusCode:200,data:null,headers:{},setHeader(k,v){this.headers[k]=v;return this},
  status(n){this.statusCode=n;return this},json(x){this.data=x;return this}};
}
async function invoke({pilot=null,flag110=false,flag109=false,invalidBudget=false,level='40',source=science,upstreamStatus=200}={}){
 const req={method:'POST',body:body({pilot,level,source,invalidBudget}),headers:{},
  env:{AI_API_KEY:'test-only-key',AI_MODEL:'gemini-3.5-flash-lite',
   STUDYBOOK_SOURCE_LEDGER_V110:flag110?'1':'0',
   STUDYBOOK_FACT_FIRST_V109:flag109?'1':'0'}};
 const res=response();
 const nativeFetch=globalThis.fetch;
 let models=0,tokens=0,prompt='';
 globalThis.fetch=async(url,init)=>{
  if(String(url).includes(':countTokens')){tokens++;return Response.json({totalTokens:900})}
  models++;
  prompt=JSON.parse(init.body).messages[0].content;
  if(upstreamStatus!==200)return Response.json({error:{message:'Quota di collaudo'}},{status:upstreamStatus});
  return Response.json({choices:[{message:{content:JSON.stringify({parts:[{id:'1:1',text:fixture.historicalScience40.text}]})},
    finish_reason:'stop'}],usage:{completion_tokens:150}});
 };
 try{await handler(req,res)}finally{globalThis.fetch=nativeFetch}
 return {status:res.statusCode,data:res.data,prompt,models,tokens};
}
const geometry=studyGeometryPlanV78([unit()],'40'),ledger=buildSourceLedgerV110([unit()],geometry);
eq(ledger.groups.length,1);
eq(ledger.groups[0].count,9);
eq(ledger.groups[0].sourceLetters,599);
eq(ledger.groups[0].clauses.length,9);
yes(ledger.groups[0].clauses.some(x=>x.sourceClause.includes('distinguere fra descrizione')));
yes(ledger.groups[0].clauses.some(x=>x.markers.includes('DISTINCTION')));
yes(ledger.groups[0].clauses.some(x=>x.markers.includes('NEGATION_OR_EXCLUSION')));
yes(ledger.groups[0].clauses.every(x=>x.unitId==='1:1'));
const inventoryPrompt=sourceLedgerInstructionV110('40','draft-v74',geometry,ledger);
yes(inventoryPrompt.includes('LETTERE'));
yes(inventoryPrompt.includes('P1 C9'));
yes(inventoryPrompt.includes('caus'));
throws(()=>buildSourceLedgerV110([unit('A'.repeat(3000)+'.')],studyGeometryPlanV78([unit('A'.repeat(3000)+'.')],'40')),/TOO|MISMATCH/);
throws(()=>sourceLedgerInstructionV110('10','draft-v74',geometry,ledger),/INVALID_LEVEL/);
const baseline=await invoke();
eq(baseline.status,200);
eq(baseline.models,1);
eq(baseline.data.sourceLedgerPilotV110,undefined);
yes(baseline.prompt.includes('LAB97–99')||baseline.prompt.includes('best-of'));
const allowed=await invoke({pilot:'110',flag110:true});
eq(allowed.status,200);
eq(allowed.tokens,1);
eq(allowed.models,1);
eq(allowed.data.sourceLedgerPilotV110,STUDY_SOURCE_LEDGER_V110);
eq(allowed.data.ledgerClauseCountV110,9);
eq(allowed.data.semanticCertified,false);
eq(allowed.data.approvedForApp,false);
yes(allowed.prompt.includes('P1 C9'));
yes(!allowed.prompt.includes('LAB97–99'));
eq(allowed.data.geometryReviewV78.policy,STUDY_GEOMETRY_V78);
const blocked=await invoke({pilot:'110'});
eq(blocked.status,409);
eq(blocked.models,0);
eq(blocked.tokens,0);
eq(blocked.data.code,'AI_SOURCE_LEDGER_PILOT_UNAVAILABLE');
const brokenBudget=await invoke({pilot:'110',flag110:true,invalidBudget:true});
eq(brokenBudget.status,409);
eq(brokenBudget.models,0);
eq(brokenBudget.data.code,'AI_PAGE_BUDGET_MISMATCH');
const outOfScope=await invoke({pilot:'110',flag110:true,source:'lorem '.repeat(500)+'fine.'});
eq(outOfScope.status,422);
eq(outOfScope.models,0);
eq(outOfScope.data.code,'AI_SOURCE_LEDGER_OUT_OF_SCOPE');
const quota=await invoke({pilot:'110',flag110:true,upstreamStatus:429});
eq(quota.status,429);eq(quota.models,1);eq(quota.data.code==='AI_QUOTA_LIMIT'||quota.data.code==='AI_QUOTA_MANUAL_REVIEW',true);
const previous=await invoke({pilot:'109',flag109:true});
eq(previous.status,200);
eq(previous.data.factFirstPilotV109,STUDY_FACT_FIRST_V109);
eq(previous.data.sourceLedgerPilotV110,undefined);
console.log(JSON.stringify({lab:'LAB110',passedAssertions:checks,realProviderGenerations:0,
 workerPathIsActualHandler:true,defaultLAB79Unchanged:true,previousLAB109Preserved:true,
 ledgerBuiltFromCanonicalSource:true,didacticCertification:false,apkApproved:false},null,2));
