#!/usr/bin/env node
// LAB135: 44/2000-page local stress. No real provider or paid operation.
// A new book reads original source locally and uses only explanation requests.
// Previously started LAB126 books still use their saved comprehension maps.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {generateExplainedBookV126} from '../src/lib/explainedGeneratorV126.js';
import {EXPLAINED_POLICY_V126} from '../src/lib/explainedStagesV126.js';
import {buildExplainedEditionViewV122} from '../src/lib/explainedViewV122.js';
import {composeExplainedSheetsV122} from '../src/lib/explainedLayoutV122.js';
import {libraryBookSummary} from '../src/lib/library.js';
const TEXT='Il mare è calmo e la barca naviga vicino al porto. ';
const fp='8'.repeat(64),old=globalThis.fetch;
const book=(n,repeat=4,onePassV135=true)=>({
 canonicalBookMap:{originalFingerprint:fp,pageCount:n,chapters:[],
  pages:Array.from({length:n},(_,i)=>({physicalPage:i+1,
   label:String(i+1),text:TEXT.repeat(repeat),sourceStatus:'verified',
   widthPt:595,heightPt:842}))},
 chapters:[],
 editionsV36:{version:EXPLAINED_POLICY_V126,sourceFingerprint:fp,
  onePassV135,originalPages:n,pages:[],complete:false,
  status:'partial',phase:onePassV135?'draft':'comprehension'}
});
const response=q=>({engine:'ai',repairContractV127:'lab127-automatic-recovery-v1',
 version:EXPLAINED_POLICY_V126,phase:q.phase,model:'gemini-3.1-flash-lite',
 pages:q.pages.map(p=>q.phase==='comprehend'?{
  id:p.id,connections:[],segments:p.segments.map(s=>({
   id:s.id,concepts:[s.source.slice(0,160)]}))
 }:{id:p.id,glossary:[],segments:p.segments.map(s=>({
  id:s.id,text:TEXT.repeat(Math.max(1,Math.round(s.source.length/TEXT.length/2)))
 }))})});
const ok=q=>({status:200,ok:true,headers:{get:()=>null},
 json:async()=>response(q)});
const problem=(status)=>({status,ok:false,headers:{get:()=>null},
 json:async()=>({code:status===503?'AI_TEMPORARY_OVERLOAD':'AI_QUOTA_LIMIT'})});
try{
 const calls=[];let overloadAt=0;
 globalThis.fetch=async(_url,opts)=>{
  const q=JSON.parse(opts.body);
  calls.push({phase:q.phase,pageIds:q.pages.map(p=>p.id),
   onePassV135:q.onePassV135===true});
  if(overloadAt&&calls.length===overloadAt)return problem(503);
  return ok(q);
 };
 // One pass per planned block for a new textbook, no preliminary Gemini read.
 const fortyFour=book(44,24);
 let persisted=0;
 const answer=await generateExplainedBookV126(fortyFour,{onProgress:async(s,meta)=>{
  if(meta?.persist!==false)persisted++;
 }});
 assert.equal(answer.onePassV135,true);
 assert.equal(answer.localReadV135.pages,44);
 assert.equal(answer.comprehensionV126.verifiedPages,0,
  'Do not mislabel local PDF extraction as a Gemini comprehension pass');
 assert.equal(calls.some(x=>x.phase==='comprehend'),false,
  'No separate Gemini comprehension requests');
 assert.ok(calls.length>=1&&calls.length<=10,
  'A 44-page source must be grouped, not sent as one request per page');
 assert.equal(new Set(calls.flatMap(x=>x.pageIds)).size,44);
 assert.ok(persisted>0);
 assert.ok(answer.pages.some(p=>p?.review?.ready===true));
 assert.ok(buildExplainedEditionViewV122({...fortyFour,editionsV36:answer}));
 assert.ok(composeExplainedSheetsV122({...fortyFour,editionsV36:answer}).pages.length>=44);
 const earlierCalls=calls.length;
 const restarted=await generateExplainedBookV126({...fortyFour,editionsV36:answer});
 assert.equal(restarted.verifiedChunkVariants,answer.verifiedChunkVariants);
 assert.equal(calls.length,earlierCalls,'Do not repeat already conforming pages');
 // 2000-page stress: stable ID preservation, whole-page payloads, bounded requests.
 calls.length=0;
 const twoThousand=book(2000,3);
 const big=await generateExplainedBookV126(twoThousand);
 assert.equal(big.localReadV135.pages,2000);
 assert.equal(big.pages.length,2000);
 assert.equal(calls.some(x=>x.phase==='comprehend'),false);
 assert.ok(calls.length<120,
  'No two-stage work or 2000 individual provider calls on short pages');
 const ids=calls.flatMap(x=>x.pageIds);
 assert.equal(new Set(ids).size,2000,'No missing or duplicate original page');
 assert.equal(ids[0],'p1');assert.equal(ids.at(-1),'p2000');
 // LAB126 legacy remains available when onePassV135 was NOT approved.
 calls.length=0;
 const legacy=book(4,6,false);
 const legacyResult=await generateExplainedBookV126(legacy);
 assert.ok(calls.some(x=>x.phase==='comprehend'),'Existing two-stage path retained');
 assert.equal(legacyResult.onePassV135,false);
 // Index only metadata: no book bytes, parsed pages or chapters materialized.
 const summary=libraryBookSummary({id:'large',fileName:'Manuale.pdf',
  sourceData:{fullText:'PRIVATE_SOURCE'},studyBook:big,
  originalFile:{size:10000000},metadata:{pages:2000},
  original:{name:'Manuale.pdf'}});
 assert.equal(summary.metadata.pages,2000);
 assert.ok(summary.original.available);
 assert.ok(!('originalFile' in summary));
 assert.ok(!('sourceData' in summary));
 assert.ok(!('studyBook' in summary));
 assert.ok(!JSON.stringify(summary).includes('PRIVATE_SOURCE'));
 const libraryJs=readFileSync('src/lib/library.js','utf8');
 assert.ok(libraryJs.includes("const DB_VERSION = 3;"));
 assert.ok(libraryJs.includes('const CHECKPOINTS_STORE'));
 assert.ok(libraryJs.includes('saveExplainedCheckpoint(id,studyBook)'));
 assert.ok(libraryJs.includes("db.transaction(SUMMARIES_STORE,'readonly')"));
 const app=readFileSync('src/AppV15.jsx','utf8');
 assert.ok(app.includes('saveExplainedCheckpoint(savedId,explained)'));
 assert.ok(app.includes('onePassV135:true'));
 console.log('LAB135 PASS: one Gemini pass, 44/2000 source pages, legacy, checkpoint, light Library.');
}finally{globalThis.fetch=old;}
