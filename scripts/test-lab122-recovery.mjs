import assert from 'node:assert/strict';
import {generateExplainedBookV122} from '../src/lib/explainedGeneratorV122.js';
import {EXPLAINED_POLICY_V122} from '../src/lib/explainedPolicyV122.js';
import {planStudyAutoResumeV45} from '../src/lib/studyAutoResumeV45.js';
const sentence='Una norma imperativa è una regola obbligatoria che non può essere eliminata da accordi tra privati.';
const original=sentence+' '+sentence;
const book={canonicalBookMap:{originalFingerprint:'c'.repeat(64),pageCount:1,
 pages:[{physicalPage:1,label:'1',sourceStatus:'verified',text:original}],
 chapters:[{title:'Le norme',pageStart:1,sections:[]}]},
 chapters:[{title:'Le norme',pageStart:1,
 paragraphs:[{original,sourcePageStart:1,sourcePageEnd:1}]}]};
let requests=0;const realFetch=globalThis.fetch;
try{
 globalThis.fetch=async()=>{
  requests++;
  return {ok:false,status:503,json:async()=>({
   code:'AI_TEMPORARY_OVERLOAD',retryAfterSeconds:60,error:'Provider busy'})};
 };
 const paused=await generateExplainedBookV122(book,{onProgress:async()=>{}});
 assert.equal(paused.complete,false);
 assert.equal(paused.status,'quota-paused');
 assert.equal(paused.totalChunkVariants,1);
 assert.equal(paused.verifiedChunkVariants,0);
 assert.ok(Date.parse(paused.quota?.retryAt)>Date.now());
 const wake=planStudyAutoResumeV45(paused,Date.now(),0);
 assert.equal(wake?.reason,'provider-cooldown');
 assert.equal(requests,1);
 globalThis.fetch=async(uri,options)=>{
  requests++;
  const source=JSON.parse(options.body).pages[0];
  const answer={id:source.id,
   segments:[{id:source.segments[0].id,
    text:'Una **(norma imperativa)** è una regola obbligatoria che non può essere eliminata da accordi tra privati.'}],
   glossary:[{term:'norma imperativa',definition:'Regola obbligatoria che non si può eliminare con un accordo privato.'}]};
  return {ok:true,status:200,json:async()=>({
   engine:'ai',version:EXPLAINED_POLICY_V122,pages:[answer],providerRequests:1
  })};
 };
 const finished=await generateExplainedBookV122({...book,editionsV36:paused},
  {onProgress:async()=>{}});
 assert.equal(finished.complete,true);
 assert.equal(finished.verifiedChunkVariants,1);
 assert.equal(finished.quota,undefined);
 assert.equal(requests,2);
 let qualityCalls=0;
 const validResponse=globalThis.fetch;
 globalThis.fetch=async(uri,options)=>{
  qualityCalls++;
  const response=await validResponse(uri,options);
  if(qualityCalls>1)return response;
  const output=await response.json();
  output.pages[0].glossary=[];
  return {...response,json:async()=>output};
 };
 const firstReview=await generateExplainedBookV122(book);
 assert.equal(qualityCalls,1,'No immediate extra Gemini call while reviewing page');
 assert.equal(firstReview.status,'quality-review');
 assert.equal(firstReview.verifiedChunkVariants,0);
 const repaired=await generateExplainedBookV122({...book,editionsV36:firstReview},
  {retryReviewed:true});
 assert.equal(qualityCalls,2,'Only the rejected page is retried on resume');
 assert.equal(repaired.diagnostics.qualityReview,0);
 assert.equal(repaired.verifiedChunkVariants,1);
 globalThis.fetch=async()=>{throw new TypeError('Network request failed');};
 const disconnected=await generateExplainedBookV122(book);
 assert.equal(disconnected.diagnostics.lastCode,'V122_NETWORK');
 assert.equal(disconnected.verifiedChunkVariants,0);
 console.log(JSON.stringify({test:'LAB122_RESUME',passed:true,
  provider503Recovered:true,checkpointPreserved:true,
  realModelRequests:0,semanticCertified:false}));
}finally{globalThis.fetch=realFetch;}
