// LAB114: 0 real Gemini calls. Test the original StudyBook Worker path,
// including official quota timing, a single free backup and no empty draft loss.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import handler from '../api/editionsBulkV51.js';
import {STUDY_DRAFT_PROTOCOL_V74} from '../src/lib/studyDraftProtocolV74.js';
import {STUDY_GEOMETRY_V78} from '../src/lib/studyGeometryV78.js';
import {pageLetterBudgetsV74} from '../src/lib/studyPageBudgetsV74.js';
import {buildUnitBudgetsV71} from '../src/lib/studyDraftProtocolV71.js';
import {STUDY_LEAN_PERCENT_V111} from '../src/lib/studyLeanPercentV111.js';
import {STUDY_503_FAILOVER_V114,STUDY_503_BACKUP_V114,invoke503FailoverV114} from '../src/lib/study503FailoverV114.js';
const f=JSON.parse(readFileSync('audit/test-fixtures/lab109-worker-source.json','utf8'));
const text=f.sources.find(x=>x.id==='scienze').text;
const u={id:'1:1',source:text,pageStart:1,pageEnd:1};
let checks=0;
const eq=(a,b,msg)=>{assert.deepEqual(a,b,msg);checks++};
const ok=(v,msg)=>{assert.ok(v,msg);checks++};
const first={response:{status:503,ok:false,headers:{get:()=>null}},payload:{error:{status:'UNAVAILABLE'}}};
const backup={response:{status:200,ok:true,headers:{get:()=>null}},payload:{ok:true}};
let n=0,models=[];
let r=await invoke503FailoverV114({enabled:true,now:()=>1000,deadlineMs:100000,
 invoke:async model=>{n++;models.push(model);return n===1?first:backup},
 wait:async()=>{}});
eq(n,2);eq(models,['gemini-3.5-flash-lite',STUDY_503_BACKUP_V114]);
eq(r.model,STUDY_503_BACKUP_V114);eq(r.failoverRecovered,true);
n=0;r=await invoke503FailoverV114({enabled:true,now:()=>1000,deadlineMs:100000,
 invoke:async()=>{n++;return{...first,response:{...first.response,status:429}}},wait:async()=>{}});
eq(n,1);eq(r.attempts,1);
n=0;r=await invoke503FailoverV114({enabled:true,now:()=>1000,deadlineMs:100000,
 invoke:async()=>{n++;return{...first,response:{...first.response,headers:{get:k=>k==='retry-after'?'135':null}}}},wait:async()=>{}});
eq(n,1);eq(r.attempts,1);
n=0;r=await invoke503FailoverV114({enabled:true,now:()=>1000,deadlineMs:100000,
 invoke:async()=>{n++;return first},wait:async()=>{}});
eq(n,2);eq(r.response.status,503);
n=0;r=await invoke503FailoverV114({enabled:true,now:()=>1000,deadlineMs:59000,
 invoke:async()=>{n++;return first},wait:async()=>{}});
eq(n,1);
n=0;r=await invoke503FailoverV114({enabled:false,now:()=>1000,deadlineMs:100000,
 invoke:async()=>{n++;return first},wait:async()=>{}});
eq(n,1);
function makeBody(){
 const units=[u],budget=pageLetterBudgetsV74(units,'30');
 return {level:'30',phase:'draft-v74',draftProtocol:STUDY_DRAFT_PROTOCOL_V74,
  geometryPolicyV78:STUDY_GEOMETRY_V78,units,unitBudgets:buildUnitBudgetsV71(units,'30'),
  pageBudgetsV74:budget,targetLetters:budget[0].targetLetters,summaryCapLetters:null,
  maxOutputTokens:6000,timeoutMs:90000,experimentV111:STUDY_LEAN_PERCENT_V111,
  experimentV114:STUDY_503_FAILOVER_V114};
}
async function route(mode,enabled=true){
 let calls=0,models=[],countTokens=0;
 const req={method:'POST',body:makeBody(),headers:{},env:{
  AI_API_KEY:'fake-free-only',AI_MODEL:'gemini-3.5-flash-lite',
  STUDYBOOK_LEAN_PERCENT_V111:'1',
  STUDYBOOK_503_FAILOVER_V114:enabled?'1':'0'}};
 const res={code:200,jsonBody:null,headers:{},status(x){this.code=x;return this},
  json(x){this.jsonBody=x;return this},setHeader(k,v){this.headers[k]=v;return this}};
 const old=globalThis.fetch;
 globalThis.fetch=async(url,opts)=>{
  if(String(url).includes(':countTokens')){countTokens++;return Response.json({totalTokens:2500})}
  calls++;let b=JSON.parse(opts.body);models.push(b.model);
  if(mode==='503-first'&&calls===1)return Response.json({error:{status:'UNAVAILABLE'}},{status:503});
  if(mode==='429')return Response.json({error:{status:'RESOURCE_EXHAUSTED',
    message:'requests per minute exceeded'}},{status:429});
  if(mode==='503-official')return Response.json({error:{status:'UNAVAILABLE'}},
    {status:503,headers:{'retry-after':'95'}});
  if(mode==='503-always')return Response.json({error:{status:'UNAVAILABLE'}},{status:503});
  return Response.json({choices:[{message:{content:JSON.stringify({
   parts:[{id:'1:1',text:f.historicalScience40.text}]})},finish_reason:'stop'}]});
 };
 try{await handler(req,res)}finally{globalThis.fetch=old}
 return {calls,models,countTokens,res};
}
let x=await route('healthy');eq(x.res.code,200);eq(x.calls,1);
eq(x.res.jsonBody.providerAttempts,1);eq(x.res.jsonBody.provider503Recovered,false);
x=await route('503-first');eq(x.res.code,200);eq(x.calls,2);
eq(x.models,['gemini-3.5-flash-lite','gemini-3.1-flash-lite']);
eq(x.res.jsonBody.model,'gemini-3.1-flash-lite');
eq(x.res.jsonBody.providerAttempts,2);eq(x.res.jsonBody.provider503Recovered,true);
eq(x.res.jsonBody.failoverPilotV114,STUDY_503_FAILOVER_V114);
eq(x.countTokens,0);
x=await route('429');eq(x.res.code,429);eq(x.calls,1);
x=await route('503-official');eq(x.res.code,503);eq(x.calls,1);
eq(x.res.headers['Retry-After'],'95');
x=await route('503-always');eq(x.res.code,503);eq(x.calls,2);
eq(x.res.jsonBody.diagnostic.providerAttempts,2);
x=await route('healthy',false);eq(x.res.code,409);eq(x.calls,0);
console.log(JSON.stringify({lab:'LAB114',checks,realGeminiCalls:0,
 healthyGenerations:1,true503BackupAttempts:2,
 officialRetryAfterPreserved:true,rate429Preserved:true,
 previousWorkerPreservedWhenNotOptedIn:true,largeBlockRepartitioned:false}));
