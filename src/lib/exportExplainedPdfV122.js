import {jsPDF} from 'jspdf';
import {deliverBlob} from './fileDelivery.js';
import {composeExplainedSheetsV122} from './explainedLayoutV122.js';
const clean=x=>String(x||'').replace(/\*\*/gu,'');
const safe=x=>String(x||'StudyBook').replace(/\.[^.]+$/u,'').replace(/[^a-zA-Z0-9_-]+/gu,'_');
const FONT={heading:13,body:10.5,glossary:9.2};
function textRuns(line){
 return String(line||'').split(/(\*\*\([^)\n]+\)\*\*)/gu).filter(Boolean)
  .map(part=>({text:clean(part),bold:/^\*\*\([^)\n]+\)\*\*$/u.test(part)}));
}
function richLine(pdf,line,x,y,size){
 let cursor=x;
 for(const run of textRuns(line)){
  pdf.setFont('helvetica',run.bold?'bold':'normal');
  pdf.setFontSize(size);pdf.text(run.text,cursor,y);
  cursor+=pdf.getTextWidth(run.text);
 }
 return cursor;
}
function measuredWrap(pdf,value,width,font){
 const size=FONT[font]||FONT.body;
 pdf.setFont('helvetica',font==='heading'?'bold':'normal');
 pdf.setFontSize(size);
 const lines=[];
 for(const paragraph of String(value||'').split(/\n/u)){
  if(!paragraph.trim()){lines.push('');continue;}
  let line='';
  const tokens=paragraph.trim().match(/\*\*\([^)\n]+\)\*\*|\S+/gu)||[];
  for(const word of tokens){
   const candidate=line?line+' '+word:word;
   if(line && pdf.getTextWidth(clean(candidate))>width){lines.push(line);line=word;}
   else line=candidate;
   if(pdf.getTextWidth(clean(line))>width){
    // Unlike silent clipping, reject an unbreakable oversized legal token.
    throw Object.assign(new Error('Termine o formula troppo largo per la colonna PDF.'),{
     code:'V122_PDF_UNBREAKABLE_TOKEN'});
   }
  }
  if(line)lines.push(line);
 }
 return lines.length?lines:[''];
}
export async function exportExplainedPdfV122(book,fileName,{download=true}={}){
 if(book?.editionsV36?.complete!==true)
  throw Object.assign(new Error('Il Libro spiegato non è ancora completo e verificato.'),{
   code:'V122_PDF_INCOMPLETE'});
 const paper=composeExplainedSheetsV122(book,{requireComplete:true});
 if(!paper.pages.length)throw Error('Nessuna pagina da esportare.');
 const first=paper.pages[0],pdf=new jsPDF({unit:'mm',
  format:[first.widthMm,first.heightMm],compress:true});
 pdf.setProperties({title:'Libro spiegato - '+String(fileName||'StudyBook'),
  subject:'Studio in italiano semplice con glossario laterale'});
 const layout=composeExplainedSheetsV122(book,{
  requireComplete:true,wrapText:(text,width,font)=>measuredWrap(pdf,text,width,font)});
 if(layout.issues.length)throw Object.assign(new Error('Errore nell’impaginazione: verifica la pagina.'),{
  code:'V122_PDF_LAYOUT_INVALID',issues:layout.issues});
 for(let i=0;i<layout.pages.length;i++){
  const sheet=layout.pages[i];
  if(i>0)pdf.addPage([sheet.widthMm,sheet.heightMm],
   sheet.widthMm>sheet.heightMm?'landscape':'portrait');
  const {margin,gap,top,textWidth,heightMm,widthMm}=sheet;
  const asideX=margin+textWidth+gap;
  pdf.setDrawColor(205,216,229);
  pdf.line(margin,19,widthMm-margin,19);
  pdf.setTextColor(63,77,99);pdf.setFont('helvetica','normal');pdf.setFontSize(8.5);
  pdf.text('Libro spiegato · Pagina '+sheet.label,margin,16);
  pdf.setDrawColor(215,227,237);
  pdf.line(asideX-2,top-3,asideX-2,heightMm-sheet.bottom+1);
  for(const row of sheet.rows){
   const heading=row.kind==='chapter-title'||row.kind==='section-title';
   const font=heading?'heading':'body',size=FONT[font];
   pdf.setTextColor(heading?28:32,heading?48:42,heading?73:57);
   let textY=row.y+4.6;
   for(const line of row.lines){
    if(heading){pdf.setFont('helvetica','bold');pdf.setFontSize(size);pdf.text(clean(line),margin,textY);}
    else richLine(pdf,line,margin,textY,size);
    textY+=heading?6.2:5.0;
   }
   let sideY=row.y+4;
   for(const note of row.notes||[]){
    pdf.setTextColor(24,59,97);pdf.setFont('helvetica','bold');pdf.setFontSize(9.3);
    const titleLines=measuredWrap(pdf,note.term,sheet.glossaryWidth,'glossary');
    for(const line of titleLines){pdf.text(clean(line),asideX,sideY);sideY+=4.1;}
    pdf.setTextColor(48,65,78);pdf.setFont('helvetica','normal');pdf.setFontSize(9.2);
    for(const line of note.lines){pdf.text(clean(line),asideX,sideY);sideY+=4.25;}
    sideY+=2;
   }
   if(textY>heightMm-sheet.bottom+5||sideY>heightMm-sheet.bottom+5)
    throw Object.assign(new Error('Il testo supera l’area della pagina '+sheet.label),{
     code:'V122_PDF_PAGE_OVERFLOW'});
  }
  pdf.setDrawColor(209,220,233);
  pdf.line(margin,heightMm-18,widthMm-margin,heightMm-18);
  pdf.setFont('helvetica','normal');pdf.setFontSize(8);
  pdf.setTextColor(80,96,118);
  pdf.text('Pagina originale '+sheet.sourcePage,margin,heightMm-12);
  pdf.text('Pagina '+sheet.label,widthMm-margin,heightMm-12,{align:'right'});
 }
 const blob=pdf.output('blob');
 const outputName=safe(fileName)+'_Libro_spiegato.pdf';
 if(download)await deliverBlob(blob,outputName,'Esporta Libro spiegato');
 return {blob,fileName:outputName,sourcePages:layout.sourcePages,
  outputPages:layout.pages.length,additionalPages:layout.extraPages,
  policy:'lab122-one-explained-glossary-v1'};
}
