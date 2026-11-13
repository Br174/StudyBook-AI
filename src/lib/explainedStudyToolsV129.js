// LAB129: restore study tools for explained books without changing their stored edition.
// Questions/cards remain grounded in the acquired original, not invented from summaries.
import {originalExplainedPagesV122} from './explainedPolicyV122.js';

export function studyToolBookForExplainedV129(precisionBook,sourceBook){
 if(!precisionBook||!sourceBook)return precisionBook;
 // Existing chapter-based tools retain exactly the same source paragraphs.
 const existing=precisionBook.chapters||[];
 if(existing.some(chapter=>(chapter.paragraphs||[]).some(p=>
   typeof p.original==='string'&&p.original.trim())))return precisionBook;
 const pages=originalExplainedPagesV122(sourceBook);
 const chapters=pages.filter(p=>Array.isArray(p.segments)&&p.segments.some(s=>
  typeof s.source==='string'&&s.source.trim())).map(p=>({
  title:'Pagina '+String(p.label||p.physicalPage),
  pageStart:p.physicalPage,pageEnd:p.physicalPage,
  paragraphs:[{
   original:p.segments.map(s=>s.source||'').filter(Boolean).join('\n\n'),
   summary:'',sourceSection:'Pagina '+String(p.label||p.physicalPage),
   sourcePageStart:p.physicalPage,sourcePageEnd:p.physicalPage,
   glossary:[],sourceChapterIndex:p.physicalPage-1
  }]
 }));
 return {...precisionBook,chapters};
}
