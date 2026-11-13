// LAB126 native orchestration: comprehension of ALL original pages, then explanation.
// Reuses the LAB122 page planner and the existing Android single foreground scheduler.
// Both stages are checkpointed in editionsV36; no background timers or duplicate writers.
import {apiEndpoint} from './apiEndpoint.js';
import {originalExplainedPagesV122} from './explainedPolicyV122.js';
import {planExplainedBlocksV122,explainedSnapshotV122,EXPLAINED_REQUEST_TIMEOUT_V122}
 from './explainedGeneratorV122.js';
import {EXPLAINED_POLICY_V126,EXPLAINED_AUDIT_V126,COMPREHENSION_REVISION_V126,
 auditComprehensionV126,auditExplainedPageV126,lessonPayloadV126,lessonInstructionV126,
 studyUnitsV126} from './explainedStagesV126.js';
import {percentReduced} from './studyPillarV38.js';
import {MAX_CORRECTIONS_V127,repairAttemptV127,correctionRemainingV127,
 betterExplainedDraftV127,reservedExplainedPageV127,reserveAcceptedV127,
 reservationReportV127,reserveUnreadPageV127} from './explainedRepairV127.js';

const MAX_STAGE_SOURCE=30000;
const TIMEOUT=EXPLAINED_REQUEST_TIMEOUT_V122;
const MAX_STAGE_INPUT_TOKENS=30000;
const MAX_STAGE_OUTPUT_TOKENS=30000;
const MAX_SPLITS=64; // isolate a failing page without stranding the remaining book
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

async function requestPhaseV126(phase,pages,bookContext,signal,correction=false){
 const controller=new AbortController(),cancel=()=>controller.abort();
 signal?.addEventListener('abort',cancel,{once:true});
 if(signal?.aborted)cancel();
 const timeout=correction?100000:TIMEOUT;
 const timer=setTimeout(cancel,timeout);
 try{
  const reply=await fetch(apiEndpoint('/api/explained/v126'),{
   method:'POST',signal:controller.signal,headers:{'Content-Type':'application/json'},
   body:JSON.stringify({policy:EXPLAINED_POLICY_V126,phase,pages,
     ...(phase==='explain'?{bookContext}:{}),timeoutMs:correction?90000:150000})
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
function planStageBlocksV126(pages,{stage,maps,context=[]}){
 const preliminary=planExplainedBlocksV122(pages,{
  maxChars:MAX_STAGE_SOURCE,maxInputTokens:MAX_STAGE_INPUT_TOKENS,
  maxOutputTokens:MAX_STAGE_OUTPUT_TOKENS});
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
 onProgress=async()=>{},onActivity=()=>{},signal=null,retryReviewed=false
}={}){
 const source=originalExplainedPagesV122(book);
 const previous=book?.editionsV36?.version===EXPLAINED_POLICY_V126&&
  book.editionsV36.sourceFingerprint===book.canonicalBookMap.originalFingerprint
   ?book.editionsV36:null;
 const maps=new Map(),saved=new Map(),rejected=new Set();
 // Persistent per-page correction state survives Android restarts.
 const repairs=new Map(Object.entries(previous?.repairStateV127||{}));
 const readAttempts=new Map(Object.entries(previous?.comprehensionAttemptsV127||{}));
 const markUnread=(p,code='')=>{
  const tries=Number(readAttempts.get(p.id)?.tries||0)+1;
  readAttempts.set(p.id,{tries,lastCode:String(code||'').slice(0,150)});
  if(tries>=MAX_COMPREHENSION_TECH_ATTEMPTS)
   saved.set(p.id,reserveUnreadPageV127(p));
 };
 const markAttempt=(p,code='')=>{
  const updated=repairAttemptV127(repairs.get(p.id),code);
  repairs.set(p.id,updated);
  if(updated.corrections>=MAX_CORRECTIONS_V127){
   const fallback=reservedExplainedPageV127(p,saved.get(p.id),updated);
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
  if(oldPage?.id===p.id&&reserveAcceptedV127(p,oldPage)){
   saved.set(p.id,pageWithSource(p,oldPage));
  }else if(oldPage?.id===p.id&&maps.get(p.id)?.review?.ready===true){
   {
    const check=auditExplainedPageV126(p,oldPage,maps.get(p.id));
    saved.set(p.id,pageWithSource(p,{...oldPage,review:check}));
    if(!check.ready){
     rejected.add(p.id);
     if(!repairs.has(p.id))repairs.set(p.id,{initial:true,corrections:0});
    }
   }
  }
 });
 const diagnosticBefore=previous?.diagnostics||{};
 const diagnostics={
  requestsSent:0,providerErrors:0,qualityReview:rejected.size,
  originalPages:source.length,stage:'comprehension',
  mode:'lab126-understand-entire-book-first',
  priorProviderErrors:Number(diagnosticBefore.providerErrors||0),
  failedPages:[],preflightProviderCalls:0
 };
 let lastError=null;
 const publish=async(status,meta={})=>{
  const comprehensionV126=contextCheckpoint(source,maps);
  const snapshot=explainedSnapshotV122(book,source,[...saved.values()],status,diagnostics);
  const unitSource=totalSourceUnits(source);
  const unitOutput=source.reduce((n,p)=>n+(
    saved.get(p.id)?.review?.outputUnits||0),0);
  const accepted=source.filter(p=>saved.get(p.id)?.review?.ready===true).length;
  const reserved=source.filter(p=>reserveAcceptedV127(p,saved.get(p.id))).length;
  const unread=source.filter(p=>p.segments.length&&
    maps.get(p.id)?.review?.ready!==true).length;
  const done=accepted+reserved===source.length;
  const anomalies=reservationReportV127([...saved.values()]);
  const draftReduction=saved.size&&unitSource?
    percentReduced(unitSource,unitOutput):null;
  const s={...snapshot,version:EXPLAINED_POLICY_V126,
   comprehensionV126,complete:done,
   status:done?(reserved?'complete-with-reservations':'complete'):status,
   completeWithReservations:done&&reserved>0,
   reservedPagesV127:anomalies,repairStateV127:Object.fromEntries(repairs),
   comprehensionAttemptsV127:Object.fromEntries(readAttempts),
   phase:done?'quality':accepted+reserved>0||comprehensionV126.complete?'draft':'comprehension',
   sourceUnits:unitSource,outputUnits:unitOutput,
   achievedReduction:done&&!reserved?percentReduced(unitSource,unitOutput):null,
   draftAchievedReduction:draftReduction,
   verifiedChunkVariants:accepted,verifiedChunks:accepted,blockedCells:source.length-accepted-reserved,
   draftUnitsSaved:saved.size,acceptedWithReserveV127:reserved,
   semanticCertified:false,
   diagnostics:{...diagnostics,comprehensionPages:comprehensionV126.verifiedPages,
     comprehensionTotal:source.length,qualityReview:unread+rejected.size,
     understandingPending:unread,explanationPending:source.length-accepted-reserved,
     correctionPending:rejected.size,reservedPages:reserved}};
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
  const queue=planStageBlocksV126(initial,{stage:phase,maps,context});
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
   diagnostics.activePages=group.map(p=>p.physicalPage);
   diagnostics.correctionCycle=correction?Math.max(1,...group.map(p=>
    Number(repairs.get(p.id)?.corrections||0)+1)):0;
   await publish(phase==='comprehend'?'comprehension':'partial',{persist:false});
   onActivity({phase:phase==='comprehend'?'book-comprehension':
     correction?'explained-page-repair':'explained-page-block',
    pageStart:group[0].physicalPage,pageEnd:group.at(-1).physicalPage,
    pages:group.length,stage:phase,correctionCycle:correction?
     Math.max(1,...group.map(p=>Number(repairs.get(p.id)?.corrections||0)+1)):0,
    correctionMax:MAX_CORRECTIONS_V127});
   try{
    const {reply,response}=await requestPhaseV126(phase,pages,context,signal,correction);
    consecutiveTransportErrors=0;
    diagnostics.requestsSent++;
    if(!reply.ok){
     const code=response?.code||'HTTP_'+reply.status;
     diagnostics.providerErrors++;
     diagnostics.lastProviderCode=code;
     diagnostics.lastHttpStatus=reply.status;
     if(['AI_NOT_CONFIGURED','AI_MODEL_NOT_ALLOWLISTED','METHOD_NOT_ALLOWED'].includes(code)){
      lastError=code;break;
     }
     if(isCooldown(reply.status,code)){
      const rawSeconds=Number(response?.retryAfterSeconds??
       reply.headers?.get?.('Retry-After')??90);
      diagnostics.retryAt=new Date(Date.now()+Math.max(60,
       Math.min(172800,Number.isFinite(rawSeconds)&&rawSeconds>0?rawSeconds:90))*1000).toISOString();
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
      const review=auditExplainedPageV126(p,ans,maps.get(p.id));
      if(saved.get(p.id)?.review?.ready===true&&!review.ready)continue;
      const candidate=pageWithSource(p,{...ans,review});
      const best=betterExplainedDraftV127(p,saved.get(p.id),candidate);
      saved.set(p.id,best);
      if(review.ready){
       rejected.delete(p.id);
      }else{
       rejected.add(p.id);
       markAttempt(p,review.issues?.[0]||'V127_REWRITE_NOT_VERIFIED');
      }
     }
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
     diagnostics.retryAt=new Date(Date.now()+120000).toISOString();
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
 const unread=missingUnderstanding();
 if(unread.length)await runStage('comprehend',unread);
 for(let cycle=1;cycle<MAX_COMPREHENSION_TECH_ATTEMPTS&&!lastError;cycle++){
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
 diagnostics.globalComprehensionGate=checked.complete
  ?'verified-'+source.length+'-of-'+source.length
  :'partial-'+checked.verifiedPages+'-of-'+source.length;
 const pendingPages=()=>source.filter(p=>p.segments.length&&
  maps.get(p.id)?.review?.ready===true&&
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
    Math.min(4,Number(state?.corrections||0))]}}};
 };
 const initial=pendingPages().map(p=>repairs.get(p.id)?.initial
  ?repairInput(p):p);
 if(initial.length)await runStage('explain',initial,{
  correction:initial.every(p=>repairs.get(p.id)?.initial)});
 // A quality failure is recoverable locally, without making the user
 // tap the button or restarting the whole book. Only rejected pages return.
 for(let round=0;round<MAX_CORRECTIONS_V127&&!lastError;round++){
  const retry=pendingPages().filter(p=>correctionRemainingV127(
   repairs.get(p.id))>0);
  if(!retry.length)break;
  await runStage('explain',retry.map(repairInput),{correction:true});
 }
 diagnostics.qualityReview=rejected.size+source.filter(p=>p.segments.length&&
  maps.get(p.id)?.review?.ready!==true).length;
 diagnostics.lastCode=lastError||diagnostics.lastCode||null;
 if(!lastError&&diagnostics.qualityReview)
  diagnostics.nextReviewAt=new Date(Date.now()+45000).toISOString();
 return publish(lastError?(diagnostics.retryAt?'quota-paused':
   lastError==='V126_INTERRUPTED'?'interrupted':'provider-blocked'):
   diagnostics.qualityReview?'quality-review':'partial');
}