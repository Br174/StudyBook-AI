import { apiEndpoint } from './apiEndpoint.js';

/* LAB19: only books receive creative covers; scanned photographs retain their pixels.
   AI selects a visual concept through the existing, configured StudyBook provider.
   Rendering is local and non-destructive. No new API keys or external art services. */
const THEMES = {
  storia: ['#e8dcc7','#a6815a','#5f493a','arch'], diritto: ['#e6e6f1','#8687b4','#353c63','justice'],
  scienza: ['#e2f2ee','#5caaa1','#295b61','atoms'], tecnologia: ['#e2eafa','#6a8ac1','#304b78','circuit'],
  arte: ['#f5e3e6','#d58a9c','#834866','palette'], letteratura: ['#f2e8da','#b5946b','#644c39','feather'],
  natura: ['#e0ebdd','#85ac87','#406449','leaf'], economia: ['#e1ebf0','#7e9dad','#345568','chart'],
  filosofia: ['#eae2f2','#a697c7','#5d4c7e','arch'], matematica: ['#e6e8f5','#939ccf','#424c80','atoms'],
  medicina: ['#e1f1ee','#7cafa8','#3f7471','leaf'], viaggio: ['#f6e5d4','#d7a277','#875c43','arch'],
  musica: ['#ede7f9','#b6a0dc','#634b91','music'], generale: ['#ebe7f7','#b5a9d9','#59527c','arch'],
};
const ICONS = {
  arch: '<path d="M65 174V96c0-38 26-62 53-62s53 24 53 62v78" fill="none" stroke="currentColor" stroke-width="7"/><path d="M80 174h77M117 62v112M52 181h130" fill="none" stroke="currentColor" stroke-width="5"/>',
  justice: '<path d="M118 43v137M81 58h74M81 58l-25 48h50L81 58Zm74 0-25 48h50l-25-48ZM74 181h88M96 169h44" fill="none" stroke="currentColor" stroke-width="6"/>',
  atoms: '<ellipse cx="118" cy="110" rx="74" ry="31" fill="none" stroke="currentColor" stroke-width="5" transform="rotate(35 118 110)"/><ellipse cx="118" cy="110" rx="74" ry="31" fill="none" stroke="currentColor" stroke-width="5" transform="rotate(-35 118 110)"/><circle cx="118" cy="110" r="10" fill="currentColor"/>',
  circuit: '<path d="M48 70h45v40h50v55h48M48 142h45V91h90M118 36v56M54 70h-10m143 21h11m-7 74h11" fill="none" stroke="currentColor" stroke-width="6"/><circle cx="191" cy="165" r="9" fill="currentColor"/>',
  palette: '<path d="M118 42a78 78 0 1 0 0 156c17 0 16-25 3-28-12-3-15-18-2-24 15-6 34 8 50-1 43-26 3-103-51-103Z" fill="none" stroke="currentColor" stroke-width="6"/><circle cx="78" cy="85" r="9" fill="currentColor"/><circle cx="115" cy="67" r="9" fill="currentColor"/><circle cx="153" cy="93" r="9" fill="currentColor"/>',
  feather: '<path d="M57 174C46 112 86 55 176 42c0 100-51 134-119 132Zm8-6 112-126M89 126l-5-51M116 100l50 8" fill="none" stroke="currentColor" stroke-width="5"/>',
  leaf: '<path d="M70 184C35 105 106 54 187 44c4 88-43 145-117 140ZM69 185c25-59 65-96 118-141M92 131l-5-54M113 106l53 2" fill="none" stroke="currentColor" stroke-width="6"/>',
  chart: '<path d="M52 180V62M52 180h150M67 149l41-35 33 16 48-64M167 66h22v22" fill="none" stroke="currentColor" stroke-width="7"/>',
  music: '<path d="M99 61v98c0 24-46 26-46 3s46-24 46-3M99 68l85-17v90c0 24-46 26-46 3s46-24 46-3" fill="none" stroke="currentColor" stroke-width="7"/>',
};
export function isScannerBook(record) {
  // LAB20: the scan *photo* archive keeps its real picture. A processed
  // study book CREATED FROM scanned pages is a book and may receive an AI cover.
  const fromScan=record?.sourceData?.sourceFormat === 'scan' || record?.metadata?.sourceFormat === 'scan';
  return Boolean(fromScan && !record?.studyBook && !record?.metadata?.hasProcessed);
}
export function coverContext(record) {
  const source = record?.sourceData?.chapters || record?.studyBook?.chapters || [];
  const pieces = [record?.fileName, record?.subject];
  for (const chapter of source.slice(0, 3)) {
    pieces.push(chapter.title);
    pieces.push(...(chapter.paragraphs || []).slice(0, 2).map(p => typeof p === 'string' ? p : p?.original || p?.text || p?.summary || ''));
  }
  return pieces.filter(Boolean).join(' ').replace(/\s+/g,' ').slice(0,1150);
}
export function pickLocalTheme(text='') {
  const t=String(text).toLocaleLowerCase('it-IT');
  const match=[
    ['diritto',/diritt|giuridic|contratt|reato|tribunal|legge/],
    ['storia',/stori|roman[io]|medioev|secol|antich|impero/],
    ['scienza',/scienz|biolog|chimic|fisic|cellul/],
    ['matematica',/matematic|algebra|geometri|calcolo/],
    ['tecnologia',/tecnolog|informatic|intelligenza artificiale|computer|software/],
    ['letteratura',/letteratur|poesia|romanzo|dante|scritt/],
    ['medicina',/medicin|sanit|salute|farmac/],
    ['economia',/econom|finanz|mercato|gestione/],
    ['natura',/natura|ambient|botanic|ecolog/],
    ['filosofia',/filosof|pensier|etica/],
    ['musica',/music|canzon|armoni/],
    ['arte',/artistic|dipint|pittur|scultur|arte/],
    ['viaggio',/viagg|geograf|turism/],
  ].find(([,re])=>re.test(t));
  return match?.[0] || 'generale';
}
function escapeXml(value='') {
  return String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
}
function wrapTitle(title) {
  const words=String(title||'Libro di studio').replace(/\.[^.]{1,5}$/,'').replace(/[_-]+/g,' ').trim().split(/\s+/);
  const lines=[];let line='';
  for(const word of words){if(lines.length>=3)break; const next=line ? line+' '+word : word;
    if(next.length>18&&line){lines.push(line);line=word;}else{line=next;}}
  if(line&&lines.length<3)lines.push(line);
  return lines.map((l,i)=>escapeXml(i===2&&words.join(' ').length>lines.join(' ').length ? l.replace(/.$/,'…'):l));
}
export function renderAICover({title,theme='generale',variant=0}) {
  const themes=Object.keys(THEMES),palette=THEMES[themes.includes(theme)?theme:'generale'];
  const [base,medium,dark,motif]=palette;
  const line=wrapTitle(title);
  const textSize=line.some(s=>s.length>16)?23:line.some(s=>s.length>11)?26:31;
  const option=((Number(variant)||0)%4+4)%4;
  const titleY=option%2===0?146:151;
  const icon=ICONS[motif]||ICONS.arch;
  // LAB20: rigenerare deve produrre una variazione visibile, non spostare solo il titolo.
  const accent=[
    '<path d="M30 245h260" stroke="currentColor" stroke-width="1.5" opacity=".15"/>',
    '<path d="M30 90Q160 10 292 98M30 338Q160 422 292 330" fill="none" stroke="currentColor" stroke-width="4" opacity=".20"/>',
    '<circle cx="160" cy="318" r="110" fill="none" stroke="currentColor" stroke-width="3" opacity=".17"/>',
    '<path d="M15 386l290-90M15 408l290-90" stroke="currentColor" stroke-width="3" opacity=".22"/>',
  ][option];
  const blocks=line.map((value,i)=>'<tspan x="160" dy="'+(i?textSize*1.25:0)+'">'+value+'</tspan>').join('');
  const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 430" width="320" height="430">'+
    '<defs><linearGradient id="g" x2="0.95" y2="1"><stop stop-color="'+base+'"/><stop offset="1" stop-color="'+medium+'"/></linearGradient></defs>'+
    '<rect width="320" height="430" rx="14" fill="url(#g)"/><path d="M14 0v430" stroke="'+dark+'" opacity=".24" stroke-width="4"/>'+
    '<circle cx="270" cy="70" r="92" fill="#fff" opacity=".22"/><circle cx="61" cy="385" r="72" fill="#fff" opacity=".18"/>'+
    '<g color="'+dark+'">'+accent+'</g>'+
    '<text x="160" y="43" fill="'+dark+'" text-anchor="middle" font-size="11" font-family="Arial,sans-serif" letter-spacing="3">STUDYBOOK</text>'+
    '<text x="160" y="'+titleY+'" fill="'+dark+'" text-anchor="middle" font-size="'+textSize+'" font-weight="600" font-family="Georgia,serif">'+blocks+'</text>'+
    '<path d="M100 246h120" stroke="'+dark+'" stroke-width="2" opacity=".5"/>'+
    '<g color="'+dark+'" opacity=".58" transform="translate(67 263) scale(.78)">'+icon+'</g>'+
    '<path d="M113 392h94" stroke="'+dark+'" stroke-width="1.5" opacity=".42"/></svg>';
  return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
}
export async function requestAiCoverTheme(record,{signal}={}) {
  const context=coverContext(record);
  const res=await fetch(apiEndpoint('/api/explain'),{
    method:'POST',signal,headers:{'Content-Type':'application/json'},
    body:JSON.stringify({
      action:'custom',
      selection:(record.fileName||'Libro').slice(0,180),
      sourceText:context.slice(0,1050),
      question:'Sei un art director editoriale. In base al contenuto scegli UN SOLO tema illustrato per la copertina. Rispondi con UNA SOLA parola esatta tra: storia, diritto, scienza, tecnologia, arte, letteratura, natura, economia, filosofia, matematica, medicina, viaggio, musica, generale. Non aggiungere spiegazioni.',
    }),
  });
  if(!res.ok) throw new Error('Servizio AI momentaneamente non disponibile.');
  const json=await res.json();
  const answer=String(json?.answer||'').toLocaleLowerCase('it-IT');
  const theme=Object.keys(THEMES).find(t=>new RegExp('\\b'+t+'\\b','i').test(answer));
  if(!theme) throw new Error('La proposta AI non è utilizzabile.');
  return theme;
}
export async function imageBlobToThumbnail(blob) {
  if(!(blob instanceof Blob)) throw new Error('Immagine non valida.');
  if(blob.size>12*1024*1024) throw new Error('Immagine troppo grande: massimo 12 MB.');
  let image,objectUrl;
  try{
    if(typeof createImageBitmap==='function') image=await createImageBitmap(blob);
    else {
      objectUrl=URL.createObjectURL(blob);
      image=await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=objectUrl;});
    }
    const width=image.width,height=image.height;if(!width||!height)throw new Error('Immagine non leggibile.');
    const canvas=document.createElement('canvas');canvas.width=300;canvas.height=400;
    const ctx=canvas.getContext('2d');ctx.fillStyle='#f4f5f8';ctx.fillRect(0,0,300,400);
    const scale=Math.min(300/width,400/height),w=width*scale,h=height*scale;
    ctx.drawImage(image,(300-w)/2,(400-h)/2,w,h);
    return canvas.toDataURL('image/jpeg',.76);
  }finally{image?.close?.();if(objectUrl)URL.revokeObjectURL(objectUrl);}
}
/* Imported original PDF cover: a sparse introductory page, never a full text page. */
export async function extractOriginalCover(file) {
  if(!file || !(file instanceof Blob))return null;
  const name=String(file.name||'').toLowerCase();
  if(file.type.startsWith('image/') || /\.(png|jpe?g|webp)$/i.test(name))return imageBlobToThumbnail(file);
  if(/\.pdf$/i.test(name)||file.type==='application/pdf') {
    const pdfjs=await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc=new URL('pdfjs-dist/build/pdf.worker.min.mjs',import.meta.url).toString();
    const doc=await pdfjs.getDocument({data:await file.arrayBuffer()}).promise;
    try{
      const page=await doc.getPage(1);
      const content=await page.getTextContent();
      const text=content.items.map(x=>x.str||'').join(' ').replace(/\s+/g,' ').trim();
      if(text.length>390 && content.items.length>30)return null;
      const width=page.getViewport({scale:1}).width;
      const viewport=page.getViewport({scale:Math.min(1,300/width)});
      const canvas=document.createElement('canvas');canvas.width=Math.round(viewport.width);canvas.height=Math.round(viewport.height);
      await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;
      return canvas.toDataURL('image/jpeg',.76);
    }finally{await doc.destroy();}
  }
  if(/\.epub$/i.test(name)||file.type==='application/epub+zip') {
    const JSZip=(await import('jszip')).default;const zip=await JSZip.loadAsync(file);
    const container=await zip.file('META-INF/container.xml')?.async('string');
    const opfPath=container?.match(/full-path=["']([^"']+\.opf)["']/i)?.[1];
    if(!opfPath)return null;
    const opf=await zip.file(opfPath)?.async('string');if(!opf)return null;
    const coverId=opf.match(/<meta[^>]+name=["']cover["'][^>]+content=["']([^"']+)["']/i)?.[1]||'';
    const items=[...opf.matchAll(/<item\b[^>]*>/gi)].map(m=>m[0]);
    const entry=items.find(t=>/properties=["'][^"']*cover-image/.test(t))||items.find(t=>coverId&&t.includes('id="'+coverId+'"'))||'';
    const href=entry.match(/href=["']([^"']+)["']/i)?.[1];if(!href)return null;
    const base=opfPath.slice(0,opfPath.lastIndexOf('/')+1);
    const bytes=await zip.file(base+decodeURIComponent(href))?.async('uint8array');
    if(!bytes || bytes.byteLength>10*1024*1024)return null;
    return imageBlobToThumbnail(new Blob([bytes],{type:/\.png/i.test(href)?'image/png':'image/jpeg'}));
  }
  return null;
}
