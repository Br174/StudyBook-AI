// LAB72: offline negative closure from real LAB71 screenshots; zero Gemini calls.
// Must reject false numerically compliant summaries, retain good drafts,
// and preserve provider finish reason for diagnosis.
import assert from 'node:assert/strict';
import handler from '../api/editionsBulkV51.js';
import {assignBudgetsV51} from '../src/lib/integralPlannerV51.js';
import {STUDY_DRAFT_PROTOCOL_V71,buildUnitBudgetsV71} from '../src/lib/studyDraftProtocolV71.js';
import {STUDY_TARGET_V67,measureEditionLengthV72} from '../src/lib/studyRebalancePolicyV67.js';
import {studyQualityInspectionV66} from '../src/lib/studyQualityV66.js';
import {studyLetters,exactRetained} from '../src/lib/studyPillarV38.js';

const source=('Il diritto regola rapporti e condizioni. Ogni norma si applica con eccezioni che devono essere comprese. ').repeat(120);
const letters=studyLetters(source);
const variants=[['summary',88.5],['50',84.2],['40',84.6],['30',83.1],['20',68],['10',51]];
const unit={id:'0:0',ci:0,pi:0,source,pageStart:1,pageEnd:1};
const toLetters=(text,amount)=>{
 const matches=[...String(text).matchAll(/\p{L}/gu)];
 return text.slice(0,(matches[Math.min(Math.max(amount,1),matches.length)-1]?.index||0)+1);
};
const oldFetch=globalThis.fetch;
const response=()=>({
 statusCode:200,data:null,headers:new Map(),
 setHeader(k,v){this.headers.set(k,v);return this},
 status(s){this.statusCode=s;return this},
 json(data){this.data=data;return this}
});
async function mockProviderCall(level,outputLetters,finishReason,capOverride=null){
 globalThis.fetch=async(url)=>{
  if(String(url).includes(':countTokens'))return new Response(JSON.stringify({totalTokens:1300}),{status:200});
  return new Response(JSON.stringify({choices:[{finish_reason:finishReason,
   message:{content:JSON.stringify({parts:[{id:unit.id,text:toLetters(source,outputLetters)}]})}}],
    usage:{completion_tokens:377}}),{status:200});
 };
 const res=response();
 await handler({method:'POST',env:{AI_API_KEY:'MOCK_NO_REAL_TOKEN',AI_MODEL:'gemini-3.5-flash-lite'},
   body:{phase:'draft-v71',draftProtocol:STUDY_DRAFT_PROTOCOL_V71,level,
     targetLetters:level==='summary'?null:exactRetained(letters,Number(level)),
     summaryCapLetters:level==='summary'?(capOverride??Math.round(letters*.45)):null,
     unitBudgets:buildUnitBudgetsV71([unit],level),maxOutputTokens:6000,
     units:[unit]}},res);
 return res;
}
try{
 assert.equal(assignBudgetsV51([unit],'summary')[0].summaryCapLetters,Math.round(letters*.45),
  'Summary is not a legacy 50% cap');
 const findings=[];
 for(const [level,reduction] of variants){
  const amount=Math.round(letters*(1-reduction/100));
  const res=await mockProviderCall(level,amount,'length');
  assert.equal(res.statusCode,200,'Preserve structurally complete first drafts');
  assert.equal(res.data.parts.length,1);
  assert.equal(res.data.finishReason,'length');
  assert.equal(res.data.generationStoppedEarly,true);
  assert.equal(res.data.lengthReview.suspectedTruncation,true);
  assert.equal(res.data.lengthReview.compliant,false);
  assert.equal(res.data.lengthReview.withinBand,false);
  assert.equal(res.data.lengthReview.exact,false,'Cannot call wrong summary exact');
  assert.equal(res.data.outputTokenLimit,6000);
  assert.equal(res.data.outputTokensUsed,377);
  findings.push(level+':'+res.data.lengthReview.achievedReduction+'% outside range; detected');
 }
 const shorter=toLetters(source,Math.round(letters*.115));
 const book={canonicalBookMap:{pageCount:1},chapters:[{
   pageStart:1,pageEnd:1,paragraphs:[{original:source,sourcePageStart:1,sourcePageEnd:1}]}]};
 const staged=[[{editions:{},verified:{}}]];
 const drafts=[[{editions:{summary:shorter}}]];
 const inspection=studyQualityInspectionV66(book,[unit],staged,drafts);
 assert.equal(inspection.levels.summary.reductionCompliant,false);
 assert.ok(inspection.levels.summary.advisory.includes('global-reduction-off-target'));

 // A natural stop with a valid 60% reduction must pass the numeric policy.
 const legal=await mockProviderCall('summary',Math.round(letters*.45),'stop');
 assert.equal(legal.statusCode,200);
 assert.equal(legal.data.finishReason,'stop');
 assert.equal(legal.data.lengthReview.compliant,true);
 assert.equal(legal.data.lengthReview.exact,true);
 const oldSummary=await mockProviderCall('summary',Math.round(letters*.115),'stop',
   Math.round(letters*.5));
 assert.equal(oldSummary.statusCode,400);
 assert.equal(oldSummary.data.code,'AI_LENGTH_TARGET_CONFLICT',
  'Reject stale 50%-retained summary requests in LAB72');

 // Numeric audit must preserve the distinction between provider stop, length and content.
 const audit=measureEditionLengthV72({level:'10',originalLetters:10000,
   outputLetters:8500,completeParts:true,finishReason:'length'});
 assert.equal(audit.withinBand,true);
 assert.equal(audit.compliant,false);
 assert.equal(audit.suspectedTruncation,true);
 assert.equal(STUDY_TARGET_V67.summary.min,50);
 console.log('LAB72 NEGATIVE CLOSURE PASS: '+findings.join('; '));
 console.log('LAB72: legacy 50% summary cap rejected; correct summary 60% accepted; finish length is NOT certified; no actual Gemini key consumed.');
}finally{globalThis.fetch=oldFetch}
