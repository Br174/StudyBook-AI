// LAB76: local, no-Gemini tests proving source-bound, numerical, semantic
// advisories and connection to StudyBook quality inspection.
// Four GOLDEN outputs come from the immutably verified LAB104 source ledger.
// They are NOT claims that Gemini will reproduce them on new books.
import assert from 'node:assert/strict';
import {editionBestOfInstructionV76,inspectBestOfV76,rowsBestOfV76} from '../src/lib/studyBestOfV76.js';
import {studyQualityInspectionV66} from '../src/lib/studyQualityV66.js';
import {planNaturalBlocksV51} from '../src/lib/integralPlannerV51.js';
const cases=[
  {
    "src": "medicina",
    "level": "10",
    "original": "In un esempio didattico, l'apparato respiratorio porta aria ai polmoni attraverso le vie aeree. Durante l'inspirazione il diaframma si contrae e il torace aumenta di volume; durante l'espirazione a riposo il diaframma si rilassa. Negli alveoli polmonari l'ossigeno passa dall'aria al sangue, mentre l'anidride carbonica compie il percorso opposto. Lo scambio avviene grazie a differenze di pressione parziale dei gas attraverso pareti molto sottili. L'emoglobina nei globuli rossi trasporta gran parte dell'ossigeno nel sangue. La frequenza respiratoria può aumentare durante uno sforzo perché l'organismo consuma più ossigeno e produce più anidride carbonica. Per valutare un disturbo respiratorio il medico considera sintomi, storia clinica ed esame obiettivo. Un singolo valore misurato non basta sempre per una diagnosi: deve essere interpretato nel contesto clinico.",
    "generated": "L'apparato respiratorio porta aria ai polmoni tramite le vie aeree. Durante l'inspirazione il diaframma si contrae e il torace aumenta di volume; durante l'espirazione a riposo il diaframma si rilassa. Negli alveoli polmonari l'ossigeno passa dall'aria al sangue, mentre l'anidride carbonica fa il percorso inverso. Lo scambio avviene per differenze di pressione parziale attraverso pareti sottili. L'emoglobina nei globuli rossi trasporta gran parte dell'ossigeno. La frequenza respiratoria può aumentare nello sforzo perché l'organismo consuma più ossigeno e produce più anidride carbonica. Per valutare un disturbo respiratorio il medico valuta sintomi, storia clinica ed esame obiettivo. Un singolo valore misurato non basta sempre per la diagnosi: va interpretato nel contesto clinico.",
    "expected": 9.34,
    "rows": 14,
    "maxRows": 15,
    "factReview": {
      "FULL": 12,
      "PARTIAL": 2,
      "OPTIONAL_OMITTED": 1
    }
  },
  {
    "src": "concetto_sbilanciato",
    "level": "20",
    "original": "In un laboratorio di storia, gli studenti confrontano lettere, cronache, carte geografiche e registri per ricostruire gli avvenimenti. La provenienza di ciascun documento aiuta a capire chi lo ha prodotto, quando e per quale scopo. Due testimonianze possono riferire lo stesso episodio in modo diverso, perché i loro autori hanno osservato aspetti differenti oppure hanno interessi particolari. Per verificare un'affermazione occorre confrontare più fonti indipendenti, distinguere un fatto da un'opinione e segnalare ciò che resta incerto. Una data isolata non spiega da sola le cause di un evento: bisogna studiarne il contesto e le conseguenze. Una fonte primaria è prodotta nel periodo studiato. Una fonte secondaria interpreta documenti precedenti. Le ipotesi vanno distinte dai fatti documentati.",
    "generated": "Nel laboratorio di storia gli studenti confrontano lettere, cronache, carte geografiche e registri per ricostruire gli avvenimenti. La provenienza aiuta a capire autore, tempo e scopo. Testimonianze sullo stesso episodio possono differire per aspetti osservati o interessi degli autori. Per verificare un'affermazione occorre confrontare fonti indipendenti, distinguere fatti da opinioni e segnalare l'incertezza. Una data isolata non spiega le cause: serve studiare contesto e conseguenze. Una fonte primaria è prodotta nel periodo studiato. Una fonte secondaria interpreta documenti precedenti. Le ipotesi vanno distinte dai fatti documentati.",
    "expected": 18.66,
    "rows": 12,
    "maxRows": 12,
    "factReview": {
      "FULL": 13,
      "PARTIAL": 0,
      "OPTIONAL_OMITTED": 0
    }
  },
  {
    "src": "scienze",
    "level": "summary",
    "original": "La Terra ruota attorno al proprio asse. La rotazione causa il giorno e la notte, perché una parte della superficie riceve luce solare mentre l’altra rimane al buio. La rivoluzione attorno al Sole dura circa un anno. Le stagioni dipendono soprattutto dall’inclinazione dell’asse terrestre, non dalla distanza tra la Terra e il Sole. La Luna influisce sulle maree insieme al Sole. Le eclissi richiedono un allineamento particolare e non avvengono a ogni lunazione. Il metodo scientifico richiede ipotesi verificabili e osservazioni ripetibili. Un risultato isolato non basta per dimostrare una spiegazione. Per comprendere il fenomeno bisogna distinguere fra descrizione del movimento e cause delle variazioni osservate.",
    "generated": "La Terra ruota: giorno e notte. Orbita attorno al Sole in un anno. Stagioni: asse inclinato, non distanza. Maree: Luna e Sole influiscono. Eclissi: allineamento, non ogni lunazione. Metodo: ipotesi verificabili, osservazioni ripetibili; un esito isolato non basta. Distinguere moti e cause.",
    "expected": 61.1,
    "rows": 5,
    "maxRows": 5,
    "factReview": {
      "FULL": 3,
      "PARTIAL": 8,
      "OPTIONAL_OMITTED": 1
    }
  },
  {
    "src": "scienze",
    "level": "30",
    "original": "La Terra ruota attorno al proprio asse. La rotazione causa il giorno e la notte, perché una parte della superficie riceve luce solare mentre l’altra rimane al buio. La rivoluzione attorno al Sole dura circa un anno. Le stagioni dipendono soprattutto dall’inclinazione dell’asse terrestre, non dalla distanza tra la Terra e il Sole. La Luna influisce sulle maree insieme al Sole. Le eclissi richiedono un allineamento particolare e non avvengono a ogni lunazione. Il metodo scientifico richiede ipotesi verificabili e osservazioni ripetibili. Un risultato isolato non basta per dimostrare una spiegazione. Per comprendere il fenomeno bisogna distinguere fra descrizione del movimento e cause delle variazioni osservate.",
    "generated": "La Terra ruota attorno al proprio asse. La rotazione causa il giorno e la notte poiché una parte riceve luce e l'altra resta al buio. La rivoluzione attorno al Sole dura circa un anno. Le stagioni dipendono dall'inclinazione dell'asse terrestre e non dalla distanza. La Luna influisce sulle maree insieme al Sole. Le eclissi richiedono un allineamento particolare e non avvengono a ogni lunazione. Metodo: ipotesi verificabili, osservazioni ripetibili; un solo risultato non dimostra una spiegazione. Distinguere moto e cause delle variazioni.",
    "expected": 25.21,
    "rows": 10,
    "maxRows": 10,
    "factReview": {
      "FULL": 11,
      "PARTIAL": 1,
      "OPTIONAL_OMITTED": 0
    }
  }
];
const within=(x,y,t=0.02)=>Math.abs(x-y)<=t;
let checked=0;
for(const c of cases){
 const verdict=inspectBestOfV76(c.original,c.generated,c.level);
 assert(within(verdict.actualReductionPercent,c.expected),c.src+'-'+c.level+' pct regression');
 assert.equal(verdict.rows,c.rows,c.src+'-'+c.level+' lines regression');
 assert(verdict.withinBand&&verdict.gridFits,'quantitative+virtual geometry regression '+c.src);
 assert.equal(verdict.semanticCertified,false,'never certify a textbook through regex');
 assert.equal(verdict.physicalA4Verified,false,'never imply A4 printed proof');
 const prompt=editionBestOfInstructionV76(c.level,verdict.sourceLetters);
 assert(prompt.includes('pageBudgetsV74')&&prompt.includes('FONTE')===false?true:prompt.includes('testo ORIGINALE'));
 assert(prompt.includes('NON')||prompt.includes('non'));
 assert(!prompt.includes('FONDAMENTALI GIÀ VERIFICATI'),'never paste LAB101 verbose fact ledger into Gemini');
 assert(!prompt.includes('PRIMO PROMPT'),'never require a planning Gemini request');
 checked++;
}
const science=cases.find(c=>c.src==='scienze'&&c.level==='30');
const history=cases.find(c=>c.src==='concetto_sbilanciato');
const medicine=cases.find(c=>c.src==='medicina');
function warning(c,replacement,code){
 const v=inspectBestOfV76(c.original,replacement,c.level);
 assert(v.semanticAdvisories.includes(code),code+' not caught');
 return true;
}
const mutationTests=[
 warning(medicine,medicine.original.replace("dall'aria al sangue","dal sangue all'aria"),'oxygen-direction'),
 warning(medicine,medicine.original.replace('può aumentare','deve aumentare'),'may-versus-must'),
 warning(history,history.original.replace('fatti documentati','fatti dimostrati'),'documented-not-proven'),
 warning(science,science.original.replace('non avvengono a ogni lunazione','avvengono a ogni lunazione'),'not-every-lunation'),
 warning(science,science.original.replace('La Luna influisce sulle maree','La Luna causano maree'),'influence-not-cause')
];
assert.equal(mutationTests.length,5);
const proper=inspectBestOfV76(science.original,science.original,'30');
assert(!proper.semanticAdvisories.some(x=>x==='not-every-lunation'),'false alarm on correct negation');
const words=rowsBestOfV76('Una parola lunga ma non spezzata; i risultati restano fedeli.');
assert.equal(words.overlong,false);
const veryLong=rowsBestOfV76('L'.repeat(65));
assert.equal(veryLong.overlong,true);
for(const level of ['summary','50','40','30','20','10']){
 const a=editionBestOfInstructionV76(level,1000);
 assert(a.includes('1000')&&a.includes('lettere conservate'));
 if(['10','20'].includes(level))assert(a.includes('EDITING CONSERVATIVO'));
 if(['30','40'].includes(level))assert(a.includes('RISCRITTURA MODERATA'));
}
const rows=[[{editions:{'20':history.generated},verified:{},issues:{}}]];
const drafts=[[{editions:{'20':history.generated}}]];
const book={canonicalBookMap:{pageCount:1},chapters:[{paragraphs:[{original:history.original}]}]};
const units=[{id:'0:0',ci:0,pi:0,source:history.original,pageStart:1,pageEnd:1}];
const review=studyQualityInspectionV66(book,units,rows,drafts);
assert(review.publicRows[0][0].bestOfV76['20'],'quality review did not store LAB76 audit');
assert.equal(review.publicRows[0][0].bestOfV76['20'].semanticCertified,false);
assert.equal(review.levels['20'].bestOfV76.examinedUnits,1);
assert.equal(review.levels['20'].bestOfV76.compliantNumericAndVirtualGrid,1);
assert.equal(review.summary.geminiRequests,0);
// Prove 44-page upper-bound batching remains a SINGLE BLOCK per level.
// The proven LAB58 batching algorithm is reused byte-for-byte (not replaced).
const original='Argomento '.repeat(20).trim();
const whole=Array.from({length:44},(_,i)=>({id:'0:'+i,
 original,source:original,pageStart:i+1,pageEnd:i+1,ci:0,pi:i,chapterTitle:'Prova',sectionTitle:''}));
const batches={};
for(const level of ['summary','50','40','30','20','10']){
 batches[level]=planNaturalBlocksV51(whole,level).length;
 assert.equal(batches[level],1,'LAB58 large block regression '+level);
}
console.log('LAB76_BESTOF_GREEN',JSON.stringify({
 goldenSourceBackedCases:checked,mutationsCaught:mutationTests.length,
 sixLevelSourceFirstModes:6,
 quantitativeCasesPass:checked,
 nativeQualityAttached:true,
 preexisting44pageLargeBlocks:batches,
 noGeminiCalls:true,semanticCertification:false,androidDeviceNotTested:true
}));
