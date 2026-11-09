// MotorLab StudyBook AI LAB97: level-specific ONE-PASS prompts.
// First-reader semantic ledger is retained ONLY by post-output verification, never sent to Gemini.
// The original source is always the ONLY fact source. No Android or production writes.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import {FIXTURES} from './lab93-semantic-gate.mjs';
import {budget} from './lab92-stop-complete-engine.mjs';
import {evaluateLean} from './lab96-eval.mjs';
const OUT='audit/reports/lab97-level-specific-real.json';
const API='https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
const MODEL='gemini-3.5-flash-lite';
const KEY=process.env.AI_TEST_KEY||'';
const MAX_PROVIDER=20;
const CASES=[
 ['scienze',10],['medicina',10],['procedura',10],['concetto_sbilanciato',10],
 ['scienze',20],['medicina',20],['procedura',20],['concetto_sbilanciato',20],
 ['scienze',30],['medicina',30],['procedura',30],
 ['scienze',40],['procedura',40],['medicina',40],
 ['scienze',50],['medicina',50],
 ['scienze',65],['procedura',65],
 ['pagina_breve_continua',20],['pagina_breve_continua',50]
];
const schema={type:'json_schema',json_schema:{name:'studybook_lab97_italian_page',strict:true,
 schema:{type:'object',additionalProperties:false,properties:{text:{type:'string'}},required:['text']}}};
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let attempts=0,stop=false,stopReason='',errors=[],results=[];
function modeFor(level){
 if(level<=20)return 'CONSERVATIVE_EDIT';
 if(level<=40)return 'MODERATE_REWRITE';
 return 'ESSENTIAL_FACT_SUMMARY';
}
function instructions(source,plan){
 const mode=modeFor(plan.level);
 const fmt=[
  'STUDYBOOK AI: rielabora solo il testo italiano originale di questa pagina. Nessuna informazione viene dalle pagine vicine. Restituisci SOLO JSON {"text":"..."} senza altri campi.',
  'Originale: '+plan.originalLetters+' lettere alfabetiche; riduzione richiesta '+plan.level+'%; obiettivo indicativo '+plan.targetLetters+' lettere. '+(plan.short?'Testo originale brevissimo, 1-5 righe: percentuale libera e nessun allungamento obbligatorio.':'Accetta '+plan.band.low+'–'+plan.band.high+' lettere; contiamo solo lettere Unicode, non cifre/spazi/punteggiatura.'),
  'Lo spazio di stampa disponibile è al massimo '+plan.targetCap+' righe da 60 posizioni in carattere monospaziato fisso. Scrivi UN PARAGRAFO continuo, senza andare a capo: il programma lo impagina senza spezzare le parole.',
  'Conserva significato, cifre e negazioni, termini tecnici, condizioni, eccezioni e nessi causa-effetto, senza inventare fatti. Non aggiungere parole soltanto per completare l ultima riga. Se il pensiero è completo, FERMATI.'
 ];
 if(mode==='CONSERVATIVE_EDIT'){
  fmt.push('MODALITÀ EDITING CONSERVATIVO. Questo NON è un riassunto. NON saltare nessuna frase o passaggio del testo originale. Riscrivi le frasi quasi interamente, cambiando solo ripetizioni, forme contorte e parole superflue. Conserva ogni fatto e ogni relazione tecnica. Mantieni l ordine originale, le definizioni, le cause e tutti gli esempi o chiarimenti che portano informazioni indispensabili.');
  fmt.push('La riduzione '+plan.level+'% è lieve: NON dimezzare il testo, NON ridurre una pagina a poche frasi generiche. Conserva circa '+(100-plan.level)+'% delle LETTERE originali, in italiano più semplice.');
 }else if(mode==='MODERATE_REWRITE'){
  fmt.push('MODALITÀ RISCRITTURA MODERATA. Rendi più chiari i concetti e unisci le frasi che ripetono lo stesso punto; mantieni tutte le definizioni, le condizioni e le differenze fondamentali. Non eliminare frasi che introducono un fatto distinto. Il testo deve restare utile per studiare da solo.');
  fmt.push('La riduzione '+plan.level+'% non autorizza a omettere negazioni, numeri o cause. Preferisci frasi naturali, un testo non telegrafico e un solo riferimento a ogni fatto.');
 }else{
  fmt.push('MODALITÀ SINTESI DIDATTICA. Produci un testo breve e comprensibile, non un elenco di sole parole chiave. Mantieni ogni fatto indispensabile, negazioni, condizioni, cifre e i termini specialistici necessari. Preferisci una frase che esprima più fatti correlati senza ripetizioni.');
  fmt.push('Non inventare esempi o ulteriori spiegazioni per raggiungere il numero di lettere. Il testo può terminare con una riga parziale, purché non vengano omessi i punti indispensabili.');
 }
 fmt.push('TESTO ORIGINALE DELLA PAGINA:\n'+source.concepts.join(' '));
 return{mode,prompt:fmt.join('\n\n')};
}
function save(){
 const valid=results.filter(x=>x.valid),long=valid.filter(x=>!x.metrics.short);
 const group={};
 for(const mode of ['CONSERVATIVE_EDIT','MODERATE_REWRITE','ESSENTIAL_FACT_SUMMARY']){
  const groupCases=long.filter(x=>x.mode===mode);
  group[mode]={answers:groupCases.length,grid:groupCases.filter(x=>x.metrics.grid.passes).length,
    band:groupCases.filter(x=>x.metrics.band.passes).length,
    both:groupCases.filter(x=>x.metrics.completeMathPass).length,
    missingFactSignals:groupCases.reduce((n,x)=>n+x.metrics.facts.missing.length,0)};
 }
 const summary={planned:CASES.length,attempted:results.length,valid:valid.length,
  long:long.length,short:valid.filter(x=>x.metrics.short).length,
  longGrid:long.filter(x=>x.metrics.grid.passes).length,
  longBand:long.filter(x=>x.metrics.band.passes).length,
  longBoth:long.filter(x=>x.metrics.completeMathPass).length,
  longBothWithoutLexicalAlerts:long.filter(x=>x.metrics.completeMathPass&&x.metrics.facts.missing.length===0&&x.metrics.spellingSignals.length===0).length,
  byMode:group};
 const report={study:'LAB97 level-specific prompts Gemini test',date:new Date().toISOString(),model:MODEL,
  provider:{attempts,stopped:stop,stopReason,maxAttempts:MAX_PROVIDER},
  methodology:'No duplicate semantic checklist in model prompt. Semantic ledger analyzed AFTER model reply. 60-cell monospace virtual rows, not physical A4. Sources are five pre-segmented synthetic pages, not scanned PDFs.',
  controls:{mainModified:false,installedAppModified:false,APKModified:false,extraPaidServices:false,oneGenerationPerCase:true,onDemandSimpleLanguageGenerated:false},
  warning:'Lexical absence may be a false alarm and keyword presence may not prove correct meaning; all numerical passes require full semantic review.',
  summary,errors,results};
 mkdirSync('audit/reports',{recursive:true});
 writeFileSync(OUT,JSON.stringify(report,null,2)+'\n');
 return report;
}
async function trial(sourceId,level){
 const source=FIXTURES.find(s=>s.id===sourceId);
 if(!source)throw Error('Missing benchmark source '+sourceId);
 const plan=budget(source,level),config=instructions(source,plan);
 let tries=0;
 while(attempts<MAX_PROVIDER&&!stop&&tries<2){
  attempts++;tries++;const start=performance.now();
  try{
   const response=await fetch(API,{method:'POST',headers:{Authorization:'Bearer '+KEY,'Content-Type':'application/json'},
    body:JSON.stringify({model:MODEL,temperature:0.1,max_tokens:2200,response_format:schema,messages:[{role:'user',content:config.prompt}]}),
    signal:AbortSignal.timeout(75000)});
   const ms=Math.round(performance.now()-start);
   const payload=await response.json().catch(()=>({}));
   if(!response.ok){
    const issue={source:sourceId,level,mode:config.mode,attempt:attempts,http:response.status,ms,
      message:String(payload.error?.message||'Gemini provider error').slice(0,150)};
    errors.push(issue);console.log('LAB97_HTTP',JSON.stringify(issue));
    if(response.status===429){stop=true;stopReason='HTTP_429';results.push({source:sourceId,level,mode:config.mode,valid:false,error:issue});save();return}
    if(response.status===503&&tries===1&&attempts<MAX_PROVIDER){await delay(3500);continue}
    if(response.status===503){stop=true;stopReason='HTTP_503';}
    results.push({source:sourceId,level,mode:config.mode,valid:false,error:issue});save();return;
   }
   let content=String(payload.choices?.[0]?.message?.content||'').trim();
   if(content.startsWith('~~~'))content=content.replace(/^~~~json\s*/i,'').replace(/\s*~~~$/,'');
   let responseJSON={};try{responseJSON=JSON.parse(content)}catch{}
   const metrics=evaluateLean(source,level,responseJSON?.text);
   const valid=metrics.valid===true;
   const result={source:sourceId,level,mode:config.mode,valid,ms,
    metrics,completionTokens:payload.usage?.completion_tokens??null,
    qualityStatus:'NOT_SEMANTICALLY_CERTIFIED',sourceLetters:plan.originalLetters,
    targetLetters:plan.targetLetters,generatedFromSourceOnly:true};
   results.push(result);
   console.log('LAB97_CASE',JSON.stringify({source:sourceId,level,mode:config.mode,
    valid,percent:metrics.reduction,rows:metrics.grid?.rows,cap:metrics.grid?.maxRows,
    band:metrics.band?.passes,grid:metrics.grid?.passes,both:metrics.completeMathPass,
    missingFactSignals:metrics.facts?.missing?.length,ms}));
   save();return;
  }catch(e){
   const error={source:sourceId,level,mode:config.mode,attempt:attempts,issue:String(e?.name||e).slice(0,150)};
   errors.push(error);results.push({source:sourceId,level,mode:config.mode,valid:false,error});
   console.log('LAB97_RUNTIME',JSON.stringify(error));save();return;
  }
 }
}
if(!KEY){errors.push({error:'Missing pre-existing AI_API_KEY or GEMINI_API_KEY secret'});save();process.exit(1)}
console.log('LAB97_START',JSON.stringify({planned:CASES.length,maxCalls:MAX_PROVIDER,model:MODEL}));
for(const [source,level] of CASES){
 if(attempts>=MAX_PROVIDER||stop)break;
 await trial(source,level);
 if(stop)break;
 await delay(750);
}
const end=save();
console.log('LAB97_END',JSON.stringify({provider:end.provider,summary:end.summary,errorCount:end.errors.length}));
