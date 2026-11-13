#!/usr/bin/env node
// LAB127 Worker contract: mock Gemini only; no credentials, network, or quota.
import assert from 'node:assert/strict';
import handler from '../api/explainedV126.js';
import {EXPLAINED_POLICY_V126} from '../src/lib/explainedStagesV126.js';

const source='Il mare è calmo e la barca naviga vicino al porto. '.repeat(20);
const page={id:'p1',segments:[{id:'p1-s0',source}]};
const understanding={id:'p1',connections:[],segments:[
 {id:'p1-s0',concepts:['Il testo descrive un mare tranquillo e una barca vicina al porto.']} ]};
const repair={issueCodes:['V126_PAGE_REDUCTION_OUT_OF_RANGE'],
 correctionCycle:2,correctionStrategy:'guidata',previousReduction:88.5,
 previousDraft:{segments:[{id:'p1-s0',text:'Testo insufficiente.'}],glossary:[]}};
function response(){
 return {code:200,headers:{},payload:null,
  setHeader(key,value){this.headers[key]=value;return this;},
  status(code){this.code=code;return this;},
  json(payload){this.payload=payload;return payload;}};
}
const calls=[];
const oldFetch=globalThis.fetch;
globalThis.fetch=async (_url,options)=>{
 const raw=JSON.parse(options.body);
 const payload=JSON.parse(raw.messages[1].content);
 calls.push({phase:payload.pages[0].repair?'repair':
  raw.response_format?.json_schema?.name||'comprehend',
  raw,payload});
 const isRead=raw.response_format?.json_schema?.name.includes('comprehension');
 const pages=isRead?[understanding]:[{
  id:'p1',segments:[{id:'p1-s0',text:source.slice(0,Math.floor(source.length/2))}],
  glossary:[]}];
 return {status:200,ok:true,headers:{get:()=>null},
  json:async()=>({choices:[{finish_reason:'stop',
   message:{content:JSON.stringify({pages})}}]})};
};
const env={AI_API_KEY:'LAB127_FAKE_KEY',AI_MODEL:'gemini-3.1-flash-lite',
 STUDYBOOK_LAB123_503_FAILOVER:'0'};
try{
 const readRes=response();
 await handler({method:'POST',env,
  body:{policy:EXPLAINED_POLICY_V126,phase:'comprehend',pages:[page]}},readRes);
 assert.equal(readRes.code,200);
 assert.equal(readRes.headers['X-StudyBook-Recovery-Contract'],'lab127');
 assert.equal(readRes.payload.repairContractV127,'lab127-automatic-recovery-v1');
 assert.equal(readRes.payload.validated,1);

 const rewriteRes=response();
 await handler({method:'POST',env,
  body:{policy:EXPLAINED_POLICY_V126,phase:'explain',
   pages:[{...page,comprehension:understanding,repair}],bookContext:[]}},rewriteRes);
 assert.equal(rewriteRes.code,200);
 assert.equal(rewriteRes.payload.repairContractV127,'lab127-automatic-recovery-v1');
 const correction=calls.at(-1);
 assert.equal(correction.payload.pages[0].repair.correctionCycle,2);
 assert.equal(correction.payload.pages[0].repair.correctionStrategy,'guidata');
 assert.equal(correction.payload.pages[0].repair.previousDraft.segments[0].text,
  'Testo insufficiente.');
 assert.ok(correction.raw.messages[0].content.includes('previousDraft'));
 assert.ok(!JSON.stringify(correction.payload).includes('40–60'));
 assert.equal(correction.raw.model,'gemini-3.1-flash-lite');
 assert.equal(calls.length,2,'One provider mock call per healthy request.');

 const rejected=response();
 await handler({method:'POST',env,body:{policy:EXPLAINED_POLICY_V126,
   phase:'explain',pages:[{...page,comprehension:null}],bookContext:[]}},rejected);
 assert.equal(rejected.code,422);
 assert.equal(calls.length,2,'Unverified map is never sent to Gemini.');
 console.log('LAB127 PASS Worker: one call per phase, previous draft reaches model,');
 console.log('stage-specific technical gate and compatibility marker verified.');
}finally{
 globalThis.fetch=oldFetch;
}
