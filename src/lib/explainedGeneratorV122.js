// LAB122 one source page -> one explanatory page + aligned glossary, in multi-page requests.
// Legacy LAB36-121 editions remain untouched. Checkpoints are snapshots persisted by existing Library owner.
import {apiEndpoint} from './apiEndpoint.js';
import {originalExplainedPagesV122,auditExplainedPageV122,
 EXPLAINED_PRIVATE_BAND_V122,EXPLAINED_POLICY_V122} from './explainedPolicyV122.js';
import {percentReduced} from './studyPillarV38.js';

// Large batches for short pages; split automatically on provider truncation.
const BLOCK_SOURCE_LIMIT=26000;
const BLOCK_PAGE_LIMIT=72;
const VERSION=EXPLAINED_POLICY_V122;
const withSource=(original,result)=>({
 id:original.id,label:original.label,physicalPage:original.physicalPage,
 segments:Array.isArray(result?.segments)?result.segments:[],
 glossary:Array.isArray(result?.glossary)?result.glossary:[],
 review:result?.review||{ready:false,issues:['V122_DRAFT_NOT_VERIFIED']},
 sourcePage:original.physicalPage
});
export function planExplainedBlocksV122(pages,{maxChars=BLOCK_SOURCE_LIMIT,maxPages=BLOCK_PAGE_LIMIT}={}){
 const groups=[],limit=Math.max(512,Math.min(30000,Math.floor(maxChars)));
 let group=[],used=0;
 for(const p of pages){
  const size=p.segments.reduce((n,s)=>n+s.source.length,0);
  if(size>30000)throw Object.assign(new Error('Una pagina eccede il limite del blocco Gemini.'),{code:'V122_PAGE_EXCEEDS_BLOCK_LIMIT'});
  if(group.length&&(group.length>=maxPages||used+size>limit)){
   groups.push(group);group=[];used=0;
  }
  group.push(p);used+=size;
 }
 if(group.length)groups.push(group);
 return groups;
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
 const numericCompliant=achievedReduction!==null&&
  achievedReduction>=EXPLAINED_PRIVATE_BAND_V122.min&&
  achievedReduction<=EXPLAINED_PRIVATE_BAND_V122.max;
 const complete=allPagesReady&&numericCompliant;
 const qualityWarnings=[];
 if(allPagesReady&&!numericCompliant)qualityWarnings.push('V122_BOOK_REDUCTION_OUTSIDE_ACCEPTANCE');
 return {version:VERSION,sourceFingerprint:book.canonicalBookMap.originalFingerprint,
  originalPages:all,pages,complete,
  status:complete?'complete':qualityWarnings.length?'quality-review':status,
  achievedReduction,sourceLetters:totalSource,outputLetters:totalOutput,
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
 let pending=originalPages.filter(p=>p.segments.length&&
  (!records.has(p.id)||(!records.get(p.id)?.review?.ready&&retryReviewed)));
 // In a requested targeted retry, a globally nonconforming but fully
 // source-faithful book can improve only the three most distant pages.
 if(retryReviewed&&pending.length===0&&records.size===originalPages.length){
  const previous=explainedSnapshotV122(book,originalPages,[...records.values()]);
  if(previous.qualityWarnings.includes('V122_BOOK_REDUCTION_OUTSIDE_ACCEPTANCE')){
   pending=originalPages.filter(p=>p.segments.length).sort((a,b)=>{
    const d=x=>Math.abs(50-Number(records.get(x.id)?.review?.reduction||0));
    return d(b)-d(a);
   }).slice(0,3).sort((a,b)=>a.physicalPage-b.physicalPage);
  }
 }
 const diagnostics={requestsSent:0,providerErrors:0,qualityReview:rejected.size,
  originalPages:originalPages.length,mode:'one-explanation-per-source-page'};
 let lastError=null;
 const publish=async(status='partial')=>{
  const snap=explainedSnapshotV122(book,originalPages,[...records.values()],status,diagnostics);
  await onProgress(snap);
  return snap;
 };
 // Blank physical sheets and cover pages are preserved as original pages, not sent to Gemini.
 for(const p of originalPages.filter(p=>p.segments.length===0)){
  if(!records.has(p.id))records.set(p.id,withSource(p,{
   segments:[],glossary:[],review:{ready:true,issues:[],sourceLetters:0,
    outputLetters:0,reduction:0,semanticCertified:false}
  }));
 }
 await publish();
 const queue=planExplainedBlocksV122(pending);
 diagnostics.splits=0;
 for(let index=0;index<queue.length;index++){
  const block=queue[index];
  if(signal?.aborted){lastError='V122_INTERRUPTED';break;}
  const pages=block.map(p=>({id:p.id,segments:p.segments,
   label:p.label,physicalPage:p.physicalPage}));
  const before=Date.now();
  try{
   onActivity({phase:'explained-page-block',pageStart:block[0].physicalPage,
    pageEnd:block.at(-1).physicalPage,pages:block.length});
   const reply=await fetch(apiEndpoint('/api/explained/v122'),{
    method:'POST',signal,headers:{'Content-Type':'application/json'},
    body:JSON.stringify({policy:VERSION,pages,timeoutMs:150000})
   });
   const response=await reply.json().catch(()=>null);
   diagnostics.requestsSent++;
   if(!reply.ok){
    const code=response?.code||'HTTP_'+reply.status;
    diagnostics.providerErrors++;
    if([413,422,502,504].includes(reply.status)&&block.length>1&&diagnostics.splits<24){
      const middle=Math.floor(block.length/2);
      queue.splice(index,1,block.slice(0,middle),block.slice(middle));
      diagnostics.splits++;index--;continue;
    }
    lastError=code;
    if(reply.status===429||reply.status===503){
     const retrySeconds=Number(response?.retryAfterSeconds||90);
     diagnostics.retryAt=new Date(Date.now()+Math.max(60,Math.min(3600,retrySeconds))*1000).toISOString();
    }
    break;
   }
   if(response?.engine!=='ai'||response?.version!==VERSION||
      !Array.isArray(response.pages)||response.pages.length!==block.length){
    if(block.length>1&&diagnostics.splits<24){
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
    records.set(source.id,withSource(source,{...answer,review}));
    if(!review.ready){diagnostics.qualityReview++;rejected.add(source.id);}
    else rejected.delete(source.id);
   }
   diagnostics.lastBlockMs=Date.now()-before;
   await publish();
  }catch(err){
   lastError=signal?.aborted?'V122_INTERRUPTED':err?.code||'V122_NETWORK_OR_STORAGE';
   diagnostics.providerErrors++;
   break;
  }
 }
 diagnostics.lastCode=lastError;
 const final=await publish(lastError?(lastError==='V122_INTERRUPTED'?'interrupted':
   diagnostics.retryAt?'quota-paused':'provider-blocked'):
   rejected.size?'quality-review':'partial');
 return final;
}
