// LAB35 PDF print/export: one physical source page per StudyBook text page.
// "bis" / "ter" are text-only overflow; "/N" are image-only leaves.
// No text may flow into a later physical source page.
import { jsPDF } from 'jspdf';
import { Capacitor } from '@capacitor/core';
import { deliverBlob } from './fileDelivery.js';
import { composeMirrorPages,mirrorPageStatistics } from './libroSpecchioV35.js';
import { withPdfMirrorRenderer } from './visualMirrorV35.js';
const filename=name=>String(name||'StudyBook').replace(/\.[^.]+$/,'')
  .replace(/[^a-z0-9-_]+/gi,'_')||'StudyBook';
const fmt=n=>Number(n||0).toLocaleString('it-IT');
// Source sheet dimensions are retained independently from the typed text.
const margin=17;
const mm=pt=>Number(pt||0)*25.4/72;
const paper=page=>({width:Math.max(95,mm(page?.widthPt||595.28)),height:Math.max(135,mm(page?.heightPt||841.89))});
export async function exportMirrorPdfV35(book,fileName,options={}){
  const source=book?.canonicalBookMap;
  if(!source?.pages?.length)throw Error('Mappa pagine originali assente.');
  const initial=paper(source.pages[0]);
  const pdf=new jsPDF({unit:'mm',format:[initial.width,initial.height],compress:true});
  pdf.setFont('helvetica','normal');pdf.setFontSize(10.7);
  const wrapLines=(text,sourcePage)=>{
    const lines=[];
    for(const part of String(text||'').split('\n')){
      const split=pdf.splitTextToSize(part,paper(sourcePage).width-2*margin);
      if(split?.length)lines.push(...split);else lines.push('');
    }
    return lines;
  };
  const layout=composeMirrorPages(source,book,{
    variant:options.variant==='simple'?'simple':'study',
    maxLines:page=>Math.max(10,Math.floor((paper(page).height-76)/6)),wrapLines,
  });
  if(!layout.pages.length)throw Error('Nessuna pagina rielaborata disponibile.');
  if(!layout.audit.valid && layout.audit.problems.some(p=>
    /chapter-count-changed|chapter-title-changed|section-title-changed|page-missing/.test(p)))
    throw Error('Libro Specchio non esportabile: struttura diversa dall’originale verificato.');
  const all=layout.pages,whole=new Map();
  for(const sheet of all){
    if(sheet.kind!=='text')continue;
    const id=sheet.sourcePage;
    if(!whole.has(id))whole.set(id,{
      originalWords:0,resultWords:0,originalLetters:0,resultLetters:0,originalLines:0,resultLines:0,
    });
    const sum=whole.get(id);
    for(const key of Object.keys(sum))sum[key]+=sheet[key]||0;
  }
  function printTextSheet(sheet){
    const {width,height}=paper(sheet),contentWidth=width-2*margin;
    pdf.setFillColor(255,255,255);pdf.rect(0,0,width,height,'F');
    pdf.setDrawColor(214,224,235);pdf.line(margin,20,width-margin,20);
    pdf.setFont('helvetica','normal');pdf.setFontSize(8);pdf.setTextColor(92,111,139);
    pdf.text('Libro Specchio · Pagina '+sheet.label,margin,17);
    let y=29;
    for(const block of sheet.blocks){
      if(block.kind==='chapter-title'){
        pdf.setFont('helvetica','bold');pdf.setFontSize(14);pdf.setTextColor(32,51,79);
        for(const line of pdf.splitTextToSize(block.text,contentWidth)){
          pdf.text(line,margin,y);y+=6;
        }
        y+=3;
      }else if(block.kind==='section-title'){
        pdf.setFont('helvetica','bold');pdf.setFontSize(10.2);pdf.setTextColor(45,64,85);
        for(const line of pdf.splitTextToSize(block.text,contentWidth)){
          pdf.text(line,margin,y);y+=5;
        }
        y+=2;
      }else{
        pdf.setFont('helvetica',block.kind==='image-ref'?'bold':'normal');
        pdf.setFontSize(block.kind==='image-ref'?9.8:10.7);
        pdf.setTextColor(block.kind==='image-ref'?25:32,block.kind==='image-ref'?95:42,block.kind==='image-ref'?177:63);
        for(const line of String(block.text||'').split('\n')){
          pdf.text(line,margin,y);y+=5.2;
        }
        y+=2;
      }
      // Never overflow into the source page N+1. A rare mismatch in printer
      // metrics is a hard failure instead of silently shifting subsequent pages.
      if(y>height-28)throw Error('Impaginazione troppo lunga sulla pagina '+sheet.label+'; verificare il foglio bis.');
    }
    const stats=mirrorPageStatistics(whole.get(sheet.sourcePage));
    pdf.setDrawColor(210,223,237);pdf.line(margin,height-22,width-margin,height-22);
    pdf.setTextColor(81,99,124);pdf.setFont('helvetica','normal');pdf.setFontSize(7.8);
    pdf.text('Parole '+fmt(stats.originalWords)+' → '+fmt(stats.editedWords)+
      ' · Risparmiate '+fmt(stats.wordsSaved),margin,280);
    pdf.text('Lettere -'+fmt(stats.lettersSaved)+' · Righe -'+fmt(stats.linesSaved)+
      ' · Riduzione '+stats.achievedPercent+'%',margin,285);
    pdf.text('Pagina '+sheet.label,210-margin,290,{align:'right'});
  }
  async function printImageSheet(sheet,render){
    if(!sheet.anchor)throw Error('Riferimento visivo assente per la pagina '+sheet.label);
    const dataUrl=await render(sheet.anchor,{maxPixels:2700000});
    if(!dataUrl)throw Error('Impossibile leggere immagine originale '+sheet.label);
    pdf.setFont('helvetica','bold');pdf.setFontSize(14);pdf.setTextColor(31,41,55);
    pdf.text('Immagine '+sheet.imageNumber+' · Pagina '+sheet.sourcePage,margin,21);
    const props=pdf.getImageProperties(dataUrl);
    const maxW=176,maxH=234;
    const ratio=Math.min(maxW/props.width,maxH/props.height);
    const w=props.width*ratio,h=props.height*ratio;
    pdf.addImage(dataUrl,'PNG',margin+(maxW-w)/2,30,w,h);
    pdf.setFont('helvetica','normal');pdf.setFontSize(8);
    pdf.setTextColor(81,99,124);
    pdf.text('Figura originale '+sheet.label+' · riferimento della pagina '+sheet.sourcePage,margin,285);
  }
  async function printAll(render){
    for(let i=0;i<all.length;i++){
      if(i>0)pdf.addPage();
      if(all[i].kind==='image')await printImageSheet(all[i],render);
      else printTextSheet(all[i]);
      if(i%6===0)await new Promise(resolve=>setTimeout(resolve,0));
    }
  }
  if(all.some(p=>p.kind==='image')){
    if(!options.originalFile)throw Error('Il PDF originale è indispensabile per esportare le immagini senza perderle.');
    await withPdfMirrorRenderer(options.originalFile,async({render})=>printAll(render));
  }else await printAll(()=>null);
  const output=pdf.output('blob');
  const name=filename(fileName)+'_Libro_Specchio.pdf';
  if(Capacitor.isNativePlatform?.())
    await deliverBlob(output,name,'Apri PDF Libro Specchio',{preferOpen:true});
  else await deliverBlob(output,name);
  return {pageCount:all.length,figureSheets:all.filter(x=>x.kind==='image').length,
    originalPageCount:source.pageCount};
}
