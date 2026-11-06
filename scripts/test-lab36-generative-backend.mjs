import assert from 'node:assert/strict';
import handler from '../api/editionsV36.js';
const levels=['10','20','30','40','50','summary'];
const originalFetch=globalThis.fetch;
const prior={url:process.env.AI_API_URL,key:process.env.AI_API_KEY,model:process.env.AI_MODEL};
process.env.AI_API_URL='https://provider.invalid/gemini';process.env.AI_API_KEY='secret-test';process.env.AI_MODEL='test-model';
function recorder(){return {code:200,payload:null,setHeader(){return this},status(n){this.code=n;return this},json(x){this.payload=x;return this}};}
async function call(body){const res=recorder();await handler({method:'POST',body},res);return res;}
try{
  const expected=Object.fromEntries(levels.map(x=>[x,'Articolo 7, salvo eccezione: la norma non cambia.']));
  let requestCount=0;
  globalThis.fetch=async(_url,options)=>{
    requestCount++;
    assert.equal(options.headers.Authorization,'Bearer secret-test');
    const sent=JSON.parse(options.body);
    assert.match(sent.messages[0].content,/DIRETTAMENTE sul testo FONTE/);
    assert.match(sent.messages[1].content,/Articolo 7/);
    return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({editions:expected})}}]}),{status:200,headers:{'Content-Type':'application/json'}});
  };
  let good=await call({source:'Articolo 7, salvo eccezione: la norma non cambia.',context:{chapterTitle:'Norme'}});
  assert.equal(good.code,200);assert.deepEqual(Object.keys(good.payload.editions),levels);assert.equal(good.payload.engine,'ai');
  assert.equal(requestCount,1);
  globalThis.fetch=async()=>new Response('rate limit',{status:429});
  let quota=await call({source:'La regola resta valida.'});
  assert.equal(quota.code,429);assert.equal(quota.payload.code,'AI_QUOTA_LIMIT');
  globalThis.fetch=async()=>new Response(JSON.stringify({choices:[{message:{content:'{"editions":{"10":"solo una"}}'}}]}),{status:200,headers:{'Content-Type':'application/json'}});
  let bad=await call({source:'La regola resta valida.'});
  assert.equal(bad.code,502);assert.equal(bad.payload.code,'INVALID_GENERATIVE_RESPONSE');
  delete process.env.AI_API_KEY;
  let unavailable=await call({source:'La regola resta valida.'});
  assert.equal(unavailable.code,503);
  console.log('LAB36 six independent Gemini editions: provider, schema, quota and config safety OK');
}finally{
  globalThis.fetch=originalFetch;
  for(const [name,key] of [['AI_API_URL','url'],['AI_API_KEY','key'],['AI_MODEL','model']]){
    if(prior[key]===undefined)delete process.env[name];else process.env[name]=prior[key];
  }
}
