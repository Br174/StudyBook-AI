// LAB57: real runner with simulated Gemini responses, no API key and no cost.
// Asserts ordering: generate ALL six complete draft editions, THEN compare.
import assert from 'node:assert/strict';
import {indexedDB as fakeIndexedDB} from 'fake-indexeddb';
import {generateDraftFirstV57} from '../src/lib/draftFirstV57.js';
import {studyLetters,exactRetained} from '../src/lib/studyPillarV38.js';
import {clearGeminiPause,readGeminiPause} from '../src/lib/geminiQuotaControllerV36.js';
import {clearGeminiCadenceForTestV58} from '../src/lib/geminiCadenceV58.js';
import {planStudyAutoResumeV45} from '../src/lib/studyAutoResumeV45.js';

const original='argomento '.repeat(20).trim();
const levels=['summary','50','40','30','20','10'];
const buildBook=(fp,count=119)=>({
 title:'44 pagine diagnostiche',
 studyPillarV38:'studybook-progressive-v38-1',
 canonicalBookMap:{originalFingerprint:fp.repeat(64),pageCount:44,uncertain:[],
  pages:Array.from({length:44},(_,i)=>({physicalPage:i+1,sourceStatus:'verified'}))},
 chapters:[{title:'Libro in 44 pagine',pageStart:1,pageEnd:44,
  paragraphs:Array.from({length:count},(_,i)=>({original,
   sourcePageStart:Math.floor(i*44/count)+1,
   sourcePageEnd:Math.floor(i*44/count)+1}))}]
});
const oldDb=globalThis.indexedDB,oldFetch=globalThis.fetch;
globalThis.indexedDB=fakeIndexedDB;
const generateBody=(payload,wrong=false)=>{
 const reps=payload.level==='summary'?8:20*(1-Number(payload.level)/100);
 return {engine:'ai',version:'integral-v51',level:payload.level,
  parts:payload.units.map(u=>({id:u.id,text:wrong&&u.id==='0:0'&&payload.level==='summary'?
     'testo completamente inventato':'argomento '.repeat(reps).trim()}))};
};
let calls=[],events=[];
try{
 await clearGeminiPause();
 globalThis.fetch=async(url,opt)=>{
  assert.ok(String(url).endsWith('/api/editions/bulk/v51'));
  const p=JSON.parse(opt.body);
  calls.push({phase:p.phase,level:p.level,start:p.units[0].pageStart,
    end:p.units.at(-1).pageEnd,length:p.units.length});
  return new Response(JSON.stringify(generateBody(p)),{status:200,
    headers:{'Content-Type':'application/json'}});
 };
 const perfect=await generateDraftFirstV57(buildBook('a'),{
  onProgress:x=>events.push({phase:x.phase,drafts:x.draftUnitsSaved,
   ready:x.verifiedChunkVariants,complete:x.complete})
 });
 assert.equal(perfect.complete,true,'all editions are verified after review');
 assert.equal(perfect.draftComplete,true);
 assert.equal(perfect.draftUnitsSaved,714);
 assert.equal(perfect.verifiedChunkVariants,714);
 assert.equal(perfect.publishedThroughPage.summary,44);
 assert.equal(calls.length,6,'one giant request per version for small book');
 assert.deepEqual(calls.map(x=>x.phase),Array(6).fill('draft'));
 const completedDraft=events.find(x=>x.drafts===714);
 assert.ok(completedDraft,'all drafts are checkpointed before review');
 assert.equal(completedDraft.ready,0,'zero *new* units are falsely verified during creation');
 for(const level of ['10','20','30','40','50']){
  const full=perfect.stagedRows.flat().map(x=>x.editions[level]).join('\n');
  assert.equal(studyLetters(full),exactRetained(studyLetters(original)*119,Number(level)),
   'exact TOTAL BOOK percent for '+level);
 }
 let repeated=0;
 globalThis.fetch=async()=>{repeated++;throw Error('Verified work must never rerun');};
 const again=await generateDraftFirstV57({...buildBook('a'),editionsV36:perfect});
 assert.equal(again.complete,true);assert.equal(repeated,0);

 calls=[];events=[];
 globalThis.fetch=async(url,opt)=>{
  const p=JSON.parse(opt.body);calls.push({phase:p.phase,level:p.level,
   count:p.units.length,pages:[p.units[0].pageStart,p.units.at(-1).pageEnd],
   repairHints:p.repairDrafts?.length||0});
  return new Response(JSON.stringify(generateBody(p,true)),{status:200,
   headers:{'Content-Type':'application/json'}});
 };
 const faulty=await generateDraftFirstV57(buildBook('b'),{
  onProgress:x=>events.push({phase:x.phase,drafts:x.draftUnitsSaved,
   verified:x.verifiedChunkVariants})
 });
 assert.equal(faulty.draftComplete,true,'even flawed draft must be complete');
 assert.equal(faulty.draftUnitsSaved,714);
 assert.equal(faulty.complete,false,'wrong facts are never certified');
 assert.equal(faulty.status,'quality-review');
 assert.ok(faulty.draftRowsV57[0][0].editions.summary,
  'the unverified first page is still stored in complete draft');
 const firstRepair=calls.findIndex(c=>c.phase==='repair');
 assert.ok(firstRepair>=6,'all six draft calls complete before first correction call');
 assert.ok(calls.slice(0,firstRepair).every(c=>c.phase==='draft'));
 assert.equal(calls.slice(0,firstRepair).length,6);
 assert.ok(calls.slice(firstRepair).every(c=>c.phase==='repair'));
 assert.ok(calls.slice(firstRepair).every(c=>c.pages[0]===1&&c.pages[1]===1),
  'only original complete PAGE 1 is retried, never the 44-page book');
 assert.ok(calls.length<=8,'single targeted correction, not repeated large blocks');
 assert.equal(faulty.verifiedChunkVariants,0,
  'LAB61: later editions must wait until defective Riassunto is approved');
 const secondCallCount=calls.length;
 const resumed=await generateDraftFirstV57({...buildBook('b'),editionsV36:faulty});
 assert.equal(resumed.draftUnitsSaved,714,'no new drafts requested on resume');
 assert.equal(calls.length,secondCallCount+1,
   'LAB61 safely retries an unresolved quality page within durable bounds');
 assert.equal(resumed.stagedRows[0][0].verified.summary,false);
 assert.equal(resumed.stagedRows[0][1].verified['10'],false,
  'later versions are never certified before the Riassunto is complete');
 const qualityPlan=planStudyAutoResumeV45(faulty);
 assert.equal(qualityPlan?.reason,'quality-continue',
   'LAB61 uses the existing foreground recovery owner with bounded attempts');
 
 calls=[];events=[];
 let failedOnce=false;
 globalThis.fetch=async(url,opt)=>{
  const p=JSON.parse(opt.body);calls.push({phase:p.phase,level:p.level});
  if(p.level==='50'&&!failedOnce){
   failedOnce=true;
   return new Response(JSON.stringify({code:'AI_QUOTA_LIMIT',error:'Temporary limit',
    quota:{kind:'requests-minute',automatic:true,httpStatus:429,
      retryAfterSeconds:30,estimated:false}}),{status:429});
  }
  return new Response(JSON.stringify(generateBody(p)),{status:200,
   headers:{'Content-Type':'application/json'}});
 };
 const blocked=await generateDraftFirstV57(buildBook('c'));
 assert.equal(blocked.status,'quota-paused');
 assert.equal(blocked.draftComplete,false);
 assert.equal(blocked.draftUnitsSaved,119,'the 119 summary drafts must be preserved');
 assert.equal(calls.length,2);
 const paused=await generateDraftFirstV57({...buildBook('c'),editionsV36:blocked});
 assert.equal(paused.status,'quota-paused');
 assert.equal(calls.length,2,'cooldown forbids early Gemini request');
 await clearGeminiPause();
 // This LAB57 regression tests checkpoint reuse, not the separate LAB58 cadence.
 await clearGeminiCadenceForTestV58();
 const resumedAfterPause=await generateDraftFirstV57({...buildBook('c'),editionsV36:blocked});
 assert.equal(resumedAfterPause.complete,true);
 assert.equal(resumedAfterPause.draftUnitsSaved,714);
 assert.equal(calls.length,7,'do not regenerate already complete summary');
 console.log('LAB57 PASS: full 714-draft creation BEFORE review; 6 requests ideal, one-page targeted correction, 429 checkpoint recovery, exact global targets.');
}finally{
 globalThis.fetch=oldFetch;
 await clearGeminiPause();
 await clearGeminiCadenceForTestV58();
 if(oldDb===undefined)delete globalThis.indexedDB;
 else globalThis.indexedDB=oldDb;
}
