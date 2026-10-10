import {apiEndpoint} from './apiEndpoint.js';
import {coverContext,isScannerBook} from './libraryCoverEngine.js';
import {prepareCoverPreview} from './trueAiCover.js';
/* LAB22: Keyless catalog -> public-domain themed photo, automatically applied.
 * No Gemini API, browser automation, keys, PDF or archive photo upload. */
const base=String(import.meta.env?.VITE_COVER_SEARCH_BASE||'').replace(/\/$/,'');
export function coverSearchEndpoint(){
  return base?base+'/api/book-cover/search':apiEndpoint('/api/book-cover/search');
}
export function coverLookupRequest(record){
  if(!record?.id||isScannerBook(record))throw new Error('Scegli un libro, non una fotografia scannerizzata.');
  return{
    title:String(record.fileName||'').replace(/\.[^/.]{2,7}$/,'').trim().slice(0,140),
    subject:String(record.subject||'').slice(0,100),
    context:coverContext(record).slice(0,1150),
    author:String(record.author||record.metadata?.author||record.sourceData?.author||'').slice(0,100),
    isbn:String(record.isbn||record.metadata?.isbn||record.sourceData?.isbn||'').slice(0,22),
  };
}
export async function searchBookCoverOnWeb(record,{onStage=()=>{}}={}){
  const body=coverLookupRequest(record);
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),38000);
  try{
    onStage('analysing');
    onStage('searching');
    const response=await fetch(coverSearchEndpoint(),{
      method:'POST',signal:controller.signal,
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(body),
    });
    const payload=await response.json().catch(()=>({}));
    if(!response.ok ||payload.type!=='web-cover'){
      throw new Error(payload.error||'Non ho trovato una copertina attendibile o una fotografia tematica libera.');
    }
    if(!['original','thematic'].includes(payload.kind) ||
       !/^image\/(?:jpeg|png|webp)$/.test(payload.mimeType||'') ||
       typeof payload.imageData!=='string'||payload.imageData.length<1200||
       payload.imageData.length>3900000)
      throw new Error('La fonte non ha restituito una fotografia utilizzabile.');
    onStage('preparing');
    const src=await prepareCoverPreview(payload.imageData,payload.mimeType,body.title,
      {overlayTitle:payload.kind==='thematic'});
    return {
      src,kind:payload.kind,label:payload.label||'Copertina trovata online',
      source:payload.source||'',sourceUrl:payload.sourceUrl||'',
      license:payload.license||'',attribution:payload.attribution||'',
      matchedTitle:payload.matchedTitle||''
    };
  }catch(error){
    if(error?.name==='AbortError')throw new Error('Ricerca copertina troppo lenta: riprova.');
    throw error;
  }finally{clearTimeout(timer);}
}
