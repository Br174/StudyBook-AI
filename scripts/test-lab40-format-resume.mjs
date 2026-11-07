import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import handler from '../api/editionsV36.js';
import {generateGeminiEditionsV36} from '../src/lib/generativeEditionsV36.js';
import {clearGeminiPause} from '../src/lib/geminiQuotaControllerV36.js';
import {progressDiagnostic} from '../src/lib/geminiRecoveryV39.js';

const oldFetch=globalThis.fetch;
const oldKey=process.env.AI_API_KEY,oldUrl=process.env.AI_API_URL;
process.env.AI_API_KEY='fake-test-only';process.env.AI_API_URL='https://gemini-mock.invalid';
const res=()=>({code:200,body:null,setHeader(){return this;},status(n){this.code=n;return this;},json(x){this.body=x;return this;}});
async function api(body){const r=res();await handler({method:'POST',body},r);return r;}
const sample='La filosofia del diritto studia i principi delle norme. La giustizia regola i rapporti umani.';
try{
  let requests=[];
  globalThis.fetch=async(_url,options)=>{
    const request=JSON.parse(options.body);requests.push(request);
    assert.equal(request.reasoning_effort,'low');
    assert.ok(request.max_tokens>=2048,'Visible content must have room beyond thinking');
    const text=requests.length===1?'':JSON.stringify({edition:'Testo di studio completo.'});
    return new Response(JSON.stringify({choices:[{finish_reason:requests.length===1?'length':'stop',message:{content:text}}]}),{status:200});
  };
  const repaired=await api({source:sample,level:'summary'});
  assert.equal(repaired.code,200,'Fallback free model must recover an empty first response');
  assert.equal(requests.length,2,'At most one known-free-model fallback');
  assert.notEqual(requests[0].model,requests[1].model,'Do not repeat identical failed model');
  assert.equal(repaired.body.editions.summary,'Testo di studio completo.');

  requests=[];
  globalThis.fetch=async(_url,options)=>{
    requests.push(JSON.parse(options.body));
    return new Response(JSON.stringify({choices:[{finish_reason:'length',message:{content:null}}]}),{status:200});
  };
  const invalid=await api({source:sample,level:'50'});
  assert.equal(invalid.code,502);
  assert.equal(invalid.body.code,'INVALID_GENERATIVE_RESPONSE');
  assert.equal(invalid.body.diagnostic.reason,'OUTPUT_TRUNCATED');
  assert.equal(requests.length,2,'Invalid responses must have a strict retry bound');
  assert.equal(JSON.stringify(invalid.body).includes('fake-test-only'),false,'Never expose keys');

  await clearGeminiPause();
  const sourceA='La teoria comprende regole, norme e rapporti giuridici.';
  const sourceB='Il diritto regola le relazioni sociali e le responsabilità.';
  const book={canonicalBookMap:{originalFingerprint:'lab40-incomplete-first-verification',
    uncertain:[],pages:[{physicalPage:1,sourceStatus:'verified'}]},
    chapters:[{title:'Teoria',paragraphs:[
      {original:sourceA,sourcePageStart:1,sourcePageEnd:1},
      {original:sourceB,sourcePageStart:1,sourcePageEnd:1}]}]};
  let failFirst=true,calls=[];
  globalThis.fetch=async(_url,options)=>{
    const body=JSON.parse(options.body);calls.push(body);
    if(failFirst&&body.source===sourceA)
      return new Response(JSON.stringify({error:'Risposta non valida',code:'INVALID_GENERATIVE_RESPONSE'}),{status:502});
    return new Response(JSON.stringify({engine:'ai',sourceVersion:'original',editions:{[body.level]:body.source}}),{status:200});
  };
  const partial=await generateGeminiEditionsV36(book,{paceMs:0});
  assert.equal(partial.complete,false);
  assert.equal(partial.verifiedChunkVariants,6,'Next paragraph must finish despite isolated invalid response');
  assert.equal(calls.length,7,'One failed request plus six valid editions');
  assert.equal(partial.rows[0][0].verified.summary,false);
  assert.equal(partial.rows[0][1].verified.summary,true);
  failFirst=false;
  const callsBeforeResume=calls.length;
  const resumed=await generateGeminiEditionsV36(book,{paceMs:0});
  assert.equal(resumed.complete,true,'Unverified chunk must resume from checkpoint');
  assert.equal(calls.length-callsBeforeResume,6,'Already-verified neighboring chunk must not repeat');
  const callsAfterComplete=calls.length;
  await generateGeminiEditionsV36(book,{paceMs:0});
  assert.equal(calls.length,callsAfterComplete,'All verified editions must remain cached');

  const allFailBook={canonicalBookMap:{originalFingerprint:'lab40-circuit-open-after-two',uncertain:[],
    pages:[{physicalPage:1,sourceStatus:'verified'}]},chapters:[{title:'Prova',paragraphs:[
      {original:'Una norma è una regola generale.',sourcePageStart:1,sourcePageEnd:1},
      {original:'Il diritto disciplina i comportamenti.',sourcePageStart:1,sourcePageEnd:1},
      {original:'La giustizia sostiene la convivenza.',sourcePageStart:1,sourcePageEnd:1}]}]};
  calls=[];
  globalThis.fetch=async(_url,options)=>{
    calls.push(JSON.parse(options.body));
    return new Response(JSON.stringify({error:'Invalid edition',code:'INVALID_GENERATIVE_RESPONSE'}),{status:502});
  };
  const halted=await generateGeminiEditionsV36(allFailBook,{paceMs:0});
  assert.equal(halted.execution.haltedOn,'AI_FORMAT_REVIEW_REQUIRED');
  assert.equal(calls.length,2,'Circuit breaker must prevent 1452 useless chunk attempts');
  assert.equal(progressDiagnostic(halted).kind,'RISPOSTA_NON_VALIDA');
  console.log('LAB40: low thinking + free bounded model fallback, invalid JSON guard, per-chunk skip, persistent resume, consecutive-error circuit PASS');
}finally{
  globalThis.fetch=oldFetch;
  if(oldKey===undefined)delete process.env.AI_API_KEY;else process.env.AI_API_KEY=oldKey;
  if(oldUrl===undefined)delete process.env.AI_API_URL;else process.env.AI_API_URL=oldUrl;
  await clearGeminiPause();
}
