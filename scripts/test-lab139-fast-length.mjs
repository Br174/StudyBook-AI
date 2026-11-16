#!/usr/bin/env node
// LAB139: deterministic, zero-cost tests. No paid provider, real API or APK.
// Only 50% per-page length is didactically blocking in this opt-in mode.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {auditExplainedPageV139,lessonInstructionOnePassV139,
 lessonPayloadOnePassV139,EXPLAINED_POLICY_V126}
 from '../src/lib/explainedStagesV126.js';
import {providerPauseV128,providerPauseV139}
 from '../src/lib/explainedProviderRecoveryV128.js';
import explainedV139Handler from '../api/explainedV139.js';
import explainedV138Handler from '../api/explainedV138.js';
import {generateExplainedBookV126} from '../src/lib/explainedGeneratorV126.js';

const makeSource=(originalText,n=6)=>({id:'p1',physicalPage:1,
 sourceLineCount:n,segments:[{id:'p1-s0',source:originalText}]});
const A='a'.repeat(1000);
const source=makeSource(A);
const page=(body,override={})=>({id:'p1',
 segments:[{id:'p1-s0',text:body}],glossary:[],...override});
const audit=(body)=>auditExplainedPageV139(source,page(body));
assert.equal(audit('b'.repeat(600)).ready,true,'40% reduction inclusive');
assert.equal(audit('b'.repeat(400)).ready,true,'60% reduction inclusive');
assert.equal(audit('b'.repeat(500)).ready,true,'50% target inclusive');
assert.equal(audit('b'.repeat(601)).ready,false,'39.9% reduction invalid');
assert.equal(audit('b'.repeat(399)).ready,false,'60.1% reduction invalid');
const semanticContradiction=page('b'.repeat(500),{glossary:[
 {term:'contraddizione',definition:'una definizione non correlata'}]});
const lengthPass=auditExplainedPageV139(source,semanticContradiction);
assert.equal(lengthPass.ready,true,'Glossary and semantic matching are not blocking');
assert.equal(lengthPass.semanticCertified,false,'Never claim meaning has been verified');
assert.equal(lengthPass.verificationScope,'length-and-structure-only');
assert.equal(auditExplainedPageV139(source,page('')).ready,false);
assert.equal(auditExplainedPageV139(source,page('b'.repeat(500),{segments:[]})).ready,false);
assert.equal(auditExplainedPageV139(source,page('b'.repeat(500),{
 segments:[{id:'p1-s99',text:'b'.repeat(500)}]})).ready,false);
assert.equal(auditExplainedPageV139(source,page('b'.repeat(500)+' ...')).ready,false);
assert.equal(auditExplainedPageV139(source,page('b'.repeat(500)+' {{TODO')).ready,false);
assert.equal(auditExplainedPageV139(makeSource(A,5),page('b'.repeat(900))).ready,true,
 '1-5 source lines are exempt from percentage while still requiring a valid body');
assert.equal(auditExplainedPageV139(makeSource(A,6),page('b'.repeat(900))).ready,false);
assert.ok(!lessonInstructionOnePassV139().includes('40–60'));
assert.ok(!JSON.stringify(lessonPayloadOnePassV139([source])).includes('acceptanceMinimum'));

// A locally guessed 503 is not Google's mandatory 90-second cooldown.
const now=Date.parse('2026-11-16T19:27:00+01:00');
const first=providerPauseV139({},{httpStatus:503,now});
assert.ok(first.seconds>=8&&first.seconds<=10);
assert.equal(first.state.overloadStrikes,1);
assert.equal(first.state.maxBlockChars,40000);
const second=providerPauseV139(first.state,{httpStatus:503,now});
assert.ok(second.seconds>=16&&second.seconds<=18);
const fifth=providerPauseV139({...second.state,overloadStrikes:4},
 {httpStatus:503,now});
assert.ok(fifth.seconds>=120&&fifth.seconds<=122);
const official=providerPauseV139(first.state,{httpStatus:503,
 now,retryAfterSeconds:240});
assert.ok(official.seconds>=240,'Honor Google Retry-After');
assert.equal(official.source,'provider-and-short-exponential-backoff');
const daily=providerPauseV139({},{httpStatus:429,now,retryAfterSeconds:3600});
assert.ok(daily.seconds>=3600,'Never bypass RPM/RPD/TPM or 429');
assert.equal(providerPauseV128({},{httpStatus:503,now}).seconds,90,
 'Older APK policy must not silently change');

const mockRes=()=>({statusCode:200,headers:{},data:null,
 setHeader(key,value){this.headers[key]=value;return this},
 status(code){this.statusCode=code;return this},
 json(data){this.data=data;return data}});
const oldFetch=globalThis.fetch;
try{
 const header139=mockRes();
 await explainedV139Handler({method:'HEAD',env:{}},header139);
 assert.equal(header139.statusCode,405);
 assert.equal(header139.headers['X-StudyBook-Fast-Contract'],
  'lab139-length-only-fast-v1');
 const header138=mockRes();
 await explainedV138Handler({method:'HEAD',env:{}},header138);
 assert.ok(!header138.headers['X-StudyBook-Fast-Contract']);
 const req={method:'POST',env:{AI_API_KEY:'LAB139_OFFLINE_FAKE'},
  body:{policy:EXPLAINED_POLICY_V126,phase:'explain',onePassV135:true,
  pages:[source],bookContext:[],modelCandidate:'gemini-3.1-flash-lite'}};
 const providerCalls=[];
 globalThis.fetch=async(url,options)=>{
  const params=JSON.parse(options.body);
  providerCalls.push({url,params});
  return {ok:true,status:200,headers:{get:()=>null},
   json:async()=>({choices:[{finish_reason:'stop',message:{content:
    JSON.stringify({pages:[page('b'.repeat(500),{glossary:[
     {term:'termine',definition:'una definizione generica non ancorata'}]})]})}}]})};
 };
 const valid=mockRes();await explainedV139Handler(req,valid);
 assert.equal(valid.statusCode,200);
 assert.equal(valid.data.validated,1);
 assert.equal(valid.data.fastLengthV139,true);
 assert.equal(valid.data.pages[0].review.semanticCertified,false);
 assert.equal(providerCalls.length,1);
 assert.equal(providerCalls[0].params.model,'gemini-3.1-flash-lite');
 assert.ok(!providerCalls[0].params.messages[0].content.includes('40–60'));

 // Repeat on the legacy route: still a separate audit, not length-only.
 const legacy=mockRes();await explainedV138Handler(req,legacy);
 assert.equal(legacy.statusCode,200);
 assert.equal(legacy.data.fastLengthV139,false);
 assert.equal(providerCalls.length,2);

 // Reuse 14 conforming + an old semantic-failed but 50%-length draft
 // before any network call; only remaining pages are eligible.
 const text=Array.from({length:6},()=>A).join('\n');
 const output='b'.repeat(3000);
 const savedPages=Array.from({length:15},(_,i)=>({id:'p'+(i+1),
  segments:[{id:'p'+(i+1)+'-s0',text:output}],glossary:[],
  review:{ready:i<14,issues:i<14?[]:['V122_PROTECTED_MEANING_MISSING'],
   semanticCertified:false}}));
 const fp='a'.repeat(64);
 const original={canonicalBookMap:{originalFingerprint:fp,pageCount:44,
  chapters:[],pages:Array.from({length:44},(_,i)=>({
   physicalPage:i+1,label:String(i+1),text,sourceStatus:'verified',
   widthPt:595,heightPt:842}))},
  editionsV36:{version:EXPLAINED_POLICY_V126,
   sourceFingerprint:fp,onePassV135:true,complete:false,status:'partial',
   originalPages:44,pages:savedPages,verifiedChunkVariants:14,
   draftUnitsSaved:15,totalChunkVariants:44,
   repairStateV127:{p15:{initial:true,corrections:0}}}};
 let requested=[];
 globalThis.fetch=async(url,options)=>{
  requested.push({url,pages:JSON.parse(options.body).pages.map(p=>p.id)});
  return {ok:false,status:503,headers:{get:()=>null},
   json:async()=>({code:'AI_TEMPORARY_OVERLOAD',retryAfterSeconds:null})};
 };
 const paused=await generateExplainedBookV126(original,{fastLengthV139:true});
 assert.equal(paused.status,'quota-paused');
 assert.equal(paused.lengthOnlyV139,true);
 assert.equal(paused.verifiedChunkVariants,15,
  'Re-accept a formerly semantically rejected but length-compliant draft locally');
 assert.ok(requested.length===1);
 assert.ok(requested.every(r=>r.url.includes('/api/explained/v139')));
 assert.ok(!requested.some(r=>r.pages.some(id=>
  Array.from({length:15},(_,i)=>'p'+(i+1)).includes(id))));
 assert.ok(Date.parse(paused.quota.retryAt)-Date.now()<15000,
  'One estimated HTTP503 should not force 90s waiting');
 assert.equal(paused.providerRecoveryV128.maxBlockChars,40000);
 assert.ok(paused.pages.slice(0,15).every(p=>p.review.ready===true));
 const app=readFileSync('src/AppV15.jsx','utf8');
 assert.ok(app.includes('fastLengthV139:working?.editionsV36?.version===EXPLAINED_POLICY_V126'));
 console.log('LAB139 PASS: 40/50/60% boundary, technical integrity, no semantic gate,');
 console.log('legacy routes, fast 503 cooldown, saved 14+1 pages and one writer.');
}finally{globalThis.fetch=oldFetch;}
