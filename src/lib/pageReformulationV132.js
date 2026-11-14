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

export async function requestPageReformulationV132(book,pageNumber,{signal}={}) {
 const {source,map}=checkedOriginalPageV132(book,pageNumber);
 if(source.segments.reduce((n,s)=>n+s.source.length,0)>42000)
  throw Error('Pagina originale troppo lunga per una richiesta sicura.');
 const payload={
  policy:EXPLAINED_POLICY_V126,phase:'explain',timeoutMs:150000,
  bookContext:[],
  pages:[{
   id:source.id,
   segments:source.segments.map(s=>({id:s.id,source:s.source})),
   sourceLineCount:source.sourceLineCount,
   comprehension:map,
   repair:{issueCodes:[],correctionNotes:[
    'Su richiesta del lettore, proponi una versione alternativa completa e più chiara.',
    'Riparti esclusivamente dal testo originale di questa pagina e dalla comprensione verificata.',
    'Non usare né copiare la precedente riformulazione. Mantieni tutti i concetti e le condizioni.',
    'La riduzione obiettivo resta il 50%: non aggiungere frasi riempitive.'
   ]}
  }]
 };
 const response=await fetch(apiEndpoint('/api/explained/v126'),{
  method:'POST',signal,headers:{'Content-Type':'application/json'},
  body:JSON.stringify(payload)
 });
 const data=await response.json().catch(()=>null);
 if(!response.ok) {
  const message=data?.error||data?.message||
   ('Richiesta non riuscita (HTTP '+response.status+').');
  throw Object.assign(new Error(message),{code:data?.code||'HTTP_'+response.status,
   retryAfterSeconds:data?.retryAfterSeconds||null});
 }
 if(data?.version!==EXPLAINED_POLICY_V126||data?.phase!=='explain'||
    !Array.isArray(data.pages)||data.pages.length!==1||data.pages[0]?.id!==source.id)
  throw Error('Risposta Gemini non coerente con la pagina originale.');
 const answer=data.pages[0];
 const review=auditExplainedPageV126(source,answer,map);
 if(!review.ready||answer.review?.ready!==true)
  throw Error('La proposta non ha superato i controlli di fedeltà o riduzione. La pagina approvata resta invariata.');
 return {id:source.id,label:source.label,sourcePage:source.physicalPage,
  segments:answer.segments.map(s=>({id:s.id,text:s.text})),
  glossary:answer.glossary.map(g=>({term:g.term,definition:g.definition})),
  review,sourceFingerprint:book.canonicalBookMap.originalFingerprint};
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
