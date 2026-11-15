#!/usr/bin/env node
// LAB134: fixed 3.1 in understanding/explanation, one bounded same-model 503 recovery.
// All provider responses mocked. No real Gemini requests or secrets used.
import assert from 'node:assert/strict';
import handler from '../api/explainedV126.js';
import {EXPLAINED_POLICY_V126} from '../src/lib/explainedStagesV126.js';

const oldFetch=globalThis.fetch;
const original='Il mare è calmo e la barca naviga vicino al porto. '.repeat(20);
const page={id:'p1',segments:[{id:'p1-s0',source:original}]};
const understanding={id:'p1',connections:[],segments:[{
 id:'p1-s0',concepts:['Il mare è calmo e la barca naviga vicino al porto.']}]};
const explanation={id:'p1',segments:[{
 id:'p1-s0',text:original.slice(0,Math.floor(original.length/2))}],glossary:[]};
function res(){return {statusCode:200,headers:{},data:null,
 setHeader(k,v){this.headers[k]=v;return this},
 status(n){this.statusCode=n;return this},
 json(data){this.data=data;return data}}}
function req(phase,changes={}){
 return {method:'POST',env:{AI_API_KEY:'FAKE_KEY',
   AI_MODEL:'gemini-3.5-flash-lite',STUDYBOOK_LAB123_503_FAILOVER:'1'},
  body:{policy:EXPLAINED_POLICY_V126,phase,
   pages:phase==='comprehend'?[page]:[{...page,comprehension:understanding}],
   ...(phase==='explain'?{bookContext:[]}:{}),
   modelCandidate:'gemini-3.1-flash-lite',...changes}};
}
function ok(phase){return {ok:true,status:200,headers:{get:()=>null},
 json:async()=>({choices:[{finish_reason:'stop',message:{content:JSON.stringify({
 pages:phase==='comprehend'?[understanding]:[explanation]})}}]})}}
function fail(status,retryAfter=null){return {ok:false,status,
 headers:{get:key=>key==='Retry-After'?retryAfter:null},json:async()=>({})}}
let seen=[],answer;
try{
 globalThis.fetch=async (_url,options)=>{
  const raw=JSON.parse(options.body);
  seen.push(raw);
  assert.equal(raw.model,'gemini-3.1-flash-lite','Must never use configured 3.5');
  return answer(raw);
 };
 for(const phase of ['comprehend','explain']){
  seen=[];answer=()=>ok(phase);
  const result=res();await handler(req(phase),result);
  assert.equal(result.statusCode,200);
  assert.equal(result.headers['X-StudyBook-Fixed-Model-Contract'],
   'lab134-fixed-gemini-3.1-flash-lite-v1');
  assert.equal(result.data.model,'gemini-3.1-flash-lite');
  assert.equal(result.data.modelPolicy,'lab134-fixed-gemini-3.1-flash-lite-v1');
  assert.equal(result.data.providerRequests,1);
  assert.equal(seen.length,1);
 }
 seen=[];answer=()=>fail(429);
 const quota=res();await handler(req('comprehend'),quota);
 assert.equal(quota.statusCode,429);
 assert.equal(seen.length,1);
 seen=[];answer=()=>fail(503,'42');
 const wait=res();await handler(req('comprehend'),wait);
 assert.equal(wait.statusCode,503);
 assert.equal(seen.length,1,'Do not retry before provider Retry-After');
 assert.equal(wait.headers['Retry-After'],'42');
 seen=[];answer=()=>seen.length===1?fail(503):ok('comprehend');
 const recovered=res();await handler(req('comprehend'),recovered);
 assert.equal(recovered.statusCode,200);
 assert.equal(seen.length,2,'Exactly one 503 retry, no infinite loop');
 assert.ok(seen.every(s=>s.model==='gemini-3.1-flash-lite'));
 assert.equal(recovered.data.providerRequests,2);
 seen=[];answer=()=>ok('explain');
 const wrong=res();await handler(req('explain',{
  modelCandidate:'gemini-3.5-flash-lite'}),wrong);
 assert.equal(wrong.statusCode,400);
 assert.equal(seen.length,0);
 console.log('LAB134 PASS: 3.1 fixed both phases, 503 bounded, 429 and Retry-After safe.');
}finally{globalThis.fetch=oldFetch}
