// LAB48: source-page progress, separate from the PDF acquisition and six-edition
// chunk meter. Count only real source pages for which ALL mapped paragraphs of
// the selected edition have provider-verified text. Never infer page readiness
// from book size, chapter count or a percentage of requests made.
const positive=value=>{
  const n=Number(value);return Number.isInteger(n)&&n>0?n:null;
};
export function studyPageProgressV48(book, level='summary'){
  const originalPageCount=positive(book?.canonicalBookMap?.pageCount)||
    positive(book?.sourceData?.structure?.pageCount)||0;
  const chapters=book?.chapters||[];
  const rows=book?.editionsV36?.rows||[];
  const states=new Map();
  for(let ci=0;ci<chapters.length;ci++){
    const chapter=chapters[ci];
    for(let pi=0;pi<(chapter?.paragraphs||[]).length;pi++){
      const p=chapter.paragraphs[pi];
      const start=positive(p?.sourcePageStart)||positive(chapter?.pageStart);
      const end=positive(p?.sourcePageEnd)||start;
      if(!start||!end||end<start)continue;
      const ready=rows[ci]?.[pi]?.verified?.[level]===true;
      // A spanning paragraph must be wholly verified before any source leaf is
      // shown as complete. A corrupt span never certifies arbitrary pages.
      const max=originalPageCount||end;
      if(end-start>30||start>max)continue;
      for(let page=start;page<=Math.min(end,max);page++){
        const old=states.get(page)||{mapped:0,ready:0};
        old.mapped++;if(ready)old.ready++;
        states.set(page,old);
      }
    }
  }
  const mappedPages=states.size;
  const verifiedPages=[...states.values()].filter(s=>s.mapped>0&&s.ready===s.mapped).length;
  return {level,originalPageCount,mappedPages,verifiedPages,
    percent:mappedPages?Math.round(10000*verifiedPages/mappedPages)/100:null,
    status:mappedPages?'measured':'unmapped'};
}
