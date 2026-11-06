// StudyBook AI LAB35 Libro Specchio 360.
// Source page identifiers are immutable. Reductions NEVER edit the source map.
// Derived "bis/ter" leaves are text overflow; "/N" leaves are figures.
// Visual coordinates are source evidence, not semantic OCR certification.
export const MIRROR_VERSION = 35;
const clean = value => String(value ?? '').replace(/\s+/gu,' ').trim();
const countLetters = value => (String(value || '').match(/\p{L}/gu)||[]).length;
const countWords = value => (clean(value).match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu)||[]).length;
const slug = s => clean(s).toLocaleLowerCase('it-IT')
  .normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^\p{L}\p{N}]+/gu,' ');
const sameTitle=(a,b)=>slug(a)===slug(b);
const safeNumber=(num,other)=>Number.isInteger(num)&&num>0?num:other;
const labels=['','bis','ter','quater','quinquies','sexies','septies','octies','nonies','decies'];
export function continuationLabel(page,number) {
  return number < labels.length ? page+' '+labels[number] : page+' bis '+number;
}
export function canonicalFingerprint(map){
  return [map?.originalFingerprint||'',map?.pageCount||0,(map?.chapters||[]).map(c=>[
    c.title,c.pageStart,c.pageEnd,(c.sections||[]).map(s=>s.title+':'+s.level).join('~')
  ].join('^')).join('||')].join('::');
}
function flattenOutline(nodes=[],depth=1,result=[]){
  for(const x of nodes||[]){
    if(!x?.title)continue;
    result.push({title:String(x.title),pageNumber:safeNumber(x.pageNumber,null),depth:Number(x.depth||depth),source:'pdf-outline'});
    flattenOutline(x.items||[],depth+1,result);
  }
  return result;
}
export function buildCanonicalBookMap({
  pages=[],chapters=[],outline=[],pageLabels=[],visualAnchors=[],
  originalFingerprint='',pdfPageCount,
}={}){
  const maxPage=Number.isInteger(pdfPageCount)&&pdfPageCount>0?pdfPageCount:pages.length;
  const byPage=new Map(pages.map(p=>[p.pageNumber,p]));
  const anchors=visualAnchors.map((a,i)=>({...a,
    id:a.id||'figure:'+a.sourcePage+':'+a.imageNumber,
    sourcePage:safeNumber(a.sourcePage,1),imageNumber:safeNumber(a.imageNumber,i+1)
  })).sort((a,b)=>a.sourcePage-b.sourcePage || a.imageNumber-b.imageNumber);
  const imageByPage=new Map();
  for(const a of anchors){
    if(!imageByPage.has(a.sourcePage))imageByPage.set(a.sourcePage,[]);
    imageByPage.get(a.sourcePage).push(a);
  }
  const sourcePages=Array.from({length:maxPage},(_,i)=>{
    const source=byPage.get(i+1)||{};
    const imageReferences=imageByPage.get(i+1)||[];
    return Object.freeze({
      physicalPage:i+1,label:String(pageLabels?.[i]||i+1),
      sourceStatus:source.status||'unknown',
      text:source.text||'',textLength:String(source.text||'').length,
      imageReferences:imageReferences.map(a=>({
        id:a.id,imageNumber:a.imageNumber,sourcePage:a.sourcePage,
        kind:a.kind||'raster',rect:a.rect||null,positionConfidence:a.positionConfidence||'unknown'
      })),
    });
  });
  const fixedChapters=chapters.map((c,index)=>({
    id:'chapter-'+(index+1),
    title:String(c.title||''),numbering:c.numbering||null,
    pageStart:safeNumber(c.pageStart,null),pageEnd:safeNumber(c.pageEnd,null),
    sections:(c.sections||[]).map((s,j)=>({
      id:'chapter-'+(index+1)+':section-'+(j+1),
      title:String(s.title||''),level:Number(s.level||2),
      pageStart:safeNumber(s.pageStart,null),
      parentTitle:s.parentTitle||null,
    })),
    paragraphCount:(c.paragraphs||[]).length,
  }));
  const outlineRows=flattenOutline(outline);
  const roots=outlineRows.filter(x=>x.depth===1 &&
    !/^(?:indice|contents|sommario)$/iu.test(clean(x.title)));
  const uncertain=[];
  if(!originalFingerprint || !/^[a-f0-9]{64}$/iu.test(originalFingerprint))
    uncertain.push('original-sha256-not-verified');
  if(sourcePages.some(p=>p.sourceStatus!=='verified'))
    uncertain.push('source-pages-pending');
  if(!fixedChapters.length)uncertain.push('chapters-not-detected');
  if(roots.length && (roots.length!==fixedChapters.length ||
     roots.some((x,i)=>!sameTitle(x.title,fixedChapters[i]?.title))))
    uncertain.push('pdf-outline-and-detected-chapters-disagree');
  if(fixedChapters.some(c=>!c.title || !c.pageStart))
    uncertain.push('chapter-title-or-page-unresolved');
  if(anchors.some(a=>a.positionConfidence!=='exact'))
    uncertain.push('figure-position-requires-review');
  return {
    version:MIRROR_VERSION,originalFingerprint,pageCount:maxPage,
    chapters:fixedChapters,pages:sourcePages,outline:outlineRows,
    visualAnchors:anchors,
    structuralStatus:uncertain.length?'needs-review':'source-mapped',
    uncertain:[...new Set(uncertain)],
    frozenAt:new Date().toISOString(),
  };
}
export function auditMirrorAgainstSource(sourceMap,studyBook) {
  const problems=[];
  if(!sourceMap?.pages?.length)problems.push('missing-source-page-map');
  const actual=studyBook?.chapters||[],expected=sourceMap?.chapters||[];
  if(actual.length!==expected.length)problems.push('chapter-count-changed');
  expected.forEach((origin,i)=>{
    const curr=actual[i];
    if(!curr||curr.title!==origin.title)problems.push('chapter-title-changed:'+i);
    if(curr && origin.paragraphCount!==curr.paragraphs?.length)
      problems.push('chapter-paragraph-count-changed:'+i);
    if(curr && (curr.sections||[]).length!==origin.sections.length)
      problems.push('section-count-changed:'+i);
    origin.sections.forEach((s,j)=>{
      if(curr && curr.sections?.[j]?.title!==s.title)
        problems.push('section-title-changed:'+i+':'+j);
    });
  });
  const seen=new Set((sourceMap?.pages||[]).map(p=>p.physicalPage));
  for(let i=1;i<=Number(sourceMap?.pageCount||0);i++)
    if(!seen.has(i))problems.push('page-missing:'+i);
  return {valid:problems.length===0,problems,sourcePages:sourceMap?.pageCount||0,
    chapterCount:expected.length,semanticCertified:false};
}
function paragraphText(p,variant){
  if(variant==='original')return String(p.original||p.summary||'');
  if(variant==='simple')return String(p.simpleSummary||p.summary||p.original||'');
  return String(p.summary||p.dsaSummary||p.original||'');
}
function wrapApprox(text,limit=92) {
  const out=[];for(const paragraph of String(text||'').split('\n')){
    if(!paragraph.trim()){out.push('');continue;}
    let line='';
    for(const word of paragraph.split(/\s+/)){
      if(line.length+word.length+1>limit && line){out.push(line);line=word;}
      else line=line?line+' '+word:word;
    }
    if(line)out.push(line);
  }
  return out;
}
function pushText(pages,pageName,sourcePage,chapterIndex,lines,originalText,
   sectionTitle,chapterTitle,status) {
  const page={kind:'text',label:pageName,sourcePage,chapterIndex,
    chapterTitle,blocks:[],imageLinks:[],sourceStatus:status,
    originalWords:0,resultWords:0,originalLetters:0,resultLetters:0,
    originalLines:0,resultLines:0};
  pages.push(page);
  return page;
}
function metrics(page,original,edited,originalLines,resultLines){
  page.originalWords+=countWords(original);
  page.resultWords+=countWords(edited);
  page.originalLetters+=countLetters(original);
  page.resultLetters+=countLetters(edited);
  page.originalLines+=originalLines;
  page.resultLines+=resultLines;
}
function photoInsertionIndex(anchor,totalText){
  const frac=Number(anchor?.relativeTextPosition ?? NaN);
  if(!Number.isFinite(frac))return totalText;
  return Math.max(0,Math.min(totalText,Math.round(totalText*Math.max(0,Math.min(1,frac)))));
}
export function composeMirrorPages(sourceMap,book,{
  variant='study',maxLines=43,wrapLines=wrapApprox,
}={}){
  if(!sourceMap?.pages?.length || !book) return {pages:[],audit:{valid:false,problems:['missing-input']}};
  const audit=auditMirrorAgainstSource(sourceMap,book);
  const byPhysicalPage=new Map(sourceMap.pages.map(p=>[p.physicalPage,{
    source:p,entries:[],images:(sourceMap.visualAnchors||[]).filter(a=>a.sourcePage===p.physicalPage),
  }]));
  // Each original paragraph has one immutable page owner. Multi-page old
  // paragraphs are marked uncertain, NEVER silently spread to the next page.
  for(let i=0;i<(book.chapters||[]).length;i++){
    const chapter=book.chapters[i];
    for(let j=0;j<(chapter.paragraphs||[]).length;j++){
      const p=chapter.paragraphs[j],owner=safeNumber(p.sourcePageStart,safeNumber(chapter.pageStart,1));
      const row=byPhysicalPage.get(owner);
      if(!row){audit.problems.push('paragraph-without-source-page:'+i+':'+j);continue;}
      const sourcePageEnd=safeNumber(p.sourcePageEnd,owner);
      if(sourcePageEnd!==owner) audit.problems.push('cross-page-paragraph-needs-review:'+i+':'+j);
      row.entries.push({kind:'paragraph',chapterIndex:i,chapterTitle:chapter.title,
        sectionTitle:p.sourceSection||null,paragraphIndex:j,
        original:String(p.original||''),text:paragraphText(p,variant),
      });
    }
  }
  const pages=[];
  for(const source of sourceMap.pages){
    const row=byPhysicalPage.get(source.physicalPage);
    const anchors=row.images||[];
    // A frontispiece/index page with no processed paragraphs is preserved
    // verbatim, not silently deleted from the printed book.
    if(!row.entries.length && source.text.trim()) {
      row.entries.push({kind:'original-page',chapterIndex:null,chapterTitle:'',
        sectionTitle:'',original:source.text,text:source.text});
    }
    const textEntries=row.entries.slice();
    const totalCharacters=textEntries.reduce((n,e)=>n+e.text.length,0);
    const withReferences=[];
    let consumed=0,figIndex=0;
    const positioned=anchors.slice().sort((a,b)=>
      photoInsertionIndex(a,totalCharacters)-photoInsertionIndex(b,totalCharacters)
      || a.imageNumber-b.imageNumber);
    for(const e of textEntries){
      withReferences.push(e);
      consumed+=e.text.length;
      while(figIndex<positioned.length &&
        photoInsertionIndex(positioned[figIndex],totalCharacters)<=consumed){
        const a=positioned[figIndex++];
        withReferences.push({kind:'image-ref',anchor:a,text:'(Immagine '+a.imageNumber+')',original:''});
      }
    }
    while(figIndex<positioned.length){
      const a=positioned[figIndex++];
      withReferences.push({kind:'image-ref',anchor:a,text:'(Immagine '+a.imageNumber+')',original:''});
    }
    const sourceStatus=source.sourceStatus;
    let sheet=pushText(pages,source.label,source.physicalPage,null,[],null,null,null,sourceStatus);
    let remaining=Math.max(1,maxLines),continuation=0,lastSection='',lastChapter='';
    function newSheet(){
      continuation+=1;
      sheet=pushText(pages,continuationLabel(source.label,continuation),
        source.physicalPage,null,[],null,null,null,sourceStatus);
      remaining=Math.max(1,maxLines);lastSection='';lastChapter='';
    }
    for(const e of withReferences){
      if(e.kind==='image-ref'){
        if(remaining<1)newSheet();
        sheet.blocks.push({kind:'image-ref',text:e.text,anchorId:e.anchor.id,
          sourcePage:e.anchor.sourcePage,imageNumber:e.anchor.imageNumber});
        sheet.imageLinks.push(e.anchor.id);remaining-=1;continue;
      }
      const heading=[];
      if(e.chapterTitle && lastChapter!==e.chapterTitle){
        heading.push({kind:'chapter-title',text:e.chapterTitle});
        lastChapter=e.chapterTitle;
      }
      if(e.sectionTitle && lastSection!==e.sectionTitle){
        heading.push({kind:'section-title',text:e.sectionTitle});
        lastSection=e.sectionTitle;
      }
      if(heading.length+1>remaining)newSheet();
      for(const h of heading){sheet.blocks.push(h);remaining-=2;}
      const targetLines=wrapLines(e.text)||[];
      const originalLineCount=(wrapLines(e.original)||[]).length;
      const outputCount=targetLines.length;
      const minimum=1;
      let offset=0;
      if(!targetLines.length) targetLines.push('');
      while(offset<targetLines.length){
        if(remaining<=0)newSheet();
        const take=Math.max(minimum,Math.min(remaining,targetLines.length-offset));
        const part=targetLines.slice(offset,offset+take).join('\n');
        const first=offset===0;
        sheet.blocks.push({kind:e.kind,text:part,
          chapterIndex:e.chapterIndex,paragraphIndex:e.paragraphIndex,
          sourcePage:source.physicalPage,
          sectionTitle:e.sectionTitle,
          continued:!first});
        // Attribute the original words once, not repeatedly on each overflow.
        const weight=take/Math.max(1,outputCount);
        metrics(sheet,e.original,part,first?originalLineCount:0,take);
        // Correct the un-split source word double-count if paragraphs overflow.
        if(!first){
          sheet.originalWords-=countWords(e.original);
          sheet.originalLetters-=countLetters(e.original);
        }
        remaining-=take;offset+=take;
      }
    }
    for(const a of anchors){
      // Image leaves NEVER consume the text page capacity.
      pages.push({kind:'image',label:source.label+'/'+a.imageNumber,
        sourcePage:source.physicalPage,anchorId:a.id,anchor:a,
        sourceStatus,blocks:[],imageNumber:a.imageNumber});
    }
  }
  audit.valid=audit.problems.length===0;
  return {pages,audit,sourcePageCount:sourceMap.pageCount,
    imageCount:(sourceMap.visualAnchors||[]).length,
    structureLocked:true,variant};
}
export function mirrorPageStatistics(page){
  const oldWords=page?.originalWords||0,newWords=page?.resultWords||0;
  const oldLetters=page?.originalLetters||0,newLetters=page?.resultLetters||0;
  return {
    originalWords:oldWords,editedWords:newWords,wordsSaved:oldWords-newWords,
    originalLetters:oldLetters,editedLetters:newLetters,
    lettersSaved:oldLetters-newLetters,
    originalLines:page?.originalLines||0,editedLines:page?.resultLines||0,
    linesSaved:(page?.originalLines||0)-(page?.resultLines||0),
    achievedPercent:oldLetters>0?Math.round((1-newLetters/oldLetters)*1000)/10:0,
  };
}
