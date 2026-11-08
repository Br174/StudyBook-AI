import assert from 'node:assert/strict';
import handler from '../api/editionsBulkV51.js';
import {matchedControlInstructionV79,FAIR_CONTROL_PROTOCOL_V79}
 from '../src/lib/studyMarkerControlV79.js';
import {markerInstructionV78} from '../src/lib/studyMarkerExperimentsV78.js';
import {STUDY_DRAFT_PROTOCOL_V74} from '../src/lib/studyDraftProtocolV74.js';
import {pageLetterBudgetsV74} from '../src/lib/studyPageBudgetsV74.js';
import {buildUnitBudgetsV71} from '../src/lib/studyDraftProtocolV71.js';
import {studyLetters} from '../src/lib/studyPillarV38.js';
const a=matchedControlInstructionV79(1000,500,450,550);
const b=markerInstructionV78('fixed20',1000,500,450,550,{count:0});
assert.equal(a.split('\n').slice(0,6).join('\n'),b.split('\n').slice(0,6).join('\n'));
assert.match(a,/450–550/);assert.match(b,/450–550/);
assert.ok(!a.includes('Usa marcatori esattamente'));
const units=[{id:'0:0',source:'La Terra ruota attorno al proprio asse e spiega il giorno e la notte. '.repeat(9),pageStart:1,pageEnd:1}];
const budget=pageLetterBudgetsV74(units,'50')[0];
const body={phase:'draft-v74',draftProtocol:STUDY_DRAFT_PROTOCOL_V74,units,level:'50',
 pageBudgetsV74:[budget],unitBudgets:buildUnitBudgetsV71(units,'50'),
 targetLetters:budget.targetLetters,bookTitle:'TEST',maxOutputTokens:4096,timeoutMs:55000,
 matchedControlV79:'control'};
function res(){return {statusCode:200,data:null,headers:{},setHeader(k,v){this.headers[k]=v;return this},
 status(s){this.statusCode=s;return this},json(v){this.data=v;return this}}}
const old=globalThis.fetch;
let providerCalls=0;
try{
 globalThis.fetch=async(url,opts)=>{
  if(String(url).includes(':countTokens'))return new Response(JSON.stringify({totalTokens:100}),{status:200});
  const msg=JSON.parse(opts.body).messages[0].content;
  assert.equal(msg,a.replace('1000',String(studyLetters(units[0].source)))
   .replace('500',String(budget.targetLetters))
   .replace('450',String(budget.minLetters))
   .replace('550',String(budget.maxLetters)));
  providerCalls++;
  return new Response(JSON.stringify({choices:[{finish_reason:'stop',
   message:{content:JSON.stringify({parts:[{id:'0:0',text:'La Terra ruota e produce il giorno e la notte.'}]})}}],
   usage:{completion_tokens:25}}),{status:200});
 };
 const denied=res();
 await handler({method:'POST',env:{AI_API_KEY:'MOCK',AI_MODEL:'gemini-3.5-flash-lite'},
  body},denied);
 assert.equal(denied.statusCode,403);assert.equal(providerCalls,0);
 const allowed=res();
 await handler({method:'POST',env:{AI_API_KEY:'MOCK',AI_MODEL:'gemini-3.5-flash-lite',
  STUDYBOOK_FIXED20_REPEAT_V79:'enabled'},body},allowed);
 assert.equal(allowed.statusCode,200,JSON.stringify(allowed.data));
 assert.equal(allowed.headers['X-StudyBook-Fixed20-Matched-Protocol'],FAIR_CONTROL_PROTOCOL_V79);
 assert.equal(providerCalls,1);
 const clash=res();
 await handler({method:'POST',env:{AI_API_KEY:'MOCK',AI_MODEL:'gemini-3.5-flash-lite',
  STUDYBOOK_FIXED20_REPEAT_V79:'enabled',STUDYBOOK_MARKER_PROBE_V78:'enabled'},
  body:{...body,markerModeV78:'fixed20'}},clash);
 assert.equal(clash.statusCode,400);assert.equal(providerCalls,1);
 console.log('LAB79_MATCHED_CONTROL_OFFLINE_PASS',JSON.stringify({
  identicalSourceAndBudgetPrefix:true,accessFlagRequired:true,combinedModesRejected:true,
  providerCalls,sourceBudget:budget.originalLetters}));
}finally{globalThis.fetch=old}
