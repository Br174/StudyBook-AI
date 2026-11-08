// LAB73: exact 44-page / 674-unit failure reproduction with zero Gemini quota.
// Failing first request must never block the entire book or lose checkpoints.
import assert from 'node:assert/strict';
import {indexedDB as fakeIndexedDB} from 'fake-indexeddb';
import {generateDraftFirstV57} from '../src/lib/draftFirstV57.js';
import {studyLetters} from '../src/lib/studyPillarV38.js';
import {clearGeminiPause} from '../src/lib/geminiQuotaControllerV36.js';
import {clearGeminiCadenceForTestV58} from '../src/lib/geminiCadenceV58.js';
import {initialStudyOutputLimitV73,safeNetworkSplitV73,
 STUDY_NETWORK_SPLIT_LIMIT_V73} from '../src/lib/studyNetworkRecoveryV73.js';
import {planStudyAutoResumeV45} from '../src/lib/studyAutoResumeV45.js';
import {STUDY_DRAFT_PROTOCOL_V72} from '../src/lib/studyDraftProtocolV72.js';

const source='argomento '.repeat(20).trim();
const makeBook=(fp,count=674)=>({
 title:'44 pagine sintetiche, non dati del signor Bruno',
 studyPillarV38:'studybook-progressive-v38-1',
 canonicalBookMap:{originalFingerprint:fp.repeat(64),pageCount:44,uncertain:[],
  pages:Array.from({length:44},(_,i)=>({physicalPage:i+1,sourceStatus:'verified'}))},
 chapters:[{title:'Test pagine complete',pageStart:1,pageEnd:44,
  paragraphs:Array.from({length:count},(_,i)=>({original:source,
   sourcePageStart:Math.floor(i*44/count)+1,
   sourcePageEnd:Math.floor(i*44/count)+1}))}]
});
const makeResponse=body=>{
 const reps=body.level==='summary'?8:20*(1-Number(body.level)/100);
 const parts=body.units.map(u=>({id:u.id,text:'argomento '.repeat(reps).trim()}));
 const sourceLetters=body.units.reduce((n,u)=>n+studyLetters(u.source),0);
 const observedLetters=parts.reduce((n,p)=>n+studyLetters(p.text),0);
 return {engine:'ai',version:'integral-v51',level:body.level,parts,
  completeParts:true,draftProtocol:STUDY_DRAFT_PROTOCOL_V72,
  lengthReview:{sourceLetters,observedLetters,withinBand:true,compliant:true},
  finishReason:'stop',outputTokenLimit:body.maxOutputTokens,inputTokens:200};
};
const response=body=>new Response(JSON.stringify(makeResponse(body)),{
 status:200,headers:{'Content-Type':'application/json'}});
const networkFail=()=>new Response(JSON.stringify({
 code:'AI_PROVIDER_NETWORK',error:'Connessione temporaneamente interrotta',
 diagnostic:{stage:'gemini-request',elapsedMs:9000,sourceUnits:200}
}),{status:502,headers:{'Content-Type':'application/json'}});
const oldFetch=globalThis.fetch,oldDb=globalThis.indexedDB;
globalThis.indexedDB=fakeIndexedDB;
globalThis.__studybookLab73Probe=true;
try{
 await clearGeminiPause();await clearGeminiCadenceForTestV58();
 const dense=makeBook('a'),ordered=dense.chapters[0].paragraphs.map((p,i)=>({
  id:'0:'+i,source:p.original,pageStart:p.sourcePageStart,pageEnd:p.sourcePageEnd
 }));
 assert.equal(initialStudyOutputLimitV73(ordered),50000);
 assert.equal(initialStudyOutputLimitV73(ordered.slice(0,20)),50000);
 assert.equal(safeNetworkSplitV73([ordered[0]],'summary',{
  code:'AI_PROVIDER_NETWORK',used:0}),null);
 assert.equal(safeNetworkSplitV73(ordered,'summary',{
  code:'AI_QUOTA_LIMIT',used:0}),null);
 assert.equal(safeNetworkSplitV73(ordered,'summary',{
  code:'AI_PROVIDER_NETWORK',used:STUDY_NETWORK_SPLIT_LIMIT_V73}),null);
 const calls=[],progress=[];
 globalThis.fetch=async(url,opts)=>{
  assert.ok(String(url).endsWith('/api/editions/bulk/v51'));
  const p=JSON.parse(opts.body);
  calls.push({level:p.level,from:p.units[0].pageStart,
   to:p.units.at(-1).pageEnd,count:p.units.length,
   tokenBudget:p.maxOutputTokens});
  if(calls.length===1)return networkFail();
  return response(p);
 };
 const result=await generateDraftFirstV57(dense,{onProgress:s=>{
  if(s.draftUnitsSaved>0)progress.push(s.draftUnitsSaved);
 }});
 console.log('LAB73_FIRST_RUN',JSON.stringify({status:result.status,
   haltedOn:result.execution?.haltedOn,saved:result.draftUnitsSaved,
   expected:result.draftUnitsTotal,networkSplits:result.diagnostics?.networkSplitsV73,
   last:result.diagnostics?.lastCode,provider:result.diagnostics?.lastProviderDiagnostic,
   requests:calls.length,firstCalls:calls.slice(0,4)}));
 assert.equal(result.draftComplete,true,'All 674x6 unverified drafts created');
 assert.equal(result.draftUnitsSaved,4044);
 assert.ok(result.diagnostics.networkSplitsV73>=1,'Retry uses full-page split');
 assert.ok(result.diagnostics.networkSplitsV73<=STUDY_NETWORK_SPLIT_LIMIT_V73);
 assert.ok(result.providerBlockOutputLimitV73<50000,'Only an actual network fault reduces subsequent block sizes');
 assert.ok(calls[1].count<calls[0].count,'No identical retry after first failed request');
 assert.equal(calls[1].from,calls[0].from);
 assert.ok(calls[1].to<calls[0].to,'Network split ends on earlier whole page');
 assert.ok(progress.length>0,'Persisted unverified drafts before quality review');
 const lastCount=calls.length;
 globalThis.fetch=async()=>{throw Error('Resuming must NOT regenerate saved drafts');};
 const restored=await generateDraftFirstV57({...dense,editionsV36:result});
 assert.equal(restored.draftUnitsSaved,4044,'Cold-start drafts survive');
 assert.equal(calls.length,lastCount);
 console.log('LAB73_NETWORK_RECOVERY_PASS',JSON.stringify({originalPages:44,
  originalUnits:674,sixVariants:4044,requestedBlocks:calls.length,
  splitCount:result.diagnostics.networkSplitsV73,
  rawDraftsPersisted:result.draftUnitsSaved,worker:'simulated'}));
 // Persistent outage: strictly limited split attempts, then stop, no storm.
 await clearGeminiPause(); await clearGeminiCadenceForTestV58();
 const outage=makeBook('b');
 let failures=0;
 globalThis.fetch=async()=>{failures++;return networkFail()};
 const stopped=await generateDraftFirstV57(outage);
 assert.equal(stopped.status,'provider-blocked');
 assert.equal(stopped.execution.haltedOn,'AI_PROVIDER_NETWORK');
 assert.ok(failures<=STUDY_NETWORK_SPLIT_LIMIT_V73+1,
  'Persistent outage cannot fan out without bound');
 assert.equal(stopped.draftUnitsSaved,0);
 assert.equal(planStudyAutoResumeV45(stopped)?.reason,'transient-recovery');
 console.log('LAB73_FAIL_CLOSED_PASS',JSON.stringify({networkCalls:failures,
  preservedDrafts:true,automaticRecovery:'bounded-foreground-only'}));
}finally{
 globalThis.fetch=oldFetch;
 delete globalThis.__studybookLab73Probe;
 await clearGeminiPause();await clearGeminiCadenceForTestV58();
 if(oldDb===undefined)delete globalThis.indexedDB;else globalThis.indexedDB=oldDb;
}
