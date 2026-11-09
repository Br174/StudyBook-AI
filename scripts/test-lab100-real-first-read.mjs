// MotorLab StudyBook LAB100 — ONE live Gemini first reading for each distinct source page.
// The fact ledger is saved and reused unchanged for six letter/line reduction plans.
// Zero calls for the six plan derivations, zero calls for «In parole semplici».
// This is a research-only branch: NOT book ingestion, production code or a released APK.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import {FIXTURES} from './lab93-semantic-gate.mjs';
import {validateLedger,splitSentences,makeSixPlans} from './lab100-first-read-ledger.mjs';
const MANUAL=JSON.parse(readFileSync('audit/test-fixtures/lab93-atomic-fact-ledger.json','utf8')).sources;
const KEY=process.env.AI_TEST_KEY||'',MODEL='gemini-3.5-flash-lite';
const API='https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
const OUT='audit/reports/lab100-real-first-read.json',MAX_CALLS=7;
const SCHEMA={type:'json_schema',json_schema:{name:'studybook_lab100_first_read_atomic_inventory',strict:true,
 schema:{type:'object',additionalProperties:false,properties:{
  facts:{type:'array',items:{type:'object',additionalProperties:false,properties:{
   id:{type:'string'},sourceSentence:{type:'string'},evidence:{type:'string'},
   claim:{type:'string'},kind:{type:'string'},essential:{type:'boolean'}},
   required:['id','sourceSentence','evidence','claim','kind','essential']}}
 },required:['facts']}}};
let calls=0,stop=false,reason='',results=[],errors=[];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function prompt(source){
 const text=source.concepts.join(' ');
 const rows=splitSentences(text);
 return [
 'STUDYBOOK AI, FASE DI COMPRENSIONE UNICA DELLA PAGINA. Questa analisi deve essere riutilizzata invariata per 6 versioni future. NON scrivere nessun riassunto o testo da studiare.',
 'Estrai TUTTI i fatti distinti e necessari presenti in questa sola pagina: definizioni, obblighi, condizioni, negazioni, possibilità, eccezioni, cause, cifre, soggetti e relazioni. È un inventario, non una riscrittura: una riga di inventario per fatto atomico; un periodo può contenere più fatti.',
 'Per ciascun fatto scrivi: id sequenziale F1,F2,...; sourceSentence S1,S2...; evidence citazione BREVE e LETTERALE presa ESATTAMENTE dal periodo di origine, compresi apostrofi, accenti e parole come NON/PUÒ/SE; claim una breve proposizione italiana che ne conserva il significato; kind una fra definizione, fatto, causa, condizione, negazione, eccezione, misura, relazione, contesto; essential true quando la perdita cambierebbe ciò che lo studente deve sapere.',
 'OBBLIGATORIO: ogni periodo originale deve avere almeno un fatto. Se ci sono due proposizioni con cause, negazioni o condizioni diverse, estrai più fatti separati. Per i periodi divisi dal punto e virgola o dai due punti, analizza entrambe le parti. Non saltare i dettagli perché sembrano secondari.',
 'La citazione evidence deve trovarsi nella stessa frase indicata da sourceSentence. NON copiare né citare le pagine vicine. Non aggiungere conoscenze esterne, inventare esempi o cambiare il senso di «può», «deve», «non» e «soltanto».',
 'Non serve rispettare alcuna percentuale, riga A4 o numero di caratteri in questa prima lettura. L inventario completo sarà memorizzato e controllato, poi usato per tutte le riduzioni senza nuove estrazioni.',
 'Rispondi SOLO JSON {"facts":[{"id":"F1","sourceSentence":"S1","evidence":"citazione letterale","claim":"affermazione italiana","kind":"fatto","essential":true}, ...]}. Nessun altro campo.',
 'FRASI NUMERATE DELLA PAGINA (fonte unica):',
 ...rows.map(row=>row.id+': '+row.text),
 ...(source.contextOnly?['CONTESTO ADIACENTE PER ORIENTAMENTO, VIETATO COPIARNE CONTENUTI: prima «'+source.contextOnly.before+'», dopo «'+source.contextOnly.after+'».']:[])
 ].join('\n\n');
}
function manualBenchmark(source,claims){
 const joined=claims.map(f=>f.claim).join(' ');
 const groups=MANUAL[source.id]||[];
 const requirements=groups.flatMap((g,i)=>[
  ...g.core.map(f=>({id:f.id,kind:'core',concept:i+1,re:f.re})),
  ...g.support.map(f=>({id:f.id,kind:'support',concept:i+1,re:f.re}))
 ]);
 const missing=requirements.filter(f=>!new RegExp(f.re,'iu').test(joined));
 return{
  referenceCount:requirements.length,lexicallyMatched:requirements.length-missing.length,
  missingReferenceLexicalSignals:missing.map(f=>({id:f.id,kind:f.kind,concept:f.concept})),
  limitation:'This deliberately strict manually curated regex benchmark can overflag synonyms and cannot prove causal entailment.'
 };
}
function save(){
 const answered=results.filter(r=>r.received),good=answered.filter(r=>r.anchorValidated);
 const summary={pagesPlanned:FIXTURES.length,pagesAttempted:results.length,
  modelResponses:answered.length,anchoredValid:good.length,
  sixLevelPlans:good.reduce((n,r)=>n+r.plans.length,0),
  sourceSentences:good.reduce((n,r)=>n+r.ledger.completeness.sourceSentences,0),
  anchoredFacts:good.reduce((n,r)=>n+r.ledger.completeness.anchoredFacts,0),
  missingSourceSentences:good.reduce((n,r)=>n+r.ledger.completeness.missingSentences.length,0),
  sourceClauseWarnings:good.reduce((n,r)=>n+r.ledger.completeness.sourceClauseAlerts,0),
  markerWarnings:good.reduce((n,r)=>n+r.ledger.completeness.unrepresentedCriticalMarkers,0),
  totalManualRubricSignals:good.reduce((n,r)=>n+r.manualBenchmark.referenceCount,0),
  lexicalRubricMatched:good.reduce((n,r)=>n+r.manualBenchmark.lexicallyMatched,0),
  didacticallyCertified:0
 };
 const report={experiment:'LAB100 single first read, source-backed atomic ledger reused unchanged for 6 levels',
 date:new Date().toISOString(),model:MODEL,
 constraints:'Five synthetic source pages, pre-extracted text; automatic PDF extraction and true A4 output are NOT tested. Anchor validation and lexical rubrics do NOT certify semantic correctness.',
 provider:{attempts:calls,stopped:stop,reason,maxAttempts:MAX_CALLS},
 controls:{mainEdited:false,productionEdited:false,apkBuilt:false,paidServicesAdded:false,modelCallsForSixLevels:0},
 summary,errors,results};
 mkdirSync('audit/reports',{recursive:true});writeFileSync(OUT,JSON.stringify(report,null,2)+'\n');
 return report;
}
async function oneRead(source){
 let retries=0;
 while(!stop&&calls<MAX_CALLS&&retries<2){
  retries++;calls++;const started=performance.now();
  try{
   const response=await fetch(API,{method:'POST',headers:{Authorization:'Bearer '+KEY,'Content-Type':'application/json'},
    body:JSON.stringify({model:MODEL,temperature:0.1,max_tokens:3700,response_format:SCHEMA,
      messages:[{role:'user',content:prompt(source)}]}),
    signal:AbortSignal.timeout(85000)});
   const ms=Math.round(performance.now()-started),json=await response.json().catch(()=>({}));
   if(!response.ok){
    const issue={source:source.id,http:response.status,ms,call:calls,message:String(json.error?.message||'provider unavailable').slice(0,180)};
    errors.push(issue);console.log('LAB100_PROVIDER',JSON.stringify(issue));
    if(response.status===429){stop=true;reason='HTTP_429';results.push({source:source.id,received:false,error:issue});save();return}
    if(response.status===503&&retries===1&&calls<MAX_CALLS){await sleep(3200);continue}
    if(response.status===503){stop=true;reason='HTTP_503'}
    results.push({source:source.id,received:false,error:issue});save();return;
   }
   const raw=String(json.choices?.[0]?.message?.content||'').trim();
   let extracted={};
   try{extracted=JSON.parse(raw.replace(/^~~~json\s*/iu,'').replace(/\s*~~~$/u,''))}catch(e){errors.push({source:source.id,issue:'INVALID_MODEL_JSON',message:String(e).slice(0,150)})}
   const evaluated=validateLedger(source,extracted);
   const validated=evaluated.valid===true;
   const reused=validated?makeSixPlans(source,evaluated.payload):null;
   const benchmark=validated?manualBenchmark(source,evaluated.facts):null;
   const item={
    source:source.id,received:Array.isArray(extracted.facts),
    anchorValidated:validated,ms,
    rawModelFacts:extracted.facts||null,
    ledger:validated?evaluated.payload:null,
    preflight:{errors:evaluated.errors,warnings:evaluated.warnings,sourceSentences:evaluated.completeness?.sourceSentences||null},
    manualBenchmark:benchmark,plans:reused?.plans||[],
    sourceFingerprint:reused?.plans[0]?.ledgerSourceHash||null,
    rawTextWasPreExtracted:true,
    semanticReviewStatus:'NOT_APPROVED_FOR_STUDY'
   };
   results.push(item);
   console.log('LAB100_PAGE',JSON.stringify({source:source.id,received:item.received,anchored:validated,
    returnedFacts:extracted.facts?.length||0,sourceSentences:evaluated.completeness?.sourceSentences,
    sourceClauseWarnings:evaluated.completeness?.sourceClauseAlerts,
    markedRisks:evaluated.completeness?.unrepresentedCriticalMarkers,
    manualReferenceMatched:benchmark?.lexicallyMatched,manualReferenceTotal:benchmark?.referenceCount,
    plans:item.plans.length,ms}));
   save();return;
  }catch(e){
   const issue={source:source.id,exception:String(e?.name||e).slice(0,180),call:calls};
   errors.push(issue);console.log('LAB100_RUNTIME',JSON.stringify(issue));
   results.push({source:source.id,received:false,error:issue});save();return;
  }
 }
}
if(!KEY){errors.push({issue:'NO_EXISTING_GEMINI_SECRET'});save();process.exit(1)}
console.log('LAB100_START',JSON.stringify({pages:FIXTURES.length,maxCalls:MAX_CALLS,model:MODEL}));
for(const source of FIXTURES){
 if(stop||calls>=MAX_CALLS)break;
 await oneRead(source);
 if(stop)break;
 await sleep(900);
}
const r=save();
console.log('LAB100_FINAL',JSON.stringify({provider:r.provider,summary:r.summary,errors:r.errors.length}));
