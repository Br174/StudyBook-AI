import {EXPLAINED_POLICY_V122,originalExplainedPagesV122,isVerifiedExplainedPageV125} from './explainedPolicyV122.js';
import {studyLetters,percentReduced} from './studyPillarV38.js';
import {EXPLAINED_POLICY_V126,EXPLAINED_AUDIT_V126,COMPREHENSION_REVISION_V126,auditExplainedPageV126} from './explainedStagesV126.js';
const readAuditV126=new WeakMap();
const PENDING='Pagina non ancora verificata: attendere il completamento del Libro spiegato.';
export function isExplainedBookV122(book){
 return [EXPLAINED_POLICY_V122,EXPLAINED_POLICY_V126].includes(book?.editionsV36?.version);
}
export function buildExplainedEditionViewV122(book){
 if(!isExplainedBookV122(book))return null;
 const s=book.editionsV36,byPage=new Map((s.pages||[])
  .filter(Boolean).map(p=>[Number(p.sourcePage),p]));
 const originalPages=originalExplainedPagesV122(book);
 const originalByPage=new Map(originalPages.map(p=>[p.physicalPage,p]));
 const ready=(original,record)=>{
  if(!original||!record)return false;
  if(s.version!==EXPLAINED_POLICY_V126)return isVerifiedExplainedPageV125(original,record);
  if(!original.segments.length)return record.review?.ready===true&&record.segments.length===0;
  if(record.review?.auditRevision!==EXPLAINED_AUDIT_V126||
    record.review?.comprehensionRevision!==COMPREHENSION_REVISION_V126||
    record.review.ready!==true||record.review.sizeCompliant!==true)return false;
  if(readAuditV126.has(record))return readAuditV126.get(record);
  const map=s.comprehensionV126?.pages?.[original.physicalPage-1];
  const valid=Boolean(s.comprehensionV126?.complete)&&
   auditExplainedPageV126(original,record,map).ready===true;
  readAuditV126.set(record,valid);
  return valid;
 };
 const consumed=new Set();
 const chapters=(book.chapters||[]).map(c=>({
  ...c,paragraphs:(c.paragraphs||[]).map(p=>{
   const start=Number(p.sourcePageStart||c.pageStart)||1;
   const end=Math.max(start,Number(p.sourcePageEnd||start));
   const chunks=[];let pending=false;
   for(let page=start;page<=end;page++){
    if(consumed.has(page))continue;
    consumed.add(page);
    const record=byPage.get(page);
    if(ready(originalByPage.get(page),record)){
     chunks.push((record.segments||[]).map(x=>x.text).join('\n\n'));
    }else{pending=true;chunks.push(PENDING);}
   }
   const explained=chunks.filter(Boolean).join('\n\n');
   return {...p,summary:explained,dsaSummary:explained,
    simpleSummary:undefined,editionPending:pending,
    editionPreviewOnly:pending,editionSource:'explained-v122-original'};
  })
 }));
 const originalLetters=(s.pages||[]).filter(Boolean).reduce((n,p)=>n+
   (Number(p.review?.sourceLetters)||0),0);
 const resultingLetters=(s.pages||[]).filter(p=>ready(originalByPage.get(Number(p?.sourcePage)),p)).reduce((n,p)=>n+
   (Number(p.review?.outputLetters)||0),0);
 const complete=s.complete===true&&originalPages.every(original=>
  ready(original,byPage.get(original.physicalPage)));
 const readyPages=originalPages.filter(original=>
  ready(original,byPage.get(original.physicalPage))).length;
 const achieved=complete?(s.version===EXPLAINED_POLICY_V126
   ?s.achievedReduction:(originalLetters?
     percentReduced(originalLetters,resultingLetters):null)):null;
 const lettersOnly=complete&&originalLetters?
   percentReduced(originalLetters,resultingLetters):null;
 return {...book,chapters,explainedV122:true,
  editionReadiness:{complete,partial:!complete,readyPages,
   verifiedParagraphs:readyPages,
   totalParagraphs:s.totalChunkVariants||0,
   source:'explained-v122',status:complete?'available-with-quality-notes':'preview-only'},
  precisionEdition:{level:'explained',label:'Libro spiegato',
   targetPercent:50,achievedPercent:achieved,achievedLettersPercent:lettersOnly,
   draftAchievedPercent:s.draftAchievedReduction??null,
   originalLetters,resultingLetters:complete?resultingLetters:null,
   qualityGuard:{semanticCertification:false,status:complete?
    'source-guards-passed-not-semantic-certified':'preview-only'},
   reductionCompliant:complete}};
}
