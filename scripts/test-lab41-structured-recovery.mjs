import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import handler from '../api/editionsV36.js';
import {auditGeminiLevels,generateGeminiEditionsV36} from '../src/lib/generativeEditionsV36.js';
import {STUDY_PILLAR_VERSION,studyLetters,exactRetained} from '../src/lib/studyPillarV38.js';
import {progressDiagnostic} from '../src/lib/geminiRecoveryV39.js';
import {clearGeminiPause} from '../src/lib/geminiQuotaControllerV36.js';

const origFetch=globalThis.fetch, origKey=process.env.AI_API_KEY,origUrl=process.env.AI_API_URL;
process.env.AI_API_KEY='fake-lab41-key';process.env.AI_API_URL='https://mock-gemini.invalid';
function res(){return {code:200,payload:null,setHeader(){return this},status(n){this.code=n;return this},json(j){this.payload=j;return this}};}
async function call(body){let x=res();await handler({method:'POST',body},x);return x;}
const original='La norma giuridica disciplina i rapporti sociali. La norma giuridica stabilisce obblighi e diritti. La norma è generale e costituisce una regola.';
try{
 let requests=[];
 globalThis.fetch=async(_url,opts)=>{
   const req=JSON.parse(opts.body);requests.push(req);
   assert.equal(req.reasoning_effort,'low');
   assert.equal(req.response_format?.type,'json_schema');
   assert.equal(req.response_format?.json_schema?.strict,true);
   assert.deepEqual(req.response_format?.json_schema?.schema?.required,['edition']);
   assert.equal(req.response_format?.json_schema?.schema?.additionalProperties,false);
   return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify({edition:original})}}]}),{status:200});
 };
 const out=await call({source:original,level:'50',policy:STUDY_PILLAR_VERSION,
   targetLetters:exactRetained(studyLetters(original),50),context:{chapterTitle:'Diritto'}});
 assert.equal(out.code,200);assert.equal(out.payload.policyVersion,STUDY_PILLAR_VERSION);
 assert.equal(out.payload.diagnostic.format,'json_schema');
 assert.equal(requests.length,1);
 assert.match(requests[0].messages[0].content,/VINCOLO MATEMATICO OBBLIGATORIO/);
 const semantic=auditGeminiLevels(original,out.payload.editions,{pillar:true,
   targetByLevel:{'50':exactRetained(studyLetters(original),50)}});
 assert.equal(semantic.verified['50'],false,'Formatted but semantically invalid output remains blocked');

 let calls=0;
 globalThis.fetch=async()=>{
   calls++;
   throw new TypeError('Network offline');
 };
 const unavailable=await call({source:original,level:'summary',policy:STUDY_PILLAR_VERSION});
 assert.equal(calls,2,'Bounded to two different free models');
 assert.equal(unavailable.code,502);
 assert.equal(unavailable.payload.code,'AI_PROVIDER_NETWORK');
 assert.equal(unavailable.payload.diagnostic.reason,'AI_PROVIDER_NETWORK');
 assert.ok(!JSON.stringify(unavailable.payload).includes('fake-lab41-key'));

 await clearGeminiPause();
 const book={canonicalBookMap:{originalFingerprint:'lab41-connection-resume-test',
   uncertain:[],pages:[{physicalPage:1,sourceStatus:'verified'}]},
   chapters:[{title:'Studio legale',paragraphs:[
     {original:'Le norme disciplinano i rapporti umani.',sourcePageStart:1,sourcePageEnd:1},
     {original:'I diritti regolano i comportamenti.',sourcePageStart:1,sourcePageEnd:1},
     {original:'La filosofia del diritto studia le norme.',sourcePageStart:1,sourcePageEnd:1}]}]};
 let firstFails=true,seen=[];
 globalThis.fetch=async(_url,opts)=>{
   const body=JSON.parse(opts.body);seen.push(body);
   if(firstFails&&body.source==='Le norme disciplinano i rapporti umani.')
     return new Response(JSON.stringify({code:'AI_PROVIDER_TIMEOUT',error:'Provider timeout',
       diagnostic:{reason:'AI_PROVIDER_TIMEOUT',model:'gemini-3.1-flash-lite',elapsedMs:55000,httpStatus:504}}),{status:504});
   return new Response(JSON.stringify({engine:'ai',sourceVersion:'original',
     editions:{[body.level]:body.source}}),{status:200});
 };
 let partial=await generateGeminiEditionsV36(book,{paceMs:0});
 assert.equal(partial.complete,false);
 assert.equal(partial.verifiedChunkVariants,12,'Two other paragraphs processed after one timeout');
 assert.equal(partial.diagnostics?.errorsByCode?.AI_PROVIDER_TIMEOUT,1);
 assert.equal(partial.diagnostics?.lastProviderDiagnostic?.reason,'AI_PROVIDER_TIMEOUT');
 firstFails=false;let count=seen.length;
 let full=await generateGeminiEditionsV36(book,{paceMs:0});
 assert.equal(full.complete,true);
 assert.equal(seen.length-count,6,'Resume must request only six unverified levels');

 const many={...book,canonicalBookMap:{...book.canonicalBookMap,
    originalFingerprint:'lab41-network-breaker'},
   chapters:[{...book.chapters[0],paragraphs:book.chapters[0].paragraphs.slice(0,3)}]};
 seen=[];
 globalThis.fetch=async(_url,opts)=>{
   seen.push(JSON.parse(opts.body));
   return new Response(JSON.stringify({code:'AI_PROVIDER_TIMEOUT',error:'Provider timeout'}),{status:504});
 };
 let stopped=await generateGeminiEditionsV36(many,{paceMs:0});
 assert.equal(stopped.execution.haltedOn,'AI_NETWORK_REVIEW_REQUIRED');
 assert.equal(seen.length,2,'Stop two failed parts before spending a book-worth of requests');
 assert.equal(progressDiagnostic(stopped).kind,'CONNESSIONE');
 console.log('LAB41 test: structured JSON policy, no semantic bypass, typed network errors, 2-failure circuit, checkpoint resume PASS');
}finally{
 globalThis.fetch=origFetch;
 if(origKey===undefined)delete process.env.AI_API_KEY;else process.env.AI_API_KEY=origKey;
 if(origUrl===undefined)delete process.env.AI_API_URL;else process.env.AI_API_URL=origUrl;
 await clearGeminiPause();
}
