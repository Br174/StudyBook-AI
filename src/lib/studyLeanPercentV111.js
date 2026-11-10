// StudyBook AI LAB111: one compact source-retention prompt per NATURAL BLOCK.
// Six official levels. No additional Gemini calls or sentence-by-sentence planner.
// Budget authority remains studyPageBudgetsV74 + studyGeometryV78.
// Numerical results are always measured from generated text; no relabeling.
import {STUDY_GEOMETRY_V78} from './studyGeometryV78.js';
import {STUDY_TARGET_V67} from './studyRebalancePolicyV67.js';

export const STUDY_LEAN_PERCENT_V111='lab111-original-letters-retention-one-call-v1';
const SUPPORTED=new Set(['summary','50','40','30','20','10']);
export function chooseLeanPercentV111({env={},req={},level,phase}={}){
 return env?.STUDYBOOK_LEAN_PERCENT_V111==='1'&&
  req?.experimentV111===STUDY_LEAN_PERCENT_V111&&
  SUPPORTED.has(String(level))&&
  (phase==='draft-v74'||phase==='recalibrate-v74');
}
export function leanPercentInstructionV111(level,phase,geometry){
 const policy=STUDY_TARGET_V67[String(level)];
 if(!policy||!['draft-v74','recalibrate-v74'].includes(phase)||
    geometry?.policy!==STUDY_GEOMETRY_V78||geometry.level!==String(level)||
    !Array.isArray(geometry.groups)||!geometry.groups.length)
  throw Error('LAB111_OFFICIAL_GEOMETRY_REQUIRED');
 const retained=100-policy.target;
 const detail=String(level)==='10'?
  'REVISIONE LEGGERA: mantieni quasi tutta la spiegazione originale. Elimina soltanto formulazioni ripetute, non interi passaggi logici.'
  :String(level)==='20'?
  'REVISIONE CONSERVATIVA: mantieni la maggior parte di esempi, condizioni, definizioni e spiegazioni. Non trasformare il testo in poche frasi schematiche.'
  :String(level)==='30'?
  'RIDUZIONE MODERATA: conserva argomentazioni e collegamenti, togli soprattutto ripetizioni e digressioni che non cambiano il significato.'
  :String(level)==='40'?
  'SINTESI RAGIONATA: accorcia la forma mantenendo assunti, condizioni e relazioni. Conserva spiegazioni rilevanti finché raggiungi il budget.'
  :String(level)==='50'?
  'SINTESI DI METÀ: fornisci un testo circa metà dell’originale, con definizioni, argomentazioni principali ed esempi indispensabili, non un breve elenco di conclusioni.'
  :'RIASSUNTO SVILUPPATO: conserva circa due quinti delle lettere in frasi complete, presentando i concetti e i loro legami senza diventare telegrafico.';
 const instructions=[
  'StudyBook AI LAB111: UNA SOLA RISCRITTURA da fonte originale, in italiano chiaro, senza chiamate aggiuntive. JSON soltanto: {"parts":[{"id":"...","text":"..."}]}.',
  'La riduzione riguarda le LETTERE ALFABETICHE ELIMINATE (non le parole, gli spazi o il contenuto da mantenere).',
  'OBIETTIVO: elimina '+policy.target+'% e CONSERVA circa '+retained+'% delle lettere originali. Non confondere riduzione e conservazione.',
  'La precisione delle LETTERE è importante quanto la chiarezza: scrivi un testo vicino al numero CENTRALE indicato per ogni pagina. Non fermarti dopo aver elencato gli assunti, conserva la spiegazione originale necessaria ad arrivare a quel numero.',
  detail,
  'Tutti i contenuti devono essere ricavati SOLO dalla fonte: non inventare, non completare righe con riempitivi, non troncare frasi, non deformare accenti, nomi, cifre, negazioni o condizioni.',
  'Mantieni ogni id una volta e nello stesso ordine; il testo di ogni id può essere riscritto ma non trasferito alla pagina seguente. Una prosa continua, senza elenchi, a capo manuali o marcatori.',
  'Le fasce ±5 punti percentuali sono limiti del TESTO PRODOTTO, non etichette da apporre. Se contenuti e limite sono incompatibili, rispetta il significato; il programma misurerà la non conformità senza fingere successo.',
  phase==='recalibrate-v74'
   ?'Ricalibrazione SOLO esplicita: la bozza precedente può servire da confronto, ma il riferimento per recuperare informazioni e lettere mancanti è sempre la fonte originale. Nessuna altra chiamata automatica.'
   :'Generazione iniziale: produci direttamente il testo completo, senza chiedere pianificazione, doppie alternative o ulteriori verifiche.',
  'Budget locali CALCOLATI DAL SOFTWARE, uno per pagina o gruppo inseparabile:'
 ];
 for(const page of geometry.groups){
  instructions.push(
   'Pagina '+page.pageStart+(page.pageEnd>page.pageStart?'-'+page.pageEnd:'')+
   ' | fonte '+page.sourceLetters+' LETTERE | scrivi ~'+page.targetLetters+
   ' LETTERE conservate | minimo '+page.minLetters+' massimo '+page.maxLetters+
   ' | al più '+page.maxRows+' righe virtuali da 60 caratteri'+
   (page.ids.length>1?' | '+page.ids.length+' paragrafi originali, conservali distinti':'')
  );
 }
 return instructions.join('\n');
}
