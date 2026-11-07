// LAB51: public reading must always advance from physical page 1.
// Already-verified later results remain staged in checkpoints, never discarded.
export const EDITION_LEVELS_V51=['summary','50','40','30','20','10'];
const positive=v=>Number.isInteger(Number(v))&&Number(v)>0?Number(v):null;
export function publishSequentialPagesV51(book,sourceRows){
  const pages=book?.canonicalBookMap?.pages||[];
  const last=book?.canonicalBookMap?.pageCount||Math.max(0,...(book?.chapters||[]).map(c=>c.pageEnd||0));
  const positions=new Map();
  for(let ci=0;ci<(book.chapters||[]).length;ci++){
    const ch=book.chapters[ci];
    for(let pi=0;pi<(ch.paragraphs||[]).length;pi++){
      const p=ch.paragraphs[pi],start=positive(p.sourcePageStart)||positive(ch.pageStart);
      const end=positive(p.sourcePageEnd)||positive(ch.pageEnd)||start;
      if(!start||!end||end<start)continue;
      for(let page=start;page<=end;page++){
        const found=positions.get(page)||[];
        found.push({ci,pi,start,end});positions.set(page,found);
      }
    }
  }
  const through={};
  for(const level of EDITION_LEVELS_V51){
    let limit=0;
    for(let page=1;page<=last;page++){
      const mapped=positions.get(page)||[];
      if(mapped.some(u=>sourceRows[u.ci]?.[u.pi]?.verified?.[level]!==true))break;
      limit=page;
    }
    through[level]=limit;
  }
  const rows=sourceRows.map((chapter,ci)=>chapter.map((row,pi)=>{
    const p=book.chapters[ci].paragraphs[pi],ch=book.chapters[ci];
    const end=positive(p.sourcePageEnd)||positive(ch.pageEnd)||
      positive(p.sourcePageStart)||positive(ch.pageStart)||Infinity;
    const editions={...row.editions},verified={...row.verified},
      issues={...row.issues},achievedPercent={...row.achievedPercent};
    for(const level of EDITION_LEVELS_V51){
      if(end<=through[level])continue;
      editions[level]=null;verified[level]=false;
      achievedPercent[level]=null;
      issues[level]=['waiting-for-earlier-page'];
    }
    return {...row,editions,verified,issues,achievedPercent};
  }));
  return {rows,through};
}
