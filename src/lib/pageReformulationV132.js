// LAB132.3 — isolated Riformula button: original page, Gemini instructions,
// length-only final check. All other generation and learning flows remain unchanged.
import {apiEndpoint} from './apiEndpoint.js';
import {originalExplainedPagesV122} from './explainedPolicyV122.js';
import {EXPLAINED_POLICY_V126,auditComprehensionV126,auditExplainedPageV126,studyUnitsV126} from './explainedStagesV126.js';

export const RIFORMULA_LENGTH_AUDIT_V132='lab132-single-page-length-only-v1';
const MAX_LENGTH_ATTEMPTS_V132=8;
const TARGET_REDUCTION_V132=50;
// Internal acceptance band, never sent to Gemini (existing LAB132 tolerance).
const MIN_REDUCTION_V132=40,MAX_REDUCTION_V132=60;

export function checkedOriginalPageV132(book,pageNumber){
 const source=originalExplainedPagesV122(book).find(p=>p.physicalPage===Number(pageNumber));
 if(!source||!source.segments.length)throw Error('Pagina originale non riformulabile.');
 const edition=book?.editionsV36;
 if(edition?.version!==EXPLAINED_POLICY_V126)
  throw Error('Questa versione non supporta ancora la riformulazione della pagina.');
 if(edition.sourceFingerprint!==book?.canonicalBookMap?.originalFingerprint)
  throw Error('La versione elaborata non corrisponde più alla fonte originale: nessuna riformulazione avviata.');
 // Existing Worker protocol requires this already available map; no new AI read.
 const map=edition.comprehensionV126?.pages?.[source.physicalPage-1];
 if(!map||!auditComprehensionV126(source,map).ready)
  throw Error('La pagina originale non ha ancora i dati tecnici necessari alla riformulazione.');
 return {source,map};
}

export function auditRiformulaLengthV132(source,answer){
 const originalSegments=source?.segments||[],segments=answer?.segments;
 const validStructure=answer?.id===source?.id&&Array.isArray(segments)&&
  segments.length===originalSegments.length&&segments.every((s,i)=>
   s?.id===originalSegments[i].id&&typeof s?.text==='string'&&s.text.trim())&&
  Array.isArray(answer?.glossary);
 const original=originalSegments.map(s=>String(s.source||'')).join('\n');
 const result=Array.isArray(segments)?segments.map(s=>String(s?.text||''))
  .join('\n').replace(/\*\*/gu,''):'';
 const sourceUnits=studyUnitsV126(original),outputUnits=studyUnitsV126(result);
 const exactReduction=sourceUnits>0?100*(sourceUnits-outputUnits)/sourceUnits:NaN;
 const sizeCompliant=Number.isFinite(exactReduction)&&
  exactReduction>=MIN_REDUCTION_V132&&exactReduction<=MAX_REDUCTION_V132;
 const issues=[];
 if(!validStructure||!sourceUnits||!outputUnits)issues.push('V132_INVALID_RESPONSE_STRUCTURE');
 if(!sizeCompliant)issues.push('V132_PAGE_REDUCTION_OUT_OF_RANGE');
 return {ready:issues.length===0,issues,auditRevision:RIFORMULA_LENGTH_AUDIT_V132,
  targetReduction:TARGET_REDUCTION_V132,sourceUnits,outputUnits,sizeCompliant,
  exactReduction,reduction:Number.isFinite(exactReduction)?Math.round(exactReduction*10)/10:null,
  semanticCertified:false};
}

export async function requestPageReformulationV132(book,pageNumber,{signal,onAttempt}={}){
 const {source,map}=checkedOriginalPageV132(book,pageNumber);
 if(source.segments.reduce((n,s)=>n+s.source.length,0)>42000)
  throw Error('Pagina originale troppo lunga per una richiesta sicura.');
 const page={id:source.id,sourceLineCount:source.sourceLineCount,
  segments:source.segments.map(s=>({id:s.id,source:s.source})),comprehension:map};
 let lastReduction=null;
 for(let attempt=1;attempt<=MAX_LENGTH_ATTEMPTS_V132;attempt++){
  if(signal?.aborted)throw Object.assign(new Error('Riformulazione annullata.'),{name:'AbortError'});
  onAttempt?.(attempt,MAX_LENGTH_ATTEMPTS_V132);
  // Always ask Gemini to read the original page; never send the rejected draft.
  const response=await fetch(apiEndpoint('/api/explained/v126'),{
   method:'POST',signal,headers:{'Content-Type':'application/json'},
   body:JSON.stringify({policy:EXPLAINED_POLICY_V126,phase:'explain',
    timeoutMs:150000,bookContext:[],pages:[page]})
  });
  const data=await response.json().catch(()=>null);
  // Stop safely on 429/503, network problems and protocol failures.
  if(!response.ok){
   const message=data?.error||data?.message||('Richiesta non riuscita (HTTP '+response.status+').');
   throw Object.assign(new Error(message),{code:data?.code||'HTTP_'+response.status,
    retryAfterSeconds:data?.retryAfterSeconds||null,httpStatus:response.status});
  }
  if(data?.version!==EXPLAINED_POLICY_V126||data?.phase!=='explain'||
     !Array.isArray(data.pages)||data.pages.length!==1||data.pages[0]?.id!==source.id)
   throw Object.assign(new Error('Risposta Gemini non coerente con la pagina originale.'),
    {code:'V132_RESPONSE_MISMATCH'});
  const answer=data.pages[0];
  // Deliberately ignore Worker semantic/glossary review flags for this button.
  const review=auditRiformulaLengthV132(source,answer);
  if(review.issues.includes('V132_INVALID_RESPONSE_STRUCTURE'))
   throw Object.assign(new Error('Risposta Gemini incompleta: la pagina approvata resta invariata.'),
    {code:'V132_INVALID_RESPONSE_STRUCTURE'});
  if(review.ready){
   const glossary=answer.glossary.filter(g=>g&&typeof g.term==='string'&&
    typeof g.definition==='string').map(g=>({term:g.term,definition:g.definition}));
   return {id:source.id,label:source.label,sourcePage:source.physicalPage,
    segments:answer.segments.map(s=>({id:s.id,text:s.text})),
    glossary,review,sourceFingerprint:book.canonicalBookMap.originalFingerprint};
  }
  lastReduction=review.reduction;
  // Existing Worker handles this quantitative correction using the same source.
  if(attempt<MAX_LENGTH_ATTEMPTS_V132)
   page.repair={issueCodes:['V126_PAGE_REDUCTION_OUT_OF_RANGE'],
    correctionCycle:Math.min(attempt,5),correctionStrategy:'mirata',
    previousReduction:lastReduction};
 }
 throw Object.assign(new Error('La riformulazione non è ancora intorno al 50% dopo '+
  MAX_LENGTH_ATTEMPTS_V132+' tentativi. Ultima riduzione: '+
  (lastReduction==null?'non misurabile':lastReduction.toFixed(1)+'%')+
  '. Riprovi premendo Riformula. Il testo approvato resta invariato.'),
  {code:'V132_LENGTH_NOT_REACHED',attempts:MAX_LENGTH_ATTEMPTS_V132,lastReduction});
}

export function applyApprovedReformulationsV132(book,state){
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
  const onlyLength=replacement.review?.auditRevision===RIFORMULA_LENGTH_AUDIT_V132;
  if(!source||(!onlyLength&&!map)||replacement.id!==source.id||
     replacement.sourceFingerprint!==state.sourceFingerprint)
   throw Error('Pagina riformulata non corrisponde alla fonte verificata.');
  // A previously accepted historic V126 page retains its original audit.
  // Only new Riformula pages use the new, isolated length-only audit.
  const review=onlyLength?auditRiformulaLengthV132(source,replacement):
   auditExplainedPageV126(source,replacement,map);
  if(!review.ready)throw Error('La pagina '+source.label+' non supera più i controlli.');
  return {...p,segments:replacement.segments,glossary:replacement.glossary,review};
 });
 return {...book,editionsV36:{...original,pages:records}};
}
