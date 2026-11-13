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

const MAX_STAGE_SOURCE=30000;
const TIMEOUT=EXPLAINED_REQUEST_TIMEOUT_V122;
const MAX_STAGE_INPUT_TOKENS=30000;
const MAX_STAGE_OUTPUT_TOKENS=30000;
const MAX_SPLITS=12;
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

async function requestPhaseV126(phase,pages,bookContext,signal){
 const controller=new AbortController(),cancel=()=>controller.abort();
 signal?.addEventListener('abort',cancel,{once:true});
 if(signal?.aborted)cancel();
 const timer=setTimeout(cancel,TIMEOUT);
 try{
  const reply=await fetch(apiEndpoint('/api/explained/v126'),{
   method:'POST',signal:controller.signal,headers:{'Content-Type':'application/json'},
   body:JSON.stringify({policy:EXPLAINED_POLICY_V126,phase,pages,
     ...(phase==='explain'?{bookContext}:{}),timeoutMs:150000})
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
 source.forEach((p,i)=>{
  if(!p.segments.length)return;
  const oldMap=previous?.comprehensionV126?.pages?.[i];
  if(oldMap?.id===p.id)maps.set(p.id,{...oldMap,
    review:auditComprehensionV126(p,oldMap)});
  const oldPage=previous?.pages?.[i];
  if(oldPage?.id===p.id&&maps.get(p.id)?.review?.ready===true){
   const check=auditExplainedPageV126(p,oldPage,maps.get(p.id));
   saved.set(p.id,pageWithSource(p,{...oldPage,review:check}));
   if(!check.ready)rejected.add(p.id);
  }
 });
 const diagnosticBefore=previous?.diagnostics||{};
 const diagnostics={
  requestsSent:0,providerErrors:0,qualityReview:rejected.size,
  originalPages:source.length,stage:'comprehension',
  mode:'lab126-understand-entire-book-first',
  priorProviderErrors:Number(diagnosticBefore.providerErrors||0),
  preflightProviderCalls:0
 };
 let lastError=null;
 const publish=async(status,meta={})=>{
  const comprehensionV126=contextCheckpoint(source,maps);
  const snapshot=explainedSnapshotV122(book,source,[...saved.values()],status,diagnostics);
  const unitSource=totalSourceUnits(source);
  const unitOutput=source.reduce((n,p)=>n+(
    saved.get(p.id)?.review?.outputUnits||0),0);
  const accepted=source.filter(p=>saved.get(p.id)?.review?.ready===true).length;
  const done=accepted===source.length&&comprehensionV126.complete&&
    source.every(p=>saved.get(p.id)?.review?.sizeCompliant===true);
  const draftReduction=saved.size&&unitSource?
    percentReduced(unitSource,unitOutput):null;
  const s={...snapshot,version:EXPLAINED_POLICY_V126,
   comprehensionV126,complete:done,status:done?'complete':status,
   phase:done?'quality':comprehensionV126.complete?'draft':'comprehension',
   sourceUnits:unitSource,outputUnits:unitOutput,
   achievedReduction:done?percentReduced(unitSource,unitOutput):null,
   draftAchievedReduction:draftReduction,
   verifiedChunkVariants:accepted,verifiedChunks:accepted,blockedCells:source.length-accepted,
   draftUnitsSaved:saved.size,semanticCertified:false,
   diagnostics:{...diagnostics,comprehensionPages:comprehensionV126.verifiedPages,
     comprehensionTotal:source.length,qualityReview:rejected.size}};
  await onProgress(s,meta);
  return s;
 };
 // Existing verified zero-text original pages pass through unchanged.
 for(const p of source.filter(p=>!p.segments.length)){
  saved.set(p.id,pageWithSource(p,{segments:[],glossary:[],review:{
   ready:true,issues:[],sizeCompliant:true,sourceUnits:0,outputUnits:0,
   auditRevision:EXPLAINED_AUDIT_V126,semanticCertified:false}}));
 }
 const runStage=async(phase,initial)=>{
  const context=phase==='explain'?globalContextV126(source,maps):[];
  const queue=planStageBlocksV126(initial,{stage:phase,maps,context});
  diagnostics.stage=phase==='comprehend'?'comprehension':'explanation';
  diagnostics.plannedRequests=queue.length;
  diagnostics.plannedPagesPerRequest=queue.map(b=>b.length);
  diagnostics.splits=0;
  await publish(phase==='comprehend'?'comprehension':'partial',{persist:false});
  for(let index=0;index<queue.length;index++){
   const group=queue[index];
   if(signal?.aborted){lastError='V126_INTERRUPTED';break;}
   const pages=group.map(p=>sourceEnvelope(p,p.repair,
      phase==='explain'?maps.get(p.id):null));
   onActivity({phase:phase==='comprehend'?'book-comprehension':'explained-page-block',
    pageStart:group[0].physicalPage,pageEnd:group.at(-1).physicalPage,
    pages:group.length,stage:phase});
   diagnostics.activePages=group.map(p=>p.physicalPage);
   try{
    const {reply,response}=await requestPhaseV126(phase,pages,context,signal);
    diagnostics.requestsSent++;
    if(!reply.ok){
     const code=response?.code||'HTTP_'+reply.status;
     diagnostics.providerErrors++;
     diagnostics.lastProviderCode=code;
     diagnostics.lastHttpStatus=reply.status;
     if(isCooldown(reply.status,code)){
      const rawSeconds=Number(response?.retryAfterSeconds??
       reply.headers?.get?.('Retry-After')??90);
      diagnostics.retryAt=new Date(Date.now()+Math.max(60,
       Math.min(172800,Number.isFinite(rawSeconds)&&rawSeconds>0?rawSeconds:90))*1000).toISOString();
      diagnostics.retryReason=code;lastError=code;break;
     }
     if(isSplitCandidate(reply.status,code)&&group.length>1&&
       diagnostics.splits<MAX_SPLITS){
      const mid=Math.floor(group.length/2);
      queue.splice(index,1,group.slice(0,mid),group.slice(mid));
      diagnostics.splits++;index--;continue;
     }
     lastError=code;break;
    }
    if(response?.engine!=='ai'||response?.version!==EXPLAINED_POLICY_V126||
       response.phase!==phase||!Array.isArray(response.pages)||
       response.pages.length!==group.length){
     lastError='V126_BACKEND_CONTRACT_MISMATCH';break;
    }
    for(let i=0;i<group.length;i++){
     const p=group[i],ans=response.pages[i];
     if(ans?.id!==p.id){lastError='V126_PAGE_ID_MISMATCH';break;}
     if(phase==='comprehend'){
      maps.set(p.id,{...ans,review:auditComprehensionV126(p,ans)});
     }else{
      const review=auditExplainedPageV126(p,ans,maps.get(p.id));
      if(saved.get(p.id)?.review?.ready===true&&!review.ready)continue;
      saved.set(p.id,pageWithSource(p,{...ans,review}));
      if(review.ready)rejected.delete(p.id);else rejected.add(p.id);
     }
    }
    if(lastError)break;
    diagnostics.lastHttpStatus=200;
    diagnostics.lastBlockPages=group.length;
    diagnostics.activePages=[];
    await publish(phase==='comprehend'?'comprehension':'partial');
   }catch(err){
    lastError=signal?.aborted?'V126_INTERRUPTED':err?.code||'V126_NETWORK';
    diagnostics.providerErrors++;break;
   }
  }
  diagnostics.activePages=[];
 };
 // First scan ALL source pages, regardless of paragraph/page segmentation.
 const unread=source.filter(p=>p.segments.length&&
  maps.get(p.id)?.review?.ready!==true);
 if(unread.length)await runStage('comprehend',unread);
 const checked=contextCheckpoint(source,maps);
 if(lastError||!checked.complete){
  diagnostics.stage='comprehension';
  diagnostics.qualityReview=source.filter(p=>p.segments.length&&
   maps.get(p.id)?.review?.ready!==true).length;
  if(!lastError&&diagnostics.qualityReview)
   diagnostics.nextReviewAt=new Date(Date.now()+45000).toISOString();
  diagnostics.lastCode=lastError;
  return publish(lastError?(diagnostics.retryAt?'quota-paused':
   lastError==='V126_INTERRUPTED'?'interrupted':'provider-blocked'):
   'quality-review');
 }
 // Global gate: no explanation request was sent until EVERY map passed.
 diagnostics.globalComprehensionGate='verified-'+source.length+'-of-'+source.length;
 const pending=source.filter(p=>p.segments.length&&
  saved.get(p.id)?.review?.ready!==true).map(p=>({
  ...p,...(saved.get(p.id)?.review?.repair?{
    repair:saved.get(p.id).review.repair}:{})
 }));
 if(pending.length)await runStage('explain',pending);
 diagnostics.qualityReview=rejected.size;
 diagnostics.lastCode=lastError;
 if(!lastError&&rejected.size)
  diagnostics.nextReviewAt=new Date(Date.now()+45000).toISOString();
 return publish(lastError?(diagnostics.retryAt?'quota-paused':
   lastError==='V126_INTERRUPTED'?'interrupted':'provider-blocked'):
   rejected.size?'quality-review':'partial');
}