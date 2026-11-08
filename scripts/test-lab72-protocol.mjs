// LAB72 new app<->Worker protocol regression: no real provider costs.
import assert from 'node:assert/strict';
import handler from '../api/editionsBulkV51.js';
import {STUDY_DRAFT_PROTOCOL_V72,verifyStudyDraftResponseV72} from '../src/lib/studyDraftProtocolV72.js';
import {buildUnitBudgetsV71} from '../src/lib/studyDraftProtocolV71.js';
import {studyLetters,exactRetained} from '../src/lib/studyPillarV38.js';
import {readFileSync} from 'node:fs';
const source=('Una regola prevede fatti, conseguenze e limiti che devono restare chiari. ').repeat(17);
const units=[{id:'0:0',source,pageStart:1,pageEnd:1}];
const letters=studyLetters(source);
function res(){return {statusCode:200,payload:null,headers:new Map(),
 setHeader(k,v){this.headers.set(k,v);return this},status(s){this.statusCode=s;return this},
 json(p){this.payload=p;return this}}}
const oldFetch=globalThis.fetch;
try{
 globalThis.fetch=async(url)=>{
  if(String(url).includes(':countTokens'))
   return new Response(JSON.stringify({totalTokens:1200}),{status:200});
  return new Response(JSON.stringify({choices:[{finish_reason:'length',
   message:{content:JSON.stringify({parts:[{id:'0:0',text:source}]})}}],
   usage:{completion_tokens:144}}),{status:200});
 };
 const req={method:'POST',env:{AI_API_KEY:'MOCK_KEY_ONLY',AI_MODEL:'gemini-3.5-flash-lite'},
  body:{phase:'draft-v72',draftProtocol:STUDY_DRAFT_PROTOCOL_V72,level:'10',
   targetLetters:exactRetained(letters,10),summaryCapLetters:null,
   unitBudgets:buildUnitBudgetsV71(units,'10'),maxOutputTokens:6000,units}};
 const out=res();
 await handler(req,out);
 assert.equal(out.statusCode,200);
 assert.equal(out.headers.get('X-StudyBook-Draft-Protocol'),STUDY_DRAFT_PROTOCOL_V72);
 assert.equal(out.payload.draftProtocol,STUDY_DRAFT_PROTOCOL_V72);
 const verified=verifyStudyDraftResponseV72(out.payload,letters,'10');
 assert.equal(verified.ok,true);
 assert.equal(out.payload.lengthReview.withinBand,false);
 assert.equal(out.payload.lengthReview.compliant,false);
 assert.equal(out.payload.generationStoppedEarly,true);
 assert.equal(verified.finishReason,'length');
 assert.equal(verifyStudyDraftResponseV72({...out.payload,draftProtocol:'lab71-unit-length-budget-v1'},letters,'10').ok,false);
 assert.equal(verifyStudyDraftResponseV72({...out.payload,finishReason:undefined},letters,'10').ok,true);
 assert.equal(verifyStudyDraftResponseV72({...out.payload,lengthReview:{...out.payload.lengthReview,sourceLetters:letters+1}},letters,'10').ok,false);
 const app=readFileSync(new URL('../src/lib/draftFirstV57.js',import.meta.url),'utf8');
 const improve=readFileSync(new URL('../src/lib/studyRebalanceV67.js',import.meta.url),'utf8');
 assert.match(app,/phase:isNewDraft\?'draft-v72'/);
 assert.match(improve,/recalibrate-v72/);
 assert.match(improve,/repair-v72/);
 assert.match(app,/draftEvidenceV72/);
 console.log('LAB72 PROTOCOL PASS: fail-closed Worker identity and source measurement; source unchanged; bounded response diagnostics');
}finally{globalThis.fetch=oldFetch}
