// LAB35: the PDF outline is stronger evidence than guesswork from font/lines,
// but ONLY if its chapter entries match their printed source pages.
// Never silently change chapters based on unverified bookmarks.
const canonical=value=>String(value||'').toLocaleLowerCase('it-IT')
  .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .replace(/^(?:cap(?:itolo)?\.?\s*\d+\s*[:.\-–]\s*|\d+\s*[.)]\s*)/iu,'')
  .replace(/[^\p{L}\p{N}]+/gu,' ').trim();
export function choosePdfChapterAuthority(pages=[],sourceChapters=[],outline=[]){
  const roots=(outline||[]).filter(x=>x.depth===1 && x?.title
    && !/^(?:indice|sommario|contents)$/iu.test(String(x.title).trim()));
  if(roots.length<2)return {
    chapters:sourceChapters,authority:'source-text',review:[],
  };
  if(roots.some(x=>!Number.isInteger(x.pageNumber)||x.pageNumber<1)
    ||roots.some((x,i)=>i>0 && x.pageNumber<=roots[i-1].pageNumber)){
    return {chapters:sourceChapters,authority:'source-text',
      review:['pdf-outline-page-order-uncertain']};
  }
  const byPage=new Map((pages||[]).map(p=>[p.pageNumber,String(p.text||'')]));
  const headingMatches=roots.filter(r=>{
    const first=canonical(r.title);
    const source=canonical(byPage.get(r.pageNumber)||'');
    return Boolean(first.length>=6 && source.includes(first.slice(0,Math.min(first.length,55))));
  }).length;
  // A bookmark alone is not enough: require source page evidence.
  if(headingMatches < Math.ceil(roots.length*0.75))return {
    chapters:sourceChapters,authority:'source-text',
    review:['pdf-outline-chapter-titles-not-confirmed:'+headingMatches+'/'+roots.length],
  };
  const normalized=[];
  const rootsWithEnd=roots.map((row,i)=>({...row,
    until:roots[i+1]?.pageNumber||Number.MAX_SAFE_INTEGER,
  }));
  for(const [i,root] of rootsWithEnd.entries()){
    normalized.push({
      title:root.title,pageStart:root.pageNumber,
      pageEnd:Math.max(root.pageNumber,Math.min(
        root.until-1,Math.max(root.pageNumber,...pages.map(p=>p.pageNumber||0)))),
      sections:[],paragraphs:[],paragraphMeta:[],numbering:null,
      outlineVerified:true,
    });
  }
  for(const previous of sourceChapters){
    let sectionName='';
    for(let j=0;j<(previous.paragraphs||[]).length;j++){
      const meta=previous.paragraphMeta?.[j]||{};
      const sourcePage=Number(meta.pageStart||previous.pageStart||0);
      const targetIndex=rootsWithEnd.findIndex(r=>sourcePage>=r.pageNumber && sourcePage<r.until);
      if(targetIndex<0)continue; // Physical front matter remains in source pages.
      const next=normalized[targetIndex];
      const priorTitle=String(previous.title||'');
      if(priorTitle && canonical(priorTitle)!==canonical(next.title)
        && !/^(?:introduzione|documento)$/iu.test(priorTitle)){
        sectionName=priorTitle;
        if(!next.sections.some(x=>x.title===sectionName))next.sections.push({
          title:sectionName,level:2,pageStart:sourcePage,parentTitle:next.title,
        });
      }
      next.paragraphs.push(previous.paragraphs[j]);
      next.paragraphMeta.push({...meta,pageStart:sourcePage,
        pageEnd:Number(meta.pageEnd||sourcePage),
        sectionTitle:meta.sectionTitle||sectionName||null,
      });
    }
    for(const section of previous.sections||[]){
      const p=Number(section.pageStart||previous.pageStart||0);
      const targetIndex=rootsWithEnd.findIndex(r=>p>=r.pageNumber && p<r.until);
      if(targetIndex>=0&&!normalized[targetIndex].sections.some(s=>s.title===section.title))
        normalized[targetIndex].sections.push({...section});
    }
  }
  // If grouping would discard text, the original detected structure wins.
  const oldText=sourceChapters.reduce((n,c)=>n+(c.paragraphs||[])
    .reduce((m,p)=>m+String(p||'').length,0),0);
  const newText=normalized.reduce((n,c)=>n+(c.paragraphs||[])
    .reduce((m,p)=>m+String(p||'').length,0),0);
  if(newText<oldText*0.99 || normalized.some(c=>!c.paragraphs.length))
    return {chapters:sourceChapters,authority:'source-text',
      review:['pdf-outline-reconstruction-incomplete']};
  return {chapters:normalized,authority:'pdf-outline-verified',
    review:[],outlineRootCount:roots.length,matchedRootTitles:headingMatches};
}
