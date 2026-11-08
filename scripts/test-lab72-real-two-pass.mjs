// LAB72: at most two authorized real Gemini patch requests, synthetic text.
import handler from '../api/editionsBulkV51.js';
import {buildUnitBudgetsV71} from '../src/lib/studyDraftProtocolV71.js';
import {STUDY_DRAFT_PROTOCOL_V72} from '../src/lib/studyDraftProtocolV72.js';
import {studyLetters,exactRetained} from '../src/lib/studyPillarV38.js';
const key=process.env.AI_API_KEY||process.env.GEMINI_API_KEY||'';
if(!key){console.log('LAB72_TWO_PASS_UNVERIFIED: existing free key absent');process.exit(0)}
const assertions=[
 'La Luna è un satellite naturale della Terra e non emette luce propria: riflette quella solare.',
 'Le sue fasi dipendono dalla geometria fra Sole, Terra e Luna nel corso del mese.',
 'Il ciclo delle fasi dura circa ventinove giorni e mezzo, misurato da una Luna nuova alla successiva.',
 'La distanza fra Terra e Luna non è sempre identica, poiché il moto segue un’orbita ellittica.',
 'La superficie presenta crateri, altopiani e pianure scure chiamate mari, pur essendo prive di acqua superficiale liquida.',
 'La gravità lunare è inferiore a quella terrestre, ma il corpo conserva una massa significativa.',
 'La Luna presenta sempre quasi la stessa faccia verso la Terra per effetto della rotazione sincrona.',
 'L’atmosfera lunare è estremamente tenue e non può sostenere la respirazione umana.',
 'Le maree terrestri derivano soprattutto dall’attrazione gravitazionale della Luna insieme a quella del Sole.',
 'Le eclissi lunari si verificano quando la Terra si interpone fra il Sole e la Luna in circostanze geometriche specifiche.',
 'Il primo sbarco umano sulla Luna è avvenuto nel luglio del 1969 con la missione Apollo 11.',
 'Il regolite lunare è costituito da frammenti rocciosi e polveri prodotti anche dagli impatti meteorici.',
 'Le variazioni di temperatura superficiale sono marcate fra l’illuminazione solare e la notte lunare.',
 'Lo studio della Luna aiuta a comprendere la storia degli impatti e l’evoluzione del sistema solare.',
 'Le osservazioni telescopiche possono distinguere numerose strutture superficiali ma non i piccoli oggetti lasciati dagli astronauti.',
 'I campioni riportati sulla Terra vengono studiati con misure chimiche e mineralogiche per chiarire la storia geologica.'
];


const source=assertions.join('\n\n');
const original=studyLetters(source);
const matches=[...source.matchAll(/\p{L}/gu)];
let previousText=source.slice(0,(matches[Math.round(original*.818)-1]?.index||0)+1);
const units=[{id:'0:0',source,pageStart:1,pageEnd:1}],target=exactRetained(original,10);
const findings=[];
for(let trial=1;trial<=2;trial++){
 const res={statusCode:200,payload:null,
  setHeader(){return this},status(code){this.statusCode=code;return this},
  json(value){this.payload=value;return this}};
 await handler({method:'POST',env:{AI_API_KEY:key,AI_MODEL:'gemini-3.5-flash-lite'},
  body:{phase:'repair-v72',draftProtocol:STUDY_DRAFT_PROTOCOL_V72,
   level:'10',bookTitle:'Prova di un libro sintetico',targetLetters:target,
   summaryCapLetters:null,units,unitBudgets:buildUnitBudgetsV71(units,'10'),
   repairDrafts:[{id:'0:0',text:previousText}],
   maxOutputTokens:6000,timeoutMs:85000}},res);
 if(res.statusCode!==200||!res.payload?.parts?.[0]?.text){
  findings.push({trial,status:res.statusCode,code:res.payload?.code||'INVALID'});
  break;
 }
 const m=res.payload.lengthReview;
 findings.push({trial,status:200,originalLetters:original,
  outputLetters:m.observedLetters,reduction:m.achievedReduction,
  withinBand:m.withinBand,completeParts:res.payload.completeParts,
  finishReason:res.payload.finishReason,
  inputTokens:res.payload.inputTokens,outputTokens:res.payload.outputTokensUsed,
  tokenLimit:res.payload.outputTokenLimit});
 previousText=res.payload.parts[0].text;
 if(m.withinBand&&m.compliant)break;
}
console.log('LAB72_REAL_TWO_PASS_OBSERVED',JSON.stringify({targetReduction:10,
 targetLetters:target,findings,requests:findings.length,
 method:'patch-only, no actual user data'}));
