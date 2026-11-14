// LAB132: one user-requested page rewrite, always from the verified original.
// Reuse the EXISTING v126 free Gemini worker, comprehension and semantic audit.
import {apiEndpoint} from './apiEndpoint.js';
import {originalExplainedPagesV122} from './explainedPolicyV122.js';
import {EXPLAINED_POLICY_V126,auditComprehensionV126,auditExplainedPageV126} from './explainedStagesV126.js';

export function checkedOriginalPageV132(book,pageNumber) {
 const source=originalExplainedPagesV122(book).find(p=>p.physicalPage===Number(pageNumber));
 if(!source||!source.segments.length)throw Error('Pagina originale non riformulabile.');
 const edition=book?.editionsV36;
 if(edition?.version!==EXPLAINED_POLICY_V126)
  throw Error('Questa versione non supporta ancora la riformulazione della pagina.');
 if(edition.sourceFingerprint!==book?.canonicalBookMap?.originalFingerprint)
  throw Error('La versione elaborata non corrisponde più alla fonte originale: nessuna riformulazione avviata.');
 const map=edition.comprehensionV126?.pages?.[source.physicalPage-1];
 if(!map||!auditComprehensionV126(source,map).ready)
  throw Error('La comprensione originale di questa pagina non è verificata.');
 return {source,map};
}

// This diagnostic categorizes the existing V126/V125 checks; it does not relax them.
export function reformulationFeedbackV132(localReview,workerReview) {
 const raw=[...(Array.isArray(localReview?.issues)?localReview.issues:[]),
  ...(Array.isArray(workerReview?.issues)?workerReview.issues:[])];
 const issues=[...new Set(raw.filter(x=>typeof x==='string')
  .map(x=>x.split(':')[0]).filter(Boolean))].slice(0,12);
 const has=expression=>issues.some(code=>expression.test(code));
 const notes=[],labels=[];
 if(has(/REDUCTION_OUT_OF_RANGE|TRIVIAL_OR_ONE_LINE_BODY/iu)){
  notes.push('Avvicinati all’obiettivo del 50% senza riempitivi né tagli ai concetti.');
  labels.push('riduzione');
 }
 if(has(/MAP_CONTENT_COVERAGE|ESSENTIAL|CONCEPT|SOURCE_MEANING/iu)){
  notes.push('Reintroduci le proposizioni essenziali mancanti, nel segmento della fonte corrispondente.');
  labels.push('concetti');
 }
 if(has(/IMMUTABLE|PROTECTED|CONDITION|MODALITY|RELATION|UNSUPPORTED|QUALIFIER|REFERENCE|AUTHOR|REVERSED/iu)){
  notes.push('Conserva condizioni, negazioni, attribuzioni e riferimenti esattamente come nell’originale.');
  labels.push('fedeltà');
 }
 if(has(/GLOSSARY|SEGMENT|STRUCTURE|EMPTY|TRUNCAT|GRAMMAR|PLACEHOLDER/iu)){
  notes.push('Correggi struttura, segmenti, grammatica e glossario senza alterare la fonte.');
  labels.push('struttura o glossario');
 }
 if(!notes.length){
  notes.push('Riesamina fedeltà e completezza usando soltanto la fonte originale e la mappa.');
  labels.push('verifica della proposta');
 }
 return {issues,notes,summary:labels.join(', ')};
}

const MAX_REFORMULATION_ATTEMPTS_V132=3;
export async function requestPageReformulationV132(book,pageNumber,{signal,onAttempt}={}) {
 const {source,map}=checkedOriginalPageV132(book,pageNumber);
 if(source.segments.reduce((n,s)=>n+s.source.length,0)>42000)
  throw Error('Pagina originale troppo lunga per una richiesta sicura.');
 const page={
  id:source.id,
  segments:source.segments.map(s=>({id:s.id,source:s.source})),
  sourceLineCount:source.sourceLineCount,
  comprehension:map,
  repair:{issueCodes:[],correctionNotes:[
   'Su richiesta del lettore, proponi una versione alternativa completa e più chiara.',
   'Riparti soltanto dal testo originale e dalla comprensione verificata di questa pagina.',
   'Non copiare la precedente riformulazione. Preserva ogni concetto e condizione.',
   'La riduzione obiettivo resta il 50%: non aggiungere frasi riempitive.'
  ]}
 };
 let lastFeedback=null;
 for(let attempt=1;attempt<=MAX_REFORMULATION_ATTEMPTS_V132;attempt++){
  if(signal?.aborted)throw Object.assign(new Error('Riformulazione annullata.'),{name:'AbortError'});
  onAttempt?.(attempt,MAX_REFORMULATION_ATTEMPTS_V132);
  const response=await fetch(apiEndpoint('/api/explained/v126'),{
   method:'POST',signal,headers:{'Content-Type':'application/json'},
   body:JSON.stringify({
    policy:EXPLAINED_POLICY_V126,phase:'explain',timeoutMs:150000,
    bookContext:[],pages:[page]
   })
  });
  const data=await response.json().catch(()=>null);
  // Never loop on Gemini quota, overload, transport, or a broken protocol.
  if(!response.ok){
   const message=data?.error||data?.message||
    ('Richiesta non riuscita (HTTP '+response.status+').');
   throw Object.assign(new Error(message),{
    code:data?.code||'HTTP_'+response.status,
    retryAfterSeconds:data?.retryAfterSeconds||null,
    httpStatus:response.status
   });
  }
  if(data?.version!==EXPLAINED_POLICY_V126||data?.phase!=='explain'||
     !Array.isArray(data.pages)||data.pages.length!==1||data.pages[0]?.id!==source.id)
   throw Object.assign(new Error('Risposta Gemini non coerente con la pagina originale.'),{
    code:'V132_RESPONSE_MISMATCH'
   });
  const answer=data.pages[0];
  // The Worker flag is advisory: re-audit the full physical source page on device.
  const review=auditExplainedPageV126(source,answer,map);
  if(review.ready&&answer.review?.ready===true)
   return {id:source.id,label:source.label,sourcePage:source.physicalPage,
    segments:answer.segments.map(s=>({id:s.id,text:s.text})),
    glossary:answer.glossary.map(g=>({term:g.term,definition:g.definition})),
    review,sourceFingerprint:book.canonicalBookMap.originalFingerprint};
  lastFeedback=reformulationFeedbackV132(review,answer.review);
  if(attempt<MAX_REFORMULATION_ATTEMPTS_V132){
   // A targeted correction, still generated from the ORIGINAL, never the rejected draft.
   // Internal tolerance ranges are not sent to Gemini.
   page.repair={
    issueCodes:lastFeedback.issues,
    correctionCycle:attempt,
    correctionStrategy:attempt===1?'mirata':'guidata',
    correctionNotes:[
     'Riformula nuovamente da zero, usando la fonte originale completa e la mappa di comprensione.',
     ...lastFeedback.notes
    ]
   };
  }
 }
 throw Object.assign(new Error(
  'Proposta non approvata dopo '+MAX_REFORMULATION_ATTEMPTS_V132+
  ' tentativi. Controlli da correggere: '+(lastFeedback?.summary||'fedeltà o riduzione')+
  '. La pagina già approvata resta invariata.'),{
  code:'V132_PROPOSAL_REJECTED',
  issues:lastFeedback?.issues||[],
  attempts:MAX_REFORMULATION_ATTEMPTS_V132
 });
}

export function applyApprovedReformulationsV132(book,state) {
 if(!state||!Object.keys(state.accepted||{}).length)return book;
 if(state.sourceFingerprint!==book?.canonicalBookMap?.originalFingerprint)
  throw Error('La fonte è cambiata: non applico riformulazioni a un altro libro.');
 const sourcePages=originalExplainedPagesV122(book);
 const byPage=new Map(sourcePages.map(p=>[p.physicalPage,p]));
 const original=book.editionsV36;
 const records=(original?.pages||[]).map(p=>{
  const replacement=state.accepted?.[String(p?.sourcePage)];
  if(!replacement)return p;
  const source=byPage.get(Number(p.sourcePage));
  const map=original.comprehensionV126?.pages?.[Number(p.sourcePage)-1];
  if(!source||!map||replacement.id!==source.id||
     replacement.sourceFingerprint!==state.sourceFingerprint)
   throw Error('Pagina riformulata non corrisponde alla fonte verificata.');
  const review=auditExplainedPageV126(source,replacement,map);
  if(!review.ready)throw Error('La pagina '+source.label+' non supera più i controlli.');
  return {...p,segments:replacement.segments,glossary:replacement.glossary,review};
 });
 return {...book,editionsV36:{...original,pages:records}};
}
