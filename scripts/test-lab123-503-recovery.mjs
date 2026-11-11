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
 // Test A: 503 means a cooldown, NOT 44 -> 22 -> 11 immediate requests.
 let calls=[],progress=[];
 globalThis.fetch=async(_,options)=>{
  const req=JSON.parse(options.body);
  calls.push(req.pages.map(p=>p.id));
  return {ok:false,status:503,json:async()=>({
   code:'AI_TEMPORARY_OVERLOAD',retryAfterSeconds:80})};
 };
 const halted=await generateExplainedBookV122(book,{
  onProgress:async snapshot=>progress.push(snapshot)
 });
 assert.equal(calls.length,1,'one 503 must produce exactly ONE attempted request');
 assert.equal(calls[0].length,44,'first planned block contains all 44 short pages');
 assert.equal(halted.status,'quota-paused');
 assert.equal(halted.verifiedChunkVariants,0);
 assert.ok(Date.parse(halted.quota.retryAt)>Date.now());
 assert.ok(halted.diagnostics.nextBlockChars<28000);
 const future=Date.parse(halted.quota.retryAt)+1;
 const wake=planStudyAutoResumeV45(halted,future);
 assert.equal(wake.reason,'provider-cooldown');
 assert.ok(wake.at>=future);
 console.log('PASS LAB124: one 503 pauses exactly once and reduces future block-size budget');

 // Test B: after cooldown, previously saved original pages are reused and
 // only as many whole-page requests as the new capacity requires are sent.
 calls=[];
 globalThis.fetch=async(_,options)=>{
  const block=JSON.parse(options.body).pages;
  calls.push(block.map(p=>p.id));
  return {ok:true,status:200,json:async()=>replyFor(block)};
 };
 const recovered=await generateExplainedBookV122({...book,editionsV36:halted},{
  onProgress:async snapshot=>progress.push(snapshot)
 });
 assert.equal(recovered.complete,true);
 assert.equal(recovered.verifiedChunkVariants,44);
 assert.equal(recovered.quota,undefined);
 assert.ok(calls.length>=1);
 assert.ok(calls.every(batch=>batch.length>=1));
 assert.deepEqual(calls.flat(),Array.from({length:44},(_,i)=>'p'+(i+1)));
 assert.ok(progress.some(s=>s.verifiedChunkVariants>0&&s.verifiedChunkVariants<44));
 console.log('PASS LAB124: scheduled recovery completes 44/44 from original and page checkpoints');

 // Test C: a size-error 413 is not a quota 503: halve whole pages safely.
 calls=[];let attempts=0;
 globalThis.fetch=async(_,options)=>{
  const block=JSON.parse(options.body).pages;
  calls.push(block.map(p=>p.id));
  if(attempts++===0)return {ok:false,status:413,json:async()=>({
   code:'V122_BLOCK_TOO_LARGE'})};
  return {ok:true,status:200,json:async()=>replyFor(block)};
 };
 const split=await generateExplainedBookV122(book,{onProgress:async()=>{}});
 assert.equal(split.complete,true);
 assert.equal(split.diagnostics.splits,1);
 assert.equal(calls.length,3,'413: one initial oversize attempt and two half blocks');
 assert.equal(calls[0].length,44);
 assert.equal(calls[1].length,22);
 assert.equal(calls[2].length,22);
 console.log('PASS LAB124: real size error splits at full-page boundaries');

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
