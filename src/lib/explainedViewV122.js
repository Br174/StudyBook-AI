import {EXPLAINED_POLICY_V122,originalExplainedPagesV122,isVerifiedExplainedPageV125} from './explainedPolicyV122.js';
import {studyLetters,percentReduced} from './studyPillarV38.js';
const PENDING='Pagina non ancora verificata: attendere il completamento del Libro spiegato.';
export function isExplainedBookV122(book){
 return book?.editionsV36?.version===EXPLAINED_POLICY_V122;
}
export function buildExplainedEditionViewV122(book){
 if(!isExplainedBookV122(book))return null;
 const s=book.editionsV36,byPage=new Map((s.pages||[])
  .filter(Boolean).map(p=>[Number(p.sourcePage),p]));
 const originalPages=originalExplainedPagesV122(book);
 const originalByPage=new Map(originalPages.map(p=>[p.physicalPage,p]));
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
    if(isVerifiedExplainedPageV125(originalByPage.get(page),record)){
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
 const resultingLetters=(s.pages||[]).filter(p=>isVerifiedExplainedPageV125(
  originalByPage.get(Number(p?.sourcePage)),p)).reduce((n,p)=>n+
   (Number(p.review?.outputLetters)||0),0);
 const complete=s.complete===true&&originalPages.every(original=>
  isVerifiedExplainedPageV125(original,byPage.get(original.physicalPage)));
 const readyPages=originalPages.filter(original=>
  isVerifiedExplainedPageV125(original,byPage.get(original.physicalPage))).length;
 const achieved=complete&&originalLetters?
   percentReduced(originalLetters,resultingLetters):null;
 return {...book,chapters,explainedV122:true,
  editionReadiness:{complete,partial:!complete,readyPages,
   verifiedParagraphs:readyPages,
   totalParagraphs:s.totalChunkVariants||0,
   source:'explained-v122',status:complete?'available-with-quality-notes':'preview-only'},
  precisionEdition:{level:'explained',label:'Libro spiegato',
   targetPercent:50,achievedPercent:achieved,achievedLettersPercent:achieved,
   draftAchievedPercent:s.draftAchievedReduction??null,
   originalLetters,resultingLetters:complete?resultingLetters:null,
   qualityGuard:{semanticCertification:false,status:complete?
    'source-guards-passed-not-semantic-certified':'preview-only'},
   reductionCompliant:complete}};
}
