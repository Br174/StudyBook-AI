// LAB128: read-only printable snapshot. Never persist or approve a provisional page.
// The current book's complete flag and its Gemini checkpoints remain untouched.
import {EXPLAINED_POLICY_V126,auditExplainedPageV126,
 EXPLAINED_AUDIT_V126} from './explainedStagesV126.js';
import {originalExplainedPagesV122} from './explainedPolicyV122.js';
import {reserveAcceptedV127,reserveUnreadPageV127} from './explainedRepairV127.js';

export function buildProvisionalExplainedBookV128(book){
 const originalSnapshot=book?.editionsV36;
 if(originalSnapshot?.version!==EXPLAINED_POLICY_V126)
  throw new Error('La bozza parziale richiede un Libro spiegato LAB126/LAB128.');
 const sources=originalExplainedPagesV122(book);
 const prior=new Map((originalSnapshot.pages||[]).filter(Boolean).map(p=>[p.id,p]));
 const pages=[],waiting=[];
 for(const original of sources){
  const record=prior.get(original.id);
  if(!original.segments.length){
   pages.push(record?.review?.ready===true?record:{
    id:original.id,label:original.label,sourcePage:original.physicalPage,
    physicalPage:original.physicalPage,segments:[],glossary:[],
    review:{ready:true,sizeCompliant:true,issues:[],
     auditRevision:EXPLAINED_AUDIT_V126,semanticCertified:false}});
   continue;
  }
  const accepted=reserveAcceptedV127(original,record);
  const comprehension=originalSnapshot.comprehensionV126?.pages?.[original.physicalPage-1];
  const conforming=Boolean(record?.review?.ready===true&&comprehension&&
   auditExplainedPageV126(original,record,comprehension).ready===true);
  if(accepted||conforming){
   pages.push(record);
  }else{
   const draft=reserveUnreadPageV127(original);
   pages.push({...draft,review:{...draft.review,
    issues:['V128_PENDING_PROVIDER_REWRITE'],
    provisionalOriginal:true,
    semanticCertified:false}});
   waiting.push(original.physicalPage);
  }
 }
 return {
  book:{...book,editionsV36:{...originalSnapshot,pages,
   complete:true,completeWithReservations:waiting.length>0||
    originalSnapshot.completeWithReservations===true}},
  waitingPages:waiting,verifiedPages:sources.length-waiting.length-
   pages.filter(p=>p?.review?.acceptedWithReserve===true&&!p.review?.provisionalOriginal).length,
  sourcePages:sources.length
 };
}
