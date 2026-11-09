// MotorLab StudyBook LAB101: ONE real Gemini call per page extracts facts AND
// priorities at once. Manual labels remain private, used only AFTER generation.
// No standalone second classification request and no six-way duplication.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import {FIXTURES} from './lab93-semantic-gate.mjs';
import {splitSentences} from './lab100-first-read-ledger.mjs';
import {rankFirstRead,compareCalibration} from './lab101-priority-ledger.mjs';
const LEGACY=JSON.parse(readFileSync('audit/reports/lab100-safe-anchor-final.json','utf8')).verifiedLedgers;
const EDITORIAL=JSON.parse(readFileSync('audit/test-fixtures/lab101-manual-priority-calibration.json','utf8')).labels;
const KEY=process.env.AI_TEST_KEY||'',MODEL='gemini-3.5-flash-lite',API='https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
const OUT='audit/reports/lab101-real-priorities.json',MAX_CALLS=7;
const SCHEMA={type:'json_schema',json_schema:{name:'lab101_first_read_with_priority',strict:true,
 schema:{type:'object',additionalProperties:false,properties:{
  facts:{type:'array',items:{type:'object',additionalProperties:false,properties:{
   id:{type:'string'},sourceSentence:{type:'string'},evidence:{type:'string'},
   claim:{type:'string'},kind:{type:'string'},priority:{type:'string'}},
   required:['id','sourceSentence','evidence','claim','kind','priority']}}
 },required:['facts']}}};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let attempts=0,halt=false,why='',errors=[],pages=[];
function prompt(source){
 const rows=splitSentences(source.concepts.join(' '));
 return[
 'STUDYBOOK AI: PRIMA LETTURA UNICA DI UNA PAGINA. Crea IN UNA SOLA RISPOSTA sia l inventario fedele dei fatti sia la priorità didattica. Non produrre ancora versioni ridotte. Questo inventario verrà conservato per tutte e sei le versioni.',
 'Non cancellare NESSUNA frase che contiene un fatto distinto. Una frase può avere più fatti: separa negazioni, condizioni, eccezioni, cause, definizioni, cifre e soggetti, lasciando inalterato il grado di certezza («può» non è «deve», «documentato» non è «dimostrato»).',
 'Per ogni fatto indica id F1/F2... (unico), sourceSentence S1/S2..., evidence copiato LETTERALMENTE e BREVE dalla stessa frase della fonte, claim con il significato in italiano corretto, kind e priority.',
 'Usa SOLO tre valori per priority:',
 'fondamentale = se togli il fatto perdi un concetto, una definizione, una differenza, un numero necessario, una negazione, una condizione, un obbligo, una causa o una relazione imprescindibile; deve essere mantenuto in TUTTE le versioni, anche nel riassunto;',
 'supporto = informazione realmente presente che precisa o rende più facile capire un concetto già fondamentale. Non significa da cancellare: al 10/20% resta più spiegata, nelle versioni brevi si può rendere più sintetica;',
 'contesto = cornice introduttiva/esemplificativa non necessaria per comprendere i concetti essenziali. La sua presenza rimane registrata ma non deve forzare ad allungare un riassunto.',
 'Non assegnare automaticamente «fondamentale» a tutti i fatti, e non declassare una negazione o condizione fondamentale solo per ridurre la lunghezza. Se tutti sono veramente fondamentali, sii fedele alla fonte: i controlli lo segnaleranno come da verificare.',
 'Per kind usa uno fra fatto, definizione, causa, relazione, condizione, negazione, eccezione, misura, obbligo, possibilità, contesto.',
 'Ciascuna frase S1... deve essere rappresentata. Se contiene punto e virgola, controlla entrambi i lati. Non prendere dati da pagine adiacenti e non aggiungere conoscenze esterne. Nessuna percentuale né lunghezza è richiesta ORA.',
 'RISPONDI SOLO JSON {"facts":[{"id":"F1","sourceSentence":"S1","evidence":"citazione letterale","claim":"fatto italiano","kind":"fatto","priority":"fondamentale"}]}. Nessun altro campo.',
 'TESTO ORIGINALE DI QUESTA PAGINA:',
 ...rows.map(s=>s.id+': '+s.text),
 ...(source.contextOnly?['CONTESTO ADIACENTE SOLO PER ORIENTAMENTO, NON ESTRARRE FATTI: prima '+source.contextOnly.before+' / dopo '+source.contextOnly.after]:[])
 ].join('\n\n');
}
function save(){
 const valid=pages.filter(p=>p.anchorValidated),all=pages.filter(p=>p.modelAnswered);
 const summary={
  plannedPages:FIXTURES.length,attemptedPages:pages.length,modelResponses:all.length,
  validatedLedgers:valid.length,totalExtractedFacts:valid.reduce((n,p)=>n+p.summary.facts,0),
  fundamental:valid.reduce((n,p)=>n+p.summary.core,0),
  support:valid.reduce((n,p)=>n+p.summary.support,0),
  context:valid.reduce((n,p)=>n+p.summary.context,0),
  flatLongInventories:valid.filter(p=>p.summary.flatPriority&&p.source!=='pagina_breve_continua').length,
  levelPlans:valid.reduce((n,p)=>n+p.plans.length,0),
  matchedEditorialAnchors:valid.reduce((n,p)=>n+p.calibration.matched,0),
  editorialPriorityAgreements:valid.reduce((n,p)=>n+p.calibration.agreed,0),
  editorialPriorityDisagreements:valid.reduce((n,p)=>n+p.calibration.mismatch,0),
  unmatchedManualFacts:valid.reduce((n,p)=>n+p.calibration.unmatchedReference.length,0),
  semanticCertified:0
 };
 const report={study:'LAB101 automatic one-pass extract+priority Gemini',
  date:new Date().toISOString(),model:MODEL,
  provider:{attempts,halt,why,maxCalls:MAX_CALLS},summary,errors,pages,
  scope:'Five synthetic pre-extracted pages. No PDF, no A4 real font, no real book. Calibration manually labeled from LAB100 and not provided to Gemini.',
  warning:'Priority agreement on overlapping quotes does not certify knowledge accuracy or guarantee that all fundamental concepts will fit in the shorter page.'};
 mkdirSync('audit/reports',{recursive:true});writeFileSync(OUT,JSON.stringify(report,null,2)+'\n');
 return report;
}
async function call(source){
 let tries=0;
 while(attempts<MAX_CALLS&&!halt&&tries<2){
  attempts++;tries++;const start=performance.now();
  try{
   const r=await fetch(API,{method:'POST',headers:{Authorization:'Bearer '+KEY,'Content-Type':'application/json'},
    body:JSON.stringify({model:MODEL,temperature:0.1,max_tokens:3900,response_format:SCHEMA,
     messages:[{role:'user',content:prompt(source)}]}),
    signal:AbortSignal.timeout(82000)});
   const ms=Math.round(performance.now()-start),data=await r.json().catch(()=>({}));
   if(!r.ok){
    const err={source:source.id,http:r.status,attempt:attempts,ms,message:String(data.error?.message||'HTTP failed').slice(0,150)};
    errors.push(err);console.log('LAB101_PROVIDER',JSON.stringify(err));
    if(r.status===429){halt=true;why='HTTP_429';pages.push({source:source.id,modelAnswered:false,error:err});save();return}
    if(r.status===503&&tries===1&&attempts<MAX_CALLS){await sleep(3200);continue}
    if(r.status===503){halt=true;why='HTTP_503'}
    pages.push({source:source.id,modelAnswered:false,error:err});save();return;
   }
   let text=String(data.choices?.[0]?.message?.content||'').trim();
   if(text.startsWith('~~~'))text=text.replace(/^~~~json\s*/iu,'').replace(/\s*~~~$/u,'');
   let payload={};try{payload=JSON.parse(text)}catch(e){errors.push({source:source.id,error:'BAD_JSON',message:String(e).slice(0,100)})}
   const evaluation=rankFirstRead(source,payload);
   const v=evaluation.valid;
   const prev=LEGACY.find(x=>x.sourceId===source.id);
   const calibr=v?compareCalibration(source.id,evaluation.ledger,prev.sourceFacts,EDITORIAL[source.id]):null;
   const item={source:source.id,modelAnswered:Array.isArray(payload.facts),anchorValidated:v,ms,
    rawPriorities:payload.facts||null,validationErrors:evaluation.errors||[],
    validationWarnings:evaluation.warnings||[],quoteRepairs:evaluation.quoteRepairs||[],
    ledger:v?evaluation.ledger:null,summary:evaluation.summary||null,plans:evaluation.plans||[],
    calibration:calibr,semanticallyCertified:false,approvedForApp:false};
   pages.push(item);
   console.log('LAB101_PAGE',JSON.stringify({source:source.id,modelAnswered:item.modelAnswered,
    verified:v,extracted:payload.facts?.length||0,
    fundamental:item.summary?.core,support:item.summary?.support,context:item.summary?.context,
    priorityFlat:item.summary?.flatPriority,plans:item.plans.length,
    editorialAligned:calibr?.matched,priorityAgreement:calibr?.agreed,
    warnings:item.validationWarnings.length,ms}));
   save();return;
  }catch(e){
   const err={source:source.id,attempt:attempts,error:String(e?.name||e).slice(0,150)};
   errors.push(err);pages.push({source:source.id,modelAnswered:false,error:err});save();
   console.log('LAB101_RUNTIME',JSON.stringify(err));return;
  }
 }
}
if(!KEY){errors.push({error:'PREEXISTING_FREE_GEMINI_SECRET_MISSING'});save();process.exit(1)}
console.log('LAB101_START',JSON.stringify({model:MODEL,pages:FIXTURES.length,maxCalls:MAX_CALLS}));
for(const source of FIXTURES){
 if(halt||attempts>=MAX_CALLS)break;
 await call(source);
 if(halt)break;
 await sleep(700);
}
const report=save();
console.log('LAB101_FINAL',JSON.stringify({summary:report.summary,provider:report.provider,errors:errors.length}));
