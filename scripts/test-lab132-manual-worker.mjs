#!/usr/bin/env node
// LAB132.4 Worker contract: fake Gemini only; no external provider used.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import handler,{RIFORMULA_MODE_V132} from '../api/manualRiformulaV132.js';
const oldFetch=globalThis.fetch;
const original='La legge distingue un obbligo da una possibilità. '.repeat(15).trim();
let calls=[],headers;
const res=()=>{
 let code=200;headers={};
 return {setHeader(k,v){headers[k]=v;return this},
  status(n){code=n;return this},
  json(data){return {status:code,data}}};
};
const request={method:'POST',env:{AI_API_KEY:'FAKE_KEY_FOR_TEST',
 AI_MODEL:'gemini-3.5-flash-lite'},
 body:{mode:RIFORMULA_MODE_V132,variant:2,
 page:{id:'p33',segments:[{id:'p33-s0',source:original}]}}};
try{
 globalThis.fetch=async(url,opt)=>{
  calls.push({url,body:JSON.parse(opt.body)});
  return {ok:true,status:200,headers:{get:()=>null},json:async()=>({
   choices:[{finish_reason:'stop',message:{content:JSON.stringify({page:{
    id:'p33',segments:[{id:'p33-s0',text:'La legge spiega la differenza tra obbligo e possibilità.'}],
    glossary:[]}})}}]})};
 };
 const response=await handler(request,res());
 assert.equal(response.status,200);
 assert.equal(response.data.mode,RIFORMULA_MODE_V132);
 assert.equal(response.data.providerRequests,1);
 assert.equal(calls.length,1);
 assert.equal(calls[0].body.temperature,0.6);
 const prompt=calls[0].body.messages[0].content;
 assert.ok(prompt.includes('SEMPLIFICA DAVVERO'));
 assert.ok(prompt.includes('NUOVO'));
 assert.ok(!prompt.includes('FASE 1'));
 const input=JSON.parse(calls[0].body.messages[1].content);
 assert.equal(input.page.segments[0].source,original);
 assert.equal(input.variantRequest,2);
 assert.ok(Math.abs(input.targetBodyUnits-input.originalBodyUnits/2)<1);
 assert.ok(!JSON.stringify(input).includes('previousDraft'));
 const head=await handler({method:'HEAD',env:{},body:{}},res());
 assert.equal(head.status,405);
 assert.equal(headers['X-StudyBook-Riformula-Contract'],RIFORMULA_MODE_V132);
 calls=[];
 const invalid=await handler({...request,body:{...request.body,page:{id:'p33',segments:[]}}},res());
 assert.equal(invalid.status,400);assert.equal(calls.length,0);
 calls=[];
 globalThis.fetch=async()=>{calls.push(1);return {ok:false,status:429,
  headers:{get:()=>null},json:async()=>({})};};
 const quota=await handler(request,res());
 assert.equal(quota.status,429);assert.equal(calls.length,1);
 assert.ok(readFileSync('worker/index.js','utf8').includes("'/api/reformulate/v132'"));
 console.log('LAB132.4 PASS Worker: prompt dedicate, temperature, 1 request, contract, quota.');
}finally{globalThis.fetch=oldFetch;}
