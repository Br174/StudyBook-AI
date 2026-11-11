// LAB122 deterministic 70/30 mirror layout. Gemini NEVER decides paper breaks.
// Original pages are anchors; overflow is emitted only as bis, tris, quater...
import {continuationLabel} from './libroSpecchioV35.js';
import {originalExplainedPagesV122} from './explainedPolicyV122.js';
const mm=pt=>Number(pt||0)*25.4/72;
const clean=x=>String(x||'').replace(/\*\*/gu,'').trim();
export function approximateWrapV122(text,widthMm,font='body'){
 const max=Math.max(9,Math.floor(widthMm/(font==='glossary'?2.0:font==='heading'?2.8:2.3)));
 const lines=[];
 for(const paragraph of String(text||'').split(/\n/u)){
  if(!paragraph.trim()){lines.push('');continue;}
  let current='';
  for(const word of paragraph.trim().split(/\s+/u)){
   if(!current){current=word;continue;}
   if((current+' '+word).length>max){lines.push(current);current=word;}
   else current+=' '+word;
  }
  if(current)lines.push(current);
 }
 return lines.length?lines:[''];
}
const sentenceUnits=text=>{
 const lines=String(text||'').split(/\n+/u).map(x=>x.trim()).filter(Boolean);
 return lines.flatMap(line=>{
  const parts=line.match(/[^.!?]+(?:[.!?]+|$)/gu)||[line];
  return parts.map(x=>x.trim()).filter(Boolean);
 });
};
const same=(a,b)=>String(a).trim().toLocaleLowerCase('it-IT')===
 String(b).trim().toLocaleLowerCase('it-IT');
export function composeExplainedSheetsV122(book,{
 wrapText=approximateWrapV122,requireComplete=false
}={}){
 const originals=originalExplainedPagesV122(book);
 const snapshot=book?.editionsV36;
 const records=new Map((snapshot?.pages||[]).filter(Boolean).map(p=>[p.id,p]));
 const sheets=[],issues=[];
 const margin=15,gap=4,top=25,bottom=22;
 for(const original of originals){
  const record=records.get(original.id);
  const ready=record?.review?.ready===true;
  if(requireComplete&&!ready)
   throw Object.assign(new Error('Pagina '+original.label+' non verificata.'),{code:'V122_PAGE_NOT_READY'});
  const widthMm=Math.max(100,mm(original.widthPt)),heightMm=Math.max(140,mm(original.heightPt));
  const contentWidth=widthMm-2*margin-gap;
  const textWidth=contentWidth*.69,glossaryWidth=contentWidth-textWidth;
  const maxY=heightMm-bottom;
  let continuation=0;
  const newSheet=()=>{
   const sheet={label:continuation===0?original.label:
    continuationLabel(original.label,continuation),
    sourcePage:original.physicalPage,widthMm,heightMm,
    textWidth,glossaryWidth,margin,gap,top,bottom,
    ready,rows:[],sourceLetters:original.originalBodyLetters,
    reduction:record?.review?.reduction??null};
   sheets.push(sheet);continuation++;
   return sheet;
  };
  let sheet=newSheet(),currentY=top;
  const glossary=Array.isArray(record?.glossary)?record.glossary:[];
  const emittedTerms=new Set();
  const noteFor=text=>{
   const result=[];
   for(const item of glossary){
    const term=String(item.term||'').trim();
    const key=term.toLocaleLowerCase('it-IT');
    if(!term||emittedTerms.has(key))continue;
    const marker='**('+term+')**';
    if(!String(text||'').toLocaleLowerCase('it-IT').includes(marker.toLocaleLowerCase('it-IT')))continue;
    emittedTerms.add(key);
    result.push({term,definition:String(item.definition||'')});
   }
   return result;
  };
  const rows=[];
  const segments=original.segments;
  if(!ready)rows.push({kind:'pending',text:'Pagina in elaborazione o da verificare: originale conservato.'});
  else{
   for(let i=0;i<=segments.length;i++){
    for(const heading of original.headings.filter(x=>x.position===i))
     rows.push({kind:heading.kind,text:heading.text});
    if(i===segments.length)break;
    const segment=record.segments.find(x=>x.id===segments[i].id);
    if(!segment){issues.push('V122_MISSING_SEGMENT:'+original.id);continue;}
    for(const sentence of sentenceUnits(segment.text))
     rows.push({kind:'paragraph',text:sentence,notes:noteFor(sentence)});
   }
  }
  if(rows.length===0)rows.push({kind:'empty',text:''});
  for(const row of rows){
   const heading=row.kind==='chapter-title'||row.kind==='section-title';
   const font=heading?'heading':'body';
   const lines=wrapText(clean(row.text),textWidth,font);
   const lineHeight=heading?6.2:5.0;
   const sideNotes=(row.notes||[]).map(note=>({
    ...note,lines:wrapText(note.definition,glossaryWidth,'glossary')
   }));
   const notesHeight=sideNotes.reduce((n,v)=>n+6+v.lines.length*4.25+2.5,0);
   const rowHeight=Math.max(lines.length*lineHeight+(heading?3:2.5),notesHeight+1);
   if(rowHeight>maxY-top+0.01){
    issues.push('V122_ROW_OVERFLOW:'+original.id);
    if(requireComplete)throw Object.assign(new Error('Una frase o una definizione non entra in una pagina: revisione mirata necessaria.'),{
     code:'V122_ROW_TOO_TALL',page:original.label});
    // Never truncate content or silently place a glossary-only sheet.
   }
   if(currentY+rowHeight>maxY&&sheet.rows.length>0){
    sheet=newSheet();currentY=top;
   }
   sheet.rows.push({...row,lines,notes:sideNotes,y:currentY,height:rowHeight});
   currentY+=rowHeight;
  }
 }
 return {pages:sheets,issues,sourcePages:originals.length,
  extraPages:sheets.length-originals.length,allReady:originals.every(p=>records.get(p.id)?.review?.ready)};
}
