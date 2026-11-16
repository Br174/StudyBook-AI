// LAB127 orchestration: whole-book reading attempt, then nonblocking explanation and reserve.
// Reuses the LAB122 page planner and the existing Android single foreground scheduler.
// Both stages are checkpointed in editionsV36; no background timers or duplicate writers.
import {apiEndpoint} from './apiEndpoint.js';
import {originalExplainedPagesV122} from './explainedPolicyV122.js';
import {planExplainedBlocksV122,explainedSnapshotV122,EXPLAINED_REQUEST_TIMEOUT_V122}
 from './explainedGeneratorV122.js';
import {EXPLAINED_POLICY_V126,EXPLAINED_AUDIT_V126,COMPREHENSION_REVISION_V126,
 auditComprehensionV126,auditExplainedPageV126,lessonPayloadV126,lessonInstructionV126,
 studyUnitsV126,auditExplainedPageV139} from './explainedStagesV126.js';
import {percentReduced} from './studyPillarV38.js';
import {nextLengthTargetScaleV140,targetScaleV140} from './explainedQualityV140.js';
import {MAX_CORRECTIONS_V127,repairAttemptV127,correctionRemainingV127,
 betterExplainedDraftV127,reservedExplainedPageV127,reserveAcceptedV127,
 usableExplainedDraftV127,
 reservationReportV127,reserveUnreadPageV127} from './explainedRepairV127.js';
import {V128_DEFAULT_BLOCK_CHARS,providerRecoveryStateV128,providerPauseV128,providerPauseV139,
 providerSuccessfulBlockV128} from './explainedProviderRecoveryV128.js';
import {modelComparisonStateV133,selectFreeStudyModelV133,
 recordFreeStudyModelV133,modelComparisonReportV133,
 STUDY_PRIMARY_MODEL_V134} from './explainedModelComparisonV133.js';

const MAX_STAGE_SOURCE=40000;
const TIMEOUT=EXPLAINED_REQUEST_TIMEOUT_V122;
const MAX_STAGE_INPUT_TOKENS=35000;
const MAX_STAGE_OUTPUT_TOKENS=30000;
const MAX_SPLITS=64; // isolate a failing page without stranding the remaining book
const V136_MIN_QUALITY_BLOCK_CHARS=8000; // Only poor *content*, never 503, reduces a future batch
const MAX_COMPREHENSION_TECH_ATTEMPTS=3; // initial + two targeted rereads
const isCooldown=(status,code)=>status===429||(status===503&&
 !['AI_NOT_CONFIGURED','AI_MODEL_NOT_ALLOWLISTED'].includes(code))||
 ((status===502||status===504)&&/AI_PROVIDER_(?:NETWORK|TIMEOUT|REJECTED)|V126_NETWORK/iu.test(code||''));
const isSplitCandidate=(status,code)=>status===413||
  (status===422&&['V126_OUTPUT_TRUNCATED','V126_PAGE_COUNT_OR_ORDER','V126_BLOCK_TOO_LARGE'].includes(code));
const pageWithSource=(original,answer)=>({
 id:original.id,label:original.label,physicalPage:original.physicalPage,
 sourcePage:original.physicalPage,
 segments:Array.isArray(answer?.segments)?answer.segments:[],
 glossary:Array.isArray(answer?.glossary)?answer.glossary:[],
 review:answer?.review||{ready:false,issues:['V126_DRAFT_UNVERIFIED']}
});
const totalSourceUnits=pages=>pages.reduce((n,p)=>n+studyUnitsV126(
 p.segments.map(s=>s.source).join('\n')),0);

async function requestPhaseV126(phase,pages,bookContext,signal,correction=false,modelCandidate=null,onePassV135=false,quickV139=false,focusedV140=false,targetScale=1,tailV141=false){
 const controller=new AbortController(),cancel=()=>controller.abort();
 signal?.addEventListener('abort',cancel,{once:true});
 if(signal?.aborted)cancel();
 const timeout=correction?100000:TIMEOUT;
 const timer=setTimeout(cancel,timeout);
 try{
  // V138 is a separate Worker contract. All older v126 / comprehension
  // callers stay on the existing immutable route.
  const route=phase==='explain'&&tailV141?'/api/explained/v141':
   phase==='explain'&&focusedV140?'/api/explained/v140':
   phase==='explain'&&quickV139?'/api/explained/v139':
   phase==='explain'&&onePassV135?'/api/explained/v138':'/api/explained/v126';
  const reply=await fetch(apiEndpoint(route),{
   method:'POST',signal:controller.signal,headers:{'Content-Type':'application/json'},
   body:JSON.stringify({policy:EXPLAINED_POLICY_V126,phase,pages,
     ...(phase==='explain'?{bookContext}:{}),
    modelCandidate:modelCandidate||STUDY_PRIMARY_MODEL_V134,
    ...(phase==='explain'&&onePassV135?{onePassV135:true}:{}),
    ...(phase==='explain'&&focusedV140?{targetScaleV140:targetScale}:{}),
    timeoutMs:correction?90000:150000})
  });
  const response=await reply.json().catch(()=>null);
  if(controller.signal.aborted)throw Object.assign(new Error('Interrotto'),{
   code:signal?.aborted?'V126_INTERRUPTED':'V126_REQUEST_TIMEOUT'});
  return {reply,response};
 }catch(err){
  if(err?.code)throw err;
  throw Object.assign(new Error('Worker non raggiungibile'),{
   code:signal?.aborted?'V126_INTERRUPTED':
    controller.signal.aborted?'V126_REQUEST_TIMEOUT':'V126_NETWORK'});
 }finally{
  clearTimeout(timer);signal?.removeEventListener('abort',cancel);
 }
}
function sourceEnvelope(p,repair=null,map=null){
 return {id:p.id,segments:p.segments.map(s=>({id:s.id,source:s.source})),
  sourceLineCount:p.sourceLineCount,
  ...(repair?{repair}:{}),...(map?{comprehension:map}:{})};
}
function globalContextV126(pages,maps){
 // A bounded guide to the whole book. Detailed local maps still travel with
 // their original full page in every explanation request.
 const notes=[];
 for(const p of pages){
  const record=maps.get(p.id);
  const concept=record?.segments?.flatMap(s=>s.concepts||[]).find(Boolean);
  if(concept)notes.push(p.id+': '+String(concept).slice(0,180));
 }
 if(notes.length<=80)return notes;
 const selected=[];
 for(let i=0;i<80;i++)selected.push(notes[Math.floor(i*(notes.length-1)/79)]);
 return [...new Set(selected)];
}
function planStageBlocksV126(pages,{stage,maps,context=[],
 maxSourceChars=V128_DEFAULT_BLOCK_CHARS}){
 const preliminary=planExplainedBlocksV122(pages,{
  maxChars:Math.min(MAX_STAGE_SOURCE,maxSourceChars),
  maxInputTokens:Math.min(MAX_STAGE_INPUT_TOKENS,Math.max(7000,maxSourceChars*2)),
  maxOutputTokens:Math.min(MAX_STAGE_OUTPUT_TOKENS,Math.max(7000,maxSourceChars*2))});
 if(stage!=='explain')return preliminary;
 const groups=[];
 const instructionSize=lessonInstructionV126().length;
 const payloadTokens=block=>{
  const enriched=block.map(p=>sourceEnvelope(p,p.repair,maps.get(p.id)));
  const json=JSON.stringify(lessonPayloadV126(enriched,
    enriched.map(x=>x.comprehension),context));
  return Math.ceil((json.length+instructionSize)/2.6);
 };
 for(const group of preliminary){
  let working=[];
  for(const p of group){
   if(working.length&&payloadTokens([...working,p])>MAX_STAGE_INPUT_TOKENS){
    groups.push(working);working=[];
   }
   working.push(p);
  }
  if(working.length)groups.push(working);
 }
 return groups;
}
function contextCheckpoint(originalPages,records){
 const completed=originalPages.filter(p=>!p.segments.length||
  auditComprehensionV126(p,records.get(p.id)).ready).length;
 const pages=originalPages.map(p=>records.get(p.id)||null);
 return {revision:COMPREHENSION_REVISION_V126,pages,
   complete:completed===originalPages.length,
   verifiedPages:completed,totalPages:originalPages.length};
}

export async function generateExplainedBookV126(book,{
 onProgress=async()=>{},onActivity=()=>{},signal=null,retryReviewed=false,
 fastLengthV139=false,glossaryPrecisionV140=false,tailReliableV141=false
}={}){
 const source=originalExplainedPagesV122(book);
 const previous=book?.editionsV36?.version===EXPLAINED_POLICY_V126&&
  book.editionsV36.sourceFingerprint===book.canonicalBookMap.originalFingerprint
   ?book.editionsV36:null;
 // New source books explicitly opt into one Gemini read+rewrite request per block.
 // Previous V126 checkpoints continue their exact two-stage path unless opted in.
 const onePassV135=previous?.onePassV135===true;
 const quickV139=Boolean(onePassV135&&fastLengthV139);
 const focusedV140=quickV139&&glossaryPrecisionV140===true;
 const tailV141=Boolean(focusedV140&&tailReliableV141);
 let lengthTargetScaleV140=targetScaleV140(previous?.lengthTargetScaleV140);
 const correctionLimit=quickV139?2:MAX_CORRECTIONS_V127;
 const maps=new Map(),saved=new Map(),rejected=new Set();
 // Persistent per-page correction state survives Android restarts.
 const repairs=new Map(Object.entries(previous?.repairStateV127||{}));
 const readAttempts=new Map(Object.entries(previous?.comprehensionAttemptsV127||{}));
 let providerRecoveryV128=providerRecoveryStateV128(previous?.providerRecoveryV128);
 let modelComparisonV133=modelComparisonStateV133(previous?.modelComparisonV133);
 // A low-yield HTTP-200 answer is not a provider outage. Replan only future
 // requests; the 40k transport cap and accepted checkpoints remain untouched.
 // LAB139: retire an inherited QUALITY-YIELD shrink. Use the existing
 // 40k-safe preflight; split only on real 413/422/truncation, not on
 // subjective AI acceptance. Never change the provider transport cap.
 let qualityBlockCharsV136=quickV139?MAX_STAGE_SOURCE:
  Math.max(V136_MIN_QUALITY_BLOCK_CHARS,
   Math.min(MAX_STAGE_SOURCE,Number(previous?.qualityBlockCharsV136)||MAX_STAGE_SOURCE));
 const markUnread=(p,code='')=>{
  const tries=Number(readAttempts.get(p.id)?.tries||0)+1;
  readAttempts.set(p.id,{tries,lastCode:String(code||'').slice(0,150)});
  if(tries>=MAX_COMPREHENSION_TECH_ATTEMPTS)
   saved.set(p.id,reserveUnreadPageV127(p));
 };
 const markAttempt=(p,code='')=>{
  const updated=repairAttemptV127(repairs.get(p.id),code);
  repairs.set(p.id,updated);
  if(updated.corrections>=correctionLimit){
   const fallback=reservedExplainedPageV127(p,saved.get(p.id),updated,
    {terminalCorrectionLimit:correctionLimit});
   saved.set(p.id,fallback);rejected.delete(p.id);
  }
  return updated;
 };
 source.forEach((p,i)=>{
  if(!p.segments.length)return;
  const oldMap=previous?.comprehensionV126?.pages?.[i];
  if(oldMap?.id===p.id)maps.set(p.id,{...oldMap,
    review:auditComprehensionV126(p,oldMap)});
  const oldPage=previous?.pages?.[i];
  // A verified page in the SAME source fingerprint has already passed the
  // previous mandatory audit. Never silently demote 9/44 to 0/44 merely
  // because the next APK calibrates short-page rules. Preserve the original
  // review and protect the page from repeat provider calls.
  if(oldPage?.id===p.id&&oldPage.review?.ready===true&&
     usableExplainedDraftV127(p,oldPage)){
   saved.set(p.id,pageWithSource(p,oldPage));
  }else if(oldPage?.id===p.id&&reserveAcceptedV127(p,oldPage)){
   // A previous semantic-only reservation may already meet the new 50%
   // LENGTH contract. Promote locally without asking Gemini again.
   const localReview=quickV139&&!oldPage.review?.sourceTextFallback?
    auditExplainedPageV139(p,oldPage):null;
   saved.set(p.id,localReview?.ready?
    pageWithSource(p,{...oldPage,review:localReview}):
    pageWithSource(p,oldPage));
  }else if(oldPage?.id===p.id&&(onePassV135||maps.get(p.id)?.review?.ready===true)){
   {
    const check=quickV139?auditExplainedPageV139(p,oldPage):
     auditExplainedPageV126(p,oldPage,maps.get(p.id),
      {onePassV135,strictSourceLinesV138:onePassV135});
    saved.set(p.id,pageWithSource(p,{...oldPage,review:check}));
    if(!check.ready){
     rejected.add(p.id);
     if(!repairs.has(p.id))repairs.set(p.id,{initial:true,corrections:0});
    }
   }
  }
  // LAB141: repairState may already be exhausted from a LAB139/140 APK,
  // but its reservation was never recognized because the old gate wanted
  // five attempts. Migrate the EXACT saved draft locally, no Gemini call.
  const entry=saved.get(p.id),oldRepair=repairs.get(p.id);
  const exhausted=Number(oldRepair?.corrections||0)>=correctionLimit||
   (entry?.review?.acceptedWithReserve===true&&
    Number(entry.review.correctionAttempts||0)>=correctionLimit);
  if(quickV139&&entry&&!entry.review?.ready&&
     !reserveAcceptedV127(p,entry)&&exhausted){
   const state={...oldRepair,initial:true,corrections:correctionLimit,
    lastCode:oldRepair?.lastCode||'V141_PREVIOUS_LIMIT_REACHED'};
   repairs.set(p.id,state);
   saved.set(p.id,reservedExplainedPageV127(p,entry,state,
    {terminalCorrectionLimit:correctionLimit}));
   rejected.delete(p.id);
  }
 });
 const diagnosticBefore=previous?.diagnostics||{};
 const diagnostics={
  requestsSent:0,providerErrors:0,qualityReview:rejected.size,
  originalPages:source.length,stage:'comprehension',
  mode:onePassV135?'lab135-one-gemini-pass':'lab128-overload-backoff-and-provisional-pdf',
  priorProviderErrors:Number(diagnosticBefore.providerErrors||0),
  failedPages:[],preflightProviderCalls:0
 };
 let lastError=null;
 const publish=async(status,meta={})=>{
  const comprehensionV126=contextCheckpoint(source,maps);
  const snapshot=explainedSnapshotV122(book,source,[...saved.values()],status,diagnostics);
  const unitSource=totalSourceUnits(source);
  const unitOutput=source.reduce((n,p)=>n+studyUnitsV126(
    (saved.get(p.id)?.segments||[]).map(s=>String(s?.text||''))
      .join('\n').replace(/\*\*/gu,'')),0);
  const accepted=source.filter(p=>saved.get(p.id)?.review?.ready===true).length;
  // A factual precision KPI based only on accepted long pages. No semantic
  // auditing, Gemini calls or regeneration, even for large textbooks.
  const measuredReductions=focusedV140?source.map(p=>saved.get(p.id)?.review)
   .filter(r=>r?.ready===true&&!r.shortPage&&Number.isFinite(r.exactReduction))
   .map(r=>r.exactReduction):[];
  const precisionV140=focusedV140?{
   pagesMeasured:measuredReductions.length,
   meanDeviation:measuredReductions.length?Math.round(
    measuredReductions.reduce((a,v)=>a+Math.abs(v-50),0)/
     measuredReductions.length*10)/10:null,
   nearTargetPages:measuredReductions.filter(v=>Math.abs(v-50)<=5).length
  }:null;
  const reserved=source.filter(p=>reserveAcceptedV127(p,saved.get(p.id))).length;
  const incomplete=source.filter(p=>p.segments.length&&
    saved.get(p.id)?.review?.ready!==true&&
    !reserveAcceptedV127(p,saved.get(p.id))).length;
  const unread=onePassV135?0:source.filter(p=>p.segments.length&&
    maps.get(p.id)?.review?.ready!==true&&
    !reserveAcceptedV127(p,saved.get(p.id))).length;
  const done=accepted+reserved===source.length;
  const anomalies=reservationReportV127([...saved.values()]);
  const draftReduction=saved.size&&unitSource?
    percentReduced(unitSource,unitOutput):null;
  // Local diagnostics: show where requests are spent without uploading book
  // content, source text, names, identifiers or API secrets.
  const issueCounts=new Map();
  for(const entry of saved.values()){
   if(entry?.review?.ready===true)continue;
   for(const issue of entry?.review?.issues||[]){
    const code=String(issue||'').split(':')[0].slice(0,65);
    if(code)issueCounts.set(code,(issueCounts.get(code)||0)+1);
   }
  }
  const topIssues=[...issueCounts.entries()]
   .sort((a,b)=>b[1]-a[1]).slice(0,5)
   .map(([code,pages])=>({code,pages}));
  const s={...snapshot,version:EXPLAINED_POLICY_V126,
   onePassV135,qualityBlockCharsV136,lengthOnlyV139:quickV139,
   glossaryPrecisionV140:focusedV140,tailReliableV141:tailV141,
   lengthTargetScaleV140,precisionV140,
   verificationScope:quickV139?'length-and-structure-only':'legacy-didactic-audit',
   localReadV135:onePassV135?{pages:source.length,total:source.length,
    method:'verified-local-source',semanticCertified:false}:null,
   comprehensionV126,complete:done,
   status:done?(reserved?'complete-with-reservations':'complete'):status,
   completeWithReservations:done&&reserved>0,
   reservedPagesV127:anomalies,repairStateV127:Object.fromEntries(repairs),
   comprehensionAttemptsV127:Object.fromEntries(readAttempts),
   providerRecoveryV128,modelComparisonV133,
   phase:done?'quality':onePassV135||accepted+reserved>0||comprehensionV126.complete?'draft':'comprehension',
   sourceUnits:unitSource,outputUnits:unitOutput,
   achievedReduction:done&&!reserved?percentReduced(unitSource,unitOutput):null,
   draftAchievedReduction:draftReduction,
   verifiedChunkVariants:accepted,verifiedChunks:accepted,blockedCells:source.length-accepted-reserved,
   draftUnitsSaved:saved.size,acceptedWithReserveV127:reserved,
   semanticCertified:false,
   diagnostics:{...diagnostics,comprehensionPages:comprehensionV126.verifiedPages,
     comprehensionTotal:source.length,qualityReview:incomplete,
     understandingPending:unread,explanationPending:incomplete,
     correctionPending:rejected.size,reservedPages:reserved,
     providerOverloadStrikes:providerRecoveryV128.overloadStrikes,
     providerMaxBlockChars:providerRecoveryV128.maxBlockChars,
     draftedPages:saved.size,topIssues,
     modelComparisonV133:modelComparisonReportV133(modelComparisonV133)}};
  await onProgress(s,meta);
  return s;
 };
 // Existing verified zero-text original pages pass through unchanged.
 for(const p of source.filter(p=>!p.segments.length)){
  saved.set(p.id,pageWithSource(p,{segments:[],glossary:[],review:{
   ready:true,issues:[],sizeCompliant:true,sourceUnits:0,outputUnits:0,
   auditRevision:EXPLAINED_AUDIT_V126,semanticCertified:false}}));
 }
 const runStage=async(phase,initial,{correction=false}={})=>{
  const context=phase==='explain'?globalContextV126(source,maps):[];
  const queue=planStageBlocksV126(initial,{stage:phase,maps,context,
   maxSourceChars:Math.min(providerRecoveryV128.maxBlockChars,qualityBlockCharsV136)});
  diagnostics.stage=phase==='comprehend'?'comprehension':'explanation';
  diagnostics.plannedRequests=queue.length;
  diagnostics.plannedPagesPerRequest=queue.map(b=>b.length);
  diagnostics.splits=0;
  let consecutiveTransportErrors=0;
  await publish(phase==='comprehend'?'comprehension':'partial',{persist:false});
  for(let index=0;index<queue.length;index++){
   const group=queue[index];
   if(signal?.aborted){lastError='V126_INTERRUPTED';break;}
   const pages=group.map(p=>{
    const envelope=sourceEnvelope(p,p.repair,
      phase==='explain'?maps.get(p.id):null);
    const reviewIssues=maps.get(p.id)?.review?.issues;
    return phase==='comprehend'&&Array.isArray(reviewIssues)&&reviewIssues.length
     ?{...envelope,comprehensionRepair:reviewIssues}:envelope;
   });
   const modelCandidate=selectFreeStudyModelV133(modelComparisonV133);
   const modelStartedAt=Date.now();
   const modelSourceChars=pages.reduce((n,p)=>n+p.segments.reduce((v,s)=>v+s.source.length,0),0);
   diagnostics.activeModel=modelCandidate;
   diagnostics.activePages=group.map(p=>p.physicalPage);
   diagnostics.correctionCycle=correction?Math.max(1,...group.map(p=>
    Number(repairs.get(p.id)?.corrections||0)+1)):0;
   await publish(phase==='comprehend'?'comprehension':'partial',{persist:false});
   onActivity({phase:phase==='comprehend'?'book-comprehension':
     correction?'explained-page-repair':'explained-page-block',
    pageStart:group[0].physicalPage,pageEnd:group.at(-1).physicalPage,
    pages:group.length,stage:phase,correctionCycle:correction?
     Math.max(1,...group.map(p=>Number(repairs.get(p.id)?.corrections||0)+1)):0,
    correctionMax:correctionLimit});
   try{
    const {reply,response}=await requestPhaseV126(phase,pages,context,signal,
    correction,modelCandidate,onePassV135,quickV139,focusedV140,lengthTargetScaleV140,tailV141);
   if(modelCandidate&&Number.isFinite(reply.status)){
    const reportedModel=response?.model||modelCandidate;
    const received=Array.isArray(response?.pages)?response.pages.length:0;
    const verified=Array.isArray(response?.pages)?
     response.pages.filter(p=>p?.review?.ready===true).length:0;
    modelComparisonV133=recordFreeStudyModelV133(modelComparisonV133,{
     model:reportedModel,status:reply.status,elapsedMs:Date.now()-modelStartedAt,
     sourceChars:modelSourceChars,receivedPages:received,readyPages:verified});
   }
    consecutiveTransportErrors=0;
    diagnostics.requestsSent++;
    if(reply.ok&&response?.repairContractV127!=='lab127-automatic-recovery-v1'){
     lastError='V127_WORKER_UPDATE_REQUIRED';
     diagnostics.lastCode=lastError;
     diagnostics.lastProviderCode=lastError;
     break;
    }
    if(!reply.ok){
     const code=response?.code||'HTTP_'+reply.status;
     diagnostics.providerErrors++;
     diagnostics.lastProviderCode=code;
     diagnostics.lastHttpStatus=reply.status;
     if(['AI_NOT_CONFIGURED','AI_MODEL_NOT_ALLOWLISTED','METHOD_NOT_ALLOWED'].includes(code)){
      lastError=code;break;
     }
     if(isCooldown(reply.status,code)){
      const pause=(quickV139&&reply.status===503?
       providerPauseV139:providerPauseV128)(providerRecoveryV128,{
       httpStatus:reply.status,code,
       retryAfterSeconds:response?.retryAfterSeconds??
        reply.headers?.get?.('Retry-After')??null
      });
      providerRecoveryV128=pause.state;
      diagnostics.retryAt=pause.retryAt;
      diagnostics.retrySeconds=pause.seconds;
      diagnostics.retryReason=code;lastError=code;break;
     }
     // HTTP 413/422/invalid-source: isolate the single failing page.
     // Other pages continue, instead of blocking a 44- or 2000-page book.
     if((isSplitCandidate(reply.status,code)||
       (reply.status===400&&code.startsWith('V126_SOURCE_'))) &&
       group.length>1&&diagnostics.splits<MAX_SPLITS){
      const mid=Math.floor(group.length/2);
      queue.splice(index,1,group.slice(0,mid),group.slice(mid));
      diagnostics.splits++;index--;continue;
     }
     diagnostics.lastCode=code;
     diagnostics.failedPages.push(...group.map(p=>p.physicalPage));
     if(phase==='explain')for(const p of group)markAttempt(p,code);
     else for(const p of group)markUnread(p,code);
     await publish(phase==='comprehend'?'comprehension':'partial');
     continue;
    }
    const validShape=response?.engine==='ai'&&
      response?.version===EXPLAINED_POLICY_V126&&
      response.phase===phase&&Array.isArray(response.pages)&&
      response.pages.length===group.length;
    const validIds=validShape&&response.pages.every((a,i)=>a?.id===group[i].id);
    if(!validIds){
     const code=validShape?'V126_PAGE_ID_MISMATCH':'V126_BACKEND_CONTRACT_MISMATCH';
     diagnostics.lastCode=code;
     if(group.length>1&&diagnostics.splits<MAX_SPLITS){
      const mid=Math.floor(group.length/2);
      queue.splice(index,1,group.slice(0,mid),group.slice(mid));
      diagnostics.splits++;index--;continue;
     }
     diagnostics.failedPages.push(...group.map(p=>p.physicalPage));
     if(phase==='explain')for(const p of group)markAttempt(p,code);
     else for(const p of group)markUnread(p,code);
     await publish(phase==='comprehend'?'comprehension':'partial');
     continue;
    }
    for(let i=0;i<group.length;i++){
     const p=group[i],ans=response.pages[i];
     if(phase==='comprehend'){
      const map={...ans,review:auditComprehensionV126(p,ans)};
      maps.set(p.id,map);
      if(!map.review.ready)markUnread(p,map.review.issues?.[0]);
      else readAttempts.delete(p.id);
     }else{
      const review=quickV139?auditExplainedPageV139(p,ans):
       auditExplainedPageV126(p,ans,maps.get(p.id),
        {onePassV135,strictSourceLinesV138:onePassV135});
      if(saved.get(p.id)?.review?.ready===true&&!review.ready)continue;
      const candidate=pageWithSource(p,{...ans,review});
      const earlier=saved.get(p.id);
      const best=betterExplainedDraftV127(p,earlier,candidate);
      saved.set(p.id,best);
      if(review.ready){
       // Count a successful repair too; only failed fifth calls enter reserve.
       if(repairs.get(p.id)?.initial===true)
        repairs.set(p.id,repairAttemptV127(repairs.get(p.id)));
       rejected.delete(p.id);
      }else{
       rejected.add(p.id);
       // Save the previous no-improvement streak BEFORE markAttempt:
       // repairAttemptV127 returns a fresh object and intentionally drops
       // fields beyond initial/corrections/lastCode.
       const priorRepair=repairs.get(p.id);
       const stagnated=earlier?.review?.ready===false&&best===earlier;
       const updated=markAttempt(p,review.issues?.[0]||'V127_REWRITE_NOT_VERIFIED');
       const consecutive=stagnated?Number(priorRepair?.stagnantV136||0)+1:0;
       repairs.set(p.id,{...updated,stagnantV136:consecutive});
       // Two failed attempts with NO better draft should not make three more
       // identical paid requests. Preserve best text explicitly WITH RESERVE.
       if(consecutive>=2&&!reserveAcceptedV127(p,saved.get(p.id))){
        const state={...repairs.get(p.id),corrections:correctionLimit,
          lastCode:'V141_NO_LENGTH_IMPROVEMENT'};
        repairs.set(p.id,state);
        saved.set(p.id,reservedExplainedPageV127(p,best,state,
         {terminalCorrectionLimit:correctionLimit}));
        rejected.delete(p.id);
       }
      }
     }
    }
    // LAB140 learns from the length of pages ALREADY received. This is a
    // pure scalar update, not a new Gemini call, semantic audit or rewrite.
    if(phase==='explain'&&focusedV140)
     lengthTargetScaleV140=nextLengthTargetScaleV140(lengthTargetScaleV140,
      group.map(p=>saved.get(p.id)?.review));
    // An HTTP-200 batch with too few conforming pages is a content-yield
    // problem. Reduce ONLY remaining blocks, never repeat already-sent pages.
    // The first/last batch can itself have near-zero usable output.
    // Persist a smaller cap for the very NEXT correction/resume even when
    // this was the only remaining block. This is an HTTP200 content-yield
    // adaptation, NEVER a reaction to 503 or a fabricated token limit.
    if(phase==='explain'&&group.length>=2&&!quickV139){
     const acceptedInBlock=group.filter(p=>saved.get(p.id)?.review?.ready===true).length;
     if(acceptedInBlock*4<group.length&&
         qualityBlockCharsV136>V136_MIN_QUALITY_BLOCK_CHARS){
      const previousCap=qualityBlockCharsV136;
      qualityBlockCharsV136=Math.max(V136_MIN_QUALITY_BLOCK_CHARS,
        Math.floor(qualityBlockCharsV136*0.5));
      diagnostics.qualityBackpressureV136=true;
      diagnostics.lowYieldBlocksV138=(diagnostics.lowYieldBlocksV138||0)+1;
      diagnostics.qualityBlockReducedFromV138=previousCap;
      // Replan only unsent pages. Never regenerate accepted pages or repeat
      // already-sent calls merely because quality was poor.
      if(index+1<queue.length){
       const remaining=queue.slice(index+1).flat();
       const replan=planStageBlocksV126(remaining,{stage:phase,maps,context,
        maxSourceChars:Math.min(providerRecoveryV128.maxBlockChars,qualityBlockCharsV136)});
       queue.splice(index+1,queue.length-index-1,...replan);
       diagnostics.plannedRequests=queue.length;
      }
     }
    }
    const blockLimitBefore=providerRecoveryV128.maxBlockChars;
    providerRecoveryV128=providerSuccessfulBlockV128(providerRecoveryV128);
    if(providerRecoveryV128.maxBlockChars!==blockLimitBefore&&index+1<queue.length){
     // Replan only NOT-YET-SENT pages, so two successful blocks actually
     // increase packet sizes immediately rather than on the next restart.
     const remaining=queue.slice(index+1).flat();
     const replanned=planStageBlocksV126(remaining,{
      stage:phase,maps,context,
      maxSourceChars:Math.min(providerRecoveryV128.maxBlockChars,qualityBlockCharsV136)
     });
     queue.splice(index+1,queue.length-index-1,...replanned);
     diagnostics.plannedRequests=queue.length;
    }
    diagnostics.lastHttpStatus=200;
    diagnostics.lastBlockPages=group.length;
    diagnostics.activePages=[];
    await publish(phase==='comprehend'?'comprehension':'partial');
   }catch(err){
    const code=signal?.aborted?'V126_INTERRUPTED':err?.code||'V126_NETWORK';
    diagnostics.providerErrors++;
    if(signal?.aborted){lastError=code;break;}
    if(group.length>1&&diagnostics.splits<MAX_SPLITS){
     const mid=Math.floor(group.length/2);
     queue.splice(index,1,group.slice(0,mid),group.slice(mid));
     diagnostics.splits++;index--;continue;
    }
    diagnostics.failedPages.push(...group.map(p=>p.physicalPage));
    diagnostics.lastCode=code;
    if(phase==='explain')for(const p of group)markAttempt(p,code);
    else for(const p of group)markUnread(p,code);
    // If the connection itself fails repeatedly, respect a real cooldown
    // instead of issuing hundreds of doomed requests on a 2000-page book.
    consecutiveTransportErrors++;
    if(consecutiveTransportErrors>=3){
     lastError=code;
     const pause=providerPauseV128(providerRecoveryV128,{
      httpStatus:0,code,retryAfterSeconds:null
     });
     providerRecoveryV128=pause.state;
     diagnostics.retryAt=pause.retryAt;
     diagnostics.retrySeconds=pause.seconds;
     break;
    }
    await publish(phase==='comprehend'?'comprehension':'partial');
   }
  }
  diagnostics.activePages=[];
  diagnostics.correctionCycle=0;
 };
 // First scan ALL source pages, regardless of paragraph/page segmentation.
 const missingUnderstanding=()=>source.filter(p=>p.segments.length&&
  maps.get(p.id)?.review?.ready!==true&&
  !reserveAcceptedV127(p,saved.get(p.id)));
 const unread=onePassV135?[]:missingUnderstanding();
 if(unread.length)await runStage('comprehend',unread);
 for(let cycle=1;!onePassV135&&cycle<MAX_COMPREHENSION_TECH_ATTEMPTS&&!lastError;cycle++){
  const missing=missingUnderstanding();
  if(!missing.length)break;
  await runStage('comprehend',missing);
 }
 const checked=contextCheckpoint(source,maps);
 if(lastError){
  diagnostics.stage='comprehension';
  diagnostics.lastCode=lastError;
  return publish(diagnostics.retryAt?'quota-paused':
   lastError==='V126_INTERRUPTED'?'interrupted':'provider-blocked');
 }
 // LAB127: comprehension attempts run first, but one invalid/missing page
 // cannot prevent explanation of the other pages that were actually read.
 // Each page still needs its OWN valid map before it can be explained.
 diagnostics.globalComprehensionGate=onePassV135?
  'local-source-'+source.length+'-of-'+source.length:
  checked.complete?'verified-'+source.length+'-of-'+source.length:
  'partial-'+checked.verifiedPages+'-of-'+source.length;
 const pendingPages=()=>source.filter(p=>p.segments.length&&
  (onePassV135||maps.get(p.id)?.review?.ready===true)&&
  saved.get(p.id)?.review?.ready!==true&&
  !reserveAcceptedV127(p,saved.get(p.id)));
 const repairInput=p=>{
  const previousDraft=saved.get(p.id);
  const state=repairs.get(p.id);
  const issues=previousDraft?.review?.issues||[];
  return {...p,repair:{
   ...(previousDraft?.review?.repair||{}),
   issueCodes:[...new Set(issues.map(x=>String(x).split(':')[0]))].slice(0,15),
   previousDraft:previousDraft?.segments?.length?{
    segments:previousDraft.segments.map(s=>({id:s.id,text:s.text})),
    glossary:previousDraft.glossary||[]}:null,
   previousReduction:previousDraft?.review?.reduction??null,
   correctionCycle:Number(state?.corrections||0)+1,
   correctionStrategy:['mirata','guidata','strutturale','concetti','finale'][
    Math.min(4,Number(state?.corrections||0))]}};
 };
 const initial=pendingPages().map(p=>repairs.get(p.id)?.initial
  ?repairInput(p):p);
 if(initial.length)await runStage('explain',initial,{
  correction:initial.every(p=>repairs.get(p.id)?.initial)});
 // A quality failure is recoverable locally, without making the user
 // tap the button or restarting the whole book. Only rejected pages return.
 for(let round=0;round<correctionLimit&&!lastError;round++){
  const retry=pendingPages().filter(p=>correctionRemainingV127(
   repairs.get(p.id))>0&&Number(repairs.get(p.id)?.corrections||0)<correctionLimit);
  if(!retry.length)break;
  await runStage('explain',retry.map(repairInput),{correction:true});
 }
 // Count only ACTUALLY unfinished pages. The old one-pass code counted
 // already-verified pages as missing because they have no comprehension map,
 // and then attempted pointless quality resumes at 41/44.
 diagnostics.qualityReview=source.filter(p=>p.segments.length&&
  saved.get(p.id)?.review?.ready!==true&&
  !reserveAcceptedV127(p,saved.get(p.id))).length;
 diagnostics.lastCode=lastError||diagnostics.lastCode||null;
 if(!lastError&&diagnostics.qualityReview)
  diagnostics.nextReviewAt=new Date(Date.now()+45000).toISOString();
 return publish(lastError?(diagnostics.retryAt?'quota-paused':
   lastError==='V126_INTERRUPTED'?'interrupted':'provider-blocked'):
   diagnostics.qualityReview?'quality-review':'partial');
}