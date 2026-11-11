// LAB121 ISOLATED Android trial: Gemini sees ONLY ideal central reduction.
 // The application's five wider acceptance ranges never enter this prompt.
import {STUDY_TARGET_V67} from './studyRebalancePolicyV67.js';
import {STUDY_GEOMETRY_V78} from './studyGeometryV78.js';

export const STUDY_PRIVATE_PROMPT_V121='lab121-strict-center-no-acceptance-bands-v1';
export const STUDY_PRIVATE_EXPERIMENT_V121='studybook-private-center-v121';
const LEVELS=new Set(['summary','50','40','30','20','10']);
export function choosePrivatePromptV121({env={},req={},level,phase}={}){
 return env?.STUDYBOOK_PRIVATE_TARGET_V121==='1'&&
  req?.experimentV121===STUDY_PRIVATE_EXPERIMENT_V121&&
  LEVELS.has(String(level))&&
  (phase==='draft-v74'||phase==='recalibrate-v74');
}
export function privateCenterInstructionV121(level,phase,geometry){
 const p=STUDY_TARGET_V67[String(level)];
 if(!p||!['draft-v74','recalibrate-v74'].includes(phase)||
    geometry?.policy!==STUDY_GEOMETRY_V78||
    geometry.level!==String(level)||!Array.isArray(geometry.groups)||
    !geometry.groups.length)throw Error('LAB121_GEOMETRY_REQUIRED');
 const out=[
  'StudyBook LAB121: una sola riscrittura per blocco naturale. Rispondi solo JSON {"parts":[{"id":"...","text":"..."}]}.',
  'L’obiettivo è la riduzione delle LETTERE ALFABETICHE, non il numero di parole, di caratteri o di paragrafi.',
  'Obiettivo preciso: elimina '+p.target+'% delle lettere e conserva '+(100-p.target)+'%. Cerca di arrivare al valore indicato con la massima precisione.',
  'Non interrompere il testo dopo aver citato soltanto gli assunti: conserva le spiegazioni necessarie per studiare.',
  'Non alterare significati, negazioni, condizioni, eccezioni, termini legali, riferimenti, cause e gradi di certezza; non trasformare «verificabili» in «verificate».',
  'Se il numero richiesto e il significato sono incompatibili, preserva il significato. Non riempire di frasi fittizie e non interrompere a metà un periodo.',
  'Tutti gli ID devono comparire nell’ordine originale una sola volta, con testo italiano completo, senza spostare contenuti fra pagine.',
  phase==='recalibrate-v74'
    ?'Ricalibrazione esplicita soltanto: confronta la bozza precedente ma ricostruisci tutto a partire dall’originale, senza inventare.'
    :'Genera direttamente il testo di studio, una sola risposta, senza fasi di pianificazione o chiamate aggiuntive.'
 ];
 for(const g of geometry.groups){
  out.push('Pagina '+g.pageStart+(g.pageEnd>g.pageStart?'-'+g.pageEnd:'')+
   ': testo originale '+g.sourceLetters+' lettere, testo richiesto circa '+
   g.targetLetters+' lettere, circa '+g.maxRows+' righe di studio.'+
   (g.ids?.length>1?' Mantieni separati i '+g.ids.length+' paragrafi.':''));
 }
 return out.join('\n');
}
export function modelOnlyPayloadV121({bookTitle='',units,verifiedPageBudgets,
 pageFeedback=null}={}){
 if(!Array.isArray(units)||!units.length)throw Error('LAB121_MODEL_UNITS_REQUIRED');
 const stripped=units.map(u=>({
  id:u.id,source:u.source,pageStart:u.pageStart,pageEnd:u.pageEnd,
  sourceLetters:u.sourceLetters,targetLetters:u.targetLetters,
  ...(typeof u.previousDraft==='string'&&u.previousDraft?{previousDraft:u.previousDraft}:{})
 }));
 const pages=(verifiedPageBudgets||[]).map(g=>({
  pageStart:g.pageStart,pageEnd:g.pageEnd,
  originalLetters:g.originalLetters,targetLetters:g.targetLetters,
  unitIds:g.unitIds
 }));
 const feedback=(pageFeedback||[]).map(g=>({
  pageStart:g.pageStart,pageEnd:g.pageEnd,
  previousLetters:g.previousLetters,targetLetters:g.targetLetters,
  gapLetters:g.gapLetters,direction:g.direction
 }));
 const output={bookTitle:String(bookTitle).slice(0,140),units:stripped,
  pageTargets:pages,...(feedback.length?{pageFeedback:feedback}:{})};
 // Hard fail before network use if private band metadata accidentally
 // becomes part of the Gemini request structure.
 const forbidden=/"(?:minLetters|maxLetters|tolerancePercentagePoints|acceptanceMinimum|acceptanceMaximum|priorWithinBand|withinBand|range)\"\s*:/iu;
 if(forbidden.test(JSON.stringify(output)))throw Error('LAB121_PRIVATE_BAND_LEAK');
 return output;
}
