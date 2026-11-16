// LAB141: tighter end-of-book numeric guidance, same single Gemini request.
// The internal 40-60 acceptance band remains private; the model sees ONLY
// the 50% target and per-page numerical feedback for failed revisions.
import {lessonInstructionOnePassV140,lessonPayloadOnePassV140,
 studyUnitsV126} from './explainedStagesV126.js';
export const TAIL_PRECISION_CONTRACT_V141='lab141-endgame-two-repairs-one-pass-v1';
export function lessonInstructionOnePassV141(){
 return lessonInstructionOnePassV140()+'\n'+[
  'CORREZIONE MIRATA SENZA CHIAMATE EXTRA: per pagine con campo repair, usa il valore esatto targetBodyUnits indicato nella pagina e confrontalo con previousBodyUnits nel repair.',
  'Se previousBodyUnits è superiore al target, rendi il corpo più sintetico preservando i concetti. Se è inferiore, sviluppa maggiormente spiegazione e collegamenti presenti nella fonte, senza inventare.',
  'Conta le LETTERE e i SEGNI DI PUNTEGGIATURA del corpo, non spazi, numeri, glossario, titoli. Regola la lunghezza mentre scrivi, restituendo una SOLA versione completa della pagina.',
  'Conserva ogni id di segmento e la sua posizione originale. In una correzione riscrivi soltanto le pagine ricevute in questa richiesta; non chiedere un altro passaggio e non copiare i codici di errore.'
 ].join('\n');
}
export function lessonPayloadOnePassV141(pages,context=[],scale=1){
 const payload=lessonPayloadOnePassV140(pages,context,scale);
 return {...payload,pages:payload.pages.map((p,i)=>{
  const repair=pages[i]?.repair;
  if(!repair?.previousDraft?.segments?.length)return p;
  const oldBody=repair.previousDraft.segments.map(s=>String(s?.text||'')).join('\n');
  const previousBodyUnits=studyUnitsV126(oldBody);
  const target=p.targetBodyUnits;
  return {...p,repair:{...(p.repair||{}),
   previousBodyUnits,targetBodyUnits:target,
   lengthDirection:previousBodyUnits>target?'shorten':
    previousBodyUnits<target?'expand':'maintain',
   // The numeric target alone is model-visible; private tolerances are not.
   lengthAdjustmentUnits:Math.abs(previousBodyUnits-target),
   correctionNotes:[
    ...((p.repair?.correctionNotes||[]).slice(0,8)),
    'Correggi la lunghezza di questa pagina verso targetBodyUnits senza perdere concetti e senza introdurre frasi riempitive.'
   ]
  }};
 })};
}
