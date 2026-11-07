// LAB49: each explicit tap starts a new real Gemini request for exactly the
// displayed study leaf. Never precompute, persist, silently synthesize or print.
import {apiEndpoint} from './apiEndpoint.js';
import {readGeminiPause,registerGeminiPause} from './geminiQuotaControllerV36.js';

export function verifiedPageTextV49(page){
  if(page?.kind!=='text')return {text:'',pending:false};
  const blocks=Array.isArray(page.blocks)?page.blocks:[];
  const pending=blocks.some(b=>(b.kind==='paragraph'||b.kind==='original-page')&&b.editionPending===true);
  const parts=blocks.filter(b=>['paragraph','original-page','chapter-title','section-title'].includes(b.kind)
      &&b.editionPending!==true)
    .map(b=>String(b.text||'').trim()).filter(Boolean);
  // Headings alone must never be sent to Gemini as a fictional finished page.
  const hasVerifiedParagraph=blocks.some(b=>['paragraph','original-page'].includes(b.kind)
      &&b.editionPending!==true&&String(b.text||'').trim());
  return {text:hasVerifiedParagraph?parts.join('\n\n'):'',pending};
}

export async function explainStudyPageOnDemandV49(page,{bookTitle='',signal}={}){
  const {text,pending}=verifiedPageTextV49(page);
  if(!text)throw Object.assign(new Error(pending?
    'La pagina non contiene ancora paragrafi verificati. Attenda il completamento Gemini.':
    'La pagina non contiene testo di studio da spiegare.'),{code:'NO_VERIFIED_PAGE_TEXT'});
  if(text.length>12000)throw Object.assign(new Error(
    'La pagina supera il limite di una singola richiesta. Non viene tagliato alcun testo.'),{code:'PAGE_TOO_LONG'});
  if(signal?.aborted)throw Object.assign(new Error('Spiegazione annullata'),{name:'AbortError'});
  const pause=await readGeminiPause();
  if(pause){
    const when=pause.retryAt?new Date(pause.retryAt).toLocaleString('it-IT'):'quando il provider sara disponibile';
    throw Object.assign(new Error('Gemini e in pausa per il limite del provider. Riprovi dopo '+when+'.'),
      {code:'GEMINI_COOLDOWN',quota:pause});
  }
  const response=await fetch(apiEndpoint('/api/page-simple/v49'),{
    method:'POST',headers:{'Content-Type':'application/json'},signal,
    body:JSON.stringify({pageText:text,pageLabel:String(page.label||page.sourcePage||''),
      bookTitle:String(bookTitle||'')}),
  });
  const data=await response.json().catch(()=>null);
  if(!response.ok){
    if((response.status===429||response.status===503)&&data?.quota)
      await registerGeminiPause(data.quota);
    const error=new Error(data?.error||(
      response.status===404?'Il servizio Parole semplici non e ancora pubblicato sul Worker.':
      'Gemini non ha restituito la spiegazione di questa pagina.'));
    error.code=data?.code||'HTTP_'+response.status;
    throw error;
  }
  if(typeof data?.explanation!=='string'||!data.explanation.trim()||data.engine!=='gemini-live')
    throw Object.assign(new Error('La spiegazione Gemini non e stata verificata.'),{code:'INVALID_PAGE_ANSWER'});
  return {text:data.explanation.trim(),label:String(page.label||''),engine:'gemini-live',
    incompleteSource:pending};
}
