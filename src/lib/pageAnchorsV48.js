// LAB48: text-only page position anchors. Never extracts images or rearranges
// page ownership. The original PDF stays byte-for-byte immutable.
const normalized=value=>String(value||'').toLocaleLowerCase('it-IT')
  .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .replace(/[^\p{L}\p{N}]+/gu,' ').trim();
function titleLine(lines,title){
  const key=normalized(title);
  if(key.length<7)return -1;
  return lines.findIndex(line=>{
    const found=normalized(line);
    return found===key || found.startsWith(key+' ') ||
      (key.startsWith(found+' ')&&found.length>=8&&found.length>=key.length*.55);
  });
}
function paragraphLine(lines,source){
  const text=normalized(source);
  if(!text)return -1;
  const stem=text.slice(0,Math.min(27,text.length));
  return lines.findIndex(line=>normalized(line).startsWith(stem)||
    (normalized(line).length>=12 && stem.startsWith(normalized(line))));
}
export function anchorPageEntriesV48(source,sourceMap,entries=[]){
  const lines=String(source?.text||'').split('\n').map(x=>x.trim()).filter(Boolean);
  const geometry=Array.isArray(source?.textLineGeometry)?source.textLineGeometry:[];
  const topAt=index=>index>=0&&Number.isFinite(geometry[index]?.topPt)
    ?Number(geometry[index].topPt):null;
  const numbered=entries.map((entry,index)=>{
    const line=paragraphLine(lines,entry.original);
    return {...entry,sourceLineIndex:line,sourceTopPt:topAt(line),
      sourceOrder:index};
  });
  // A heading belongs to its printed original source page, never every
  // processed paragraph, chapter view or bis/tris continuation.
  const headings=[];
  if(entries.length){
    const page=Number(source?.physicalPage);
    for(const chapter of sourceMap?.chapters||[]){
      if(Number(chapter.pageStart)===page){
        const pos=titleLine(lines,chapter.title);
        if(pos>=0)headings.push({kind:'chapter-title',text:lines[pos],sourceLineIndex:pos,sourceTopPt:topAt(pos)});
      }
      for(const section of chapter.sections||[]){
        if(Number(section.pageStart)!==page)continue;
        const pos=titleLine(lines,section.title);
        if(pos>=0)headings.push({kind:'section-title',text:lines[pos],
          sourceLineIndex:pos,sourceTopPt:topAt(pos),sectionLevel:Number(section.level||2)});
      }
    }
  }
  // A single printed title must never appear twice, even when chapter/section
  // heuristics found it simultaneously.
  const seen=new Set();
  const unique=headings.filter(h=>{
    const key=h.sourceLineIndex+':'+normalized(h.text);
    if(seen.has(key))return false;seen.add(key);return true;
  });
  const sorted=[...numbered,...unique].sort((a,b)=>{
    const aPos=a.sourceLineIndex<0?Number.POSITIVE_INFINITY:a.sourceLineIndex;
    const bPos=b.sourceLineIndex<0?Number.POSITIVE_INFINITY:b.sourceLineIndex;
    return aPos-bPos || (a.kind==='chapter-title'?-1:b.kind==='chapter-title'?1:0)
      || (a.kind==='section-title'?-1:b.kind==='section-title'?1:0)
      || (a.sourceOrder??0)-(b.sourceOrder??0);
  });
  return {entries:sorted,sourceLineCount:lines.length,headingCount:unique.length,
    unplacedHeadingCount:(sourceMap?.chapters||[]).reduce((count,ch)=>
      count+(Number(ch.pageStart)===Number(source.physicalPage)&&titleLine(lines,ch.title)<0?1:0)+
      (ch.sections||[]).filter(sec=>Number(sec.pageStart)===Number(source.physicalPage)
        &&titleLine(lines,sec.title)<0).length,0)};
}
