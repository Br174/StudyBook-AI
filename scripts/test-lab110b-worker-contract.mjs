// LAB110B offline contract: actual Worker, fake provider only.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import handler from '../api/editionsBulkV51.js';
import {studyLetters} from '../src/lib/studyPillarV38.js';
import {buildUnitBudgetsV71} from '../src/lib/studyDraftProtocolV71.js';
import {pageLetterBudgetsV74} from '../src/lib/studyPageBudgetsV74.js';
import {STUDY_DRAFT_PROTOCOL_V74} from '../src/lib/studyDraftProtocolV74.js';
import {STUDY_GEOMETRY_V78,studyGeometryPlanV78} from '../src/lib/studyGeometryV78.js';
import {STUDY_SOURCE_LEDGER_V110} from '../src/lib/studySourceLedgerV110.js';
import {STUDY_CLAUSE_BUDGET_V110B,clauseBudgetInstructionV110B}
 from '../src/lib/studyClauseBudgetV110B.js';
const fixtures=JSON.parse(readFileSync('audit/test-fixtures/lab109-worker-source.json','utf8'));
const source=fixtures.sources.find(x=>x.id==='scienze').text;
const units=[{id:'1:1',source,pageStart:1,pageEnd:1}];
const b=pageLetterBudgetsV74(units,'40');
let checks=0;
const eq=(a,v)=>{assert.deepEqual(a,v);checks++};
const ok=(x)=>{assert.ok(x);checks++};
const plan=clauseBudgetInstructionV110B('40','draft-v74',studyGeometryPlanV78(units,'40'),units);
eq(plan.policy,STUDY_CLAUSE_BUDGET_V110B);
eq(plan.ledger.groups[0].count,9);
ok(plan.text.includes('orientativamente conserva'));
ok(plan.text.includes('distinguere fra descrizione'));
ok(plan.text.includes('MAX 8 RIGHE'));
ok(plan.text.includes('conserva '+plan.ledger.groups[0].targetLetters+' LETTERE'));
async function run({flag=false,mixed=false,invalidBudget=false,sourceOverride=null,upstream=200}={}){
 const useUnits=sourceOverride?[{id:'1:1',source:sourceOverride,pageStart:1,pageEnd:1}]:units;
 const pageBudgetsV74=pageLetterBudgetsV74(useUnits,'40');
 if(invalidBudget)pageBudgetsV74[0].targetLetters++;
 const req={method:'POST',headers:{},env:{
  AI_API_KEY:'fake-test-only-key',AI_MODEL:'gemini-3.5-flash-lite',
  STUDYBOOK_CLAUSE_BUDGET_V110B:flag?'1':'0'},
  body:{
   phase:'draft-v74',draftProtocol:STUDY_DRAFT_PROTOCOL_V74,geometryPolicyV78:STUDY_GEOMETRY_V78,
   experimentV110b:STUDY_CLAUSE_BUDGET_V110B,
   ...(mixed?{experimentV110:STUDY_SOURCE_LEDGER_V110}:{}),
   level:'40',units:useUnits,unitBudgets:buildUnitBudgetsV71(useUnits,'40'),
   pageBudgetsV74,
   targetLetters:pageLetterBudgetsV74(useUnits,'40')[0].targetLetters,maxOutputTokens:4096,timeoutMs:70000
  }
 };
 const res={code:200,data:null,headers:{},status(x){this.code=x;return this},json(x){this.data=x;return this},setHeader(k,v){this.headers[k]=v;return this}};
 const oldFetch=globalThis.fetch;let generations=0,tokens=0,system='';
 globalThis.fetch=async(url,opts)=>{
  if(String(url).includes(':countTokens')){tokens++;return Response.json({totalTokens:1234})}
  generations++;system=JSON.parse(opts.body).messages[0].content;
  if(upstream!==200)return Response.json({error:{message:'test quota'}},{status:upstream});
  return Response.json({choices:[{message:{content:JSON.stringify({parts:[{id:'1:1',text:fixtures.historicalScience40.text}]})},finish_reason:'stop'}]});
 };
 try{await handler(req,res)}finally{globalThis.fetch=oldFetch}
 return{...res,generations,tokens,system};
}
const live=await run({flag:true});
eq(live.code,200);eq(live.generations,1);eq(live.tokens,1);
eq(live.data.clauseBudgetPilotV110B,STUDY_CLAUSE_BUDGET_V110B);
eq(live.data.clauseCountV110B,9);eq(live.data.approvedForApp,false);
eq(live.data.sourceRiskAuditV110.readyForStudy,false);
ok(live.data.sourceRiskAuditV110.groups[0].warningCodes.includes('DESCRIPTION_VS_CAUSES_OF_VARIATIONS_MISSING'));
ok(live.system.includes('CLAUSOLA 9'));
const denied=await run({flag:false});eq(denied.code,409);eq(denied.generations,0);
const mixed=await run({flag:true,mixed:true});eq(mixed.code,409);eq(mixed.generations,0);
const budget=await run({flag:true,invalidBudget:true});eq(budget.code,409);eq(budget.generations,0);
const scope=await run({flag:true,sourceOverride:'lorem '.repeat(700)+'fine.'});
eq(scope.code,422);eq(scope.generations,0);
const quota=await run({flag:true,upstream:429});
eq(quota.code,429);eq(quota.generations,1);
console.log(JSON.stringify({lab:'LAB110B',checks,actualWorkerHandler:true,
 simulatedOnly:true,realProviderCalls:0,normalLAB79NotModified:true,
 releaseApproved:false}));
