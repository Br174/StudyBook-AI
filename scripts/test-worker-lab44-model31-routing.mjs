// Scudo360/Pac-Man: NO Gemini network traffic, exact Worker-only model routing.
import assert from 'node:assert/strict';
import handler from '../api/editionsV36.js';
const originalFetch=globalThis.fetch;
const key='offline-only-fake-test-key';
const models=[];
const mkRes=()=>({
 statusCode:200,body:null,headers:{},
 status(code){this.statusCode=code;return this;},
 setHeader(name,value){this.headers[name]=value;return this;},
 json(value){this.body=value;return this;}
});
const source='La norma giuridica disciplina i rapporti sociali.';
const request=(preferred)=>({
 method:'POST',
 env:{AI_API_KEY:key,...(preferred?{STUDYBOOK_PREFERRED_EDITION_MODEL:preferred}:{})},
 body:{source,level:'summary'}
});
try {
 globalThis.fetch=async(_url,options)=>{
   const call=JSON.parse(options.body);
   models.push(call.model);
   if(call.model==='gemini-3.1-flash-lite'){
     return new Response(JSON.stringify({
       choices:[{finish_reason:'stop',message:{content:'{"edition":"La norma giuridica disciplina i rapporti sociali."}'}}]
     }),{status:200});
   }
   return new Response(JSON.stringify({error:{status:'RESOURCE_EXHAUSTED',message:'429 quota'}}),{status:429});
 };
 const preferred=mkRes();
 await handler(request('gemini-3.1-flash-lite'),preferred);
 assert.equal(preferred.statusCode,200);
 assert.equal(preferred.body.model,'gemini-3.1-flash-lite');
 assert.deepEqual(models,['gemini-3.1-flash-lite'],'Pilot must not request 3.5');
 models.length=0;
 const legacy=mkRes();
 await handler(request(null),legacy);
 assert.equal(legacy.statusCode,429,'Original LAB44 default remains unchanged');
 assert.deepEqual(models,['gemini-3.5-flash-lite'],'Legacy no-preference route must remain original');
 models.length=0;
 globalThis.fetch=async(_url,options)=>{
   models.push(JSON.parse(options.body).model);
   return new Response(JSON.stringify({error:{status:'RESOURCE_EXHAUSTED',message:'free per-model limit'}}),{status:429});
 };
 const blocked=mkRes();
 await handler(request('gemini-3.1-flash-lite'),blocked);
 assert.equal(blocked.statusCode,429);
 assert.equal(blocked.body.code,'AI_QUOTA_LIMIT');
 assert.deepEqual(models,['gemini-3.1-flash-lite'],'Do not fall back to exhausted 3.5 on 3.1 quota');
 assert.ok(!JSON.stringify(blocked.body).includes(key),'No key ever exposed in diagnostics');
 console.log('SCUDO360_WORKER_MODEL31 PASS: 3.1 is exclusive when bound, old default untouched, quota fallback blocked, no keys exposed.');
}finally{
 globalThis.fetch=originalFetch;
}