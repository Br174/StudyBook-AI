// LAB122 deterministic 70/30 mirror layout. Gemini NEVER decides paper breaks.
// Original pages are anchors; overflow is emitted only as bis, tris, quater...
import {continuationLabel} from './libroSpecchioV35.js';
import {originalExplainedPagesV122,isVerifiedExplainedPageV125} from './explainedPolicyV122.js';
import {EXPLAINED_POLICY_V126,EXPLAINED_AUDIT_V126,
 auditExplainedPageV126} from './explainedStagesV126.js';
import {reserveAcceptedV127} from './explainedRepairV127.js';
const mm=pt=>Number(pt||0)*25.4/72;
const clean=x=>String(x||'').replace(/\*\*/gu,'').trim();
export function approximateWrapV122(text,widthMm,font='body'){
 const max=Math.max(9,Math.floor(widthMm/(font==='glossary'?2.0:font==='heading'?2.8:2.3)));
 const lines=[];
 for(const paragraph of String(text||'').split(/\n/u)){
  if(!paragraph.trim()){lines.push('');continue;}
  let current='';
  const words=paragraph.trim().match(/\*\*\([^)\n]+\)\*\*|\S+/gu)||[];
  const visibleLength=value=>String(value).replace(/\*\*/gu,'').length;
  for(const word of words){
   if(!current){current=word;continue;}
   if(visibleLength(current+' '+word)>max){lines.push(current);current=word;}
   else current+=' '+word;
  }
  if(current)lines.push(current);
 }
 return lines.length?lines:[''];
}
const sentenceUnits=text=>{
 const lines=String(text||'').split(/\n+/u).map(x=>x.trim()).filter(Boolean);
 return lines.flatMap(line=>{
  // Do not split inside art. / artt. / d.lgs. legal citations.
  const protectedLine=line.replace(/\b(artt?|d\.lgs|d\.l|n)\./giu,(whole)=>whole.replace(/\./gu,'∎'));
  const parts=protectedLine.match(/[^.!?]+(?:[.!?]+|$)/gu)||[protectedLine];
  return parts.map(x=>x.trim().replace(/∎/gu,'.')).filter(Boolean);
 });
};
// Keep draft rendering separate from approval and PDF export.
export function hasReadableExplainedDraftV122(original,record){
 if(!original.segments.length||!Array.isArray(record?.segments)||
    record.segments.length!==original.segments.length)return false;
 return original.segments.every((segment,index)=>{
  const draft=record.segments[index];
  return draft?.id===segment.id&&typeof draft.text==='string'&&
    draft.text.trim()&&!/\[\[|\]\]|\{\{\s*TODO|\.\.\.\s*$/u.test(draft.text);
 });
}
export function composeExplainedSheetsV122(book,{
 wrapText=approximateWrapV122,requireComplete=false
}={}){
 const originals=originalExplainedPagesV122(book);
 const snapshot=book?.editionsV36;
 const records=new Map((snapshot?.pages||[]).filter(Boolean).map(p=>[p.id,p]));
 const isPrintable=(original,record)=>{
  if(!original||!record)return false;
  if(snapshot?.version!==EXPLAINED_POLICY_V126)
   return isVerifiedExplainedPageV125(original,record);
  if(reserveAcceptedV127(original,record))return true;
  if(!original.segments.length)return record.review?.ready===true;
  if(record.review?.auditRevision!==EXPLAINED_AUDIT_V126||
   record.review?.ready!==true)return false;
  const map=snapshot.comprehensionV126?.pages?.[original.physicalPage-1];
  return Boolean(map&&auditExplainedPageV126(original,record,map).ready);
 };
 const sheets=[],issues=[];
 const margin=15,gap=4,top=25,bottom=22;
 for(const original of originals){
  const record=records.get(original.id);
  const ready=isPrintable(original,record);
  const reserved=reserveAcceptedV127(original,record);
  // Only conforming pages are readable/studiable; drafts remain in checkpoints.
  const draft=false;
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
    ready,draft,reserved,rows:[],sourceLetters:original.originalBodyLetters,
    reduction:record?.review?.reduction??null};
   sheets.push(sheet);continuation++;
   return sheet;
  };
  let sheet=newSheet(),currentY=top;
  const glossary=Array.isArray(record?.glossary)?record.glossary.filter(item=>
    typeof item?.term==='string'&&typeof item.definition==='string'):[];
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
  if(!ready&&!draft)rows.push({kind:'pending',text:'Testo della pagina non ancora disponibile.'});
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
  extraPages:sheets.length-originals.length,allReady:originals.every(p=>
   isPrintable(p,records.get(p.id)))};
}
