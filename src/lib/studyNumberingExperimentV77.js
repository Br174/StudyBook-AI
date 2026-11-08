// MotorLab LAB77: experiment-only prompts and self-check for numeric markers.
// This is NOT a production writing protocol. The software counts actual text
// letters after removing only structurally marked numeric annotations.
export const EXPERIMENT_MODES_V77=Object.freeze([
 'sentence-up','sentence-down','word-down','letter-up'
]);
export const NUMBERING_EXPERIMENT_PROTOCOL_V77='studybook-numbering-experiment-77-v1';
const TAG=/⟦([0-9]{1,7})⟧/gu;
export const alphabeticalLettersV77=text=>
 (String(text||'').normalize('NFC').match(/\p{L}/gu)||[]).length;
export function stripNumberMarkersV77(text){
 return String(text||'').replace(/⟦[0-9]{1,7}⟧/gu,'');
}
export function markInstructionV77(mode,target,min,max,originalLetters){
 if(!EXPERIMENT_MODES_V77.includes(mode))
  throw Error('Unknown experimental numbering mode');
 const intro=[
  'Motore StudyBook: prova scientifica di numerazione senza modificare la fonte.',
  'La fonte contiene '+originalLetters+' LETTERE alfabetiche. La percentuale è una RIDUZIONE: devono rimanere circa '+target+' lettere.',
  'Intervallo ammesso del testo FINALE ripulito: '+min+'–'+max+' lettere alfabetiche Unicode. L’obiettivo centrale è '+target+'.',
  'Il testo finale deve essere una spiegazione didattica in italiano con frasi complete, non un elenco artificiale.',
  'Non inventare, non cancellare condizioni, eccezioni, negazioni, riferimenti normativi e numeri del contenuto.',
  'Usa per OGNI annotazione ESATTAMENTE la forma ⟦123⟧ con sole cifre all’interno; è un marcatore da rimuovere. Non usarla per numeri autentici del testo originale.',
  'Il software elimina SOLO i marcatori ⟦numero⟧ e conta autonomamente le lettere. Non dichiarare conteggi in una frase esterna.',
  'Tieni invariati gli id delle unità e usa JSON {parts:[{id,text},...]}; metti annotazioni SOLO dentro text.',
  'La difficoltà numerica non autorizza frasi senza senso, ripetizioni o tagli ai concetti.'
 ];
 const descriptions={
  'sentence-up':[
   'Dopo OGNI frase completa scrivi il marcatore ⟦N⟧ con il NUMERO PROGRESSIVO di lettere alfabetiche emesse dall’inizio del testo.',
   'Il totale parte da 0 e cresce. Conta solo lettere; ignora spazi, cifre reali, punteggiatura, apostrofi e marcatori.',
   'Ogni nuova frase continua il conteggio. Fermati quando sei vicino al valore '+target+', senza superare il massimo '+max+'.'
  ],
  'sentence-down':[
   'Dopo OGNI frase completa scrivi ⟦N⟧, dove N è il numero di LETTERE ANCORA DA SCRIVERE per arrivare all’obiettivo centrale '+target+'.',
   'Inizia idealmente da '+target+', sottrai le lettere di ogni nuova frase. Ignora spazi, cifre reali, punteggiatura, apostrofi e marcatori.',
   'Il conteggio scende verso 0. Fermati quando sei vicino a 0, rispettando la fascia finale '+min+'–'+max+'.'
  ],
  'word-down':[
   'Dopo OGNI PAROLA inserisci ⟦N⟧, numero di lettere ANCORA DA SCRIVERE per arrivare a '+target+'.',
   'Sottrai le sole lettere Unicode della parola appena prodotta; ignora spazi, punteggiatura, cifre originali e annotazioni.',
   'Il contatore scende verso 0; fermati vicino a 0. Esempio puramente tecnico: Auto⟦196⟧ corre⟦191⟧.'
  ],
  'letter-up':[
   'Dopo OGNI SINGOLA LETTERA alfabetica inserisci ⟦N⟧, progressivo crescente a partire da 1.',
   'Ogni lettera nuova fa aumentare il progressivo di ESATTAMENTE 1. Per esempio: A⟦1⟧u⟦2⟧t⟦3⟧o⟦4⟧.',
   'Non numerare spazi, cifre autentiche, punteggiatura né apostrofi. Non unire due lettere nello stesso tag.',
   'Raggiungi circa il progressivo '+target+', senza oltrepassare '+max+'. Il testo ripulito deve essere leggibile.'
  ]
 };
 return [...intro,...descriptions[mode]].join('\n');
}
export function markerAuditV77(annotated,mode,target){
 const text=String(annotated||''),real=stripNumberMarkersV77(text);
 const tags=[...text.matchAll(TAG)].map(x=>({at:x.index,number:Number(x[1]),len:x[0].length}));
 const total=alphabeticalLettersV77(real);
 const expectedMinTags=(mode==='letter-up'?total:mode==='word-down'?
   (real.match(/\p{L}+/gu)||[]).length:1);
 const positions=[];
 let prev=0,missingTags=0,sequenceErrors=0;
 for(const tag of tags){
  const span=text.slice(prev,tag.at);
  const letters=alphabeticalLettersV77(span);
  const absolute=alphabeticalLettersV77(text.slice(0,tag.at));
  const expected=mode.endsWith('-up')?absolute:target-absolute;
  if(tag.number!==expected)sequenceErrors++;
  positions.push({declared:tag.number,expected});
  prev=tag.at+tag.len;
 }
 const tail=alphabeticalLettersV77(text.slice(prev));
 if(tags.length<expectedMinTags)missingTags=expectedMinTags-tags.length;
 if(tail>0)missingTags++;
 const noUnparsedTags=!/[⟦⟧]/u.test(real);
 return {totalLetters:total,tagCount:tags.length,expectedMinTags,
  missingTags,sequenceErrors,unparsedTagSyntax:!noUnparsedTags,
  lastDeclared:positions.at(-1)?.declared??null,
  lastExpected:positions.at(-1)?.expected??null,
  lettersAfterLastTag:tail,
  markersValid:missingTags===0&&sequenceErrors===0&&noUnparsedTags
 };
}
