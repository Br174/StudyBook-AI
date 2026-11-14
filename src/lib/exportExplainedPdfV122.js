import {jsPDF} from 'jspdf';
import {deliverBlob} from './fileDelivery.js';
import {composeExplainedSheetsV122} from './explainedLayoutV122.js';
import {reservationReportV127} from './explainedRepairV127.js';
import {buildProvisionalExplainedBookV128} from './explainedProvisionalV128.js';
const clean=x=>String(x||'').replace(/\*\*/gu,'');
const safe=x=>String(x||'StudyBook').replace(/\.[^.]+$/u,'').replace(/[^a-zA-Z0-9_-]+/gu,'_');
const FONT={heading:13,body:10.5,glossary:9.2};
// Same verified edition -> reuse PDF bytes; no unnecessary jsPDF regeneration.
const pdfCacheV130=new WeakMap();
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
export async function exportExplainedPdfV122(book,fileName,{
 download=true,provisional=false,preferOpen=false
}={}){
 const edition=book?.editionsV36;
 const eligible=edition&&typeof edition==='object';
 const signature=eligible?[
  String(fileName),edition.sourceFingerprint,edition.status,
  edition.complete,edition.verifiedChunkVariants,edition.reservedPagesV127?.length,
  edition.pages?.length,provisional
 ].join('|'):'';
 const cached=eligible?pdfCacheV130.get(edition):null;
 if(cached?.signature===signature){
  if(download)await deliverBlob(cached.result.blob,cached.result.fileName,
   preferOpen?'Apri Libro spiegato in PDF':'Esporta Libro spiegato',{preferOpen});
  return cached.result;
 }
 const temporary=provisional&&book?.editionsV36?.complete!==true?
   buildProvisionalExplainedBookV128(book):null;
 const printable=temporary?.book||book;
 const waitingPages=temporary?.waitingPages||[];
 const reservations=reservationReportV127(printable?.editionsV36?.pages||[]);
 if(printable?.editionsV36?.complete!==true)
  throw Object.assign(new Error('Il Libro spiegato non è ancora completo e verificato.'),{
   code:'V122_PDF_INCOMPLETE'});
 const paper=composeExplainedSheetsV122(printable,{requireComplete:true});
 if(!paper.pages.length)throw Error('Nessuna pagina da esportare.');
 const first=paper.pages[0],pdf=new jsPDF({unit:'mm',
  format:[first.widthMm,first.heightMm],compress:true});
 pdf.setProperties({title:(temporary?'BOZZA INCOMPLETA - ':'Libro spiegato - ')+
  String(fileName||'StudyBook'),
  subject:temporary?'BOZZA: pagine non elaborate riportano testo originale, nessuna certificazione':
   reservations.length?'Studio con pagine esplicitamente accettate con riserva':
    'Studio in italiano semplice con glossario laterale'});
 const layout=composeExplainedSheetsV122(printable,{
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
  pdf.text('Libro spiegato · Pagina '+sheet.label+
    (sheet.provisionalOriginal?' · ORIGINALE NON RIELABORATO':
      sheet.reserved?' · CON RISERVA':''),margin,16);
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
 if(reservations.length){
  const explanation={
   V126_PAGE_REDUCTION_OUT_OF_RANGE:'Riduzione del testo fuori intervallo',
   V126_TRIVIAL_OR_ONE_LINE_BODY:'Testo troppo sintetico',
   V126_MAP_CONTENT_COVERAGE_LOW:'Concetti rilevanti non rintracciati',
   V122_PROTECTED_MEANING_MISSING:'Riferimento o condizione mancante',
   V127_NO_USABLE_EXPLANATION:'Nessuna spiegazione valida: inserito originale',
   V127_REWRITE_NOT_VERIFIED:'Riscrittura non verificata',
   V127_COMPREHENSION_UNAVAILABLE:'Lettura preliminare non acquisita; originale conservato',
   V128_PENDING_PROVIDER_REWRITE:'Gemini non ha ancora prodotto una spiegazione verificata'
  };
  const reportWidth=first.widthMm,reportHeight=first.heightMm;
  const safeWidth=reportWidth-30;
  let y=27;
  const reportPage=()=>{
   pdf.addPage([reportWidth,reportHeight],
    reportWidth>reportHeight?'landscape':'portrait');
   pdf.setFont('helvetica','bold');pdf.setFontSize(13);
   pdf.setTextColor(30,42,60);
   pdf.text(temporary?'BOZZA INCOMPLETA - pagine da elaborare':
     'Rapporto pagine accettate con riserva',15,17);
   y=27;
  };
  reportPage();
  const writeLine=(value,{bold=false,size=9.1}={})=>{
   pdf.setFont('helvetica',bold?'bold':'normal');pdf.setFontSize(size);
   const lines=pdf.splitTextToSize(String(value),safeWidth);
   for(const line of lines){
    if(y>reportHeight-22)reportPage();
    pdf.text(line,15,y);y+=4.9;
   }
  };
  if(temporary){
   writeLine('DOCUMENTO PROVVISORIO: '+waitingPages.length+
    ' pagine NON rielaborate con Gemini.',{bold:true});
   writeLine('Questa bozza NON sostituisce il Libro spiegato completo.');
   writeLine('L’elaborazione originale resta incompleta e riprendibile dai checkpoint.');
  }else{
   writeLine(reservations.length+' pagine non conformi; non certificate.',{bold:true});
   writeLine('Queste pagine sono incluse per permettere di terminare il libro.');
  }
  writeLine('Rileggere il testo originale in caso di dubbi.');
  y+=3;
  for(const item of reservations){
   if(y>reportHeight-38)reportPage();
   writeLine('Pagina originale '+item.label+' - '+
     (item.provisionalOriginal?'NON ANCORA ELABORATA - testo originale.':
       item.corrections>0?item.corrections+' correzioni automatiche senza esito.':
       'lettura tecnica incompleta; originale conservato.'),{bold:true});
   if(item.sourceTextFallback)writeLine('ATTENZIONE: contenuto originale, non riscritto.');
   for(const code of item.issues.slice(0,12))
    writeLine('Problema: '+(explanation[code]||code));
   y+=4;
  }
 }
 const blob=pdf.output('blob');
 const outputName=safe(fileName)+(temporary?
  '_Libro_spiegato_BOZZA_INCOMPLETA.pdf':reservations.length?
   '_Libro_spiegato_CON_RISERVE.pdf':'_Libro_spiegato.pdf');
 if(download)await deliverBlob(blob,outputName,
  preferOpen?'Apri Libro spiegato in PDF':'Esporta Libro spiegato',
  {preferOpen});
 const result={blob,fileName:outputName,sourcePages:layout.sourcePages,
  outputPages:layout.pages.length,additionalPages:layout.extraPages,
  pagesWithReservations:reservations.length,
  provisionalOriginalPages:waitingPages.length,
  provisional:temporary!==null,
  reportPages:pdf.getNumberOfPages()-layout.pages.length,
  policy:'lab122-one-explained-glossary-v1'};
 if(eligible)pdfCacheV130.set(edition,{signature,result});
 return result;
}
