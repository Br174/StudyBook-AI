#!/usr/bin/env node
// LAB138 no-cost regression: same-book checkpoint reuse, one-pass page
// quality contracts and zero blind HTTP503 retries. No real Gemini/network.
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import explainedV138Handler from '../api/explainedV138.js';
import explainedV126Handler from '../api/explainedV126.js';
import {EXPLAINED_POLICY_V126,lessonInstructionOnePassV138,
 lessonPayloadOnePassV138,auditExplainedPageV126} from '../src/lib/explainedStagesV126.js';
import {generateExplainedBookV126} from '../src/lib/explainedGeneratorV126.js';
import {saveLibraryBook,saveExplainedCheckpoint,getLibraryBook,
 findBestExplainedCheckpointV138} from '../src/lib/library.js';

const phrase='La barca viaggia vicino al porto, mentre il mare è calmo. ';
const text=phrase.repeat(24);
const fp='a'.repeat(64),wrong='b'.repeat(64);
const page={id:'p1',segments:[{id:'p1-s0',source:text}]};
const response=()=>({statusCode:200,headers:{},data:null,
 setHeader(k,v){this.headers[k]=v;return this},
 status(n){this.statusCode=n;return this},
 json(data){this.data=data;return data}});
const env={AI_API_KEY:'FAKE_LAB138_NO_REAL_REQUEST',AI_MODEL:'gemini-3.1-flash-lite'};
const req={method:'POST',env,body:{policy:EXPLAINED_POLICY_V126,
 phase:'explain',pages:[page],bookContext:[],onePassV135:true,
 modelCandidate:'gemini-3.1-flash-lite'}};
const originalFetch=globalThis.fetch;
try{
 const hint=lessonPayloadOnePassV138([page]).pages[0];
 assert.equal(hint.segments.length,1);
 assert.ok(hint.segments[0].targetSegmentUnits>100);
 assert.ok(Math.abs(hint.segments[0].targetSegmentUnits-
   hint.targetBodyUnits)<=1);
 assert.ok(!lessonInstructionOnePassV138().includes('40–60'));
 assert.ok(!JSON.stringify(hint).includes('acceptanceMinimum'));
 // Only original pages of 1-5 nonempty lines are exempt from the mandatory
 // percentage constraint; character count alone cannot grant an exemption.
 const fiveLines={...page,sourceLineCount:5};
 const sixLines={...page,sourceLineCount:6};
 assert.equal(lessonPayloadOnePassV138([fiveLines]).pages[0].shortSource,true);
 assert.equal(lessonPayloadOnePassV138([sixLines]).pages[0].shortSource,false);
 const exampleAnswer={id:'p1',segments:[{id:'p1-s0',
  text:phrase.repeat(12)}],glossary:[]};
 assert.equal(auditExplainedPageV126(fiveLines,exampleAnswer,null,
  {onePassV135:true,strictSourceLinesV138:true}).shortPage,true);
 assert.equal(auditExplainedPageV126(sixLines,exampleAnswer,null,
  {onePassV135:true,strictSourceLinesV138:true}).shortPage,false);

 const v138head=response();
 await explainedV138Handler({method:'HEAD',env,body:{}},v138head);
 assert.equal(v138head.statusCode,405);
 assert.equal(v138head.headers['X-StudyBook-Quality-Strategy-Contract'],
  'lab138-targeted-reliable-pages-v1');
 const v126head=response();
 await explainedV126Handler({method:'HEAD',env,body:{}},v126head);
 assert.ok(!('X-StudyBook-Quality-Strategy-Contract' in v126head.headers));

 const providerBodies=[];
 globalThis.fetch=async(_url,options)=>{
  const request=JSON.parse(options.body);
  providerBodies.push(request);
  return {ok:false,status:503,headers:{get:()=>null},
   json:async()=>({error:{code:503,message:'overloaded'}})};
 };
 const overloaded=response();
 await explainedV138Handler(req,overloaded);
 assert.equal(overloaded.statusCode,503);
 assert.equal(overloaded.data.code,'AI_TEMPORARY_OVERLOAD');
 assert.equal(providerBodies.length,1,
  'LAB138 must NOT make an unreported immediate second provider call on HTTP503');
 assert.equal(providerBodies[0].model,'gemini-3.1-flash-lite');

 providerBodies.length=0;
 globalThis.fetch=async(_url,options)=>{
  const providerReq=JSON.parse(options.body);
  providerBodies.push(providerReq);
  return {ok:true,status:200,headers:{get:()=>null},
   json:async()=>({choices:[{finish_reason:'stop',
    message:{content:JSON.stringify({pages:[{id:'p1',
     segments:[{id:'p1-s0',text:phrase.repeat(12)}],glossary:[]}]})}}]})};
 };
 const good=response();
 await explainedV138Handler(req,good);
 assert.equal(good.statusCode,200);
 assert.equal(good.data.qualityStrategyV138,true);
 assert.equal(good.data.pages[0].review.ready,true);
 assert.equal(providerBodies.length,1);
 assert.ok(providerBodies[0].messages[0].content.includes('targetSegmentUnits'));
 assert.ok(JSON.parse(providerBodies[0].messages[1].content).pages[0]
   .segments[0].targetSegmentUnits>0);

 const saved={version:EXPLAINED_POLICY_V126,sourceFingerprint:fp,
  complete:false,status:'quota-paused',onePassV135:true,originalPages:44,
  pages:[{id:'p1',review:{ready:true},segments:[]}],
  verifiedChunkVariants:9,draftUnitsSaved:24,totalChunkVariants:44,
  quota:{automatic:true,kind:'overload',retryAt:'2026-11-16T18:00:00.000Z'}};
 const book=(fingerprint,edition)=>({canonicalBookMap:{pageCount:44,
  originalFingerprint:fingerprint,pages:[]},editionsV36:edition});
 const sourceData={structure:{pageCount:44},sourceFormat:'pdf'};
 await saveLibraryBook({id:'lab138-existing',fileName:'Scienze.pdf',
  profileId:'default',sourceData,studyBook:book(fp,saved)});
 await saveLibraryBook({id:'lab138-unrelated',fileName:'Scienze.pdf',
  profileId:'default',sourceData,studyBook:book(wrong,
   {...saved,sourceFingerprint:wrong,verifiedChunkVariants:38})});
 const exact=await findBestExplainedCheckpointV138({sourceFingerprint:fp,
  pageCount:44,fileName:'Scienze.pdf',profileId:'default',
  excludeId:'lab138-new-import'});
 assert.equal(exact.sourceId,'lab138-existing');
 assert.equal(exact.verifiedPages,9);
 assert.equal(exact.draftedPages,24);
 assert.equal((await getLibraryBook('lab138-existing'))
  .studyBook.editionsV36.verifiedChunkVariants,9);
 const update={...saved,verifiedChunkVariants:11};
 await saveExplainedCheckpoint('lab138-existing',book(fp,update));
 assert.equal((await findBestExplainedCheckpointV138({sourceFingerprint:fp,
  pageCount:44,fileName:'Scienze.pdf'})).verifiedPages,11);
 assert.equal(await findBestExplainedCheckpointV138({sourceFingerprint:wrong,
  pageCount:44,fileName:'Altro.pdf',excludeId:'lab138-unrelated'}),null);
 
 // A 200 returning ONLY slogans in a large batch must reduce the next
 // correction budget, including when the bad batch was the final batch.
 const verifiedPage={id:'p1',sourcePage:1,physicalPage:1,
  segments:[{id:'p1-s0',text:phrase.repeat(12)}],glossary:[],
  review:{ready:true,sizeCompliant:true,issues:[]}};
 const fortyFour={canonicalBookMap:{originalFingerprint:fp,pageCount:44,
  pages:Array.from({length:44},(_,i)=>({physicalPage:i+1,label:String(i+1),
  text,sourceStatus:'verified',widthPt:595,heightPt:842}))},
  chapters:[],editionsV36:{...saved,verifiedChunkVariants:1,
   draftUnitsSaved:1,pages:[verifiedPage],quota:null,status:'partial'}};
 let call=0;
 globalThis.fetch=async(url,options)=>{
  assert.ok(String(url).includes('/api/explained/v138'));
  const request=JSON.parse(options.body);
  assert.ok(!request.pages.some(p=>p.id==='p1'),
   'LAB138 must never resend a verified page on resume');
  call++;
  if(call>=2)return {ok:false,status:503,headers:{get:()=>null},
   json:async()=>({code:'AI_TEMPORARY_OVERLOAD'})};
  return {ok:true,status:200,headers:{get:()=>null},
   json:async()=>({engine:'ai',repairContractV127:'lab127-automatic-recovery-v1',
    version:EXPLAINED_POLICY_V126,phase:request.phase,
    pages:request.pages.map(p=>({id:p.id,glossary:[],
     segments:p.segments.map(s=>({id:s.id,text:'Poche parole.'}))}))})};
 };
 const partial=await generateExplainedBookV126(fortyFour);
 assert.equal(partial.status,'quota-paused');
 assert.ok(partial.draftUnitsSaved>0);
 assert.equal(partial.verifiedChunkVariants,1,
  'The one previously verified page must survive 503 and new audit rules');
 assert.equal(partial.pages[0].review.ready,true);
 assert.ok(partial.qualityBlockCharsV136<40000,
  'Backpressure must be persisted even with an exhausted request queue');
 assert.equal(partial.providerRecoveryV128.maxBlockChars,40000,
  'A 503 must never be misdiagnosed as oversize');
 assert.equal(partial.pages.filter(p=>p?.review?.ready===true).length,1);
 console.log('LAB138 PASS: immutable 136/137 endpoint, V138 one-pass targets,');
 console.log('no immediate retry on 503, exact-fingerprint recovery, adaptive quality.');
}finally{globalThis.fetch=originalFetch;}
