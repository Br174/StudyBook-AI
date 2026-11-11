// LAB121 actual Worker route with MOCK Gemini: no real tokens used.
// Goal: provider sees ONLY center targets, not min/max acceptance bands.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import handler from '../api/editionsBulkV51.js';
import {STUDY_DRAFT_PROTOCOL_V74} from '../src/lib/studyDraftProtocolV74.js';
import {STUDY_GEOMETRY_V78} from '../src/lib/studyGeometryV78.js';
import {STUDY_LEAN_PERCENT_V111} from '../src/lib/studyLeanPercentV111.js';
import {STUDY_PRIVATE_EXPERIMENT_V121,modelOnlyPayloadV121,
 privateCenterInstructionV121} from '../src/lib/studyPrivatePromptV121.js';
import {STUDY_503_FAILOVER_V114} from '../src/lib/study503FailoverV114.js';
import {STUDY_LEVELS_V67,STUDY_TARGET_V67} from '../src/lib/studyRebalancePolicyV67.js';
import {pageLetterBudgetsV74} from '../src/lib/studyPageBudgetsV74.js';
import {buildUnitBudgetsV71} from '../src/lib/studyDraftProtocolV71.js';
import {studyGeometryPlanV78} from '../src/lib/studyGeometryV78.js';
const sample=JSON.parse(readFileSync('audit/test-fixtures/lab109-worker-source.json','utf8'));
const original=sample.sources.find(x=>x.id==='scienze').text;
const unit={id:'0:0',source:original,pageStart:1,pageEnd:1};
const expected={summary:55,'50':50,'40':45,'30':35,'20':25,'10':15};
let checks=0;const eq=(a,b,m)=>{assert.deepEqual(a,b,m);checks++};
const ok=(x,m)=>{assert.ok(x,m);checks++};
async function test(level,{enabled=true,includeFlag=true}={}){
 const pageBudgets=pageLetterBudgetsV74([unit],level);
 const body={
  level,phase:'draft-v74',
  draftProtocol:STUDY_DRAFT_PROTOCOL_V74,
  geometryPolicyV78:STUDY_GEOMETRY_V78,
  units:[unit],unitBudgets:buildUnitBudgetsV71([unit],level),
  pageBudgetsV74:pageBudgets,
  targetLetters:level==='summary'?null:pageBudgets[0].targetLetters,
  summaryCapLetters:level==='summary'?pageBudgets[0].targetLetters:null,
  maxOutputTokens:8000,timeoutMs:90000,
  experimentV111:STUDY_LEAN_PERCENT_V111,
  experimentV114:STUDY_503_FAILOVER_V114,
  ...(includeFlag?{experimentV121:STUDY_PRIVATE_EXPERIMENT_V121}:{})
 };
 const req={method:'POST',headers:{},body,env:{
  AI_API_KEY:'fake-not-live',AI_MODEL:'gemini-3.5-flash-lite',
  STUDYBOOK_LEAN_PERCENT_V111:'1',
  STUDYBOOK_503_FAILOVER_V114:'1',
  STUDYBOOK_PRIVATE_TARGET_V121:enabled?'1':'0'}};
 const res={code:200,jsonBody:null,headers:{},status(n){this.code=n;return this},
  json(v){this.jsonBody=v;return this},
  setHeader(name,value){this.headers[name]=value;return this}};
 let calls=0,countTokens=0,messages=null;
 const previous=globalThis.fetch;
 globalThis.fetch=async(url,options)=>{
  if(String(url).includes(':countTokens')){countTokens++;return Response.json({totalTokens:1234})}
  calls++;
  const data=JSON.parse(options.body);
  messages=data.messages;
  const part={parts:[{id:'0:0',text:original}]};
  return Response.json({choices:[{message:{content:JSON.stringify(part)},
   finish_reason:'stop'}]});
 };
 try{await handler(req,res)}finally{globalThis.fetch=previous}
 return{body,res,calls,countTokens,messages,pageBudgets};
}
for(const level of STUDY_LEVELS_V67){
 const result=await test(level);
 const p=expected[level];
 eq(STUDY_TARGET_V67[level].target,p,'central target for '+level);
 eq(result.res.code,200,'Worker accepted '+level);
 eq(result.calls,1,'Exactly one mocked generation for '+level);
 eq(result.countTokens,0,'No extra provider countTokens for '+level);
 eq(result.res.jsonBody.privateCenterPilotV121,STUDY_PRIVATE_EXPERIMENT_V121);
 eq(result.res.jsonBody.privateBandDisclosedToGemini,false);
 eq(result.res.jsonBody.lengthReview.range?.min,STUDY_TARGET_V67[level].min);
 const joined=JSON.stringify(result.messages);
 ok(joined.includes('elimina '+p+'%'),'Strict center in system prompt');
 ok(!joined.includes('"minLetters"')&&!joined.includes('"maxLetters"'),
  'Private letter band never serialized to model');
 ok(!/fasce|limiti accettabili|±5|tolleranza/i.test(joined),
  'No private tolerance text in prompt');
 const user=JSON.parse(result.messages[1].content);
 eq(user.pageTargets[0].targetLetters,result.pageBudgets[0].targetLetters);
 ok(!('pageBudgetsV74' in user),'No raw budget object with bands');
 ok(result.res.jsonBody.lengthReview.semanticCertified!==true);
}
const disabled=await test('10',{enabled:false});
eq(disabled.res.code,409);eq(disabled.calls,0);
const malformed=await test('20',{includeFlag:false});
eq(malformed.res.code,200);eq(malformed.res.jsonBody.privateCenterPilotV121,undefined);
const geometry=studyGeometryPlanV78([unit],'30');
const modelPrompt=privateCenterInstructionV121('30','draft-v74',geometry);
ok(!/minimo|maxLetters|minLetters|tolleranza|fasce/i.test(modelPrompt));
const safe=modelOnlyPayloadV121({units:[{...unit,
 sourceLetters:900,targetLetters:600,minLetters:590,maxLetters:610}],
 verifiedPageBudgets:[{pageStart:1,pageEnd:1,
 originalLetters:900,targetLetters:600,minLetters:590,maxLetters:610,
 tolerancePercentagePoints:5}]});
ok(!JSON.stringify(safe).includes('minLetters'));
ok(!JSON.stringify(safe).includes('maxLetters'));
console.log(JSON.stringify({lab:'121',checks,sixLevels:6,
 goals:expected,modelCallsReal:0,mockedRequests:6,
 disabledPilotWorkerRejectsBeforeModel:true,
 sanitizedProviderUser:true,sourcePreserved:true,
 approvedForApp:false,semanticCertified:false}));
