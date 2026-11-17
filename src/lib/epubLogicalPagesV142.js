// StudyBook AI LAB142 — one immutable, logical text-page map for reflowable EPUB.
// A logical study page is NOT a printed page. No new Gemini calls are made here.
// Offset-based slicing proves exact text coverage even for very long paragraphs.
export const EPUB_LOGICAL_CONTRACT_V142='lab142-epub-immutable-logical-pages-v1';
const MAX_PAGES=2000;
const DEFAULT_CHARS=3200;
const cleanParagraph=x=>String(x||'');
const isSha=x=>/^[0-9a-f]{64}$/iu.test(String(x||''));
function hex(bytes){
 return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
}
export async function sha256EpubV142(buffer){
 if(!globalThis.crypto?.subtle?.digest)
  throw Error('SHA-256 non disponibile: originale EPUB non modificato.');
 return hex(await globalThis.crypto.subtle.digest('SHA-256',buffer));
}
function flat(chapters){
 const paragraphs=[];
 const chapterOffsets=[];
 const meta=[];
 let offset=0;
 for(const chapter of chapters||[]){
  const items=Array.isArray(chapter?.paragraphs)?chapter.paragraphs:[];
  const first=offset;
  for(let i=0;i<items.length;i++){
   const value=cleanParagraph(items[i]);
   if(!value.trim())continue;
   if(paragraphs.length)offset+=2;
   const start=offset;offset+=value.length;
   paragraphs.push(value);
   meta.push({chapterIndex:chapterOffsets.length,paragraphIndex:i,
    sourceStart:start,sourceEnd:offset,
    sectionTitle:chapter.paragraphMeta?.[i]?.sectionTitle||null});
  }
  chapterOffsets.push({start:first,end:offset});
 }
 return {text:paragraphs.join('\n\n'),paragraphs,chapterOffsets,meta};
}
function pageAt(pages,position){
 let lo=0,hi=pages.length-1;
 const pos=Math.max(0,position);
 while(lo<hi){
  const mid=(lo+hi)>>1;
  if(pos>=pages[mid].sourceEnd)lo=mid+1;else hi=mid;
 }
 return pages[lo]?.physicalPage||1;
}
export function buildEpubLogicalPagesV142(source,{fingerprint,fingerprintBasis='original-file',targetChars=DEFAULT_CHARS}={}){
 if(String(source?.sourceFormat||'').toLowerCase()!=='epub')
  throw Error('Il paginatore EPUB non può trasformare altri formati.');
 if(!isSha(fingerprint))throw Error('Impronta EPUB SHA-256 non disponibile.');
 const chapters=Array.isArray(source?.chapters)?source.chapters:[];
 const raw=flat(chapters),text=raw.text;
 if(!text.trim())throw Error('EPUB privo di testo utilizzabile: originale conservato.');
 if(String(source.fullText||'')&&String(source.fullText)!==text)
  throw Error('Testo EPUB e capitoli non coincidono: nessuna pagina inventata.');
 // Keep <=2000 pages on a large ebook, but never create a 120k-character
 // page that would exceed the existing native source-page safety limit.
 const target=Math.max(1600,Math.ceil(Number(targetChars)||DEFAULT_CHARS),
  Math.ceil(text.length/1600));
 if(target>100000)
  throw Error('EPUB oltre il limite di 2000 pagine logiche verificabili.');
 const logical=[],verified=[];
 let start=0;
 while(start<text.length){
  const remaining=text.length-start;
  let end=remaining<=Math.round(target*1.15)?text.length:
    Math.min(text.length,start+target);
  if(end<text.length){
   const local=text.slice(start,end),minimum=Math.floor(target*0.83);
   // Prefer paragraph boundaries without dropping or inserting even spaces.
   const para=local.lastIndexOf('\n\n');
   const word=local.lastIndexOf(' ');
   const breakPos=para>=minimum?para+2:word>=minimum?word+1:local.length;
   end=start+breakPos;
   // Do not split a UTF-16 surrogate pair.
   if(end>start&&end<text.length&&
      /[\uD800-\uDBFF]/u.test(text.charAt(end-1))&&
      /[\uDC00-\uDFFF]/u.test(text.charAt(end)))end-=1;
  }
  if(end<=start)throw Error('Paginazione EPUB senza avanzamento.');
  const body=text.slice(start,end),n=logical.length+1;
  logical.push({physicalPage:n,label:String(n),logicalPage:true,
   sourceStart:start,sourceEnd:end,text:body,sourceStatus:'verified',
   sourceLineCount:Math.max(1,Math.ceil(body.length/92)),
   widthPt:595.28,heightPt:841.89,textLength:body.length,
   imageReferences:[],textLineGeometry:[]});
  verified.push({pageNumber:n,text:body,status:'verified',logicalPage:true,
   sourceStart:start,sourceEnd:end,sourceLineCount:Math.max(1,Math.ceil(body.length/92)),
   widthPt:595.28,heightPt:841.89});
  if(logical.length>MAX_PAGES)
   throw Error('EPUB oltre il limite di 2000 pagine logiche.');
  start=end;
 }
 if(logical.map(p=>p.text).join('')!==text||
    logical.at(-1)?.sourceEnd!==text.length)
  throw Error('Copertura delle pagine EPUB non verificata.');
 const mappedChapters=chapters.map((chapter,index)=>{
  const range=raw.chapterOffsets[index];
  const paragraphs=(chapter.paragraphs||[]).map(x=>String(x||''));
  const paragraphMeta=(chapter.paragraphMeta||[]).map(x=>({...x}));
  const references=raw.meta.filter(m=>m.chapterIndex===index);
  for(const r of references){
   paragraphMeta[r.paragraphIndex]={
    ...paragraphMeta[r.paragraphIndex],
    pageStart:pageAt(logical,r.sourceStart),
    pageEnd:pageAt(logical,Math.max(r.sourceStart,r.sourceEnd-1))
   };
  }
  const startPage=pageAt(logical,range.start),endPage=pageAt(logical,
   Math.max(range.start,range.end-1));
  const sections=(chapter.sections||[]).map(section=>{
   const located=references.find(x=>x.sectionTitle===section.title);
   const anchor=located?located.sourceStart:range.start;
   return {...section,pageStart:pageAt(logical,anchor),
    pageEnd:endPage};
  });
  return {...chapter,pageStart:startPage,pageEnd:endPage,
   paragraphs,paragraphMeta,sections};
 });
 const mapChapters=mappedChapters.map((chapter,i)=>({
  id:'chapter-'+(i+1),title:chapter.title,numbering:chapter.numbering||null,
  pageStart:chapter.pageStart,pageEnd:chapter.pageEnd,
  paragraphCount:chapter.paragraphs.length,
  sections:chapter.sections.map((section,j)=>({
   id:'chapter-'+(i+1)+':section-'+(j+1),title:section.title,
   level:section.level,pageStart:section.pageStart,
   parentTitle:section.parentTitle||null
  }))
 }));
 const canonicalBookMap={
  version:35,originalFingerprint:fingerprint,
  fingerprintBasis,sourceFormat:'epub',paginationOwner:EPUB_LOGICAL_CONTRACT_V142,
  pageCount:logical.length,logicalPageCount:logical.length,
  pages:logical,chapters:mapChapters,outline:[],visualAnchors:[],
  structuralStatus:'source-mapped-logical',uncertain:[],
  exactTextCoverage:true,sourceTextLength:text.length,
  frozenAt:new Date().toISOString()
 };
 return {
  ...source,fullText:text,pages:verified,chapters:mappedChapters,
  canonicalBookMap,sourceFormat:'epub',
  structure:{...(source.structure||{}),pageCount:logical.length,
   chapterCount:mappedChapters.length,logicalPages:true,
   paginationOwner:EPUB_LOGICAL_CONTRACT_V142,
   paginationKind:'logical-not-printed',sourceFingerprintBasis:fingerprintBasis,
   textFirst:true}
 };
}
export async function ensureEpubLogicalPagesV142(source,{originalFile}={}){
 if(source?.sourceFormat!=='epub')return source;
 const existing=source?.canonicalBookMap;
 if(existing?.paginationOwner===EPUB_LOGICAL_CONTRACT_V142&&
    existing.pages?.length===existing.pageCount&&existing.pageCount>0&&
    isSha(existing.originalFingerprint)&&existing.exactTextCoverage===true)
  return source;
 // Old LAB141 EPUBs stored chapters+text but no source pages. Use actual
 // saved file bytes when available. Fallback is labeled a TEXT fingerprint,
 // never represented as verified original-file SHA-256.
 const haveFile=originalFile&&typeof originalFile.arrayBuffer==='function';
 const bytes=haveFile?await originalFile.arrayBuffer():new TextEncoder()
  .encode(JSON.stringify({format:'epub',chapters:(source.chapters||[]).map(
   x=>({title:x.title,paragraphs:x.paragraphs}))}));
 const fingerprint=await sha256EpubV142(bytes);
 return buildEpubLogicalPagesV142(source,{fingerprint,
  fingerprintBasis:haveFile?'original-file':'extracted-text'});
}
