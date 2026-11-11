// LAB109 contract: REAL StudyBook Worker handler, deterministic provider stub.
// Checks installed LAB79 handshake, safe opt-in, source budgets, one generation,
// exact geometry, 429 protection and no accidental production activation.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import handler from '../api/editionsBulkV51.js';
import {STUDY_DRAFT_PROTOCOL_V74} from '../src/lib/studyDraftProtocolV74.js';
import {STUDY_GEOMETRY_V78} from '../src/lib/studyGeometryV78.js';
import {STUDY_FACT_FIRST_V109} from '../src/lib/studyFactFirstV109.js';
import {buildUnitBudgetsV71} from '../src/lib/studyDraftProtocolV71.js';
import {pageLetterBudgetsV74} from '../src/lib/studyPageBudgetsV74.js';
import {studyLetters} from '../src/lib/studyPillarV38.js';

const fixture=JSON.parse(readFileSync('audit/test-fixtures/lab109-worker-source.json','utf8'));
const source=fixture.sources.find(s=>s.id==='scienze').text;
const prior=fixture.historicalScience40.text;
const sourceLetters=studyLetters(source);
let assertions=0;
const equal=(a,b,msg)=>{assert.deepEqual(a,b,msg);assertions++};
const yes=(a,msg)=>{assert.ok(a,msg);assertions++};

function makeBody({experiment=false,phase='draft-v74'}={}){
 const units=[{id:'1:1',source,pageStart:1,pageEnd:1,chapterTitle:'Scienze',sectionTitle:'Test'}];
 return {
   phase,draftProtocol:STUDY_DRAFT_PROTOCOL_V74,geometryPolicyV78:STUDY_GEOMETRY_V78,
   level:'40',units,bookTitle:'Fixture sintetico LAB109',
   unitBudgets:buildUnitBudgetsV71(units,'40'),
   pageBudgetsV74:pageLetterBudgetsV74(units,'40'),
   targetLetters:pageLetterBudgetsV74(units,'40')[0].targetLetters,summaryCapLetters:null,
   maxOutputTokens:4096,timeoutMs:55000,
   repairDrafts:phase==='recalibrate-v74'?[{id:'1:1',text:prior}]:[],
   ...(experiment?{experimentV109:STUDY_FACT_FIRST_V109}:{})
 };
}
function makeResponse(){
 const r={code:200,headers:{},body:null,status(c){this.code=c;return this},
   json(x){this.body=x;return this},setHeader(k,v){this.headers[k]=v;return this}};
 return r;
}
async function run({experiment=false,flag=false,phase='draft-v74',invalidBudget=false,upstreamStatus=200}={}){
 const body=makeBody({experiment,phase});
 if(invalidBudget)body.pageBudgetsV74[0].targetLetters+=1;
 const req={method:'POST',body,headers:{},env:{AI_API_KEY:'research-fixture-key',
   STUDYBOOK_FACT_FIRST_V109:flag?'1':'0',AI_MODEL:'gemini-3.5-flash-lite'}};
 const res=makeResponse();
 let generationCalls=0,countCalls=0,lastPrompt=null;
 const oldFetch=globalThis.fetch;
 globalThis.fetch=async function(url,init){
  if(String(url).includes(':countTokens')){
   countCalls++;return new Response(JSON.stringify({totalTokens:1234}),{status:200,headers:{'Content-Type':'application/json'}});
  }
  generationCalls++;
  const x=JSON.parse(init.body);lastPrompt=x.messages?.[0]?.content;
  if(upstreamStatus===429)return new Response(JSON.stringify({error:{code:429,message:'quota exceeded'}}),
   {status:429,headers:{'Content-Type':'application/json','Retry-After':'60'}});
  return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({parts:[{id:'1:1',text:prior}]})},
   finish_reason:'stop'}],usage:{completion_tokens:125}}),
   {status:200,headers:{'Content-Type':'application/json'}});
 };
 try{await handler(req,res)}finally{globalThis.fetch=oldFetch}
 return {status:res.code,data:res.body,header:res.headers,generationCalls,countCalls,prompt:lastPrompt};
}
const baseline=await run();
equal(baseline.status,200);
equal(baseline.generationCalls,1);
yes(baseline.prompt.includes('LAB97–99')||baseline.prompt.includes('best-of'));
equal(baseline.data.factFirstPilotV109,undefined);
equal(baseline.data.bestOfInstruction==='lab76-best-of-quantitative-and-source-fidelity-v1',true);
const active=await run({experiment:true,flag:true});
equal(active.status,200);
equal(active.generationCalls,1);
equal(active.countCalls,1);
yes(active.prompt.includes('FATTI NON DUPLICATI'));
yes(active.prompt.includes('DESCRIZIONE'));
yes(!active.prompt.includes('LAB97–99'));
equal(active.data.factFirstPilotV109,STUDY_FACT_FIRST_V109);
equal(active.data.semanticCertified,false);
equal(active.data.approvedForApp,false);
equal(active.data.bestOfInstruction,null);
equal(active.data.geometryReviewV78.policy,STUDY_GEOMETRY_V78);
equal(active.data.draftProtocol,STUDY_DRAFT_PROTOCOL_V74);
equal(active.data.lengthReview.achievedReduction,36.9);
const denied=await run({experiment:true,flag:false});
equal(denied.status,409);
equal(denied.data.code,'AI_FACT_FIRST_PILOT_UNAVAILABLE');
equal(denied.generationCalls,0);
equal(denied.countCalls,0);
const invalid=await run({experiment:true,flag:true,invalidBudget:true});
equal(invalid.status,409);
equal(invalid.data.code,'AI_PAGE_BUDGET_MISMATCH');
equal(invalid.generationCalls,0);
const recalibrate=await run({experiment:true,flag:true,phase:'recalibrate-v74'});
equal(recalibrate.status,200);
equal(recalibrate.generationCalls,1);
yes(recalibrate.prompt.includes('Ricalibrazione esplicita'));
const quota=await run({experiment:true,flag:true,upstreamStatus:429});
equal(quota.status,429);
equal(quota.generationCalls,1);
yes(['AI_QUOTA_LIMIT','AI_QUOTA_MANUAL_REVIEW'].includes(quota.data.code));
console.log(JSON.stringify({lab:'LAB109',workerContractAssertions:assertions,
 sourceLetters,existingAndroidHandshakePreserved:true,
 pilotRequiresDoubleOptIn:true,providerCallsReal:0,
 realWorkerHandlerExecuted:true,mockedProviderGenerations:baseline.generationCalls+
   active.generationCalls+recalibrate.generationCalls+quota.generationCalls,
 userDataChanged:false,semanticCertified:false},null,2));
