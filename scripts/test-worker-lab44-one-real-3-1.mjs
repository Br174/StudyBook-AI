// Exactly ONE real, free-tier-only Gemini request; NO retry/repair/fallback.
// Neither user book content nor API key is read or printed.
import assert from 'node:assert/strict';
import handler from '../api/editionsV36.js';
import {STUDY_PILLAR_VERSION,studyLetters,exactRetained} from '../src/lib/studyPillarV38.js';
import {auditGeminiLevels} from '../src/lib/generativeEditionsV36.js';

const key=process.env.AI_API_KEY||process.env.GEMINI_API_KEY;
assert.ok(key,'Existing authorized Gemini free key is missing; no provider test');
const text='La norma giuridica disciplina i rapporti sociali e garantisce diritti e doveri.';
const source=Array(8).fill(text).join(' ');
const cap=exactRetained(studyLetters(source),50)-1;
let httpCalls=0;
const actualFetch=globalThis.fetch;
const out={statusCode:200,headers:{},body:null,
  status(code){this.statusCode=code;return this;},
  setHeader(k,v){this.headers[k]=v;return this;},
  json(data){this.body=data;return this;}};
try {
 globalThis.fetch=(...args)=>{
   httpCalls++;
   if(httpCalls>1)throw new Error('PROVIDER_REQUEST_BUDGET_EXCEEDED');
   return actualFetch(...args);
 };
 await handler({
   method:'POST',
   env:{AI_API_KEY:key,STUDYBOOK_PREFERRED_EDITION_MODEL:'gemini-3.1-flash-lite'},
   body:{source,level:'summary',policy:STUDY_PILLAR_VERSION,summaryCapLetters:cap,
    context:{chapterTitle:'Filosofia del diritto',sectionTitle:'La norma giuridica'}}
 },out);
 assert.equal(httpCalls,1,'Exactly one real call permitted');
 if(out.statusCode!==200){
   console.log('ONE_GEMINI_3_1_REAL_PROBE=BLOCKED',JSON.stringify({
     status:out.statusCode,
     code:String(out.body?.code||'unknown').slice(0,60),
     quotaKind:String(out.body?.quota?.kind||'unknown').slice(0,60),
     retrySource:String(out.body?.quota?.retrySource||'unknown').slice(0,60),
     model:String(out.body?.quota?.model||'unknown').slice(0,60)
   }));
   throw new Error('3.1 real probe did not produce verifiable study edition; NO deployment');
 }
 assert.equal(out.body.model,'gemini-3.1-flash-lite');
 assert.equal(out.body.engine,'ai');
 assert.equal(out.body.policyVersion,STUDY_PILLAR_VERSION);
 assert.equal(out.body.diagnostic?.format,'json_schema');
 assert.equal(typeof out.body.editions?.summary,'string');
 const review=auditGeminiLevels(source,out.body.editions,{
   pillar:true,summaryCapLetters:cap
 });
 const verified=review.verified.summary===true;
 console.log('ONE_GEMINI_3_1_REAL_PROBE',JSON.stringify({
   model:out.body.model,providerRequests:httpCalls,jsonSchema:true,
   originalLetters:studyLetters(source),
   summaryLetters:studyLetters(out.body.editions.summary),
   summaryCap:cap,
   verified,
   issues:(review.issues.summary||[]).map(x=>x.split(':')[0]).slice(0,12)
 }));
 assert.ok(verified,'One real generated summary did not pass unchanged StudyBook pillar; NO deployment');
} finally{
 globalThis.fetch=actualFetch;
}