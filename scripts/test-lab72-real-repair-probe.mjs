// LAB72: exactly one additional free-model probe with measured repair focus.
// The preceding text is synthetic (not user data). Results are DIAGNOSTIC.
import handler from '../api/editionsBulkV51.js';
import {buildUnitBudgetsV71,STUDY_DRAFT_PROTOCOL_V71} from '../src/lib/studyDraftProtocolV71.js';
import {studyLetters,exactRetained} from '../src/lib/studyPillarV38.js';
const key=process.env.AI_API_KEY||process.env.GEMINI_API_KEY||'';
if(!key){console.log('LAB72_REAL_REPAIR_UNVERIFIED: No existing key');process.exit(0)}
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
const priorLetters=Math.round(original*.818);
const m=[...source.matchAll(/\p{L}/gu)];
const previousText=source.slice(0,(m[priorLetters-1]?.index??0)+1);
const units=[{id:'0:0',source,pageStart:1,pageEnd:1}];
const target=exactRetained(original,10);
const reply={method:'POST',env:{AI_API_KEY:key,AI_MODEL:'gemini-3.5-flash-lite'},
 body:{phase:'repair-v71',draftProtocol:STUDY_DRAFT_PROTOCOL_V71,
 level:'10',bookTitle:'Prova sintentica ricalibrazione',
 targetLetters:target,summaryCapLetters:null,
 unitBudgets:buildUnitBudgetsV71(units,'10'),
 maxOutputTokens:6000,timeoutMs:85000,
 repairDrafts:[{id:'0:0',text:previousText,repairFocus:{
   targetLetters:target,note:'La bozza precedente è troppo corta. Recupera i dettagli pertinenti dalla fonte.'}}],
 units}};
const res={statusCode:200,payload:null,
 setHeader(){return this},status(s){this.statusCode=s;return this},
 json(p){this.payload=p;return this}};
await handler(reply,res);
if(res.statusCode!==200)console.log('LAB72_REAL_REPAIR_UNVERIFIED',JSON.stringify({
 status:res.statusCode,code:res.payload?.code||'UNKNOWN'}));
else console.log('LAB72_REAL_REPAIR_OBSERVED',JSON.stringify({
 originalLetters:original,syntheticPreviousLetters:priorLetters,
 targetLetters:target,outputLetters:res.payload.lengthReview.observedLetters,
 reduction:res.payload.lengthReview.achievedReduction,
 withinBand:res.payload.lengthReview.withinBand,
 finishReason:res.payload.finishReason,
 tokensOut:res.payload.outputTokensUsed,
 tokenLimit:res.payload.outputTokenLimit,
 completeParts:res.payload.completeParts
}));
