import assert from 'node:assert/strict';
import {generateExplainedBookV122} from '../src/lib/explainedGeneratorV122.js';
import {planStudyAutoResumeV45} from '../src/lib/studyAutoResumeV45.js';
import {EXPLAINED_POLICY_V122} from '../src/lib/explainedPolicyV122.js';
import {default as explainedWorker} from '../api/explainedV122.js';

const source='Una norma imperativa è una regola obbligatoria che non può essere eliminata da accordi tra privati. '.repeat(2).trim();
const simple='Una **(norma imperativa)** è una regola obbligatoria che non può essere eliminata da accordi tra privati.';
const book={canonicalBookMap:{originalFingerprint:'1'.repeat(64),pageCount:44,
 pages:Array.from({length:44},(_,i)=>({physicalPage:i+1,label:String(i+1),
  sourceStatus:'verified',widthPt:595,heightPt:842,text:source})),
 chapters:[{title:'Le norme',pageStart:1,pageEnd:44,sections:[]}]},
 chapters:[{title:'Le norme',pageStart:1,pageEnd:44,paragraphs:Array.from({length:44},
 (_,i)=>({original:source,sourcePageStart:i+1,sourcePageEnd:i+1}))}]};
const replyFor=pages=>({engine:'ai',version:EXPLAINED_POLICY_V122,pages:pages.map(p=>({
 id:p.id,segments:p.segments.map(s=>({id:s.id,text:simple})),
 glossary:[{term:'norma imperativa',definition:'Una regola obbligatoria che le parti non possono eliminare con accordo.'}]
}))});
const nativeFetch=globalThis.fetch;
try{
 let calls=[],step=0,firstSnapshot=null;
 globalThis.fetch=async(_,options)=>{
  const req=JSON.parse(options.body),batch=req.pages;
  calls.push(batch.map(p=>p.id));
  if(step++===1)return {ok:false,status:503,json:async()=>({
   code:'AI_TEMPORARY_OVERLOAD',retryAfterSeconds:80})};
  return {ok:true,status:200,json:async()=>replyFor(batch)};
 };
 const progress=[];
 const completed=await generateExplainedBookV122(book,{
  onProgress:async s=>{progress.push(s);if(!firstSnapshot&&s.verifiedChunkVariants>0)firstSnapshot=s;}
 });
 assert.equal(calls[0].length,1,'FIRST Gemini block must be exactly one original page');
 assert.equal(firstSnapshot.verifiedChunkVariants,1,'one page saved before any larger request');
 assert.equal(calls[1].length>1,true,'then batching is allowed');
 assert.ok(calls[2].length<calls[1].length,'503 must halve the batch rather than stall all 44 pages');
 assert.equal(completed.verifiedChunkVariants,44);
 assert.equal(completed.complete,true);
 assert.equal(completed.diagnostics.splits,1);
 assert.equal(progress.some(p=>p.verifiedChunkVariants>=1&&p.verifiedChunkVariants<44),true);
 console.log('PASS LAB123: first page available before 503, safe split and 44/44 checkpoints');

 let failures=0;globalThis.fetch=async()=>{
  failures++;return {ok:false,status:503,json:async()=>({
   code:'AI_TEMPORARY_OVERLOAD',retryAfterSeconds:90})};
 };
 const stopped=await generateExplainedBookV122(book,{onProgress:async()=>{}});
 assert.equal(stopped.verifiedChunkVariants,0);
 assert.equal(stopped.status,'quota-paused');
 assert.equal(failures,1,'one failed first-page request, no storm');
 assert.ok(Date.parse(stopped.quota.retryAt)>Date.now());
 const readyAt=Date.parse(stopped.quota.retryAt)+1;
 const wake=planStudyAutoResumeV45(stopped,readyAt);
 assert.equal(wake.reason,'provider-cooldown');
 assert.ok(wake.at>=readyAt);
 let resumedRequests=0;globalThis.fetch=async(_,opts)=>{
  resumedRequests++;
  return {ok:true,status:200,json:async()=>replyFor(JSON.parse(opts.body).pages)};
 };
 const recovered=await generateExplainedBookV122({...book,editionsV36:stopped},
  {onProgress:async()=>{}});
 assert.equal(recovered.complete,true);
 assert.equal(recovered.verifiedChunkVariants,44);
 assert.equal(recovered.quota,undefined);
 assert.ok(resumedRequests>1);
 console.log('PASS LAB123: no-progress 503 then 44/44 resumes from saved original');

 const blocked=planStudyAutoResumeV45({...stopped,quota:undefined,
  status:'provider-blocked'},readyAt,0);
 assert.equal(blocked.reason,'lab123-provider-recovery');
 assert.equal(planStudyAutoResumeV45({...stopped,quota:undefined,
  status:'provider-blocked'},readyAt,2),null);
 console.log('PASS LAB123: 502/network foreground retry bounded to 2');

 let providerModels=[],workerResponse=null,workerStatus=200;
 globalThis.fetch=async(_,options)=>{
  const model=JSON.parse(options.body).model;
  providerModels.push(model);
  if(model==='gemini-3.5-flash-lite')return {ok:false,status:503,
   headers:new Headers(),json:async()=>({error:{status:'UNAVAILABLE',message:'Service temporarily busy'}})};
  return {ok:true,status:200,headers:new Headers(),
   json:async()=>({choices:[{finish_reason:'stop',message:{
    content:JSON.stringify({pages:replyFor([{
     id:'p1',segments:[{id:'p1-s0',source}]
    }]).pages})}}]})};
 };
 const response={
  setHeader(){return this;},
  status(v){workerStatus=v;return this;},
  json(v){workerResponse=v;return this;}
 };
 await explainedWorker({method:'POST',env:{AI_API_KEY:'test',AI_MODEL:'gemini-3.5-flash-lite',
  STUDYBOOK_LAB123_503_FAILOVER:'1'},
  body:{policy:EXPLAINED_POLICY_V122,pages:[{id:'p1',
   segments:[{id:'p1-s0',source}]}],timeoutMs:150000}},response);
 assert.equal(workerStatus,200,JSON.stringify(workerResponse));
 assert.deepEqual(providerModels,['gemini-3.5-flash-lite','gemini-3.1-flash-lite']);
 assert.equal(workerResponse.providerRequests,2);
 assert.equal(workerResponse.failoverRecovered,true);
 assert.equal(workerResponse.readyPages,1);
 assert.equal(workerResponse.privateBandDisclosedToGemini,false);
 console.log('PASS LAB123: primary 503 to free-tier fallback, one bounded provider retry');
 console.log(JSON.stringify({test:'LAB123_503_RECOVERY',passed:true,
  checkedPages:44,providerFailover:'free-model-only',semanticCertified:false}));
}finally{globalThis.fetch=nativeFetch;}
