// LAB130 — ephemeral editable draft: never marks the stored book complete.
// Pending pages carry the ORIGINAL text and an explicit, visible warning.
import {originalExplainedPagesV122} from './explainedPolicyV122.js';
import {buildProvisionalExplainedBookV128} from './explainedProvisionalV128.js';

export const EDITABLE_DRAFT_WARNING_V130=
 'BOZZA INCOMPLETA — TESTO ORIGINALE NON ANCORA RIELABORATO CON GEMINI';
export function editableExplainedBookV130(storedBook,view){
 if(!view?.editionReadiness?.partial)
  return {book:view,provisional:false,unfinished:[]};
 const temporary=buildProvisionalExplainedBookV128(storedBook);
 const originals=originalExplainedPagesV122(storedBook);
 const records=new Map((temporary.book.editionsV36.pages||[]).filter(Boolean)
  .map(record=>[record.id,record]));
 const originalChapters=Array.isArray(storedBook?.chapters)?storedBook.chapters:[];
 const chapterSet=[];
 const unfinished=[];
 let group=null;
 for(const source of originals){
  const page=Number(source.physicalPage)||1;
  let c=originalChapters.find(ch=>{
   const first=Number(ch.pageStart)||1;
   const last=Number(ch.pageEnd)||first;
   return page>=first&&page<=last;
  });
  if(!c)c={title:'Pagine originali'};
  const title=String(c.title||'Capitolo');
  if(!group||group.sourceTitle!==title){
   group={sourceTitle:title,title,paragraphs:[]};
   chapterSet.push(group);
  }
  const record=records.get(source.id);
  const original=(source.segments||[]).map(x=>x.source).filter(Boolean).join('\n\n');
  const pending=record?.review?.provisionalOriginal===true;
  const explained=Array.isArray(record?.segments)?
   record.segments.map(x=>String(x.text||'')).filter(Boolean).join('\n\n'):'';
  if(pending)unfinished.push(page);
  const editionText=(pending?EDITABLE_DRAFT_WARNING_V130+
   '\nPagina originale '+page+'\n\n':'')+(explained||original);
  group.paragraphs.push({
   original,summary:editionText,dsaSummary:editionText,simpleSummary:undefined,
   sourcePageStart:page,sourcePageEnd:page,
   sourceSection:'Pagina originale '+page,
   glossary:pending?[]:(record?.glossary||[]),
   editionPending:false,provisionalOriginal:pending
  });
 }
 const exported={
  ...view,
  chapters:chapterSet,
  // Visible draft marker in the document title, not a mutation to stored state.
  title:EDITABLE_DRAFT_WARNING_V130,
  editionReadiness:{...(view.editionReadiness||{}),partial:false,
   complete:false,exportPreviewOnly:true}
 };
 return {book:exported,provisional:true,unfinished};
}
