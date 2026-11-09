// StudyBook AI / MotorLab LAB108: source-preserving one-call prompt research.
// Isolated module, no app/Worker/production generator wiring.
import {studyLetters} from './studyPillarV38.js';
import {sourceLetterBudgetV74} from './studyPageBudgetsV74.js';
import {prepareLetterFirstTrialV107} from './studyInverseCalibrationV107.js';

export const CALIBRATION_LEVELS_V108=Object.freeze(['10','20','40']);
export const CALIBRATION_ARMS_V108=Object.freeze(['COPY_EDIT','ANCHORED_SECTIONS']);
const count=s=>studyLetters(String(s??'').normalize('NFC'));
function sentences(value){
 const text=String(value||'').normalize('NFC').replace(/\s+/gu,' ').trim();
 return text.match(/[^.!?]+[.!?]+|[^.!?]+$/gu)?.map(s=>s.trim()).filter(Boolean)||[];
}
function distribute(total,weights){
 if(!Number.isInteger(total)||total<0||!weights.length)throw Error('INVALID_LETTER_ALLOCATION');
 const n=weights.reduce((a,b)=>a+b,0),raw=weights.map(x=>total*x/n);
 const result=raw.map(Math.floor),remaining=total-result.reduce((a,b)=>a+b,0);
 const priorities=raw.map((x,i)=>({i,rem:x-result[i]})).sort((a,b)=>b.rem-a.rem||a.i-b.i);
 for(let i=0;i<remaining;i++)result[priorities[i].i]++;
 return result;
}
export function buildSourcePreservingPromptV108({
 source,level,arm='COPY_EDIT',maxRows,shortPageExempt=false
}={}){
 const normalized=String(source||'').normalize('NFC').replace(/\s+/gu,' ').trim(),l=String(level);
 if(!normalized||!CALIBRATION_LEVELS_V108.includes(l))throw Error('INVALID_ORIGINAL_OR_LEVEL');
 if(!CALIBRATION_ARMS_V108.includes(arm))throw Error('INVALID_CALIBRATION_ARM');
 if(!Number.isSafeInteger(maxRows)||maxRows<1)throw Error('INVALID_FIXED_GRID');
 const budget=sourceLetterBudgetV74(count(normalized),l);
 const prepared=prepareLetterFirstTrialV107({source:normalized,level:l,budget});
 const pieces=sentences(normalized);
 if(pieces.length<2)throw Error('SENTENCE_ANCHORS_INSUFFICIENT');
 const allocation=distribute(budget.targetLetters,pieces.map(count));
 const preservation=l==='10'
  ?'Operazione: CORREZIONE LEGGERA dell’originale, NON riassunto. Mantieni tutte le proposizioni e tutti i dettagli necessari; elimina al massimo ridondanze e lungaggini già presenti.'
  :l==='20'
  ?'Operazione: REVISIONE CONSERVATIVA dell’originale, NON riassunto. Conserva quasi tutte le informazioni, riduci formule ripetitive e chiarisci senza cambiare fatti e condizioni.'
  :'Operazione: SINTESI CONTROLLATA al 40%: unisci solo le ridondanze, ma esprimi tutti i nuclei informativi e tutte le condizioni, date, negazioni ed eccezioni importanti.';
 const common=[
  'StudyBook AI LAB108: produci una singola pagina in italiano, in un solo JSON {"text":"..."} senza alcun testo aggiuntivo.',
  'Riduzione REALE di lettere alfabetiche richiesta: '+l+'%, NON "'+l+'% di testo da conservare".',
  'L’originale ha '+budget.originalLetters+' LETTERE alfabetiche Unicode, non caratteri totali. Mantieni circa '+budget.targetLetters+' LETTERE; fascia ammissibile '+budget.minLetters+'–'+budget.maxLetters+'. Non contare spazi, punteggiatura o cifre.',
  'Capienza già fissata: massimo '+maxRows+' righe da 60 caratteri; non spezzare parole; non cambiare font, margini o capitoli, né spostare parti sulla pagina successiva.',
  'Gli stessi fatti, termini specialistici, soggetti, negazioni, condizionali, gradi di certezza, sequenze temporali e relazioni causa-effetto devono restare corretti.',
  'Non introdurre dati, generalizzazioni o parole sostitutive che cambino la portata della fonte. Non trasformare "può" in "deve", "influisce" in "causa", né una "regola interna" in una "norma" generale.',
  preservation,
  'La priorità è conservare significato e leggibilità. Se non puoi rispettare il conteggio, NON omettere un fatto indispensabile per rientrare: StudyBook misurerà e segnalerà la non conformità.',
  'Quando la spiegazione è completa fermati; vietate frasi di riempimento, elenco di parole chiave, apostrofi mancanti, troncamenti o compressione grafica.'
 ];
 if(shortPageExempt)common.push('Pagina originale brevissima: la percentuale è non vincolante; il significato resta vincolante.');
 if(arm==='COPY_EDIT'){
  common.push('Metodo A: parti dalla formulazione originale e trattieni TUTTE le sue proposizioni; modifica solo le espressioni davvero ridondanti. Non ricostruire una mini-sintesi da zero.');
  common.push('Una riscrittura fedele del 10% mantiene CIRCA IL NOVANTA PER CENTO delle lettere, non elimina il novanta per cento. Rileggi e controlla internamente il testo prima di inviarlo.');
  common.push('TESTO FONTE NON MODIFICABILE:\n'+normalized);
 }else{
  common.push('Metodo B: mantieni l’ordine e l’identità delle frasi originarie; usa il piano di lettere sottostante solo come quota MORBIDA: se una frase contiene un fatto critico, conserva il dettaglio e redistribuisci le quote, senza ripetizioni.');
  common.push('Piano indicativo per le '+pieces.length+' frasi: '+allocation.map((n,i)=>'S'+(i+1)+' circa '+n+' lettere da conservare').join('; ')+'. Totale pagina '+budget.targetLetters+'.');
  common.push('Mantieni il nesso logico tra frasi; produci UN SOLO testo continuo, non un elenco numerato.');
  common.push('TESTO FONTE CON ANCORA DI FRASE (gli identificatori non vanno ricopiati):\n'+pieces.map((x,i)=>'S'+(i+1)+': '+x).join('\n'));
 }
 return {
  experimental:true,approvedForApp:false,
  budgetSource:'studyPageBudgetsV74',
  baselinePromptOwner:'studyInverseCalibrationV107',
  level:l,arm,
  source:normalized,originalLetters:budget.originalLetters,letterBudget:budget,
  maxRows,softSentenceBudgets:arm==='ANCHORED_SECTIONS'?allocation:null,
  shortPageExempt:Boolean(shortPageExempt),
  sourceSentenceCount:pieces.length,
  requiresRealGeminiTest:true,semanticCertified:false,requestCallsExpected:1,
  prompt:common.join('\n\n')
 };
}
