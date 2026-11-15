#!/usr/bin/env node
// LAB135: verifies one-pass Worker with a mocked Gemini provider.
// New books need no separate comprehension request. Legacy LAB126 unchanged.
import assert from 'node:assert/strict';
import handler from '../api/explainedV126.js';
import {EXPLAINED_POLICY_V126} from '../src/lib/explainedStagesV126.js';

const oldFetch=globalThis.fetch;
const original='Il mare è calmo e la barca naviga vicino al porto. '.repeat(24);
const page={id:'p1',segments:[{id:'p1-s0',source:original}]};
const answer={id:'p1',segments:[{id:'p1-s0',text:
 'Il mare è calmo e la barca naviga vicino al porto. '.repeat(12)}],glossary:[]};
const response=()=>({statusCode:200,headers:{},data:null,
 setHeader(k,v){this.headers[k]=v;return this},
 status(n){this.statusCode=n;return this},
 json(data){this.data=data;return data}});
let requests=[];
try{
 globalThis.fetch=async(_url,opts)=>{
  const body=JSON.parse(opts.body);
  requests.push(body);
  return {ok:true,status:200,headers:{get:()=>null},
   json:async()=>({choices:[{finish_reason:'stop',
    message:{content:JSON.stringify({pages:[answer]})}}]})};
 };
 const env={AI_API_KEY:'FAKE_NO_REAL_REQUEST',AI_MODEL:'gemini-3.5-flash-lite'};
 const query={policy:EXPLAINED_POLICY_V126,phase:'explain',
  pages:[page],bookContext:[],onePassV135:true,
  modelCandidate:'gemini-3.1-flash-lite'};
 const good=response();
 await handler({method:'POST',env,body:query},good);
 assert.equal(good.statusCode,200);
 assert.equal(good.data.onePassV135,true);
 assert.equal(good.data.model,'gemini-3.1-flash-lite');
 assert.equal(good.data.pages[0].review.onePassV135,true);
 assert.equal(good.data.pages[0].review.sizeCompliant,true);
 assert.equal(good.headers['X-StudyBook-One-Pass-Contract'],'lab135-explain-first-v1');
 assert.equal(requests.length,1,'One provider request for reading and rewriting');
 assert.equal(requests[0].model,'gemini-3.1-flash-lite');
 assert.ok(requests[0].messages[0].content.includes('UNICA CHIAMATA'));
 const sent=JSON.parse(requests[0].messages[1].content);
 assert.ok(!('comprehension' in sent.pages[0]),'No prior Gemini map is required');
 assert.equal(sent.pages[0].segments[0].source,original);
 assert.ok(Math.abs(sent.pages[0].targetBodyUnits-
  sent.pages[0].originalBodyUnits/2)<=1);
 const missingMap=response();
 await handler({method:'POST',env,
  body:{...query,onePassV135:false}},missingMap);
 assert.equal(missingMap.statusCode,422);
 assert.equal(requests.length,1,'Old two-stage mode still protects missing map');
 const forbidden=response();
 await handler({method:'POST',env,
  body:{...query,phase:'comprehend'}},forbidden);
 assert.equal(forbidden.statusCode,400);
 assert.equal(requests.length,1);
 console.log('LAB135 PASS Worker: one Gemini request, 50% target, source integrity, legacy gate.');
}finally{globalThis.fetch=oldFetch;}
