import assert from 'node:assert/strict';
import { buildPrecisionEdition, REDUCTION_STEPS, countWords } from '../src/lib/precisionCore.js';
import { countLetters, checkSentence, splitCompleteSentences } from '../src/lib/studyQualityGuard.js';

// LAB28 true failure: protecting every sentence containing "non" meant 0% real reduction.
const negated = Array.from({length:10},(_,i)=>[
  'Il requisito '+(i+1)+' non costituisce automaticamente prova della responsabilità civile.',
  'Il principio generale non impedisce la valutazione della situazione concreta nel caso specifico.',
  'In questo contesto è importante sottolineare che il controllo dei presupposti non sostituisce l’esame delle prove.',
  'La conclusione non dipende solamente dal fatto iniziale, ma anche dalla corretta individuazione della norma.',
].join(' ')).join(' ');
const longSingle = 'È importante sottolineare che la norma giuridica è una regola che disciplina i comportamenti.';
// 4 chapters x 4 paragraphs, all with live legally relevant material.
const source = [
  'È importante sottolineare che la norma giuridica è una regola che disciplina comportamenti e attribuisce conseguenze a determinati fatti. Il sistema giuridico è una struttura articolata che permette di organizzare i rapporti fra soggetti e istituzioni. La prima impostazione considera il rapporto fra disposizioni, competenze, diritti e doveri. Questo criterio può essere utilizzato per distinguere le differenti tipologie di norme.',
  'La disciplina applicabile prevede condizioni, presupposti e conseguenze che dipendono dall’ordinamento considerato. Qualora la fattispecie non sia presente, il requisito previsto non risulta soddisfatto. Salvo le eccezioni espressamente indicate, il termine decorre dalla data della comunicazione. La norma generale ha una funzione differente rispetto alla disposizione speciale.',
  'La teoria della gerarchia delle fonti è una concezione che distingue le norme secondo il livello del loro fondamento. Il primo livello raggruppa disposizioni di carattere generale che orientano l’attività dell’interprete. Il secondo livello contiene norme specifiche che regolano determinate ipotesi. Il terzo livello stabilisce criteri applicativi per casi particolari.',
  'Il ragionamento giuridico è una tecnica di ricostruzione che collega le condizioni di un fatto alle conseguenze di una disciplina. Il procedimento deve partire dal riconoscimento degli elementi necessari. Successivamente vengono considerate le situazioni eccezionali. In conclusione, la soluzione dipende dal rapporto fra i requisiti della norma e i fatti rilevanti.',
  'Le disposizioni normative sono costruite mediante proposizioni e prescrizioni che fissano obblighi, autorizzazioni e limiti. La dottrina può proporre modelli differenti per descrivere la struttura di queste proposizioni. Gli interpreti devono valutare le fonti considerate pertinenti. Ogni interpretazione va distinta dall’accertamento dei fatti.',
  'La distinzione fra norma primaria e norma secondaria è utile per descrivere la funzione delle regole. La norma primaria indica una condotta rilevante per il sistema. La norma secondaria disciplina la conseguenza prevista quando si verifica una determinata circostanza. I due livelli operano all’interno dello stesso ordinamento.'
].join('\n');
const book={
 chapters:Array.from({length:6},(_,i)=>({
   title:'Capitolo '+(i+1),
   paragraphs:Array.from({length:5},(_,j)=>({original: i%2 ? negated : source,
      summary:'NOT THE ORIGINAL',simpleSummary:'WRONG',sourceSection:'Sezione '+j})),
 })),
};
const levels=REDUCTION_STEPS.map(level=>buildPrecisionEdition(book,level));
const results=levels.map(ed=>{
  const original=ed.chapters.flatMap(c=>c.paragraphs).reduce((s,p)=>s+countLetters(p.original),0);
  const output=ed.chapters.flatMap(c=>c.paragraphs).reduce((s,p)=>s+countLetters(p.summary),0);
  const row={
    level:ed.precisionEdition.level,
    reductionLetters:Math.round((1-output/original)*1000)/10,
    reductionWords:ed.precisionEdition.achievedPercent,
    letters:output,
    restored:ed.precisionEdition.qualityGuard.originalFallbackParagraphs,
    targetMet:ed.precisionEdition.targetReached,
  };
  console.log('LAB29_PERCENT '+JSON.stringify(row));
  return row;
});
assert.equal(results[0].reductionLetters,0);
for(let i=1;i<results.length;i++){
 assert.ok(results[i].letters <= results[i-1].letters,
  'Ogni livello deve produrre al massimo le lettere del livello precedente: '+results[i-1].level+' vs '+results[i].level);
}
assert.ok(results[1].letters>results[5].letters*1.25,
 '10% e 50% non possono risultare quasi uguali su un libro comprimibile');
assert.ok(results[5].reductionWords >= 38,
 'Su testo multi-frase la riduzione richiesta al 50% deve avvicinarsi all’obiettivo, non essere 0%');
assert.ok(results[6].letters<results[5].letters,
 'Il Riassunto deve essere più breve del 50% su un testo comprimibile');
assert.equal(countWords('• Norma primaria • Norma secondaria'),4,'Il simbolo • non conta come parola');
for(const ed of levels) for(const ch of ed.chapters) for(const paragraph of ch.paragraphs) {
  assert.ok(paragraph.original.length>0);
  assert.ok(paragraph.summary.length>0);
  assert.ok(!paragraph.summary.includes('NOT THE ORIGINAL'));
  assert.ok(ed.precisionEdition.qualityGuard.semanticCertification===false);
  if (paragraph.precisionAudit?.coherent) {
   for(const sentence of splitCompleteSentences(paragraph.summary))
    assert.ok(checkSentence(sentence).valid,'No frasi spezzate: '+sentence.slice(0,70));
  }
}
const neg={chapters:[{title:'Norme',paragraphs:[{original:negated}]}]};
const n10=buildPrecisionEdition(neg,10),n50=buildPrecisionEdition(neg,50);
assert.ok(countLetters(n50.chapters[0].paragraphs[0].summary)<countLetters(n10.chapters[0].paragraphs[0].summary),
  'Anche un testo con negazioni deve poter essere ridotto selettivamente');
assert.ok(n50.chapters[0].paragraphs[0].summary.includes('non'));
const shortBook={chapters:[{title:'Definizioni',paragraphs:[{original:longSingle}]}]};
const short=buildPrecisionEdition(shortBook,50).chapters[0].paragraphs[0].summary;
assert.ok(countLetters(short)<countLetters(longSingle),'Una definizione breve deve poter essere schematizzata senza troncarla');
assert.ok(checkSentence(short).valid);
const protectedOriginal='Art. 12. Il ricorso è proponibile entro 30 giorni dalla notificazione, salvo le eccezioni espressamente previste.\nE = mc²';
const legal=buildPrecisionEdition({chapters:[{paragraphs:[{original:protectedOriginal}]}]},50).chapters[0].paragraphs[0].summary;
assert.ok(legal.includes(protectedOriginal),'Preservare disposizioni e formule integralmente anche se riducono il margine possibile');
console.log('LAB29_PROGRESSIVE_REDUCTION_PASS');
