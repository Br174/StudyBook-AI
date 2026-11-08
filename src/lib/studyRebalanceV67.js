// LAB67 - Phase TWO recalibration on saved complete editions.
// Rewrites only levels outside the user's tolerance with Gemini; never
// runs automatic correction in phase THREE. Existing reader/export stays
// available while candidates are staged in checkpoint memory.
import {apiEndpoint} from './apiEndpoint.js';
import {bookUnitsV51,planNaturalBlocksV51,
  BULK_OUTPUT_TOKEN_CEILING} from './integralPlannerV51.js';
import {orderSourceUnitsV59} from './studyPhaseProgressV59.js';
import {classifySourceReadinessV52} from './generativeIntegralV51.js';
import {studyLetters,exactRetained,percentReduced} from './studyPillarV38.js';
import {planRebalanceV67,editionReductionV67,betterReductionV67,
  STUDY_TARGET_V67,measureEditionLengthV72} from './studyRebalancePolicyV67.js';
import {readGeminiPause,registerGeminiPause,clearGeminiPause}
 from './geminiQuotaControllerV36.js';
import {waitForGeminiCadenceV58,markGeminiCadenceSuccessV58}
 from './geminiCadenceV58.js';
import {auditFidelity} from './fidelityEngine.js';
import {immutableViolationsV67} from './immutableFragmentsV67.js';
import {finalizeStudyQualityV66} from './studyQualityV66.js';
import {buildUnitBudgetsV71} from './studyDraftProtocolV71.js';
import {STUDY_DRAFT_PROTOCOL_V72,verifyStudyDraftResponseV72} from './studyDraftProtocolV72.js';
import {STUDY_DRAFT_PROTOCOL_V74,verifyStudyDraftResponseV74} from './studyDraftProtocolV74.js';
import {pageLetterBudgetsV74,pageLetterReviewV74,selectPageRepairUnitsV74} from './studyPageBudgetsV74.js';
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
 // LAB69: legacy LAB67 retries/acceptances are NOT proof of strict precision.
 // A finished old attempt must be reconsidered, but preserve all saved drafts.
 // A paused current attempt can resume with the same stable checkpoints.
 const prior=start.rebalanceV67;
 const resumable=prior?.sourceFingerprint===fp&&
   prior?.version==='lab72-targeted-source-v1'&&
   ['running','interrupted','waiting-provider'].includes(prior?.status);
 const stage=resumable?clone(prior):{
   version:'lab72-targeted-source-v1',sourceFingerprint:fp,
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
  const buffered=stage.buffers[level]||{};
  stage.buffers[level]=buffered;
  // LAB74: page-level repair, not a complete-book rewrite. A page already
  // within its approved letter interval is reused without being sent to
  // Gemini. An original paragraph spanning multiple pages remains atomic.
  const currentParts=units.map(u=>({id:u.id,
   text:clean(buffered[u.id])||
    clean(current.draftRowsV57?.[u.ci]?.[u.pi]?.editions?.[level])}));
  const pageSelection=selectPageRepairUnitsV74(units,currentParts,level);
  for(const u of pageSelection.untouchedUnits){
   const original=currentParts.find(p=>p.id===u.id);
   if(original?.text)buffered[u.id]=original.text;
  }
  const blocks=planNaturalBlocksV51(pageSelection.repairUnits,level);
  // Two requests maximum per natural block. The second uses the first
  // candidate ONLY as a negative length example; the original remains the
  // sole source of meaning. No unbounded retry, no Gemini during QA.
  let levelRejected=false;
  for(const block of blocks){
   if(block.every(u=>clean(buffered[u.id])))continue;
   if(signal?.aborted){await notify('interrupted');return current;}
   const originals=block.reduce((n,u)=>n+studyLetters(u.source),0);
   const policy=STUDY_TARGET_V67[level];
   const limit=exactRetained(originals,policy.target);
   const unitBudgets=buildUnitBudgetsV71(block,level);
   const pageBudgetsV74=pageLetterBudgetsV74(block,level);
   // If a saved draft misses tens of percentage points, local patches
   // cannot reconstruct the missing material safely. Use a source-grounded
   // rewrite of the full *original page group*, never artificial filler.
   const needsSourceRebuild=measure.measured===null||
     Math.abs(measure.measured-policy.target)>15;
   const ratio=1-policy.target/100;
   const chars=block.reduce((n,u)=>n+u.source.length,0);
   const maxOutputTokens=Math.min(BULK_OUTPUT_TOKEN_CEILING,
    Math.max(4096,Math.ceil(chars*ratio/1.5)+block.length*115+1800));
   // Phase two starts FROM the existing saved draft (not a fresh global
   // rewrite). All content is provisional until the complete edition passes.
   let previousParts=block.map(u=>({
     id:u.id,text:clean(current.draftRowsV57?.[u.ci]?.[u.pi]?.editions?.[level])
   })).filter(p=>p.text);
   let blockValidated=false;
   for(let trial=0;trial<2;trial++){
    if(signal?.aborted){await notify('interrupted');return current;}
    const pause=await readGeminiPause();
    if(pause){
     stage.lastQuota=pause;
     await notify('waiting-provider');
     return current;
    }
    const fullPageRebuild=needsSourceRebuild||previousParts.length!==block.length;
    const body={
      phase:fullPageRebuild?'recalibrate-v74':'repair-v72',
      draftProtocol:fullPageRebuild?STUDY_DRAFT_PROTOCOL_V74:STUDY_DRAFT_PROTOCOL_V72,
      ...(fullPageRebuild?{pageBudgetsV74}:{}),
      level,bookTitle:String(book.title||'').slice(0,140),
      targetLetters:level==='summary'?null:limit,
      summaryCapLetters:level==='summary'?limit:null,
      unitBudgets,maxOutputTokens,timeoutMs:190000,
      units:block.map(u=>({id:u.id,source:u.source,
       chapterTitle:u.chapterTitle,sectionTitle:u.sectionTitle,
       pageStart:u.pageStart,pageEnd:u.pageEnd}))
    };
    if(previousParts.length){
      // Existing LAB67 worker supports this bounded second-pass input.
      // Never change the base source nor launch a background repair cycle.
      body.repairDrafts=previousParts.map(p=>({
       id:p.id,text:p.text,repairFocus:{
        targetLetters:unitBudgets[p.id]?.targetLetters??null,
        maxSummaryLetters:unitBudgets[p.id]?.summaryTargetLetters??null,
        note:'Revisione mirata della bozza precedente; la fonte originale è unica autorità. '+
         'Mira a '+policy.target+'% (fascia '+policy.min+'-'+policy.max+'%). '+
         'Recupera soltanto informazioni presenti nella fonte, elimina soltanto ridondanze.'
       }
      }));
    }
    const began=Date.now();
    try{
      onActivity({phase:'recalibrate',level,pageStart:block[0].pageStart,
        pageEnd:block.at(-1).pageEnd,trial:trial+1,maxTrials:2});
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
      const version=fullPageRebuild?
       verifyStudyDraftResponseV74(reply,originals,level):
       verifyStudyDraftResponseV72(reply,originals,level);
      if(!version.ok)throw Object.assign(new Error(version.message),{code:version.code});
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
      stage.requests++;
      await markGeminiCadenceSuccessV58({
        requestStartedAt:began,inputTokens:reply.inputTokens||0});
      await clearGeminiPause();
      const candidates=block.map(u=>({id:u.id,text:rows.get(u.id)}));
      previousParts=candidates;
      const outputLetters=candidates.reduce((sum,p)=>sum+studyLetters(p.text),0);
      const reduction=percentReduced(originals,outputLetters);
      stage.diagnosticsV72={...(stage.diagnosticsV72||{}),
        [level]:{trial:trial+1,sourceLetters:originals,outputLetters,
          reduction,finishReason:reply.finishReason??null,
          outputTokensUsed:reply.outputTokensUsed??null,
          outputTokenLimit:reply.outputTokenLimit??null,
          lastProtocol:reply.draftProtocol||null,
          adjustedFromSavedDraft:true}};
      // A token-limited response cannot be trusted as a complete revision,
      // even when it happens to fit the numerical target.
      if(reply.generationStoppedEarly===true||reply.finishReason==='length'){
        stage.errors[level]='GEMINI_OUTPUT_TRUNCATED';
        await notify('running');
        // Don't resend a token-limited result as "complete" material.
        break;
      }
      // Strict acceptance BEFORE buffering: a 10% request can never
      // publish a 72% version, even if it is closer than the old draft.
      const pageNumeric=pageLetterReviewV74(block,candidates,level);
      const blockNumeric=measureEditionLengthV72({level,originalLetters:originals,
       outputLetters,completeParts:true,finishReason:reply.finishReason||null});
      if(blockNumeric.compliant&&pageNumeric.withinBand){
       for(const p of candidates)buffered[p.id]=p.text;
       blockValidated=true;
       stage.errors[level]=null;
       await notify('running');
       break;
      }
      stage.errors[level]='RIDUZIONE_FUORI_RANGE_O_PAGINA: '+reduction+
        '% · richiesto '+policy.min+'-'+policy.max+'%';
      // The first attempt is NOT stored as a completed replacement.
      // One extra provider call is allowed only inside this manual action.
      await notify('running');
    }catch(error){
      stage.errors[level]=error?.code||error?.message||'NETWORK_ERROR';
      await notify(signal?.aborted?'interrupted':'waiting-provider');
      return current;
    }
   }
   if(!blockValidated){
    // Reject this entire edition, preserve every old page and checkpoint.
    stage.attempted[level]=true;
    stage.completed[level]={
      accepted:false,withinTolerance:false,
      reason:stage.errors[level]||'RIDUZIONE_FUORI_RANGE',
      measured:previousParts?percentReduced(
       originals,previousParts.reduce((n,p)=>n+studyLetters(p.text),0)):null,
      finishedAt:stamp()
    };
    levelRejected=true;
    delete stage.buffers[level];
    await notify('running');
    break;
   }
  }
  if(levelRejected)continue;
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
  const afterPages=pageLetterReviewV74(units,units.map(u=>({
    id:u.id,text:nextDrafts?.[u.ci]?.[u.pi]?.editions?.[level]})),level);
  const accepts=moreProtectedLoss===0&&immutableDefects===0&&
    afterPages.withinBand&&betterReductionV67(before,after);
  stage.attempted[level]=true;
  stage.completed[level]={
   accepted:accepts,previous:before.measured,measured:after.measured,
   withinTolerance:after.within&&afterPages.withinBand,
   pageBudgetsWithinToleranceV74:afterPages.withinBand,
   protectedWarnings:moreProtectedLoss,
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
