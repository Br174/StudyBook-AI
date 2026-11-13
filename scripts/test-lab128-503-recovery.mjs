#!/usr/bin/env node
// LAB128: deterministic recovery regression. No live Gemini / no billing.
import assert from 'node:assert/strict';
import {generateExplainedBookV126} from '../src/lib/explainedGeneratorV126.js';
import {EXPLAINED_POLICY_V126} from '../src/lib/explainedStagesV126.js';
import {buildProvisionalExplainedBookV128} from '../src/lib/explainedProvisionalV128.js';
import {providerPauseV128,recoveryProgressV128} from '../src/lib/explainedProviderRecoveryV128.js';
import {exportExplainedPdfV122} from '../src/lib/exportExplainedPdfV122.js';
import {planStudyAutoResumeV45} from '../src/lib/studyAutoResumeV45.js';

const PHRASE='Il mare è calmo e la barca naviga vicino al porto. ';
const input=(n=44)=>({canonicalBookMap:{
 originalFingerprint:'128'.repeat(22),pageCount:n,chapters:[],
 pages:Array.from({length:n},(_,i)=>({physicalPage:i+1,label:String(i+1),
  text:PHRASE.repeat(24),sourceStatus:'verified',
  widthPt:595,heightPt:842}))
}});
const response=(phase,pages)=>({engine:'ai',
 repairContractV127:'lab127-automatic-recovery-v1',
 version:EXPLAINED_POLICY_V126,phase,pages});
const makeSuccess=q=>q.pages.map(p=>q.phase==='comprehend'?{
 id:p.id,connections:[],segments:p.segments.map(s=>({
  id:s.id,concepts:[s.source.slice(0,350)]
 }))
}:{id:p.id,glossary:[],segments:p.segments.map(s=>({
 id:s.id,text:PHRASE.repeat(12)
}))});
const error=code=>({
 ok:false,status:code,headers:{get:()=>null},
 json:async()=>({code:code===503?'AI_TEMPORARY_OVERLOAD':'AI_QUOTA_LIMIT',
  retryAfterSeconds:null})
});
const ok=q=>({
 ok:true,status:200,headers:{get:()=>null},
 json:async()=>response(q.phase,makeSuccess(q))
});
const originalFetch=globalThis.fetch;
const calls=[];
let stage='first',successExplanations=0;
globalThis.fetch=async (_,options)=>{
 const q=JSON.parse(options.body);
 calls.push({phase:q.phase,pages:q.pages.map(x=>x.id)});
 if(stage==='quota'&&q.phase==='explain')return error(429);
 if(q.phase==='explain'&&stage==='first'){
  if(successExplanations++>=1)return error(503);
 }
 if(q.phase==='explain'&&stage==='second')return error(503);
 return ok(q);
};
try {
 const old=providerPauseV128({},{
  httpStatus:503,code:'AI_TEMPORARY_OVERLOAD',now:0});
 assert.equal(old.state.overloadStrikes,1);
 assert.equal(old.state.maxBlockChars,30000);
 assert.equal(old.seconds,90);
 const twice=providerPauseV128(old.state,{
  httpStatus:503,code:'AI_TEMPORARY_OVERLOAD',now:90000});
 assert.equal(twice.state.overloadStrikes,2);
 assert.equal(twice.state.maxBlockChars,15000);
 assert.ok(twice.seconds>=180);
 const authoritative=providerPauseV128(twice.state,{
  httpStatus:503,retryAfterSeconds:1200,now:0});
 assert.ok(authoritative.seconds>=1200);
 const quota=providerPauseV128({},{
  httpStatus:429,code:'AI_QUOTA_LIMIT',retryAfterSeconds:1800,now:0});
 assert.equal(quota.state.maxBlockChars,30000);
 assert.ok(quota.seconds>=1800);

 const book=input();
 const first=await generateExplainedBookV126(book);
 assert.equal(first.status,'quota-paused');
 assert.equal(first.providerRecoveryV128.overloadStrikes,1);
 assert.equal(first.comprehensionV126.verifiedPages,44);
 assert.ok(first.verifiedChunkVariants>0);
 assert.ok(first.verifiedChunkVariants<44);
 assert.equal(first.repairStateV127.p1?.corrections||0,0);
 assert.ok(planStudyAutoResumeV45(first,Date.now(),3),
  'Cooldown must remain eligible after earlier retries.');
 const known=first.pages.filter(p=>p?.review?.ready).map(p=>p.id);
 const r1=recoveryProgressV128(first);
 assert.equal(r1.verified,first.verifiedChunkVariants);
 assert.equal(r1.total,44);
 assert.equal(r1.missing,44-r1.verified);
 const stored=JSON.stringify(first);
 const provisional=buildProvisionalExplainedBookV128({
  ...book,editionsV36:first});
 assert.equal(provisional.waitingPages.length,r1.missing);
 assert.equal(provisional.book.editionsV36.complete,true);
 assert.equal(JSON.stringify(first),stored,
  'Provisional export must not certify, alter or persist original checkpoint.');
 assert.equal(provisional.book.editionsV36.pages.length,44);
 assert.ok(provisional.book.editionsV36.pages.some(p=>p.review.provisionalOriginal));
 const pdf=await exportExplainedPdfV122({...book,editionsV36:first},
  'prova-lab128.pdf',{download:false,provisional:true});
 assert.ok(pdf.fileName.includes('BOZZA_INCOMPLETA'));
 assert.equal(pdf.provisionalOriginalPages,r1.missing);
 assert.ok(pdf.reportPages>=1);
 assert.ok(pdf.blob);
 assert.equal(JSON.stringify(first),stored);

 stage='second';const secondStart=calls.length;
 const second=await generateExplainedBookV126({
  ...book,editionsV36:first});
 assert.equal(second.status,'quota-paused');
 assert.equal(second.providerRecoveryV128.overloadStrikes,2);
 assert.equal(second.providerRecoveryV128.maxBlockChars,15000);
 assert.equal(second.verifiedChunkVariants,first.verifiedChunkVariants);
 assert.ok(!calls.slice(secondStart).some(c=>
  c.phase==='explain'&&c.pages.some(p=>known.includes(p))),
  'Pages already verified must never be requested again.');
 assert.equal(second.providerRecoveryV128.lastStatus,503);
 assert.ok(Date.parse(second.quota.retryAt)>Date.now());

 stage='healthy';const thirdStart=calls.length;
 const third=await generateExplainedBookV126({
  ...book,editionsV36:second});
 assert.equal(third.complete,true);
 assert.equal(third.verifiedChunkVariants,44);
 assert.equal(third.reservedPagesV127.length,0);
 assert.equal(third.providerRecoveryV128.maxBlockChars,15000,
  'Do not immediately upsize blocks after first success.');
 assert.ok(!calls.slice(thirdStart).some(c=>
  c.phase==='explain'&&c.pages.some(p=>known.includes(p))));
 assert.ok(calls.slice(thirdStart).some(c=>c.phase==='explain'));
 const finalPdf=await exportExplainedPdfV122({
  ...book,editionsV36:third},'prova-lab128.pdf',
  {download:false,provisional:true});
 assert.equal(finalPdf.provisional,false);
 assert.equal(finalPdf.provisionalOriginalPages,0);
 assert.ok(!finalPdf.fileName.includes('BOZZA_INCOMPLETA'));

 stage='quota';
 const limit=await generateExplainedBookV126(input(1));
 assert.equal(limit.status,'quota-paused');
 assert.equal(limit.providerRecoveryV128.maxBlockChars,30000);
 assert.equal(limit.repairStateV127.p1?.corrections||0,0);
 console.log('LAB128 PASS: adaptive 503 30k->15k, safe exponential provider pauses,');
 console.log('persistent 44-page checkpoints, no re-request of approved pages,');
 console.log('original-only PDF provisional report and final full PDF. Zero Gemini calls.');
}finally{globalThis.fetch=originalFetch;}
