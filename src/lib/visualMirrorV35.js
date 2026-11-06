// LAB35: unlimited, lightweight PDF visual references, decoded only on demand.
// No global JPEG array in memory; original PDF is the authoritative image store.
import * as pdfjsLib from 'pdfjs-dist';

const OPERATORS = pdfjsLib.OPS;
const raster = new Set([
  OPERATORS.paintImageXObject,OPERATORS.paintInlineImageXObject,
  OPERATORS.paintJpegXObject,OPERATORS.paintImageMaskXObject,
  OPERATORS.paintImageXObjectRepeat,OPERATORS.paintInlineImageXObjectGroup,
].filter(Number.isFinite));
const vector = new Set([
  OPERATORS.constructPath,OPERATORS.rectangle,OPERATORS.stroke,
  OPERATORS.fill,OPERATORS.eoFill,OPERATORS.fillStroke,
  OPERATORS.eoFillStroke,
].filter(Number.isFinite));
const EPS=0.0001;
function multiply(a,b){
  return [
    a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],
    a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],
    a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5],
  ];
}
function point(m,x,y){return [m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]];}
function clamped(n){return Math.max(0,Math.min(1,n));}
function imageRect(matrix, viewport){
  const m=multiply(viewport.transform,matrix);
  const corners=[point(m,0,0),point(m,1,0),point(m,0,1),point(m,1,1)];
  let left=Math.min(...corners.map(p=>p[0]))/viewport.width;
  let right=Math.max(...corners.map(p=>p[0]))/viewport.width;
  let top=Math.min(...corners.map(p=>p[1]))/viewport.height;
  let bottom=Math.max(...corners.map(p=>p[1]))/viewport.height;
  const rect=[clamped(left),clamped(top),clamped(right),clamped(bottom)];
  return rect[2]-rect[0]>EPS && rect[3]-rect[1]>EPS ? rect : null;
}
export function inspectPdfVisualOperators(operatorList,{pageNumber=1,viewport,textItems=[]}={}){
  if(!viewport?.width || !viewport?.height)return {anchors:[],rasterCount:0,vectorCount:0,review:[]};
  const fns=operatorList?.fnArray||[],args=operatorList?.argsArray||[];
  let matrix=[1,0,0,1,0,0],stack=[],vectorCount=0,rasterCount=0;
  const candidates=[];
  for(let i=0;i<fns.length;i++){
    const fn=fns[i];
    if(fn===OPERATORS.save)stack.push(matrix.slice());
    else if(fn===OPERATORS.restore)matrix=stack.pop()||[1,0,0,1,0,0];
    else if(fn===OPERATORS.transform && Array.isArray(args[i]) && args[i].length===6)
      matrix=multiply(matrix,args[i]);
    else if(raster.has(fn)){
      rasterCount++;
      const rect=imageRect(matrix,viewport);
      if(rect){
        const area=(rect[2]-rect[0])*(rect[3]-rect[1]);
        if(area>=0.00025)candidates.push({rect,area,kind:'raster',operator:i});
      }
    }else if(vector.has(fn))vectorCount++;
  }
  // A full-page scanned background is source material for OCR, not
  // automatically a standalone illustration. Avoid printing its text twice.
  const background=candidates.filter(c=>c.area>=0.80);
  const filtered=candidates.filter(c=>c.area<0.80);
  const review=[];
  if(background.length)review.push('full-page-raster-background');
  if(rasterCount>0 && candidates.length===0)review.push('unlocated-raster-operators');
  if(vectorCount>=28 && !filtered.length){
    // Diagram composed of PDF paths: preserve faithful reference as source
    // page image; cannot safely infer the geometry of each vector figure.
    filtered.push({rect:[0,0,1,1],area:1,kind:'vector-page-reference',operator:-1});
    review.push('vector-figure-needs-visual-review');
  }
  const coords=textItems.filter(x=>x?.str?.trim() && Array.isArray(x.transform)).map(x=>{
    const xy=point(viewport.transform,x.transform[4],x.transform[5]);
    return {y:xy[1]/viewport.height,length:String(x.str||'').length};
  });
  const total=coords.reduce((n,x)=>n+x.length,0);
  const seen=new Set(),anchors=[];
  for(const figure of filtered){
    const rounded=figure.rect.map(x=>Math.round(x*1000));
    const key=figure.kind+':'+rounded.join(',');
    if(seen.has(key))continue;
    seen.add(key);
    const above=coords.filter(t=>t.y<figure.rect[1]).reduce((n,t)=>n+t.length,0);
    const fraction=total>0?clamped(above/total):null;
    anchors.push({
      id:'pdf:'+pageNumber+':figure:'+String(anchors.length+1),
      type:'image',sourcePage:pageNumber,imageNumber:anchors.length+1,
      kind:figure.kind,rect:figure.rect,area:figure.area,
      relativeTextPosition:fraction,
      positionConfidence:figure.kind==='raster'&&total>0?'approximate':'review',
      sourcePart:'pdf:page:'+pageNumber,
      caption:'Immagine '+(anchors.length+1)+' · pagina '+pageNumber,
    });
  }
  return {anchors,rasterCount,vectorCount,review};
}
export async function scanPdfPageFigures(page,pageNumber,{textContent,operatorList}={}){
  const content=textContent || await page.getTextContent();
  const operators=operatorList || await page.getOperatorList();
  return inspectPdfVisualOperators(operators,{
    pageNumber,viewport:page.getViewport({scale:1}),textItems:content.items||[]
  });
}
export async function loadPdfMirrorOutline(pdf){
  const raw=await pdf.getOutline().catch(()=>[])||[];
  const pageLabels=await pdf.getPageLabels().catch(()=>null)||[];
  const cache=new Map();
  async function pageFor(dest){
    try {
      const resolved=typeof dest==='string'?await pdf.getDestination(dest):dest;
      const ref=resolved?.[0];
      if(Number.isInteger(ref))return ref+1;
      if(!ref)return null;
      const key=String(ref.num)+':'+String(ref.gen||0);
      if(!cache.has(key))cache.set(key,await pdf.getPageIndex(ref)+1);
      return cache.get(key);
    } catch{return null;}
  }
  async function walk(nodes,depth=1){
    const output=[];
    for(const item of nodes||[]){
      if(!item?.title)continue;
      output.push({title:String(item.title),depth,pageNumber:await pageFor(item.dest),
        items:await walk(item.items||[],depth+1)});
    }
    return output;
  }
  return {outline:await walk(raw),pageLabels};
}

export async function withPdfMirrorRenderer(file,handler) {
  if(!file)throw new Error('Originale PDF necessario per aprire le immagini.');
  const binary=new Uint8Array(await file.arrayBuffer());
  const pdf=await pdfjsLib.getDocument({data:binary}).promise;
  try {
    async function render(anchor,{maxPixels=2300000}={}){
      if(!Number.isInteger(anchor?.sourcePage)||anchor.sourcePage<1
        || anchor.sourcePage>pdf.numPages)
        throw new Error('Figura senza pagina originale valida.');
      const page=await pdf.getPage(anchor.sourcePage);
      try {
        const rect=Array.isArray(anchor.rect)&&anchor.rect.length===4?anchor.rect:[0,0,1,1];
        const viewport=page.getViewport({scale:1.55});
        const ratio=Math.min(1,Math.sqrt(maxPixels/(viewport.width*viewport.height)));
        const scaled=page.getViewport({scale:1.55*ratio});
        const whole=document.createElement('canvas');
        whole.width=Math.max(1,Math.ceil(scaled.width));
        whole.height=Math.max(1,Math.ceil(scaled.height));
        const ctx=whole.getContext('2d',{alpha:false});
        if(!ctx)throw new Error('Impossibile aprire l’immagine sul dispositivo.');
        ctx.fillStyle='#fff';ctx.fillRect(0,0,whole.width,whole.height);
        try {
          await page.render({canvasContext:ctx,viewport:scaled}).promise;
          const x=Math.round(rect[0]*whole.width),y=Math.round(rect[1]*whole.height);
          const width=Math.max(1,Math.round((rect[2]-rect[0])*whole.width));
          const height=Math.max(1,Math.round((rect[3]-rect[1])*whole.height));
          const crop=document.createElement('canvas');
          crop.width=width;crop.height=height;
          const cctx=crop.getContext('2d',{alpha:false});
          if(!cctx)throw new Error('Ritaglio immagine non disponibile.');
          cctx.drawImage(whole,x,y,width,height,0,0,width,height);
          const dataUrl=crop.toDataURL('image/png');
          crop.width=crop.height=1;
          return dataUrl;
        }finally{whole.width=whole.height=1;}
      }finally{try{page.cleanup?.()}catch{}}
    }
    return await handler({render,pdf});
  }finally{
    try{pdf.cleanup()}catch{}
    try{await pdf.destroy()}catch{}
  }
}
export async function renderMirrorImage(file,anchor,options={}){
  return withPdfMirrorRenderer(file,({render})=>render(anchor,options));
}
