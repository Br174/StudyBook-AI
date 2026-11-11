import {EXPLAINED_POLICY_V122} from './explainedPolicyV122.js';
import {studyLetters,percentReduced} from './studyPillarV38.js';
const PENDING='Pagina non ancora verificata: attendere il completamento del Libro spiegato.';
export function isExplainedBookV122(book){
 return book?.editionsV36?.version===EXPLAINED_POLICY_V122;
}
export function buildExplainedEditionViewV122(book){
 if(!isExplainedBookV122(book))return null;
 const s=book.editionsV36,byPage=new Map((s.pages||[])
  .filter(Boolean).map(p=>[Number(p.sourcePage),p]));
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
    if(record?.review?.ready===true){
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
 const resultingLetters=(s.pages||[]).filter(p=>p?.review?.ready===true).reduce((n,p)=>n+
   (Number(p.review?.outputLetters)||0),0);
 const complete=s.complete===true;
 const achieved=complete&&originalLetters?
   percentReduced(originalLetters,resultingLetters):null;
 return {...book,chapters,explainedV122:true,
  editionReadiness:{complete,partial:!complete,
   verifiedParagraphs:s.verifiedChunkVariants||0,
   totalParagraphs:s.totalChunkVariants||0,
   source:'explained-v122',status:complete?'available-with-quality-notes':'preview-only'},
  precisionEdition:{level:'explained',label:'Libro spiegato',
   targetPercent:50,achievedPercent:achieved,achievedLettersPercent:achieved,
   originalLetters,resultingLetters:complete?resultingLetters:null,
   qualityGuard:{semanticCertification:false,status:complete?
    'source-guards-passed-not-semantic-certified':'preview-only'},
   reductionCompliant:complete&&achieved!==null&&achieved>=30&&achieved<=60}};
}
