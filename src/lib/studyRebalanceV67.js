// LAB67 - Phase TWO recalibration on saved complete editions.
// Rewrites only levels outside the user's tolerance with Gemini; never
// runs automatic correction in phase THREE. Existing reader/export stays
// available while candidates are staged in checkpoint memory.
import {apiEndpoint} from './apiEndpoint.js';
import {bookUnitsV51,planNaturalBlocksV51,
  BULK_OUTPUT_TOKEN_CEILING} from './integralPlannerV51.js';
import {orderSourceUnitsV59} from './studyPhaseProgressV59.js';
import {classifySourceReadinessV52} from './generativeIntegralV51.js';
import {studyLetters,exactRetained} from './studyPillarV38.js';
import {planRebalanceV67,editionReductionV67,betterReductionV67,
  STUDY_TARGET_V67} from './studyRebalancePolicyV67.js';
import {readGeminiPause,registerGeminiPause,clearGeminiPause}
 from './geminiQuotaControllerV36.js';
import {waitForGeminiCadenceV58,markGeminiCadenceSuccessV58}
 from './geminiCadenceV58.js';
import {auditFidelity} from './fidelityEngine.js';
import {immutableViolationsV67} from './immutableFragmentsV67.js';
import {finalizeStudyQualityV66} from './studyQualityV66.js';
const clean=x=>typeof x==='string'?x.trim():'';
const clone=x=>JSON.parse(JSON.stringify(x));
const stamp=()=>new Date().toISOString();
const originalFingerprint=book=>book?.canonicalBookMap?.originalFingerprint||null;
export function rebalanceSnapshotV67(previous,stage,status='running'){
 return {...previous,rebalanceV67:{...stage,status,updatedAt:stamp()},
  updatedAt:stamp()};
}
export function canRebalanceBookV67(book){
 const snapshot=book?.editionsV36;
 return Boolean(snapshot?.complete&&snapshot?.draftComplete&&
  snapshot?.checkpointPersistent!==false&&
  snapshot?.publicationModeV66==='generated-text-quality-not-certified'&&
  snapshot?.draftRowsV57&&originalFingerprint(book)&&
  snapshot?.sourceFingerprint===originalFingerprint(book));
}
export async function rebalanceSavedStudyBookV67(book,{
 signal=null,onProgress=()=>{},onActivity=()=>{}
}={}){
 if(!canRebalanceBookV67(book))throw Error(
   'Libro non pronto per la ricalibrazione: verificare fonte e checkpoint.');
 const units=orderSourceUnitsV59(bookUnitsV51(book));
 if(!classifySourceReadinessV52(book,units).ok)
  throw Error('Ricalibrazione vietata: fonte originale non verificata.');
 const start=book.editionsV36;
 const fp=originalFingerprint(book);
 let current=start;
 const stage=start.rebalanceV67?.sourceFingerprint===fp?
  clone(start.rebalanceV67):{
   version:'lab67-source-based-v1',sourceFingerprint:fp,
   begunAt:stamp(),completed:{},buffers:{},errors:{},attempted:{},
   requests:0,accepted:0,originalSaved:true,
   status:'running'
  };
 const notify=async(status='running')=>{
  current=rebalanceSnapshotV67(current,stage,status);
  await onProgress(current);
 };
 const pending=planRebalanceV67(units,start.draftRowsV57);
 if(!pending.length){
  stage.status='all-levels-within-tolerance';
  await notify('complete');
  return current;
 }
 const copy=()=>clone(current.draftRowsV57);
 for(const measure of pending){
  const level=measure.level;
  if(stage.completed[level]?.accepted||stage.attempted[level]&&!stage.buffers[level])
   continue;
  if(signal?.aborted){await notify('interrupted');return current;}
  const blocks=planNaturalBlocksV51(units,level);
  const buffered=stage.buffers[level]||{};
  stage.buffers[level]=buffered;
  for(const block of blocks){
   if(block.every(u=>clean(buffered[u.id])))continue;
   if(signal?.aborted){await notify('interrupted');return current;}
   const pause=await readGeminiPause();
   if(pause){
    stage.lastQuota=pause;
    await notify('waiting-provider');
    return current;
   }
   const originals=block.reduce((n,u)=>n+studyLetters(u.source),0);
   const policy=STUDY_TARGET_V67[level];
   const limit=level==='summary'
    ?Math.max(0,exactRetained(originals,policy.target))
    :exactRetained(originals,Number(level));
   const unitBudgets=Object.fromEntries(block.map(u=>[
    u.id,level==='summary'
      ?{summaryCapLetters:exactRetained(studyLetters(u.source),60)}
      :{targetLetters:exactRetained(studyLetters(u.source),Number(level))}
   ]));
   const ratio=1-policy.target/100;
   const chars=block.reduce((n,u)=>n+u.source.length,0);
   const maxOutputTokens=Math.min(BULK_OUTPUT_TOKEN_CEILING,
    Math.max(4096,Math.ceil(chars*ratio/1.5)+block.length*115+1800));
   const body={
    phase:'recalibrate',level,bookTitle:String(book.title||'').slice(0,140),
    targetLetters:level==='summary'?null:limit,
    summaryCapLetters:level==='summary'?limit:null,
    unitBudgets,maxOutputTokens,timeoutMs:190000,
    units:block.map(u=>({id:u.id,source:u.source,
     chapterTitle:u.chapterTitle,sectionTitle:u.sectionTitle,
     pageStart:u.pageStart,pageEnd:u.pageEnd}))
   };
   const began=Date.now();
   try{
    onActivity({phase:'recalibrate',level,pageStart:block[0].pageStart,
      pageEnd:block.at(-1).pageEnd});
    await waitForGeminiCadenceV58({signal,onWait:note=>
      onActivity({phase:'pacing',level,...note})});
    const response=await fetch(apiEndpoint('/api/editions/bulk/v51'),{
     method:'POST',headers:{'Content-Type':'application/json'},
     signal,body:JSON.stringify(body)});
    const reply=await response.json().catch(()=>null);
    if(!response.ok){
     const code=reply?.code||'HTTP_'+response.status;
     if((response.status===429||response.status===503)&&reply?.quota)
      await registerGeminiPause(reply.quota);
     stage.errors[level]=code;stage.lastQuota=reply?.quota||null;
     await notify('waiting-provider');
     return current;
    }
    if(reply?.engine!=='ai'||reply?.version!=='integral-v51'||
        reply?.level!==level)throw Error('Risposta Gemini non autentica.');
    const ids=new Set(block.map(u=>u.id));
    const rows=new Map();
    for(const p of reply.parts||[]){
     if(!ids.has(p?.id)||rows.has(p.id)||!clean(p.text))continue;
     rows.set(p.id,clean(p.text));
    }
    if(rows.size!==block.length){
     stage.errors[level]='PARTIAL_BLOCK';
     await notify('waiting-provider');
     return current;
    }
    for(const [id,value] of rows)buffered[id]=value;
    stage.requests++;
    await markGeminiCadenceSuccessV58({
     requestStartedAt:began,inputTokens:reply.inputTokens||0});
    await clearGeminiPause();
    await notify('running'); // Durable checkpoint: no published text changes.
   }catch(error){
    stage.errors[level]=error?.code||error?.message||'NETWORK_ERROR';
    await notify(signal?.aborted?'interrupted':'waiting-provider');
    return current;
   }
  }
  if(!units.every(u=>clean(buffered[u.id]))){
   stage.errors[level]='MISSING_RECALIBRATION_UNITS';
   await notify('waiting-provider');
   return current;
  }
  const nextDrafts=copy();
  let moreProtectedLoss=0;
  let immutableDefects=0;
  for(const u of units){
   const candidate=clean(buffered[u.id]);
   const old=clean(current.draftRowsV57?.[u.ci]?.[u.pi]?.editions?.[level]);
   // New output must not introduce more protected-fact loss than the saved
   // version. This is a conservative safety check, not certification.
   const oldMissing=auditFidelity(u.source,old).missingProtected?.length||0;
   const newMissing=auditFidelity(u.source,candidate).missingProtected?.length||0;
   if(newMissing>oldMissing)moreProtectedLoss++;
   // Technical notation and verbatim legal references have precedence over
   // mere closeness to a numeric target. An incorrect citation is rejected.
   immutableDefects+=immutableViolationsV67(u.source,candidate).length;
   nextDrafts[u.ci][u.pi].editions[level]=candidate;
  }
  const before=editionReductionV67(units,current.draftRowsV57,level);
  const after=editionReductionV67(units,nextDrafts,level);
  const accepts=moreProtectedLoss===0&&immutableDefects===0&&betterReductionV67(before,after);
  stage.attempted[level]=true;
  stage.completed[level]={
   accepted:accepts,previous:before.measured,measured:after.measured,
   withinTolerance:after.within,protectedWarnings:moreProtectedLoss,
   immutableDefects,
   finishedAt:stamp()
  };
  // The old full edition remains untouched unless the replacement is real,
  // complete and closer to the user's requested reduction.
  if(accepts){
   const previousTexts=units.map(u=>
    clean(current.draftRowsV57[u.ci][u.pi].editions[level]));
   stage.backups={...(stage.backups||{}),[level]:previousTexts};
   const updated=finalizeStudyQualityV66(book,units,
    current.stagedRows||[],nextDrafts,
    {...current,checkpointPersistent:true},()=>{});
   current={...updated,rebalanceV67:stage};
   stage.accepted++;
  }
  delete stage.buffers[level];
  await notify('running');
 }
 const still=planRebalanceV67(units,current.draftRowsV57);
 stage.remaining=still.map(x=>({level:x.level,measured:x.measured,
  goal:x.goal,distance:x.distance}));
 await notify(stage.remaining.length?'complete-with-notes':'complete');
 return current;
}
