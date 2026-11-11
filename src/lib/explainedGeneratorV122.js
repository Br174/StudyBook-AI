// LAB122 one source page -> one explanatory page + aligned glossary, in multi-page requests.
// Legacy LAB36-121 editions remain untouched. Checkpoints are snapshots persisted by existing Library owner.
import {apiEndpoint} from './apiEndpoint.js';
import {originalExplainedPagesV122,auditExplainedPageV122,
 EXPLAINED_POLICY_V122} from './explainedPolicyV122.js';

const BLOCK_SOURCE_LIMIT=16000;
const BLOCK_PAGE_LIMIT=6;
const VERSION=EXPLAINED_POLICY_V122;
const signalError=()=>Object.assign(new Error('Operazione interrotta'),{code:'V122_INTERRUPTED'});
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
 const all=pages.length,complete=all>0&&ready===all;
 return {version:VERSION,sourceFingerprint:book.canonicalBookMap.originalFingerprint,
  originalPages:all,pages,complete,status:complete?'complete':status,
  phase:complete?'quality':'draft',verifiedChunkVariants:ready,
  totalChunkVariants:all,verifiedChunks:ready,blockedCells:all-ready,
  draftUnitsSaved:saved,checkpointPersistent:true,
  updatedAt:new Date().toISOString(),semanticCertified:false,
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
 const pending=originalPages.filter(p=>p.segments.length&&
  (!records.has(p.id)||(!records.get(p.id)?.review?.ready&&retryReviewed)));
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
 for(const block of planExplainedBlocksV122(pending)){
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
    lastError=response?.code||'HTTP_'+reply.status;
    diagnostics.providerErrors++;
    if(reply.status===429||reply.status===503){
     const retrySeconds=Number(response?.retryAfterSeconds||90);
     diagnostics.retryAt=new Date(Date.now()+Math.max(60,Math.min(3600,retrySeconds))*1000).toISOString();
    }
    break;
   }
   if(response?.engine!=='ai'||response?.version!==VERSION||
      !Array.isArray(response.pages)||response.pages.length!==block.length)
    throw Object.assign(new Error('Risposta Gemini non verificabile'),{code:'V122_BACKEND_CONTRACT_MISMATCH'});
   for(let i=0;i<block.length;i++){
    const source=block[i],answer=response.pages[i];
    if(answer?.id!==source.id)throw Object.assign(new Error('Pagine fuori ordine'),{code:'V122_PAGE_ID_MISMATCH'});
    // Revalidate on device: never trust a flag "ready" returned by the Worker.
    const review=auditExplainedPageV122(source,answer);
    records.set(source.id,withSource(source,{...answer,review}));
    if(!review.ready){diagnostics.qualityReview++;rejected.add(source.id);}
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
