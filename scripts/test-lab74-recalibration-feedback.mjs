// LAB74 targeted phase-two budget feedback. NO actual Gemini API calls.
import assert from 'node:assert/strict';
import handler from '../api/editionsBulkV51.js';
import {STUDY_DRAFT_PROTOCOL_V74} from '../src/lib/studyDraftProtocolV74.js';
import {pageLetterBudgetsV74} from '../src/lib/studyPageBudgetsV74.js';
import {buildUnitBudgetsV71} from '../src/lib/studyDraftProtocolV71.js';
const sourceA='A'.repeat(100),sourceB='B'.repeat(100);
const units=[
 {id:'0:0',source:sourceA,pageStart:1,pageEnd:1},
 {id:'0:1',source:sourceB,pageStart:2,pageEnd:2}
];
const orig=globalThis.fetch;
let count=0,seen=[];
const send=()=>({code:200,value:null,setHeader(){return this},status(n){this.code=n;return this},
 json(v){this.value=v;return this}});
try{
 globalThis.fetch=async (url,options)=>{
  if(String(url).includes(':countTokens'))return new Response(
   JSON.stringify({totalTokens:220}),{status:200});
  count++;
  const request=JSON.parse(options.body);
  const data=JSON.parse(request.messages[1].content);
  seen.push(data);
  const level=data.pageBudgetsV74[0].level;
  const target=level==='20'?80:50;
  return new Response(JSON.stringify({choices:[{
   finish_reason:'stop',message:{content:JSON.stringify({parts:[
    {id:'0:0',text:'A'.repeat(target)},
    {id:'0:1',text:'B'.repeat(target)}
   ]})}
  }],usage:{completion_tokens:240}}),{status:200});
 };
 for(const [level,previous,dir,gap] of [
   ['50',40,'expand',10],['20',100,'condense',-20]
 ]){
  const data={phase:'recalibrate-v74',draftProtocol:STUDY_DRAFT_PROTOCOL_V74,
   level,bookTitle:'TEST synthetic only',units,
   repairDrafts:units.map(u=>({id:u.id,text:(u.id==='0:0'?'A':'B').repeat(previous)})),
   pageBudgetsV74:pageLetterBudgetsV74(units,level),
   unitBudgets:buildUnitBudgetsV71(units,level),
   targetLetters:2*(level==='20'?80:50),maxOutputTokens:4500,
   timeoutMs:70000};
  const response=send();
  await handler({method:'POST',env:{AI_API_KEY:'TEST',AI_MODEL:'gemini-3.5-flash-lite'},
   body:data},response);
  assert.equal(response.code,200,JSON.stringify(response.value));
  assert.equal(response.value.lengthReview.compliant,true);
  const feedback=seen.at(-1).pageFeedbackV74;
  assert.equal(feedback.length,2);
  for(const p of feedback){
   assert.equal(p.previousLetters,previous);
   assert.equal(p.direction,dir);
   assert.equal(p.gapLetters,gap);
   assert.equal(p.priorWithinBand,false);
  }
 }
 assert.equal(count,2);
 // The phase-one prompt must NOT send a corrective feedback field.
 const draft={phase:'draft-v74',draftProtocol:STUDY_DRAFT_PROTOCOL_V74,
   level:'50',bookTitle:'test',units,
   pageBudgetsV74:pageLetterBudgetsV74(units,'50'),
   unitBudgets:buildUnitBudgetsV71(units,'50'),
   targetLetters:100,maxOutputTokens:4500};
 await handler({method:'POST',env:{AI_API_KEY:'TEST',AI_MODEL:'gemini-3.5-flash-lite'},
   body:draft},send());
 assert.ok(!('pageFeedbackV74' in seen.at(-1)));
 console.log('LAB74_PHASE_TWO_FEEDBACK_PASS: expand and condense from source-derived page differences, no phase-one review');
}finally{globalThis.fetch=orig}
