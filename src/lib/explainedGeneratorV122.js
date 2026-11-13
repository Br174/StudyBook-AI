// LAB122 one source page -> one explanatory page + aligned glossary, in multi-page requests.
// Legacy LAB36-121 editions remain untouched. Checkpoints are snapshots persisted by existing Library owner.
import {apiEndpoint} from './apiEndpoint.js';
import {originalExplainedPagesV122,auditExplainedPageV122,modelPayloadV122,modelInstructionV122,
 EXPLAINED_PRIVATE_BAND_V122,EXPLAINED_POLICY_V122} from './explainedPolicyV122.js';
import {percentReduced} from './studyPillarV38.js';

// LAB124: restore the LAB51/58 TRANSPORT concept: a few large natural
// page-boundary requests, bounded by estimated input/output capacity.
// No legacy six-edition text generation or 680-character request splitting.
const BLOCK_SOURCE_LIMIT=40000; // Candidate: Worker hard cap 42000; validate on live Gemini before promotion.
const BLOCK_PAGE_LIMIT=72;
const BLOCK_INPUT_TOKEN_LIMIT=35000;
const BLOCK_OUTPUT_TOKEN_LIMIT=30000;
const SPLITTABLE_HTTP=new Set([413,422]);
const CAP_MIN_CHARS=1200;
// Error from provider != evidence that more requests at once will help.
const isProviderCooldown=(status,code)=>status===429||
 (status===503&&!['AI_NOT_CONFIGURED','AI_MODEL_NOT_ALLOWLISTED'].includes(code))||
 (status===502||status===504)&&/AI_PROVIDER_(?:NETWORK|TIMEOUT|REJECTED)|V122_NETWORK/iu.test(code||'');
const VERSION=EXPLAINED_POLICY_V122;
export const EXPLAINED_REQUEST_TIMEOUT_V122=165000;

export function explainedProgressMessageV122(snapshot){
 if(snapshot?.version==='lab126-whole-book-comprehension-v1'&&
   snapshot?.comprehensionV126?.complete!==true&&
   !snapshot?.quota?.retryAt&&snapshot?.status!=='provider-blocked'){
  const c=snapshot.comprehensionV126;
  return 'Comprensione dell’intero libro · '+(c?.verifiedPages||0)+'/'+
   (c?.totalPages||snapshot.originalPages||0)+' pagine comprese. La riscrittura inizierà soltanto dopo la lettura completa.';
 }
 const diagnostics=snapshot?.diagnostics;
 const code=diagnostics?.lastCode;
 if(snapshot?.status==='quota-paused'&&snapshot.quota?.retryAt){
   const time=new Date(snapshot.quota.retryAt).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'});
   const reason=code==='AI_QUOTA_LIMIT'?'Limite Gemini raggiunto':
     code?.includes('TIMEOUT')?'Tempo di risposta Gemini scaduto':'Gemini temporaneamente indisponibile';
   return reason+' · ripresa possibile dalle '+time+' · progressi conservati.';
 }
 if(snapshot?.status==='interrupted')return 'Richiesta interrotta · riprendi dalle pagine salvate.';
 if(code==='V122_REQUEST_TIMEOUT')return 'Il Worker non ha risposto in tempo. Riprova dalle pagine salvate.';
 if(code==='V122_NETWORK')return 'Connessione al Worker interrotta. Riprova dalle pagine salvate.';
 if(code==='AI_NOT_CONFIGURED'||code==='AI_MODEL_NOT_ALLOWLISTED')
   return 'Configurazione Gemini del Worker da verificare ('+code+').';
 if(code)return 'Elaborazione sospesa ('+code+'). Le pagine già salvate sono disponibili.';
 if(diagnostics?.qualityReview)return 'Pagine da rivedere: '+diagnostics.qualityReview+
   '. Puoi studiare le pagine conformi; le altre saranno corrette dai checkpoint.';
 return '';
}

async function requestExplainedBlock(pages,signal){
 const controller=new AbortController();
 const abort=()=>controller.abort();
 signal?.addEventListener('abort',abort,{once:true});
 if(signal?.aborted)abort();
 const timer=setTimeout(abort,EXPLAINED_REQUEST_TIMEOUT_V122);
 try{
   const reply=await fetch(apiEndpoint('/api/explained/v122'),{
     method:'POST',signal:controller.signal,headers:{'Content-Type':'application/json'},
     body:JSON.stringify({policy:VERSION,pages,timeoutMs:150000})
   });
   const response=await reply.json().catch(()=>null);
   if(controller.signal.aborted)throw new Error('Richiesta interrotta');
   return {reply,response};
 }catch{
   const code=signal?.aborted?'V122_INTERRUPTED':
     controller.signal.aborted?'V122_REQUEST_TIMEOUT':'V122_NETWORK';
   throw Object.assign(new Error(code),{code});
 }finally{
   clearTimeout(timer);
   signal?.removeEventListener('abort',abort);
 }
}
const withSource=(original,result)=>({
 id:original.id,label:original.label,physicalPage:original.physicalPage,
 segments:Array.isArray(result?.segments)?result.segments:[],
 glossary:Array.isArray(result?.glossary)?result.glossary:[],
 review:result?.review||{ready:false,issues:['V122_DRAFT_NOT_VERIFIED']},
 sourcePage:original.physicalPage
});
// Deterministic EXACT serialization size for each physical page, cached
// once per page object. modelPayloadV122 maps pages independently: a grouped
// JSON array equals the sum of individual objects plus (n-1) separators.
// The token ratio remains a conservative heuristic, NOT an API usage claim.
const SERIAL_EMPTY_JSON_CHARS_V125=JSON.stringify({pages:[]}).length;
const SERIAL_PROMPT_CHARS_V125=modelInstructionV122().length;
const SERIAL_PAGE_CHARS_V125=new WeakMap();
function serializedPagePayloadCharsV125(page){
 const cached=SERIAL_PAGE_CHARS_V125.get(page);
 if(cached!==undefined)return cached;
 const size=JSON.stringify(modelPayloadV122([page])).length-SERIAL_EMPTY_JSON_CHARS_V125;
 SERIAL_PAGE_CHARS_V125.set(page,size);
 return size;
}
export function estimateSerializedInputTokensV125(block){
 if(!block.length)return 0;
 const chars=SERIAL_EMPTY_JSON_CHARS_V125+SERIAL_PROMPT_CHARS_V125+
   block.reduce((n,page)=>n+serializedPagePayloadCharsV125(page),0)+block.length-1;
 return Math.ceil(chars/2.6);
}
export function planExplainedBlocksV122(pages,{
 maxChars=BLOCK_SOURCE_LIMIT,maxPages=BLOCK_PAGE_LIMIT,
 maxInputTokens=BLOCK_INPUT_TOKEN_LIMIT,maxOutputTokens=BLOCK_OUTPUT_TOKEN_LIMIT
}={}){
 // Same principle as LAB51 natural-boundary planner: estimate BOTH input
 // and output, fill the largest safe request, cut only at whole-page borders.
 // Page count is not an arbitrary 4-page limit.
 const groups=[],charCap=Math.max(512,Math.min(42000,Math.floor(maxChars))),
  pageCap=Math.max(1,Math.min(72,Math.floor(maxPages))),
  inputCap=Math.max(2000,Math.floor(maxInputTokens)),
  outputCap=Math.max(4000,Math.floor(maxOutputTokens));
 let group=[],chars=0,segments=0;
 const flush=()=>{if(group.length){groups.push(group);group=[];chars=0;segments=0;}};
 for(const page of pages){
  const charsOfPage=page.segments.reduce((n,seg)=>n+seg.source.length,0);
  if(charsOfPage<=0)continue;
  const segmentCount=page.segments.length;
  const count=group.length+1,nextChars=chars+charsOfPage,nextSegments=segments+segmentCount;
  // LAB124 preventive estimate: one linear LOCAL scan, zero Gemini calls.
  // Input includes JSON IDs and source-protected legal references.
  // Output includes the explained text, structured JSON and side glossary.
  const inputEstimate=Math.ceil(nextChars*0.62)+count*190+nextSegments*65+1500;
  const outputEstimate=Math.ceil(nextChars*0.58/1.4)+count*420+nextSegments*115+1800;
  if(group.length&&(count>pageCap||nextChars>charCap||
     inputEstimate>inputCap||outputEstimate>outputCap))flush();
  // Keep a single unusual page atomic for an explicit targeted review.
  group.push(page);chars+=charsOfPage;segments+=segmentCount;
 }
 flush();
 const safe=[];
 for(const group of groups){
  let tail=group;
  while(tail.length){
   if(tail.length===1||estimateSerializedInputTokensV125(tail)<=inputCap){
    safe.push(tail);break;
   }
   let low=1,high=tail.length-1,best=1;
   while(low<=high){
    const middle=Math.floor((low+high)/2);
    if(estimateSerializedInputTokensV125(tail.slice(0,middle))<=inputCap){
     best=middle;low=middle+1;
    }else high=middle-1;
   }
   safe.push(tail.slice(0,best));tail=tail.slice(best);
  }
 }
 return safe;
}
export function preflightExplainedCallsV124(pages,options={}){
 const blocks=Array.isArray(options.preplannedBlocks)?options.preplannedBlocks:
  planExplainedBlocksV122(pages,options);
 const details=blocks.map(block=>{
  const chars=block.reduce((n,p)=>n+p.segments.reduce((m,s)=>m+s.source.length,0),0);
  const segments=block.reduce((n,p)=>n+p.segments.length,0);
  const count=block.length;
  return {fromPage:block[0].physicalPage,toPage:block.at(-1).physicalPage,
    pages:count,sourceChars:chars,
    estimatedInputTokens:estimateSerializedInputTokensV125(block),
    estimatedOutputTokens:Math.ceil(chars*0.58/1.4)+count*420+segments*115+1800};
 });
 return {plannedRequests:blocks.length,totalPages:pages.length,
  details,oversizedPages:details.filter(d=>d.sourceChars>BLOCK_SOURCE_LIMIT||d.pages>72||
    d.estimatedInputTokens>BLOCK_INPUT_TOKEN_LIMIT||d.estimatedOutputTokens>30000).map(d=>d.fromPage),
  estimatedLocally:true,providerCallsForEstimate:0};
}
export function explainedSnapshotV122(book,originalPages,records,status='partial',diagnostics={}){
 const map=new Map(records.map(r=>[r.id,r]));
 const pages=originalPages.map(p=>map.get(p.id)||null);
 const ready=pages.filter(p=>p?.review?.ready===true).length;
 const saved=pages.filter(Boolean).length;
 const all=pages.length,allPagesReady=all>0&&ready===all;
 const totalSource=originalPages.reduce((n,p)=>n+p.originalBodyLetters,0);
 const totalOutput=pages.reduce((n,p)=>n+Number(p?.review?.outputLetters||0),0);
 const achievedReduction=allPagesReady&&totalSource>0?
  percentReduced(totalSource,totalOutput):null;
 // Publication is a conjunction of individual page checks, not an average.
 const numericCompliant=allPagesReady&&pages.every(page=>
   (page?.review?.sizeCompliant===true||page?.review?.sourceLetters===0));
 const complete=allPagesReady&&numericCompliant;
 const draftedSource=originalPages.reduce((n,p,i)=>n+(pages[i]?p.originalBodyLetters:0),0);
 const draftAchievedReduction=saved>0&&draftedSource>0?
   percentReduced(draftedSource,totalOutput):null;
 const qualityWarnings=[];
 if(allPagesReady&&!numericCompliant)qualityWarnings.push('V122_BOOK_REDUCTION_OUTSIDE_ACCEPTANCE');
 return {version:VERSION,sourceFingerprint:book.canonicalBookMap.originalFingerprint,
  originalPages:all,pages,complete,
  status:complete?'complete':qualityWarnings.length?'quality-review':status,
  achievedReduction,draftAchievedReduction,
  sourceLetters:totalSource,outputLetters:totalOutput,
  numericCompliant,qualityWarnings,
  phase:complete?'quality':'draft',verifiedChunkVariants:ready,
  totalChunkVariants:all,verifiedChunks:ready,blockedCells:all-ready,
  draftUnitsSaved:saved,checkpointPersistent:true,
  updatedAt:new Date().toISOString(),semanticCertified:false,
  ...(diagnostics.retryAt?{quota:{
    automatic:true,estimated:true,kind:'overload',retryAt:diagnostics.retryAt}}:{}),
  diagnostics:{...diagnostics}};
}
export async function generateExplainedBookV122(book,{
 onProgress=()=>{},onActivity=()=>{},signal=null,retryReviewed=false
}={}){
 const originalPages=originalExplainedPagesV122(book);
 const prior=book?.editionsV36?.version===VERSION&&
  book.editionsV36.sourceFingerprint===book.canonicalBookMap.originalFingerprint
   ?book.editionsV36.pages:[],records=new Map(),rejected=new Set();
 originalPages.forEach((p,i)=>{
  const saved=prior?.[i];
  if(!saved||saved.id!==p.id)return;
  const review=auditExplainedPageV122(p,saved);
  const record=withSource(p,{...saved,review});
  records.set(p.id,record);
  if(!review.ready)rejected.add(p.id);
 });
 // A retry never regenerates accepted pages. Nonconforming pages are always
 // eligible on resume, including automatic recovery after a completed block.
 const pending=originalPages.filter(p=>p.segments.length&&
   records.get(p.id)?.review?.ready!==true);
 // A provider overload is not proof of a size limit: preserve the previously
 // calibrated block budget and resume only after the provider cooldown.
 const previousDiag=book?.editionsV36?.diagnostics||{};
 const savedCharBudget=Number(previousDiag.nextBlockChars);
 const blockCharBudget=Number.isFinite(savedCharBudget)&&savedCharBudget>=CAP_MIN_CHARS
  ?Math.max(CAP_MIN_CHARS,Math.min(BLOCK_SOURCE_LIMIT,Math.floor(savedCharBudget)))
  :BLOCK_SOURCE_LIMIT;
 const diagnostics={requestsSent:0,providerErrors:0,qualityReview:rejected.size,
  originalPages:originalPages.length,mode:'one-explanation-per-source-page',
  nextBlockChars:blockCharBudget,
  priorProviderErrors:Number(previousDiag?.providerErrors||0)};
 let lastError=null;
 const publish=async(status='partial',{persist=true}={})=>{
  const snap=explainedSnapshotV122(book,originalPages,[...records.values()],status,diagnostics);
  await onProgress(snap,{persist});
  return snap;
 };
 // Blank physical sheets and cover pages are preserved as original pages, not sent to Gemini.
 for(const p of originalPages.filter(p=>p.segments.length===0)){
  if(!records.has(p.id))records.set(p.id,withSource(p,{
   segments:[],glossary:[],review:{ready:true,issues:[],sourceLetters:0,
    outputLetters:0,reduction:0,sourceLineCount:0,shortPage:true,sizeCompliant:true,semanticCertified:false}
  }));
 }
 // Initial source snapshot was already persisted by the book owner before
 // running Gemini. Avoid writing the entire original PDF AGAIN before the
 // first network request; on large books this could stall at 0/N.
 // LAB124: the LAB51/58 pattern packages as many whole pages as estimated
 // INPUT and OUTPUT capacity allow. A previous overload reduces the next
 // session's budget rather than firing several requests against a busy model.
 const planningPages=pending.map(p=>{
  const repair=records.get(p.id)?.review?.repair;
  return repair?{...p,repair}:p;
 });
 const queue=planExplainedBlocksV122(planningPages,{maxChars:blockCharBudget});
 const estimate=preflightExplainedCallsV124(planningPages,{maxChars:blockCharBudget,
  preplannedBlocks:queue});
 diagnostics.splits=0;
 diagnostics.plannedRequests=estimate.plannedRequests;
 diagnostics.plannedPagesPerRequest=estimate.details.map(block=>block.pages);
 diagnostics.predictedInputTokens=estimate.details.map(block=>block.estimatedInputTokens);
 diagnostics.predictedOutputTokens=estimate.details.map(block=>block.estimatedOutputTokens);
 diagnostics.preflightProviderCalls=0;
 diagnostics.transport='large-natural-page-blocks-lab51-lab58';
 // Publish the request forecast before starting Gemini, without a storage rewrite.
 await publish('partial',{persist:false});
 for(let index=0;index<queue.length;index++){
  const block=queue[index];
  if(signal?.aborted){lastError='V122_INTERRUPTED';break;}
  const pages=block.map(p=>{
   const review=records.get(p.id)?.review;
   return {id:p.id,segments:p.segments,label:p.label,physicalPage:p.physicalPage,
    sourceLineCount:p.sourceLineCount,
    ...(review?.ready===false&&review.repair?{repair:review.repair}:{})};
  });
  const before=Date.now();
  try{
   diagnostics.activePages=block.map(p=>p.physicalPage);
   diagnostics.lastAttemptStartedAt=new Date().toISOString();
   onActivity({phase:'explained-page-block',pageStart:block[0].physicalPage,
    pageEnd:block.at(-1).physicalPage,pages:block.length,
    sourceChars:block.reduce((total,p)=>total+p.segments.reduce((n,s)=>n+s.source.length,0),0)});

   const {reply,response}=await requestExplainedBlock(pages,signal);
   diagnostics.requestsSent++;
   if(!reply.ok){
    const code=response?.code||'HTTP_'+reply.status;
    diagnostics.providerErrors++;
    diagnostics.lastProviderCode=code;
    diagnostics.lastHttpStatus=reply.status;
    if(isProviderCooldown(reply.status,code)){
      // 429/503 may be daily/RPM capacity or a Google-side outage. Never
      // immediately split/retry: it creates a burst of further 503 responses.
      // The next foreground attempt starts only AFTER the bounded cooldown.
      const rawSeconds=Number(response?.retryAfterSeconds??reply.headers?.get?.('Retry-After')??90);
      const seconds=Number.isFinite(rawSeconds)&&rawSeconds>0?rawSeconds:90;
      // A provider-supplied Retry-After can be much longer than one hour
      // (e.g. a daily free-tier quota). Never shorten the provider's pause.
      diagnostics.retryAt=new Date(Date.now()+Math.max(60,Math.min(172800,seconds))*1000).toISOString();
      diagnostics.retryReason=code;
      // HTTP 429/503 are NOT proof that the payload was oversized.
      // Keep the calibrated block budget; only a real 413/422 may split.
      diagnostics.nextBlockChars=blockCharBudget;
      lastError=code;break;
    }
    if(SPLITTABLE_HTTP.has(reply.status)&&block.length>1&&diagnostics.splits<12){
      // A verified size/format error can be retried at a whole-page boundary
      // immediately; unlike a provider cooldown it is not quota exhaustion.
      const middle=Math.floor(block.length/2);
      queue.splice(index,1,block.slice(0,middle),block.slice(middle));
      diagnostics.splits++;index--;continue;
    }
    lastError=code;
    break;
   }
   if(response?.engine!=='ai'||response?.version!==VERSION||
      !Array.isArray(response.pages)||response.pages.length!==block.length){
    if(block.length>1&&diagnostics.splits<12){
      const middle=Math.floor(block.length/2);
      queue.splice(index,1,block.slice(0,middle),block.slice(middle));
      diagnostics.splits++;index--;continue;
    }
    throw Object.assign(new Error('Risposta Gemini non verificabile'),{code:'V122_BACKEND_CONTRACT_MISMATCH'});
   }
   for(let i=0;i<block.length;i++){
    const source=block[i],answer=response.pages[i];
    if(answer?.id!==source.id)throw Object.assign(new Error('Pagine fuori ordine'),{code:'V122_PAGE_ID_MISMATCH'});
    // Revalidate on device: never trust a flag "ready" returned by the Worker.
    const review=auditExplainedPageV122(source,answer);
    if(!review.ready&&records.get(source.id)?.review?.ready)continue;
    records.set(source.id,withSource(source,{...answer,review}));
    if(review.ready)rejected.delete(source.id);
    else rejected.add(source.id);
    diagnostics.qualityReview=rejected.size;
   }
   diagnostics.lastBlockMs=Date.now()-before;
   // Validated successes preserve the learned budget; no unnecessary tiny
   // batch when the provider is demonstrably healthy.
   diagnostics.nextBlockChars=Math.max(blockCharBudget,diagnostics.nextBlockChars);
   diagnostics.activePages=[];
   diagnostics.lastHttpStatus=200;
   diagnostics.lastBlockPages=block.length;
  }catch(err){
   lastError=signal?.aborted?'V122_INTERRUPTED':err?.code||'V122_NETWORK';
   diagnostics.providerErrors++;
   break;
  }
  await publish();
  // Save quality results and let the existing foreground recovery scheduler
  // plan one bounded targeted retry; no surprise provider burst here.
 }
 diagnostics.lastCode=lastError;
 diagnostics.activePages=[];
 // Only the existing LAB45 resume scheduler may act on this timestamp.
 // No duplicate timer or immediate quota-heavy quality-retry cascade.
 if(!lastError&&rejected.size)diagnostics.nextReviewAt=
   new Date(Date.now()+45000).toISOString();
 const final=await publish(lastError?(lastError==='V122_INTERRUPTED'?'interrupted':
   diagnostics.retryAt?'quota-paused':'provider-blocked'):
   rejected.size?'quality-review':'partial');
 return final;
}
