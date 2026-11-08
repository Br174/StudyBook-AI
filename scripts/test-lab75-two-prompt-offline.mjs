// LAB75: offline A/B protocol proof. All Google responses are mocked.
// One plan, then one write; no provider calls, real documents or paid services.
import assert from 'node:assert/strict';
import handler from '../api/editionsBulkV51.js';
import {STUDY_DRAFT_PROTOCOL_V75} from '../src/lib/studyTwoPromptV75.js';
import {STUDY_DRAFT_PROTOCOL_V74} from '../src/lib/studyDraftProtocolV74.js';
import {pageLetterBudgetsV74} from '../src/lib/studyPageBudgetsV74.js';
import {buildUnitBudgetsV71} from '../src/lib/studyDraftProtocolV71.js';
import {studyLetters} from '../src/lib/studyPillarV38.js';
const units=[
 {id:'0:0',source:'La prima pagina descrive le condizioni, i limiti e le eccezioni. '.repeat(8),
  pageStart:1,pageEnd:1},
 {id:'0:1',source:'La seconda pagina spiega cause, definizioni e osservazioni. '.repeat(8),
  pageStart:2,pageEnd:2}
];
const level='50',originalLetters=units.reduce((n,u)=>n+studyLetters(u.source),0);
const bodyBase={level,units,bookTitle:'Prova sintetica senza dati personali',
 unitBudgets:buildUnitBudgetsV71(units,level),
 pageBudgetsV74:pageLetterBudgetsV74(units,level),
 targetLetters:Math.round(originalLetters*.5),
 maxOutputTokens:6000};
function response(){
 return {code:200,data:null,headers:new Map(),
  setHeader(k,v){this.headers.set(k,v);return this},
  status(code){this.code=code;return this},
  json(value){this.data=value;return this}};
}
const oldFetch=globalThis.fetch;
let planningCalls=0,writingCalls=0;
try{
 globalThis.fetch=async(url,options)=>{
  if(String(url).includes(':countTokens'))
   return new Response(JSON.stringify({totalTokens:670}),{status:200});
  const req=JSON.parse(options.body);
  const input=JSON.parse(req.messages[1].content);
  if(req.response_format.json_schema.name==='studybook_page_plan_v75'){
   planningCalls++;
   assert.equal(input.plansV75,undefined);
   assert.match(req.messages[0].content,/PRIMO PROMPT/);
   assert.equal(input.pageBudgetsV74.length,2);
   return new Response(JSON.stringify({choices:[{finish_reason:'stop',
    message:{content:JSON.stringify({plans:units.map(u=>({
     id:u.id,outline:'Preservare definizioni, condizioni, limiti, eccezioni e cause originali; spiegare in ordine.'
    }))})}}],usage:{completion_tokens:105}}),{status:200});
  }
  if(input.plansV75){
   writingCalls++;
   assert.match(req.messages[0].content,/SECONDO PROMPT/);
   assert.equal(input.plansV75.length,2);
   assert.equal(input.plansV75[0].id,'0:0');
  }else{
   // The LAB74 legacy route must remain operational without a planning stage.
   assert.ok(!req.messages[0].content.includes('SECONDO PROMPT'));
  }
  assert.equal(input.pageBudgetsV74[0].originalLetters,studyLetters(units[0].source));
  assert.equal(input.units[1].source,units[1].source);
  const parts=units.map((u,i)=>{
   const target=input.pageBudgetsV74[i].targetLetters;
   return {id:u.id,text:'L'.repeat(target)};
  });
  return new Response(JSON.stringify({choices:[{finish_reason:'stop',
   message:{content:JSON.stringify({parts})}}],usage:{completion_tokens:410}}),
    {status:200});
 };
 const planRes=response();
 await handler({method:'POST',env:{AI_API_KEY:'OFFLINE_FAKE',AI_MODEL:'gemini-3.5-flash-lite'},
  body:{...bodyBase,phase:'plan-v75',draftProtocol:STUDY_DRAFT_PROTOCOL_V75}},planRes);
 assert.equal(planRes.code,200,JSON.stringify(planRes.data));
 assert.equal(planRes.data.version,'plan-v75');
 assert.equal(planRes.data.plans.length,2);
 assert.equal(planRes.data.parts,undefined,'The first call must NOT generate draft texts');
 assert.equal(planRes.data.sourceLetters,originalLetters);
 assert.equal(planRes.headers.get('X-StudyBook-Planning-Protocol'),STUDY_DRAFT_PROTOCOL_V75);
 const draftRes=response();
 await handler({method:'POST',env:{AI_API_KEY:'OFFLINE_FAKE',AI_MODEL:'gemini-3.5-flash-lite'},
  body:{...bodyBase,phase:'draft-v75',draftProtocol:STUDY_DRAFT_PROTOCOL_V75,
   plansV75:planRes.data.plans}},draftRes);
 assert.equal(draftRes.code,200,JSON.stringify(draftRes.data));
 assert.equal(draftRes.data.parts.length,2);
 assert.equal(draftRes.data.draftProtocol,STUDY_DRAFT_PROTOCOL_V75);
 assert.equal(draftRes.data.lengthReview.pageReviewV74.groups.length,2);
 assert.equal(draftRes.data.lengthReview.compliant,true);
 assert.equal(planningCalls,1);assert.equal(writingCalls,1);
 const negative=response();
 await handler({method:'POST',env:{AI_API_KEY:'OFFLINE_FAKE',AI_MODEL:'gemini-3.5-flash-lite'},
  body:{...bodyBase,phase:'draft-v75',draftProtocol:STUDY_DRAFT_PROTOCOL_V75,
   plansV75:[planRes.data.plans[0],planRes.data.plans[0]]}},negative);
 assert.equal(negative.code,400);
 assert.equal(negative.data.code,'AI_PLANNING_MISMATCH');
 assert.equal(writingCalls,1,'Invalid plan must be rejected before Gemini');
 const budgetCheck=response();
 const altered=JSON.parse(JSON.stringify(bodyBase));
 altered.pageBudgetsV74[0].targetLetters+=100;
 await handler({method:'POST',env:{AI_API_KEY:'OFFLINE_FAKE',AI_MODEL:'gemini-3.5-flash-lite'},
  body:{...altered,phase:'plan-v75',draftProtocol:STUDY_DRAFT_PROTOCOL_V75}},budgetCheck);
 assert.equal(budgetCheck.code,409);
 assert.equal(budgetCheck.data.code,'AI_PAGE_BUDGET_MISMATCH');
 const priorVersion=response();
 await handler({method:'POST',env:{AI_API_KEY:'OFFLINE_FAKE',AI_MODEL:'gemini-3.5-flash-lite'},
  body:{...bodyBase,phase:'draft-v74',draftProtocol:STUDY_DRAFT_PROTOCOL_V74}},priorVersion);
 assert.equal(priorVersion.code,200,'V74 original path must still function');
 console.log('LAB75_TWO_PROMPT_PROTOCOL_PASS',
  JSON.stringify({sourceLetters:originalLetters,
   phases:['plan-v75','draft-v75'],pageGroups:2,
   planningCalls,writingCalls,invalidPlanRejected:true,
   forgedBudgetRejected:true,legacyV74Works:true}));
}finally{globalThis.fetch=oldFetch}
