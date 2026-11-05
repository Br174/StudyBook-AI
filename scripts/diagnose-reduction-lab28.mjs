import { buildPrecisionEdition, REDUCTION_STEPS } from '../src/lib/precisionCore.js';
import { countLetters, countWords } from '../src/lib/studyQualityGuard.js';
const source = [
 'È importante sottolineare che la norma giuridica è una regola che disciplina comportamenti e attribuisce conseguenze a determinati fatti. Il sistema giuridico è una struttura articolata che permette di organizzare i rapporti fra soggetti e istituzioni. La prima impostazione considera il rapporto fra disposizioni, competenze, diritti e doveri. Questo criterio può essere utilizzato per distinguere le differenti tipologie di norme.',
 'La disciplina applicabile prevede condizioni, presupposti e conseguenze che dipendono dall’ordinamento considerato. Qualora la fattispecie non sia presente, il requisito previsto non risulta soddisfatto. Salvo le eccezioni espressamente indicate, il termine decorre dalla data della comunicazione. La norma generale ha una funzione differente rispetto alla disposizione speciale.',
 'La teoria della gerarchia delle fonti è una concezione che distingue le norme secondo il livello del loro fondamento. Il primo livello raggruppa disposizioni di carattere generale che orientano l’attività dell’interprete. Il secondo livello contiene norme specifiche che regolano determinate ipotesi. Il terzo livello stabilisce criteri applicativi per casi particolari.',
 'Il ragionamento giuridico è una tecnica di ricostruzione che collega le condizioni di un fatto alle conseguenze di una disciplina. Il procedimento deve partire dal riconoscimento degli elementi necessari. Successivamente vengono considerate le situazioni eccezionali. In conclusione, la soluzione dipende dal rapporto fra i requisiti della norma e i fatti rilevanti.',
 'Le disposizioni normative sono costruite mediante proposizioni e prescrizioni che fissano obblighi, autorizzazioni e limiti. La dottrina può proporre modelli differenti per descrivere la struttura di queste proposizioni. Gli interpreti devono valutare le fonti considerate pertinenti. Ogni interpretazione va distinta dall’accertamento dei fatti.',
 'La distinzione fra norma primaria e norma secondaria è utile per descrivere la funzione delle regole. La norma primaria indica una condotta rilevante per il sistema. La norma secondaria disciplina la conseguenza prevista quando si verifica una determinata circostanza. I due livelli operano all’interno dello stesso ordinamento.'
].join('\n');
const book = {
 chapters:Array.from({length:8},(_,c)=>({
   title:'Capitolo '+(c+1),
   paragraphs:Array.from({length:4},(_,p)=>({
     original:source, sourceSection:'Sottosezione '+(p+1),
     summary:'Riassunto precedente', simpleSummary:'Riassunto improprio'
   }))
 }))
};
const all=[];
for(const level of REDUCTION_STEPS){
 const d=buildPrecisionEdition(book,level);
 const chunks=d.chapters.flatMap(c=>c.paragraphs);
 const original=chunks.reduce((x,p)=>x+countLetters(p.original),0);
 const actual=chunks.reduce((x,p)=>x+countLetters(p.summary),0);
 const r={
 level, originalLetters:original, outputLetters:actual,
 reductionLetters:+((1-actual/original)*100).toFixed(1),
 outputWords:d.precisionEdition.resultingWords,
 reductionWords:d.precisionEdition.achievedPercent,
 restored:d.precisionEdition.qualityGuard.originalFallbackParagraphs,
 reasons:d.precisionEdition.qualityGuard.issues.slice(0,6)
 };
 all.push(r);
 console.log(JSON.stringify(r));
}
for(let i=1;i<all.length-1;i++) if(all[i].outputLetters>all[i-1].outputLetters)
 console.log('REGRESSION: stronger level produces longer content',all[i-1].level,all[i].level);

const samples = [
  ["every-negative-protected",Array.from({length:8},(_,i) =>
    'La disposizione non attribuisce automaticamente il diritto quando manca il requisito essenziale numero '+(i+1)+'.').join(' ')],
  ["single-unbroken-sentence",
    'Il diritto moderno sviluppa una spiegazione articolata del rapporto fra la condotta e il criterio di imputazione e considera la struttura dell’ordinamento e il modello di distribuzione delle competenze e il rilievo delle conseguenze secondo differenti impostazioni interpretative che orientano la valutazione delle situazioni concrete e l’analisi dei singoli casi fino alla scelta della disciplina applicabile.'],
  ["broken-source",
    'Il diritto è la regola e il fondamento del sistema. La disciplina si applica secondo le condizioni... La norma non stabilisce un criterio differente.'],
  ["source-with-qualifiers",
    'La norma generale si applica alla situazione. Salvo i casi speciali, la regola non modifica gli effetti stabiliti. La competenza è definita dal provvedimento. Il termine è calcolato secondo il sistema previsto.'],
];
for (const [name,sourceText] of samples) {
 const fixture={chapters:[{title:'Caso difficile',paragraphs:[{original:sourceText}]}]};
 const results=REDUCTION_STEPS.map(level=>{
   const edition=buildPrecisionEdition(fixture,level);
   const paragraph=edition.chapters[0].paragraphs[0];
   return {level,chars:countLetters(paragraph.summary),reductionWords:edition.precisionEdition.achievedPercent,
       fallback:paragraph.precisionAudit.fallbackOriginal,
       audit:paragraph.precisionAudit.reasons};
 });
 console.log('EDGE '+name+' '+JSON.stringify(results));
}

console.log('DIAGNOSTIC COMPLETE');

// LAB28 diagnostic executed with the branch-pinned CI workflow.
