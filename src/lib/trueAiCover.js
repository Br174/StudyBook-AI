import {apiEndpoint} from './apiEndpoint.js';
import {coverContext,isScannerBook} from './libraryCoverEngine.js';

/* LAB21: image pixels come from a real Gemini image model, never SVG.
   Never place provider credentials in this client or send the whole PDF.
   Local work: scale/compress and overlay the exact title on generated artwork. */
const NATIVE_COVER_BASE=String(import.meta.env?.VITE_COVER_AI_BASE||'').replace(/\/$/,'');
export function coverEndpoint(){
  return NATIVE_COVER_BASE ? NATIVE_COVER_BASE+'/api/cover-ai/generate' : apiEndpoint('/api/cover-ai/generate');
}
function readableTitle(value){
  return String(value||'Libro di studio').replace(/\.[^/.]{1,6}$/,'').replace(/[_]+/g,' ').trim().slice(0,115)||'Libro di studio';
}
export function coverRequest(record,variant=1){
  if(!record?.id || isScannerBook(record))throw new Error('Seleziona un libro, non una fotografia scannerizzata.');
  return {
    title:readableTitle(record.fileName),
    subject:String(record.subject||'Altro').slice(0,100),
    context:coverContext(record).slice(0,1450),
    variant:Math.min(50000,Math.max(0,Math.floor(variant))),
  };
}
export async function generateTrueBookImage(record,{variant=1,onStage=()=>{}}={}){
  const data=coverRequest(record,variant);
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),75000);
  try{
    onStage('analysing');
    // Extraction is already completed at import time; no OCR rerun or book rewrite.
    onStage('generating');
    const response=await fetch(coverEndpoint(),{
      method:'POST',signal:controller.signal,
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(data),
    });
    const payload=await response.json().catch(()=>null);
    if(!response.ok || payload?.type!=='generated-image'){
      const fallback=response.status===404?'Servizio copertine non ancora installato sul server.'
        :response.status===429?'Limite di generazione immagini raggiunto: riprova più tardi.'
        :'La generazione AI non è riuscita.';
      throw new Error(payload?.error||fallback);
    }
    if(!/^image\/(?:png|jpeg|webp)$/.test(payload.mimeType||'')
      ||typeof payload.imageData!=='string'||payload.imageData.length<250
      ||payload.imageData.length>8_000_000)throw new Error('Il servizio non ha restituito una vera immagine valida.');
    onStage('preparing');
    const src=await prepareCoverPreview(payload.imageData,payload.mimeType,data.title);
    onStage('preview');
    return {src,provider:payload.model||'Gemini Image',prompt:payload.prompt||'',generatedAt:new Date().toISOString()};
  }catch(e){
    if(e?.name==='AbortError')throw new Error('Generazione immagine troppo lenta. Riprova con una connessione stabile.');
    throw e;
  }finally{clearTimeout(timeout);}
}
export async function prepareCoverPreview(encoded,mime,title){
  const binary=atob(encoded);
  const bytes=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
  const blob=new Blob([bytes],{type:mime});
  const url=URL.createObjectURL(blob);
  let img;
  try {
    img=await new Promise((resolve,reject)=>{
      const image=new Image();
      image.onload=()=>resolve(image);
      image.onerror=()=>reject(new Error('Il file generato dall’AI non è una fotografia leggibile.'));
      image.src=url;
    });
    const canvas=document.createElement('canvas');canvas.width=360;canvas.height=480;
    const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Canvas non disponibile.');
    const scale=Math.max(canvas.width/img.width,canvas.height/img.height);
    const w=img.width*scale,h=img.height*scale;
    ctx.drawImage(img,(360-w)/2,(480-h)/2,w,h);
    // The provider generates the ARTWORK; exact user title is overlaid for
    // spelling accuracy, avoiding the known text-rendering weakness of models.
    const fade=ctx.createLinearGradient(0,245,0,480);
    fade.addColorStop(0,'rgba(12,19,34,0)');
    fade.addColorStop(.68,'rgba(12,19,34,.62)');
    fade.addColorStop(1,'rgba(12,19,34,.82)');
    ctx.fillStyle=fade;ctx.fillRect(0,225,360,255);
    ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#fff';
    const words=String(title||'Libro').split(/\s+/).filter(Boolean);
    const lines=[];let row='';
    ctx.font='bold 32px Georgia,serif';
    for(const word of words){
      const proposed=row?row+' '+word:word;
      if(ctx.measureText(proposed).width>310 && row){lines.push(row);row=word;}else row=proposed;
    }
    if(row)lines.push(row);
    const shown=lines.slice(0,3);
    if(lines.length>3)shown[2]=shown[2].slice(0,18)+'…';
    const size=shown.some(x=>x.length>17)?25:shown.length>=3?27:32;
    ctx.font='bold '+size+'px Georgia,serif';
    ctx.shadowColor='rgba(0,0,0,.35)';ctx.shadowBlur=6;
    const start=400-(shown.length-1)*size*.58;
    shown.forEach((line,i)=>ctx.fillText(line,180,start+i*size*1.16,320));
    return canvas.toDataURL('image/jpeg',.82);
  } finally {URL.revokeObjectURL(url);}
}
