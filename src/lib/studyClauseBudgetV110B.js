// LAB110B: measured per-proposition SOFT allocation, no additional AI calls.
// Uses the same deterministic source ledger and official LAB78 integer allocator.
import {buildSourceLedgerV110,STUDY_SOURCE_LEDGER_V110}
 from './studySourceLedgerV110.js';
import {largestRemainderV78,STUDY_GEOMETRY_V78} from './studyGeometryV78.js';

export const STUDY_CLAUSE_BUDGET_V110B='source-clause-soft-budget-40-optin-v110b';
export function chooseClauseBudgetV110B({env={},req={},level,phase}={}){
 return env?.STUDYBOOK_CLAUSE_BUDGET_V110B==='1'&&
   req?.experimentV110b===STUDY_CLAUSE_BUDGET_V110B&&
   req?.experimentV109==null&&req?.experimentV110==null&&
   String(level)==='40'&&['draft-v74','recalibrate-v74'].includes(phase);
}
export function clauseBudgetInstructionV110B(level,phase,geometry,units){
 if(String(level)!=='40'||!['draft-v74','recalibrate-v74'].includes(phase))
  throw Error('V110B_INVALID_LEVEL_OR_PHASE');
 if(geometry?.policy!==STUDY_GEOMETRY_V78)throw Error('V110B_GEOMETRY_REQUIRED');
 const ledger=buildSourceLedgerV110(units,geometry);
 if(ledger.policy!==STUDY_SOURCE_LEDGER_V110)throw Error('V110B_ORIGINAL_LEDGER_REQUIRED');
 const lines=[
  'LAB110B, UNICA CHIAMATA GEMINI. Sei un redattore didattico italiano: riassumi LA FORMA, NON I FATTI. Scrivi una sola versione al 40% di riduzione, in prosa naturale completa.',
  '40% significa conservare circa 60 LETTERE alfabetiche ogni 100 dell’originale, NON eliminare il 60% e NON conservare il 40%. Il numero riguarda solo LETTERE Unicode, non caratteri, spazi e numeri.',
  'Prima verifica il significato: mantieni ogni fatto distinto dell’inventario qui sotto. Puoi fondere frasi collegate, ma NON eliminare cause, negazioni, possibilità, obblighi, eccezioni e differenze tra descrizione e spiegazione.',
  'La quota di LETTERE per ogni proposizione è una GUIDA editoriale, NON una regola di taglio a metà: se una proposizione è più densa di fatti può occupare qualche lettera in più recuperando spazio da altre. Il TOTALE della PAGINA e le RIGHE massime sono i vincoli quantitativi.',
  'Evita elenchi, abbreviazioni, imprecisioni, parole deformate, punteggiatura irregolare e frasi di riempimento. Accenti e apostrofi devono essere corretti. Non inventare dati.',
  'Se una quota di pagina è incompatibile con tutti i fatti, preserva i fatti e lascia che il verificatore segnali NON CONFORME.',
  'Rispondi ESCLUSIVAMENTE in JSON {"parts":[{"id":"...","text":"..."}]}; tutti gli id esattamente una volta, nello stesso ordine. Nessun piano, nessuna richiesta di controllo o seconda chiamata.',
  phase==='recalibrate-v74'
   ?'Ricalibrazione: la fonte originale rimane autorità, il precedente testo è solamente una bozza da non ripetere se errata.'
   :'Prima creazione: produci il testo finale direttamente.',
 ];
 for(const page of ledger.groups){
  const quota=largestRemainderV78(page.targetLetters,page.clauses.map(x=>x.sourceLetters));
  lines.push('PAGINA '+page.pageStart+': fonte '+page.sourceLetters+
   ' LETTERE, conserva '+page.targetLetters+' LETTERE (fascia '+
   page.minLetters+'..'+page.maxLetters+'), MAX '+page.maxRows+' RIGHE da 60 celle.');
  for(let i=0;i<page.clauses.length;i++){
   const c=page.clauses[i];
   lines.push('CLAUSOLA '+(i+1)+' ID '+c.unitId+
    ' | originale '+c.sourceLetters+' LETTERE | orientativamente conserva '+quota[i]+
    ' LETTERE | '+c.sourceClause);
  }
  if(quota.reduce((a,b)=>a+b,0)!==page.targetLetters)throw Error('V110B_BUDGET_ALLOCATION_MISMATCH');
 }
 lines.push('Le clausole sono RIFERIMENTI ORIGINALI da conservare nel significato, non frasi da copiare. Se alcune si ripetono, uniscile. Mantieni tutti i nessi.');
 return {policy:STUDY_CLAUSE_BUDGET_V110B,ledger,
  text:lines.join('\n'),modelRequestsPlanned:1,
  semanticCertified:false,approvedForApp:false};
}
