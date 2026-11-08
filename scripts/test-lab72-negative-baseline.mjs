// LAB72 read-only destructive-negative regression on the exact LAB71 code.
// Deliberately fake Gemini responses; no real provider calls or secret keys.
// The audit must report the failures (not certify them) before a fix is designed.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import handler from '../api/editionsBulkV51.js';
import {STUDY_DRAFT_PROTOCOL_V71,buildUnitBudgetsV71} from '../src/lib/studyDraftProtocolV71.js';
import {STUDY_TARGET_V67} from '../src/lib/studyRebalancePolicyV67.js';
import {studyLetters,exactRetained} from '../src/lib/studyPillarV38.js';

const base=('Il diritto regola rapporti e condizioni. Ogni norma si applica con eccezioni che devono essere comprese. ').repeat(120);
const sourceLetters=studyLetters(base);
const levels=[['summary',88.5],['50',84.2],['40',84.6],['30',83.1],['20',68],['10',51]];
function cutAtLetter(source,target){
 const matches=[...source.matchAll(/\p{L}/gu)];
 return source.slice(0,(matches[Math.min(Math.max(target,1),matches.length)-1]?.index||0)+1);
}
const nativeFetch=globalThis.fetch;
function makeRes(){const headers=new Map();return {
 statusCode:200,body:null,headers,
 setHeader(k,v){headers.set(k,v);return this},
 status(code){this.statusCode=code;return this},
 json(body){this.body=body;return this}
};}
try{
 const findings=[];
 let requests=0;
 for(const [level,requestedReduction] of levels){
  const units=[{id:'0:0',source:base,pageStart:1,pageEnd:1}];
  const expected=level==='summary'?Math.round(sourceLetters*.4):exactRetained(sourceLetters,Number(level));
  const oldCap=level==='summary'?Math.round(sourceLetters*.5):null;
  const observed=Math.round(sourceLetters*(1-requestedReduction/100));
  globalThis.fetch=async(url)=>{
   if(String(url).includes(':countTokens'))
    return new Response(JSON.stringify({totalTokens:2000}),{status:200});
   requests++;
   return new Response(JSON.stringify({choices:[{finish_reason:'length',
    message:{content:JSON.stringify({parts:[{id:'0:0',text:cutAtLetter(base,observed)}]})}}],
    usage:{completion_tokens:1000}}),{status:200});
  };
  const result=makeRes();
  await handler({
    method:'POST',env:{AI_API_KEY:'FAKE_KEY_NO_PROVIDER_CALL',AI_MODEL:'gemini-3.5-flash-lite'},
    body:{phase:'draft-v71',draftProtocol:STUDY_DRAFT_PROTOCOL_V71,
      level,bookTitle:'LAB72 negative audit',targetLetters:level==='summary'?null:expected,
      summaryCapLetters:oldCap,
      unitBudgets:buildUnitBudgetsV71(units,level),maxOutputTokens:6000,units}
  },result);
  assert.equal(result.statusCode,200);
  const b=STUDY_TARGET_V67[level];
  assert.ok(result.body.lengthReview.achievedReduction<b.min ||
    result.body.lengthReview.achievedReduction>b.max);
  assert.equal(result.body.completeParts,true);
  assert.equal(result.body.finishReason,undefined,'LAB71 did not report finishReason');
  if(level==='summary'){
   assert.equal(result.body.lengthReview.exact,true,
     'LAB71 incorrectly certifies an overcompressed summary as exact');
  }else{
   assert.equal(result.body.lengthReview.exact,false);
  }
  findings.push({level,observedReduction:result.body.lengthReview.achievedReduction,
   inBand:false,acceptedHttp:result.statusCode,
   falselyExact:result.body.lengthReview.exact,
   missingFinishReason:result.body.finishReason===undefined});
 }
 const generator=readFileSync(new URL('../src/lib/generativeEditionsV36.js',import.meta.url),'utf8');
 const quality=readFileSync(new URL('../src/lib/studyQualityV66.js',import.meta.url),'utf8');
 const pillar=readFileSync(new URL('../docs/STUDYBOOK_STUDIO_PROGRESSIVO_PILASTRO_V1.md',import.meta.url),'utf8');
 assert.match(generator,/qualityOnly:true/);
 assert.match(quality,/actualReduction!==null&&actualReduction<=50/);
 assert.match(pillar,/Nessuna percentuale fissa/);
 assert.equal(requests,6);
 console.log('LAB71 BASELINE NEGATIVE TEST REPRODUCED (6/6) NO GEMINI COST:');
 console.log(JSON.stringify(findings,null,2));
 console.log('LIVE GEMINI MODEL OUTPUT LENGTH: NOT CHECKED.');
}finally{globalThis.fetch=nativeFetch}
