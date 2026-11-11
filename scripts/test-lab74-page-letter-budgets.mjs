// LAB74 source-based per-page budget, 6 targets, ±5 ORIGINAL percentage points.
// Everything runs offline, with a fake provider and no user's book or API key.
import assert from 'node:assert/strict';
import handler,{editionPageBudgetInstructionV74} from '../api/editionsBulkV51.js';
import {studyLetters} from '../src/lib/studyPillarV38.js';
import {STUDY_TARGET_V67,measureEditionLengthV72} from '../src/lib/studyRebalancePolicyV67.js';
import {buildUnitBudgetsV71} from '../src/lib/studyDraftProtocolV71.js';
import {STUDY_DRAFT_PROTOCOL_V74,verifyStudyDraftResponseV74} from '../src/lib/studyDraftProtocolV74.js';
import {pageLetterBudgetsV74,pageLetterReviewV74} from '../src/lib/studyPageBudgetsV74.js';
const levels=[
 ['summary',45,40,50],
 ['50',50,45,55],
 ['40',55,50,60],
 ['30',65,60,70],
 ['20',75,70,80],
 ['10',85,80,90]
];
for(const [level,target,min,max] of levels){
 const one=pageLetterBudgetsV74([{id:'0:0',pageStart:1,pageEnd:1,source:'A'.repeat(100)}],level)[0];
 assert.equal(one.originalLetters,100);
 assert.equal(one.targetLetters,target);
 assert.equal(one.minLetters,min);
 assert.equal(one.maxLetters,max);
 assert.equal(one.tolerancePercentagePoints,5);
 assert.equal(STUDY_TARGET_V67[level].min,100-max);
 assert.equal(STUDY_TARGET_V67[level].max,100-min);
 const upper=measureEditionLengthV72({level,originalLetters:100,outputLetters:max});
 const lower=measureEditionLengthV72({level,originalLetters:100,outputLetters:min});
 assert.equal(upper.withinBand,true);
 assert.equal(lower.withinBand,true);
 assert.equal(measureEditionLengthV72({level,originalLetters:100,outputLetters:max+1}).withinBand,false);
 assert.equal(measureEditionLengthV72({level,originalLetters:100,outputLetters:min-1}).withinBand,false);
 const prompt=editionPageBudgetInstructionV74(level,100,'draft');
 assert.match(prompt,/prima conta le lettere/i);
 assert.match(prompt,/minimo /i);
 assert.match(prompt,/massimo /i);
}
const units=[
 {id:'0:0',source:'A'.repeat(60),pageStart:1,pageEnd:1},
 {id:'0:1',source:'B'.repeat(40),pageStart:1,pageEnd:1},
 {id:'0:2',source:'C'.repeat(100),pageStart:2,pageEnd:2}
];
assert.deepEqual(pageLetterBudgetsV74(units,'50').map(g=>[g.pageStart,g.pageEnd,g.targetLetters,g.minLetters,g.maxLetters]),
 [[1,1,50,45,55],[2,2,50,45,55]]);
const spanning=pageLetterBudgetsV74([
 {id:'0:0',source:'C'.repeat(100),pageStart:1,pageEnd:2},
 {id:'0:1',source:'D'.repeat(100),pageStart:2,pageEnd:2}], '50');
assert.equal(spanning.length,1);
assert.deepEqual([spanning[0].pageStart,spanning[0].pageEnd],[1,2]);
assert.equal(spanning[0].targetLetters,100);
assert.deepEqual(spanning[0].unitIds,['0:0','0:1']);
const lettersOnly=pageLetterBudgetsV74([
 {id:'0:0',source:'AB 123! cd',pageStart:1,pageEnd:1}], '50')[0];
assert.equal(lettersOnly.originalLetters,4);
assert.equal(lettersOnly.targetLetters,2);
assert.ok(lettersOnly.minLetters<=lettersOnly.maxLetters);

const nativeFetch=globalThis.fetch;
const res=()=>({statusCode:200,payload:null,headers:new Map(),
 setHeader(k,v){this.headers.set(k,v);return this},
 status(s){this.statusCode=s;return this},json(b){this.payload=b;return this}});
let providerCalls=0;
globalThis.fetch=async(url)=>{
 if(String(url).includes(':countTokens'))
  return new Response(JSON.stringify({totalTokens:750}),{status:200});
 providerCalls++;
 const parts=[
  {id:'0:0',text:'A'.repeat(30)},
  {id:'0:1',text:'B'.repeat(20)},
  {id:'0:2',text:'C'.repeat(50)}
 ];
 return new Response(JSON.stringify({choices:[{finish_reason:'stop',
  message:{content:JSON.stringify({parts})}}],
  usage:{completion_tokens:170}}),{status:200});
};
try{
 const input={phase:'draft-v74',draftProtocol:STUDY_DRAFT_PROTOCOL_V74,
  level:'50',bookTitle:'Fonte didattica fittizia',units,
  unitBudgets:buildUnitBudgetsV71(units,'50'),
  pageBudgetsV74:pageLetterBudgetsV74(units,'50'),
  targetLetters:100,summaryCapLetters:null,
  maxOutputTokens:6000,timeoutMs:80000};
 const good=res();
 await handler({method:'POST',env:{AI_API_KEY:'MOCK_ONLY',AI_MODEL:'gemini-3.5-flash-lite'},body:input},good);
 assert.equal(good.statusCode,200,JSON.stringify(good.payload));
 assert.equal(good.headers.get('X-StudyBook-Draft-Protocol'),STUDY_DRAFT_PROTOCOL_V74);
 assert.equal(good.payload.lengthReview.pageReviewV74.withinBand,true);
 assert.equal(good.payload.lengthReview.compliant,true);
 assert.equal(good.payload.lengthReview.achievedReduction,50);
 assert.equal(verifyStudyDraftResponseV74(good.payload,200,'50').ok,true);
 const old={...good.payload,draftProtocol:'lab72-canonical-range-observability-v1'};
 assert.equal(verifyStudyDraftResponseV74(old,200,'50').ok,false);
 const corrupted=res(),before=providerCalls;
 await handler({method:'POST',env:{AI_API_KEY:'MOCK_ONLY',AI_MODEL:'gemini-3.5-flash-lite'},body:{
  ...input,pageBudgetsV74:input.pageBudgetsV74.map((p,i)=>i===0?{...p,targetLetters:30}:p)
 }},corrupted);
 assert.equal(corrupted.statusCode,409);
 assert.equal(corrupted.payload.code,'AI_PAGE_BUDGET_MISMATCH');
 assert.equal(providerCalls,before,'Must refuse invalid numeric input BEFORE Gemini call');
 const fakeBalanced=pageLetterReviewV74(units,[
  {id:'0:0',text:'A'.repeat(50)},{id:'0:1',text:'B'.repeat(30)},
  {id:'0:2',text:'C'.repeat(20)}
 ],'50');
 assert.equal(fakeBalanced.groups[0].outputLetters,80);
 assert.equal(fakeBalanced.groups[1].outputLetters,20);
 assert.equal(fakeBalanced.withinBand,false,'Whole-book 50% cannot mask broken page budgets');
 assert.equal(studyLetters('àABC 123 .'),4);
 console.log('LAB74_PAGE_BUDGET_PASS',JSON.stringify({sixLevels:6,
  pages:2,pageBudgetsVerified:true,geminiCalls:providerCalls,
  tamperRejected:true,multispanPreserved:true}));
}finally{globalThis.fetch=nativeFetch}
