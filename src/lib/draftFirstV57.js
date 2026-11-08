// LAB57: StudyBook AI "PRIMA CREA, POI VERIFICA".
// One owner for current study-pillar books; no parallel legacy runner.
// STAGE 1: produce and durably store every unverified Gemini draft of the six
// editions. STAGE 2: compare each complete edition with the original book,
// then repair only deficient FULL physical pages. No provisional study text
// can be published or exported as verified.
import {apiEndpoint} from './apiEndpoint.js';
import {runtimeHash} from './motorLabRuntime.js';
import {loadRuntimeUnitResults,saveRuntimeUnitResults} from './resumeStore.js';
import {readGeminiPause,registerGeminiPause,clearGeminiPause} from './geminiQuotaControllerV36.js';
import {bookUnitsV51,planNaturalBlocksV51,bisectAtNaturalBoundaryV51,
  blockLetterTargetV51,BULK_OUTPUT_TOKEN_CEILING} from './integralPlannerV51.js';
import {restoredLargeBlockLimitV58,learnGeminiCadenceV58,
  markGeminiCadenceSuccessV58,waitForGeminiCadenceV58,
  readGeminiCadenceV58} from './geminiCadenceV58.js';
import {classifySourceReadinessV52} from './generativeIntegralV51.js';
import {publishSequentialPagesV51} from './pagePublicationV51.js';
import {studyLetters,percentReduced,exactRetained} from './studyPillarV38.js';
import {auditFidelity,auditProgressiveConcepts} from './fidelityEngine.js';
import {rewriteQualityV65} from './rewriteQualityV65.js';
import {finalizeStudyQualityV66} from './studyQualityV66.js';
import {repairFocusForUnitV62} from './editionRepairV53.js';
import {orderSourceUnitsV59} from './studyPhaseProgressV59.js';
import {STUDY_DRAFT_PROTOCOL_V71,verifyStudyDraftResponseV71,buildUnitBudgetsV71} from './studyDraftProtocolV71.js';
import {measureEditionLengthV72} from './studyRebalancePolicyV67.js';
import {STUDY_DRAFT_PROTOCOL_V72,verifyStudyDraftResponseV72} from './studyDraftProtocolV72.js';
import {initialStudyOutputLimitV73,safeNetworkSplitV73,isRecoverableNetworkV73}
 from './studyNetworkRecoveryV73.js';

const LEVELS=['summary','50','40','30','20','10'];
const CACHE='integral-v57-draft-first',VERSION='lab38-progressive-editions-v1';
const clean=x=>String(x||'').trim();
const signature=u=>runtimeHash(JSON.stringify([u.id,u.source,u.pageStart,u.pageEnd]));
const key=(fp,level,u)=>'mlr:'+CACHE+':'+fp+':'+level+':'+signature(u);
const priorKey=(fp,level,u)=>'mlr:integral-v51-verified-book-pages:'+fp+':'+
  level+':'+runtimeHash(JSON.stringify([[u.id,u.source,u.pageStart,u.pageEnd]]))+':draft';
const fingerprint=book=>book?.canonicalBookMap?.originalFingerprint||
  runtimeHash((book.chapters||[]).map(c=>(c.paragraphs||[]).map(p=>p.original).join('|')).join('||'));

function gridFrom(book,previous,fp){
 const match=previous?.sourceFingerprint===fp;
 const prevRows=match?(previous?.stagedRows||previous?.rows):null;
 const prevDraft=match?previous?.draftRowsV57:null;
 const rows=(book.chapters||[]).map((ch,ci)=>(ch.paragraphs||[]).map((p,pi)=>{
   const was=prevRows?.[ci]?.[pi],editions={},verified={},issues={},achievedPercent={};
   for(const level of LEVELS){
     const value=was?.verified?.[level]===true?clean(was.editions?.[level]):'';
     verified[level]=Boolean(value);
     editions[level]=value||null;
     issues[level]=value?[]:['pending-verification'];
     achievedPercent[level]=value?
       percentReduced(studyLetters(p.original),studyLetters(value)):null;
   }
   return {editions,verified,issues,achievedPercent,partialFragments:{},
     sourcePageStart:p.sourcePageStart??ch.pageStart??null};
 }));
 const drafts=(book.chapters||[]).map((ch,ci)=>(ch.paragraphs||[]).map((p,pi)=>{
   const editions={};
   for(const level of LEVELS){
     // LAB65: keep a newer unverified rewrite candidate even if an earlier
     // LAB approved an old text. The old approved copy remains in stagedRows
     // until a genuinely new variant passes review.
     const pending=prevDraft?.[ci]?.[pi]?.editions?.[level];
     const verifiedOld=rows[ci][pi].editions[level];
     editions[level]=clean(
       previous?.diagnostics?.rewritePolicyV65?.policy==='semantic-rewrite-v65'
       ?pending||verifiedOld:verifiedOld||pending)||null;
   }
   return {editions};
 }));
 return {rows,drafts};
}
function draftOf(drafts,u,level){return clean(drafts[u.ci]?.[u.pi]?.editions?.[level]);}
function saveDraftToGrid(drafts,u,level,value){
 drafts[u.ci][u.pi].editions[level]=clean(value);
}
function stats(book,units,rows,drafts,fp,diag,phase,checkpointPersistent=true){
 const published=publishSequentialPagesV51(book,rows);
 const flat=rows.flat();
 const count=flat.reduce((n,row)=>n+LEVELS.filter(level=>row.verified[level]).length,0);
 const ready=flat.filter(row=>LEVELS.every(level=>row.verified[level])).length;
 const draftUnitsSaved=units.reduce((n,u)=>n+LEVELS.filter(level=>draftOf(drafts,u,level)).length,0);
 const total=units.length*LEVELS.length;
 const complete=total>0&&count===total&&checkpointPersistent&&
   classifySourceReadinessV52(book).ok;
 return {version:VERSION,sourceFingerprint:fp,rows:published.rows,stagedRows:rows,
   draftRowsV57:drafts,draftUnitsSaved,draftUnitsTotal:total,
   draftComplete:draftUnitsSaved===total,phase:complete?'complete':phase,
   integralInputLimit:diag.inputLimit,
   providerBlockOutputLimitV73:diag.providerBlockOutputLimitV73,
   repairAttemptsV57:diag.repairAttempts,
   publishedThroughPage:published.through,verifiedCells:ready,
   totalCells:units.length,blockedCells:units.length-ready,verifiedChunks:ready,
   verifiedVariants:count,totalVariants:total,
   verifiedChunkVariants:count,totalChunkVariants:total,
   diagnostics:{...diag,errorsByCode:{...diag.errorsByCode}},
   checkpointPersistent,complete,status:complete?'complete':
     phase==='draft'?'drafting':phase==='repair'?'reviewing':'quality-review',
   updatedAt:new Date().toISOString()};
}
function emit(onProgress,book,units,rows,drafts,fp,diag,phase,persisted=true,extra={}){
 const state={...stats(book,units,rows,drafts,fp,diag,phase,persisted),...extra};
 onProgress(state,state.verifiedVariants,state.totalVariants);
 return state;
}
function halt(onProgress,book,units,rows,drafts,fp,diag,phase,status,code,persisted=true,quota=null){
 const s=emit(onProgress,book,units,rows,drafts,fp,diag,phase,persisted);
 s.status=status;s.execution={haltedOn:code,remainingBatches:diag.remainingBatches||0};
 if(quota)s.quota=quota;
 onProgress(s,s.verifiedVariants,s.totalVariants);
 return s;
}
function pageSets(units){
 const pages=new Map();
 for(const u of units)for(let p=u.pageStart;p<=u.pageEnd;p++){
   const a=pages.get(p)||[];a.push(u);pages.set(p,a);
 }
 return pages;
}
function blocksForMissing(units,drafts,rows,level,inputLimit,outputLimit){
 const missingPages=new Set();
 for(const u of units)if(!draftOf(drafts,u,level)&&!rows[u.ci][u.pi].verified[level])
   for(let page=u.pageStart;page<=u.pageEnd;page++)missingPages.add(page);
 if(!missingPages.size)return [];
 const completePages=units.filter(u=>
   Array.from({length:u.pageEnd-u.pageStart+1},(_,i)=>u.pageStart+i)
     .some(page=>missingPages.has(page)));
 return planNaturalBlocksV51(completePages,level,{maxInputTokens:inputLimit,
  maxOutputTokens:outputLimit});
}
function reviewEdition(units,drafts,level){
 const violations=[],missing=[],texts=[];
 for(const u of units){
   const output=draftOf(drafts,u,level);
   texts.push(output);
   if(!output){missing.push(u.id);violations.push({u,reasons:['draft-missing']});continue;}
   const semantic=auditFidelity(u.source,output);
   const concepts=auditProgressiveConcepts(u.source,output);
   const reasons=[];
   if(semantic.missingProtected.length)reasons.push('missing-protected');
   if(semantic.qualifierMismatches.length)reasons.push('scoped-qualifier');
   if(concepts.issues.length)reasons.push(...concepts.issues);
   if(rewriteQualityV65(u.source,output,level).needsRewrite)
     reasons.push('mechanical-copy-v65');
   if(reasons.length)violations.push({u,reasons:[...new Set(reasons)]});
 }
 const letters=units.reduce((n,u,i)=>n+studyLetters(texts[i]),0);
 const original=units.reduce((n,u)=>n+studyLetters(u.source),0);
 const target=level==='summary'?Math.max(0,exactRetained(original,50)-1):
   exactRetained(original,Number(level));
 const delta=level==='summary'?Math.max(0,letters-target):letters-target;
 const exact=level==='summary'?letters<=target:letters===target;
 return {level,missing,violations,letters,target,delta,exact,
   verified:missing.length===0&&violations.length===0&&exact};
}
function publishEdition(rows,units,drafts,level){
 for(const u of units){
   const value=draftOf(drafts,u,level),row=rows[u.ci][u.pi];
   row.editions[level]=value;
   row.verified[level]=true;row.issues[level]=[];
   row.achievedPercent[level]=percentReduced(studyLetters(u.source),studyLetters(value));
 }
}
async function request(block,level,{bookTitle='',signal=null,phase='draft',repairDrafts=[],
  targetOverride=null,onWait=()=>{}}={}){
 const target=blockLetterTargetV51(block,level),chars=block.reduce((n,u)=>n+u.source.length,0);
 const ratio=level==='summary'?0.44:1-Number(level)/100;
 const tokenBudget=Math.min(BULK_OUTPUT_TOKEN_CEILING,
   Math.max(4096,Math.ceil(chars*ratio/1.5)+block.length*115+1800));
 const expected=targetOverride===null?(level==='summary'?target.summaryCapLetters:target.targetLetters):
   Math.max(0,Math.floor(Number(targetOverride)));
 const isNewDraft=phase==='draft';
 const body={phase:isNewDraft?'draft-v72':phase,
   ...(isNewDraft?{draftProtocol:STUDY_DRAFT_PROTOCOL_V72}:{}),
   // Approximate individual targets guide Gemini without interrupting first-pass creation.
   unitBudgets:buildUnitBudgetsV71(block,level),
   bookTitle,level,
   targetLetters:level==='summary'?null:expected,
   summaryCapLetters:level==='summary'?expected:null,
   maxOutputTokens:tokenBudget,timeoutMs:190000,repairDrafts,
   units:block.map(u=>({id:u.id,source:u.source,chapterTitle:u.chapterTitle,
     sectionTitle:u.sectionTitle,pageStart:u.pageStart,pageEnd:u.pageEnd}))};
 await waitForGeminiCadenceV58({signal,onWait});
 // The in-request wait is part of the existing single Gemini runner.
 // Re-check quota here because Android may resume after a background pause.
 const cooling=await readGeminiPause();
 if(cooling)throw Object.assign(new Error('Quota Gemini in attesa'),{
   code:'AI_QUOTA_LIMIT',quota:cooling});
 const startedAt=Date.now();
 let response;
 try{
  response=await fetch(apiEndpoint('/api/editions/bulk/v51'),{
   method:'POST',headers:{'Content-Type':'application/json'},
   signal,body:JSON.stringify(body)});
 }catch(error){
  if(signal?.aborted)throw error;
  // Differentiate Android->Worker transport from Worker->Gemini upstream.
  // Only sanitized codes/stages are retained, never API keys or original text.
  throw Object.assign(new Error('Connessione al servizio Gemini interrotta'),{
   code:'AI_CLIENT_NETWORK',diagnostic:{reason:'android-worker-fetch',
    elapsedMs:Date.now()-startedAt,stage:'client-fetch',
    transportType:String(error?.name||'TypeError').slice(0,40)}
  });
 }
 const data=await response.json().catch(()=>null);
 if(!response.ok){
   const code=data?.code||(response.status===404?'AI_BULK_ENDPOINT_MISSING':'HTTP_'+response.status);
   if((response.status===429||response.status===503)&&data?.quota){
     await registerGeminiPause(data.quota);
     if(response.status===429)await learnGeminiCadenceV58(data.quota,{
       inputTokens:data?.diagnostic?.inputTokens||0});
   }
   throw Object.assign(new Error(data?.error||'Risposta Gemini non disponibile'),{
     code,quota:data?.quota||null,diagnostic:data?.diagnostic||null});
 }
 if(data?.engine!=='ai'||data?.version!=='integral-v51'||data?.level!==level)
   throw Object.assign(new Error('Provenienza risposta Gemini non verificata'),{code:'INVALID_EDITION_RESPONSE'});
 // LAB70: reject stale LAB67 Worker deployments before storing new drafts.
 // Incorrect reduction itself is saved as a draft and checked only in phase 2.
 if(isNewDraft){
   const verified=verifyStudyDraftResponseV72(data,
     block.reduce((n,u)=>n+studyLetters(u.source),0),level);
   if(!verified.ok)throw Object.assign(new Error(verified.message),{code:verified.code});
 }
 await markGeminiCadenceSuccessV58({requestStartedAt:startedAt,
   inputTokens:data?.inputTokens||0});
 return data;
}
async function restoreDrafts(units,drafts,rows,fp){
 for(const level of LEVELS){
   // LAB61: recover durable corrected drafts even if library still has an older
   // non-approved full draft. Never overwrite an already approved page.
   const open=units.filter(u=>!rows[u.ci]?.[u.pi]?.verified?.[level]);
   if(!open.length)continue;
   const current=await loadRuntimeUnitResults(open.map(u=>key(fp,level,u)));
   const old=await loadRuntimeUnitResults(open.map(u=>priorKey(fp,level,u)));
   for(const u of open){
     const record=current.get(key(fp,level,u))||old.get(priorKey(fp,level,u));
     if(!record||record.id!==u.id||!clean(record.text))continue;
     if(record.kind==='draft-v57'&&record.signature===signature(u)||
       record.kind==='draft-v53'&&record.signature===runtimeHash(JSON.stringify([[u.id,u.source,u.pageStart,u.pageEnd]]))){
       saveDraftToGrid(drafts,u,level,record.text);
     }
   }
 }
}
// LAB60: LAB59 persisted a "repair sent" marker BEFORE any Gemini response.
// On 503/timeout that marker could permanently skip an unserved correction.
// Recover only the most recently attempted legacy scope, only for snapshots
// known to have halted on a transient during the repair phase. Never clear
// accepted drafts or verified pages. Once upgraded, failed requests are no
// longer counted as performed repairs in the first place.
function recoverLegacyTransientRepairV60(previous,attempts){
 if(previous?.phase!=='repair'||
   !['quota-paused','provider-blocked','interrupted'].includes(previous?.status))
   return null;
 const code=previous?.execution?.haltedOn||previous?.diagnostics?.lastCode;
 if(!['AI_TEMPORARY_OVERLOAD','AI_QUOTA_LIMIT','AI_PROVIDER_NETWORK',
   'AI_PROVIDER_TIMEOUT','AI_TIMEOUT_OR_NETWORK','AI_MANUAL_RESTART',
   'HTTP_503','HTTP_429'].includes(code))return null;
 const candidate=Object.keys(attempts).filter(k=>attempts[k]>=1).at(-1);
 if(!candidate)return null;
 delete attempts[candidate];
 return candidate;
}
// LAB61: one quality coordinator, continuing the original two-phase runner.
// A page may become visible only after its concepts/negations have been
// checked; the global exact-letter target is still a REQUIRED final gate.
const MAX_REPAIR_ATTEMPTS_V61=3;
const MAX_REPAIR_PAGES_V61=5;
const MAX_REPAIR_CALLS_V61=4;
const attemptKeyV61=(level,page)=>level+':'+page+'-'+page;
function semanticIssuePagesV61(issues){
 return [...new Set(issues.violations.flatMap(({u})=>
   Array.from({length:u.pageEnd-u.pageStart+1},(_,i)=>u.pageStart+i)))].sort((a,b)=>a-b);
}
function numericReservedPagesV61(units,issues,level,rows){
 if(issues.exact)return [];
 let needed=Math.abs(issues.delta);
 const mapped=[...pageSets(units)].filter(([page,members])=>members.some(u=>
   !rows[u.ci]?.[u.pi]?.verified?.[level])).sort((a,b)=>b[0]-a[0]);
 const selected=[];
 for(const [page,members] of mapped){
   selected.push(page);
   const letters=members.reduce((n,u)=>n+studyLetters(u.source),0);
   needed-=Math.max(6,Math.floor(letters*.55));
   if(needed<=0)break;
 }
 return selected.sort((a,b)=>a-b);
}
function stageApprovedPrefixV61(rows,units,drafts,level,issues){
 const blocked=new Set([
   ...semanticIssuePagesV61(issues),
   ...numericReservedPagesV61(units,issues,level,rows)
 ]);
 const firstBad=blocked.size?Math.min(...blocked):Infinity;
 let newlyApproved=0;
 const failed=new Set(issues.violations.map(x=>x.u.id));
 for(const u of units){
   const row=rows[u.ci][u.pi];
   if(row?.verified?.[level]===true||u.pageEnd>=firstBad||
     failed.has(u.id))continue;
   const value=draftOf(drafts,u,level);
   if(!value)continue;
   row.editions[level]=value;
   row.verified[level]=true;
   row.issues[level]=[];
   row.achievedPercent[level]=percentReduced(studyLetters(u.source),studyLetters(value));
   newlyApproved++;
 }
 return newlyApproved;
}
function selectedRepairPages(units,issues,level,rows,attempts){
 const semantic=semanticIssuePagesV61(issues);
 const candidate=semantic.length?semantic:
   numericReservedPagesV61(units,issues,level,rows);
 const eligible=candidate.filter(page=>
   (Number(attempts[attemptKeyV61(level,page)])||0)<MAX_REPAIR_ATTEMPTS_V61);
 const pages=eligible.slice(0,MAX_REPAIR_PAGES_V61);
 // Keep full original pages, including every paragraph spanning the page.
 const selected=units.filter(u=>pages.some(page=>
   page>=u.pageStart&&page<=u.pageEnd));
 return {pages,units:selected,eligibleCount:eligible.length,
   blockedCount:candidate.length,exhausted:Math.max(0,candidate.length-eligible.length)};
}
// LAB62: a LAB61 checkpoint can be permanently quality-stalled at the
// three-attempt cap even after upgrading to improved, genuinely targeted
// prompts. Safely re-arm ONLY the earliest exhausted original page, ONCE
// per immutable source fingerprint. Never re-arm just because the app opens.
function restoreExhaustedQualityV62(previous,fp,units,rows,reviews,attempts){
 if(previous?.sourceFingerprint!==fp||previous?.complete||
   !previous?.draftComplete||previous?.status!=='quality-review'||
   previous?.diagnostics?.pendingQualityV61?.attentionRequired!==true||
   previous?.diagnostics?.qualityRecoveryV62?.policy==='focused-v62')return null;
 const level=LEVELS.find(l=>!reviews[l].verified);
 if(!level)return null;
 const issues=reviews[level];
 const bad=semanticIssuePagesV61(issues);
 const ordered=bad.length?bad:numericReservedPagesV61(units,issues,level,rows);
 // Re-arm every exhausted LEGACY page of this edition once, otherwise
 // correcting page 17 merely moves the permanent barrier to page 18.
 // Source-order selection, per-page limits and at-most-four calls per session
 // still control actual Gemini traffic. No later reopen on app relaunch.
 const pages=ordered.filter(p=>(Number(attempts[attemptKeyV61(level,p)])||0)>=MAX_REPAIR_ATTEMPTS_V61);
 const first=pages[0]??null;
 const evidence={policy:'focused-v62',level,page:first,
   recoveredPages:pages,
   previousAttempts:first!==null?Number(attempts[attemptKeyV61(level,first)]):0,
   resetOnce:pages.length>0};
 for(const page of pages)attempts[attemptKeyV61(level,page)]=0;
 return evidence;
}
export async function generateDraftFirstV57(book,{onProgress=()=>{},onActivity=()=>{},signal=null,qualityOnly=false}={}){
 const units=orderSourceUnitsV59(bookUnitsV51(book)),fp=fingerprint(book),previous=book.editionsV36;
 const {rows,drafts}=gridFrom(book,previous,fp);
 const diagnostics={mode:'draft-first-v57',requestsSent:0,draftRequests:0,
   repairRequests:0,rawDraftsSaved:0,providerErrors:0,splits:0,errorsByCode:{},
   // A previous 503 can no longer permanently shrink a whole-book plan.
   // Provider hard 413 still splits safely at complete page boundaries.
   inputLimit:restoredLargeBlockLimitV58(previous),
   providerBlockOutputLimitV73:initialStudyOutputLimitV73(units,
     previous?.sourceFingerprint===fp?previous:null),
   networkSplitsV73:0,networkFailuresV73:0,
   lastProviderDiagnostic:previous?.sourceFingerprint===fp?
     previous?.diagnostics?.lastProviderDiagnostic||null:null,
   repairAttempts:previous?.sourceFingerprint===fp
     ?{...(previous?.repairAttemptsV57||{})}:{},phase:'draft',
   remainingBatches:0,lastCode:null,
   // Observability only, never a creation gate or extra provider request.
   lengthChecksV72:previous?.sourceFingerprint===fp
     ?{...(previous?.diagnostics?.lengthChecksV72||{})}:{},
   // Persist proof of a one-off legacy recovery in every subsequent snapshot.
   qualityRecoveryV62:previous?.sourceFingerprint===fp
     ?previous?.diagnostics?.qualityRecoveryV62||null:null};
 // LAB66: local quality mode must not reset or consume historical repair
 // attempts, even if the LAB65 semantic-rewrite migration was not completed.
 if(!qualityOnly){
  // LAB65: change the correction STRATEGY once, across all six levels.
  // Never reset attempts every time the user reopens the app.
  const migrationPrevious=previous?.sourceFingerprint===fp
    ?previous?.diagnostics?.rewritePolicyV65:null;
  if(migrationPrevious?.policy==='semantic-rewrite-v65'){
    diagnostics.rewritePolicyV65=migrationPrevious;
  }else{
    const touched=[];
    if(previous?.sourceFingerprint===fp&&previous?.draftComplete){
      for(const level of LEVELS){
        for(const [page,members] of pageSets(units)){
          if(!members.some(u=>rewriteQualityV65(u.source,
              clean(previous?.draftRowsV57?.[u.ci]?.[u.pi]?.editions?.[level])||
              clean(previous?.stagedRows?.[u.ci]?.[u.pi]?.editions?.[level]),
              level).needsRewrite))continue;
          const attempt=attemptKeyV61(level,page);
          if(Number(diagnostics.repairAttempts[attempt])>0){
            diagnostics.repairAttempts[attempt]=0;touched.push(attempt);
          }
        }
      }
    }
    diagnostics.rewritePolicyV65={policy:'semantic-rewrite-v65',
      sourceFingerprint:fp,rearmedPages:touched.length,
      migrationFromLegacy:Boolean(previous?.sourceFingerprint===fp)};
  }
  diagnostics.recoveredLegacyRepairV60=previous?.sourceFingerprint===fp
    ?recoverLegacyTransientRepairV60(previous,diagnostics.repairAttempts):null;

 }
 let persisted=true;
 const source=classifySourceReadinessV52(book,units);
 if(!source.ok)return halt(onProgress,book,units,rows,drafts,fp,diagnostics,
   'draft','source-review-needed','SOURCE_REVIEW',true);
 await restoreDrafts(units,drafts,rows,fp);
 // Learn a historical quota signal only once, after a LAB57-to-58 update.
 // Do not count opening the app repeatedly as new 429 failures.
 const oldPause=await readGeminiPause();
 if(oldPause?.kind==='requests-minute' && !(await readGeminiCadenceV58()))
   await learnGeminiCadenceV58(oldPause);
 emit(onProgress,book,units,rows,drafts,fp,diagnostics,'draft');
 // FIRST PHASE: finish every required draft, no pedagogical evaluation here.
 for(const level of LEVELS){
   const pending=blocksForMissing(units,drafts,rows,level,
     diagnostics.inputLimit,diagnostics.providerBlockOutputLimitV73);
   const queue=pending.map(block=>({block,attempt:0}));
   while(queue.length){
     diagnostics.remainingBatches=queue.length;
     const job=queue.shift(),block=job.block;
     if(block.every(u=>draftOf(drafts,u,level)))continue;
     if(signal?.aborted)return halt(onProgress,book,units,rows,drafts,fp,diagnostics,
       'draft','interrupted','AI_MANUAL_RESTART',persisted);
     const pause=await readGeminiPause();
     if(pause)return halt(onProgress,book,units,rows,drafts,fp,diagnostics,'draft',
       pause.automatic?'quota-paused':'quota-review',
       pause.automatic?'AI_QUOTA_LIMIT':'AI_QUOTA_MANUAL_REVIEW',persisted,pause);
     try{
       diagnostics.requestsSent++;diagnostics.draftRequests++;
       onActivity({phase:'draft',level,pageStart:block[0].pageStart,
         pageEnd:block.at(-1).pageEnd});
       const response=await request(block,level,{bookTitle:book.title||'',signal,
         phase:'draft',onWait:data=>onActivity({phase:'pacing',level,...data})});
       // LAB72: measure each actual provider response, not just the ideal
       // length of simulated answers used in unit tests.
       const originalLetters=block.reduce((n,u)=>n+studyLetters(u.source),0);
       const responseLetters=(response.parts||[]).reduce((n,p)=>n+studyLetters(p.text),0);
       const observed=measureEditionLengthV72({
         level,originalLetters,outputLetters:responseLetters,
         completeParts:response.completeParts===true,
         finishReason:response.finishReason||null
       });
       const priorAudit=diagnostics.lengthChecksV72[level]||{
         blocks:0,withinBand:0,outOfBand:0,truncated:0};
       diagnostics.lengthChecksV72[level]={
         blocks:priorAudit.blocks+1,
         withinBand:priorAudit.withinBand+(observed.compliant?1:0),
         outOfBand:priorAudit.outOfBand+(!observed.compliant?1:0),
         truncated:priorAudit.truncated+(observed.suspectedTruncation?1:0),
         last:{sourceLetters,outputLetters:responseLetters,
           reduction:observed.achievedReduction,target:observed.targetReduction,
           min:observed.minLetters,max:observed.maxLetters,
           finishReason:response.finishReason||null,
           providerModel:response.model||null,
           inputTokens:response.inputTokens??null,
           outputTokensUsed:response.outputTokensUsed??null,
           outputTokenLimit:response.outputTokenLimit??null,
           protocol:response.draftProtocol||null}
       };
       const indexed=new Map();
       for(const item of response.parts||[])if(typeof item?.id==='string'&&clean(item.text))
         indexed.set(item.id,clean(item.text));
       const newEntries=[];
       for(const u of block){
         if(draftOf(drafts,u,level))continue;
         const answer=indexed.get(u.id);
         if(answer)newEntries.push({u,text:answer,key:key(fp,level,u)});
       }
       if(newEntries.length){
         const ok=await saveRuntimeUnitResults(newEntries.map(x=>({key:x.key,result:{
           kind:'draft-v57',id:x.u.id,signature:signature(x.u),text:x.text,
           draftEvidenceV72:{
             protocol:response.draftProtocol||null,model:response.model||null,
             sourceLetters:studyLetters(x.u.source),
             resultingLetters:studyLetters(x.text),
             achievedReduction:percentReduced(studyLetters(x.u.source),studyLetters(x.text)),
             finishReason:response.finishReason||null,
             generationStoppedEarly:response.generationStoppedEarly===true,
             generatedAt:new Date().toISOString(),
             bookFingerprint:fp,level
           }}})));
         if(!ok)return halt(onProgress,book,units,rows,drafts,fp,diagnostics,
           'draft','local-storage-error','AI_CHECKPOINT_UNAVAILABLE',false);
         for(const item of newEntries)saveDraftToGrid(drafts,item.u,level,item.text);
         diagnostics.rawDraftsSaved+=newEntries.length;
         await clearGeminiPause();
       }
       emit(onProgress,book,units,rows,drafts,fp,diagnostics,'draft');
       const missing=block.filter(u=>!draftOf(drafts,u,level));
       if(!missing.length)continue;
       if(job.attempt>=1){
         const halves=bisectAtNaturalBoundaryV51(block);
         if(halves){diagnostics.splits++;queue.unshift(...halves.map(b=>({block:b,attempt:0})));continue;}
         return halt(onProgress,book,units,rows,drafts,fp,diagnostics,'draft',
           'draft-incomplete','AI_INCOMPLETE_BLOCK',persisted);
       }
       queue.unshift({block,attempt:1});
     }catch(error){
       const code=signal?.aborted?'AI_MANUAL_RESTART':error?.code||'AI_PROVIDER_NETWORK';
       diagnostics.lastCode=code;diagnostics.providerErrors++;
       diagnostics.errorsByCode[code]=(diagnostics.errorsByCode[code]||0)+1;
       diagnostics.lastProviderDiagnostic={
         reason:String(error?.diagnostic?.stage||error?.diagnostic?.reason||
           (code==='AI_CLIENT_NETWORK'?'android-worker':'worker-gemini')).slice(0,60),
         httpStatus:Number(error?.diagnostic?.httpStatus||
           error?.diagnostic?.status)||null,
         elapsedMs:Number(error?.diagnostic?.elapsedMs)||null,
         code,level,pageStart:block[0].pageStart,pageEnd:block.at(-1).pageEnd
       };
       if(isRecoverableNetworkV73(code))diagnostics.networkFailuresV73++;
       const pause=await readGeminiPause();
       // A 503 means server overload, not proof the source block is too big.
       // Keep the large-block plan unchanged; a genuine hard 413 may split.
       if(pause)return halt(onProgress,book,units,rows,drafts,fp,diagnostics,'draft',
         pause.automatic?'quota-paused':'quota-review',code,persisted,pause);
       if(code==='AI_MANUAL_RESTART')return halt(onProgress,book,units,rows,drafts,fp,diagnostics,
         'draft','interrupted',code,persisted);
       const networkPlan=safeNetworkSplitV73(block,level,{
         code,used:diagnostics.networkSplitsV73,
         currentOutputLimit:diagnostics.providerBlockOutputLimitV73
       });
       if(networkPlan){
         diagnostics.splits++;diagnostics.networkSplitsV73++;
         diagnostics.providerBlockOutputLimitV73=networkPlan.nextOutputLimit;
         diagnostics.lastNetworkStrategyV73=networkPlan.strategy;
         // Full original pages only, no repeated identical failing request.
         queue.unshift(...networkPlan.halves.map(b=>({block:b,attempt:0})));
         emit(onProgress,book,units,rows,drafts,fp,diagnostics,'draft',persisted);
         continue;
       }
       const splittable=['AI_BLOCK_TOO_LARGE','AI_INCOMPLETE_BLOCK'].includes(code);
       const halves=splittable?bisectAtNaturalBoundaryV51(block):null;
       if(halves){
         diagnostics.splits++;
         queue.unshift(...halves.map(b=>({block:b,attempt:0})));
         continue;
       }
       return halt(onProgress,book,units,rows,drafts,fp,diagnostics,'draft',
         'provider-blocked',code,persisted);
     }
   }
 }
 // Creation is complete before the FIRST semantic/percentage review.
 let state=emit(onProgress,book,units,rows,drafts,fp,diagnostics,'review');
 if(!state.draftComplete)return halt(onProgress,book,units,rows,drafts,fp,diagnostics,
   'draft','draft-incomplete','AI_INCOMPLETE_BLOCK',persisted);
 // LAB66: once every saved draft exists, perform ONLY a local advisory audit.
 // No provider call, no automatic corrections, no discarded approvals.
 if(qualityOnly)return finalizeStudyQualityV66(book,units,rows,drafts,
   {...state,checkpointPersistent:persisted},onProgress);
 const reviews={};
 for(const level of LEVELS)reviews[level]=reviewEdition(units,drafts,level);
 if(!diagnostics.qualityRecoveryV62)
   diagnostics.qualityRecoveryV62=restoreExhaustedQualityV62(previous,fp,
     units,rows,reviews,diagnostics.repairAttempts);
 diagnostics.quality={phase:'book-review',
   levels:Object.fromEntries(LEVELS.map(l=>[l,{exact:reviews[l].exact,
     missing:reviews[l].missing.length,semanticIssues:reviews[l].violations.length,
     target:reviews[l].target,actual:reviews[l].letters}]))};
 emit(onProgress,book,units,rows,drafts,fp,diagnostics,'review');
 // SECOND PHASE: strict Riassunto -> 50 -> 40 -> 30 -> 20 -> 10
 // and physical-page order. No global check during compression.
 let unfinishedLevel=null;
 let repairCalls=0;
 for(const level of LEVELS){
   let review=reviews[level];
   if(review.verified){
     publishEdition(rows,units,drafts,level);
     emit(onProgress,book,units,rows,drafts,fp,diagnostics,'review');
     continue;
   }
   stageApprovedPrefixV61(rows,units,drafts,level,review);
   emit(onProgress,book,units,rows,drafts,fp,diagnostics,'review');
   while(!review.verified&&repairCalls<MAX_REPAIR_CALLS_V61){
     const selection=selectedRepairPages(units,review,level,rows,diagnostics.repairAttempts);
     if(!selection.units.length)break;
     const groups=planNaturalBlocksV51(selection.units,level,
       {maxInputTokens:diagnostics.inputLimit});
     const group=groups[0];
     if(!group?.length)break;
     const groupPages=[...new Set(group.flatMap(u=>
       Array.from({length:u.pageEnd-u.pageStart+1},(_,i)=>u.pageStart+i)))];
     const pause=await readGeminiPause();
     if(pause)return halt(onProgress,book,units,rows,drafts,fp,diagnostics,'repair',
       pause.automatic?'quota-paused':'quota-review',
       pause.automatic?'AI_QUOTA_LIMIT':'AI_QUOTA_MANUAL_REVIEW',persisted,pause);
     const gap=review.exact?0:review.target-review.letters;
     const lengthBefore=group.reduce((n,u)=>n+studyLetters(draftOf(drafts,u,level)),0);
     const sourceLetters=group.reduce((n,u)=>n+studyLetters(u.source),0);
     const maxAdjustment=Math.max(6,Math.floor(sourceLetters*.55));
     const boundedGap=Math.max(-maxAdjustment,Math.min(maxAdjustment,gap));
     const desired=Math.max(1,lengthBefore+boundedGap);
     const issueIds=new Set(review.violations.filter(v=>
       v.reasons.includes('mechanical-copy-v65')).map(v=>v.u.id));
     const rewriteGroup=group.some(u=>issueIds.has(u.id));
     // For legacy near-copies the model must REWRITE from the authentic
     // original, not merely correct a few words from previousDraft.
     const repairDrafts=rewriteGroup?[]:group.map(u=>({
       id:u.id,text:draftOf(drafts,u,level),
       repairFocus:repairFocusForUnitV62(u,level,draftOf(drafts,u,level),
         review.violations.find(v=>v.u.id===u.id)?.reasons||[])
     }));
     diagnostics.requestsSent++;diagnostics.repairRequests++;repairCalls++;
     if(rewriteGroup)diagnostics.rewriteRequestsV65=
       (diagnostics.rewriteRequestsV65||0)+1;
     emit(onProgress,book,units,rows,drafts,fp,diagnostics,'repair');
     try{
       onActivity({phase:'repair',level,pageStart:group[0].pageStart,
         pageEnd:group.at(-1).pageEnd});
       const response=await request(group,level,{bookTitle:book.title||'',signal,
         phase:rewriteGroup?'rewrite':'repair',repairDrafts,targetOverride:desired,
         onWait:data=>onActivity({phase:'pacing',level,...data})});
       const indexed=new Map((response.parts||[]).filter(x=>clean(x?.text))
         .map(x=>[x.id,clean(x.text)]));
       const changes=group.filter(u=>indexed.has(u.id)&&
         (!rows[u.ci][u.pi].verified[level]||issueIds.has(u.id))&&
         indexed.get(u.id)!==draftOf(drafts,u,level)).map(u=>({
           u,text:indexed.get(u.id),key:key(fp,level,u)
         }));
       if(changes.length){
         const ok=await saveRuntimeUnitResults(changes.map(x=>({key:x.key,result:{
           kind:'draft-v57',id:x.u.id,signature:signature(x.u),text:x.text}})));
         if(!ok)return halt(onProgress,book,units,rows,drafts,fp,diagnostics,
           'repair','local-storage-error','AI_CHECKPOINT_UNAVAILABLE',false);
         for(const change of changes)saveDraftToGrid(drafts,change.u,level,change.text);
         await clearGeminiPause();
       }
       // HTTP 200 counts as a bounded ATTEMPT, never as approval.
       // 503/429/timeout never increments the durable attempt counters.
       for(const page of groupPages){
         const id=attemptKeyV61(level,page);
         diagnostics.repairAttempts[id]=(Number(diagnostics.repairAttempts[id])||0)+1;
       }
       const previousMissing=review.violations.length;
       const previousDelta=Math.abs(review.delta);
       review=reviewEdition(units,drafts,level);
       reviews[level]=review;
       if(review.verified)publishEdition(rows,units,drafts,level);
       else stageApprovedPrefixV61(rows,units,drafts,level,review);
       emit(onProgress,book,units,rows,drafts,fp,diagnostics,'review');
       // Do not repeatedly request the same unhelpful response in one pass.
       const improved=review.verified||
         review.violations.length<previousMissing||
         Math.abs(review.delta)<previousDelta;
       if(!improved)break;
     }catch(error){
       const code=signal?.aborted?'AI_MANUAL_RESTART':error?.code||'AI_PROVIDER_NETWORK';
       diagnostics.lastCode=code;diagnostics.providerErrors++;
       diagnostics.errorsByCode[code]=(diagnostics.errorsByCode[code]||0)+1;
       const pause=await readGeminiPause();
       if(pause)return halt(onProgress,book,units,rows,drafts,fp,diagnostics,
         'repair',pause.automatic?'quota-paused':'quota-review',code,persisted,pause);
       return halt(onProgress,book,units,rows,drafts,fp,diagnostics,'repair',
         'provider-blocked',code,persisted);
     }
   }
   if(!review.verified){unfinishedLevel=level;break;}
 }
 diagnostics.quality={...diagnostics.quality,
   pendingLevel:unfinishedLevel,
   retryablePages:unfinishedLevel?selectedRepairPages(units,reviews[unfinishedLevel],
     unfinishedLevel,rows,diagnostics.repairAttempts).eligibleCount:0};
 if(unfinishedLevel){
   const problem=reviews[unfinishedLevel];
   const semanticPages=semanticIssuePagesV61(problem);
   const numericPages=numericReservedPagesV61(units,problem,unfinishedLevel,rows);
   const nextPage=(semanticPages[0]??numericPages[0])||null;
   const reasons=[...new Set(problem.violations.filter(v=>
     nextPage!==null&&v.u.pageStart<=nextPage&&v.u.pageEnd>=nextPage)
     .flatMap(v=>v.reasons))];
   if(!problem.exact)reasons.push('letter-budget');
   const attempts=nextPage===null?0:Number(
     diagnostics.repairAttempts[attemptKeyV61(unfinishedLevel,nextPage)])||0;
   diagnostics.pendingQualityV62={
     level:unfinishedLevel,page:nextPage,reasons:[...new Set(reasons)].slice(0,5),
     attempted:attempts,maxAttempts:MAX_REPAIR_ATTEMPTS_V61,
     remainingEligible:diagnostics.quality.retryablePages,
     needsManualReview:diagnostics.quality.retryablePages===0,
     recoveryApplied:diagnostics.qualityRecoveryV62?.resetOnce===true};
 }
 state=emit(onProgress,book,units,rows,drafts,fp,diagnostics,'review');
 if(!state.complete){
   state.status='quality-review';
   const remaining=diagnostics.quality?.retryablePages||0;
   state.execution={haltedOn:'AI_QUALITY_REVIEW',remainingBatches:remaining,
     reviewAfter:new Date(Date.now()+30000).toISOString()};
   state.diagnostics.pendingQualityV61={level:unfinishedLevel,
     retryablePages:remaining,attentionRequired:remaining===0,
     maxAttemptsPerPage:MAX_REPAIR_ATTEMPTS_V61};
   state.diagnostics.quality={phase:'book-review',
     levels:Object.fromEntries(LEVELS.map(l=>[l,{exact:reviews[l].exact,
       missing:reviews[l].missing.length,semanticIssues:reviews[l].violations.length,
       target:reviews[l].target,actual:reviews[l].letters}]))};
   onProgress(state,state.verifiedVariants,state.totalVariants);
 }
 return state;
}
