// Separate PDF of user-generated simple explanations. Original/study PDF untouched.
import {jsPDF} from 'jspdf';
import {deliverBlob} from './fileDelivery.js';
const safe=x=>String(x||'StudyBook').replace(/\.[^.]+$/,'').replace(/[^a-z0-9-_]+/gi,'_').slice(0,70)||'StudyBook';
const paper=x=>String(x||'').replace(/[’]/g,"'").replace(/[—–]/g,'-');
export async function exportSavedSimplePagesPdfV50(title,pages){
  const records=(pages||[]).filter(p=>p.text?.trim());
  if(!records.length)throw Error('Non ci sono pagine salvate.');
  const pdf=new jsPDF({unit:'mm',format:'a4',compress:true});
  const w=pdf.internal.pageSize.getWidth(),h=pdf.internal.pageSize.getHeight();
  let first=true;
  for(const page of records){
    if(!first)pdf.addPage();first=false;
    let y=20;
    pdf.setFont('helvetica','bold');pdf.setFontSize(13);
    for(const line of pdf.splitTextToSize(paper(title||'StudyBook'),w-34)){
      pdf.text(line,17,y);y+=7;
    }
    pdf.setFontSize(11);
    pdf.text(paper('In parole semplici - Pagina '+page.label),17,y);y+=10;
    pdf.setFont('helvetica','normal');pdf.setFontSize(10.5);
    for(const paragraph of paper(page.text).split(/\n+/)){
      for(const line of pdf.splitTextToSize(paragraph||' ',w-34)){
        if(y>h-20){pdf.addPage();y=20;}
        pdf.text(line,17,y);y+=5.6;
      }
      y+=3;
    }
  }
  const suffix=records.length===1?'_pagina_'+safe(records[0].label):'_pagine_salvate';
  return deliverBlob(pdf.output('blob'),safe(title)+'_in_parole_semplici'+suffix+'.pdf');
}
