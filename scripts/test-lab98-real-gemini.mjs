// MotorLab StudyBook AI LAB98: source-only prompts with short semantic caution.
// Real Gemini benchmark. One generation per page/reduction; never retries on 429.
// No live app change; 60-cell virtual typography is NOT physical A4 rendering.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import {FIXTURES} from './lab93-semantic-gate.mjs';
import {budget} from './lab92-stop-complete-engine.mjs';
import {evaluateLean} from './lab96-eval.mjs';
import {semanticGuard} from './lab98-modal-semantic-guard.mjs';
const API='https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
const MODEL='gemini-3.5-flash-lite';
const KEY=process.env.AI_TEST_KEY||'';
const OUT='audit/reports/lab98-real-gemini.json';
const MAX_CALLS=16;
const ORDER=[
 ['scienze',20],['medicina',20],['procedura',20],['concetto_sbilanciato',20],['pagina_breve_continua',20],
 ['scienze',30],['medicina',30],['procedura',30],
 ['scienze',40],['procedura',40],
 ['scienze',50],['medicina',50],
 ['scienze',65],['procedura',65],
 ['scienze',10],['medicina',10]
];
const format={type:'json_schema',json_schema:{name:'studybook_lab98_semantic_care',strict:true,
 schema:{type:'object',additionalProperties:false,properties:{text:{type:'string'}},required:['text']}}};
let attempts=0,stopped=false,stopReason='',errors=[],results=[];
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function strategy(level){
 return level<=20?'EDITING_CONSERVATIVO':level<=40?'RISCRITTURA_MODERATA':'SINTESI_FEDELE';
}
function makePrompt(source,plan){
 const mode=strategy(plan.level);
 const text=[
  'STUDYBOOK AI. Rielabora il testo originale di una sola pagina. Rispondi esclusivamente in italiano, in JSON {"text":"..."}; un unico paragrafo senza ritorni a capo.',
  'Riduzione richiesta: '+plan.level+'%. Originale '+plan.originalLetters+' LETTERE. '+(plan.short?'Pagina di 1–5 righe: percentuale libera, ma scrivi più chiaramente e non allungare inutilmente.':'Bersaglio indicativo '+plan.targetLetters+' lettere alfabetiche; fascia accettabile '+plan.band.low+'–'+plan.band.high+'. Escludi spazi, punteggiatura e numeri dal conto.'),
  'Massimo '+plan.targetCap+' righe di 60 caratteri monospaziati. Non spezzare parole, non creare righe vuote, non cambiare dimensione caratteri. StudyBook impaginerà il paragrafo.',
  'Preserva cifre, condizioni, termini tecnici, eccezioni e nessi fra cause ed effetti. ATTENZIONE AL SIGNIFICATO: non cancellare o invertire «non»; «può» resta una possibilità, non diventa una certezza; «documentato» non è sempre «dimostrato»; una regola interna non diventa una norma generale. Usa gli esatti gradi di certezza della fonte, senza aggiungere nuovi fatti.',
  'Quando ogni pensiero essenziale è completo, FERMATI. Non inserire frasi per riempire mezza riga o per raggiungere artificialmente il budget.'
 ];
 if(mode==='EDITING_CONSERVATIVO'){
  text.push('MODALITÀ '+mode+': questa è una revisione leggera, NON un riassunto. Conserva tutte le frasi che esprimono fatti distinti e la quasi totalità delle informazioni originali. Semplifica la formulazione e taglia soltanto ripetizioni o giri di parole. NON sintetizzare del 40% se la richiesta è del '+plan.level+'%.');
 }else if(mode==='RISCRITTURA_MODERATA'){
  text.push('MODALITÀ '+mode+': unisci frasi ripetitive senza eliminare idee distinte, mantieni tutte le condizioni importanti e le definizioni. Riscrivi in linguaggio accessibile ma conserva le proposizioni fondamentali.');
 }else{
  text.push('MODALITÀ '+mode+': seleziona i concetti essenziali e scrivili in frasi chiare e concise, mantenendo negazioni, condizioni, cifre e termini indispensabili. La checklist dei fatti viene verificata fuori dal modello, non va ricostruita nel testo.');
 }
 text.push('FONTE DELLA PAGINA:\n'+source.concepts.join(' '));
 return{prompt:text.join('\n\n'),mode};
}
function persist(){
 const answered=results.filter(r=>r.valid),long=answered.filter(r=>!r.metrics.short),short=answered.filter(r=>r.metrics.short);
 const byMode=Object.fromEntries(['EDITING_CONSERVATIVO','RISCRITTURA_MODERATA','SINTESI_FEDELE'].map(mode=>{
  const rows=long.filter(x=>x.mode===mode);
  return[mode,{completed:rows.length,grid:rows.filter(x=>x.metrics.grid.passes).length,
   band:rows.filter(x=>x.metrics.band.passes).length,both:rows.filter(x=>x.metrics.completeMathPass).length,
   noSemanticAlerts:rows.filter(x=>x.guard.alerts.length===0).length,
   mathAndNoAlerts:rows.filter(x=>x.metrics.completeMathPass&&x.guard.alerts.length===0).length}];
 }));
 const summary={scheduled:ORDER.length,attemptedCases:results.length,valid:answered.length,
  long:long.length,short:short.length,
  longGrid:long.filter(x=>x.metrics.grid.passes).length,
  longBand:long.filter(x=>x.metrics.band.passes).length,
  longBoth:long.filter(x=>x.metrics.completeMathPass).length,
  longBothAndNoSemanticAlerts:long.filter(x=>x.metrics.completeMathPass&&x.guard.alerts.length===0).length,
  byMode};
 const report={experiment:'LAB98 conservative semantic guard, minimal caution prompt',
  date:new Date().toISOString(),model:MODEL,
  notes:'Five pre-segmented synthetic source pages. Real PDF ingestion and physical A4 proportional font not tested. Regex semantic flags are warnings, not semantic certification.',
  controls:{sourceAppUnchanged:true,productionUnchanged:true,APKUnchanged:true,zeroExtraPaidServices:true,oneGenerationPerCase:true},
  provider:{attempts,stopped,stopReason,maxCalls:MAX_CALLS},summary,results,errors};
 mkdirSync('audit/reports',{recursive:true});
 writeFileSync(OUT,JSON.stringify(report,null,2)+'\n');
 return report;
}
async function request(id,level){
 const source=FIXTURES.find(s=>s.id===id),plan=budget(source,level),spec=makePrompt(source,plan);
 let tries=0;
 while(tries<2&&attempts<MAX_CALLS&&!stopped){
  tries++;attempts++;
  const now=performance.now();
  try{
   const response=await fetch(API,{method:'POST',headers:{Authorization:'Bearer '+KEY,'Content-Type':'application/json'},
    body:JSON.stringify({model:MODEL,temperature:0.1,max_tokens:2200,response_format:format,
      messages:[{role:'user',content:spec.prompt}]}),
    signal:AbortSignal.timeout(70000)});
   const ms=Math.round(performance.now()-now);
   const payload=await response.json().catch(()=>({}));
   if(!response.ok){
    const error={source:id,level,mode:spec.mode,attempt:attempts,status:response.status,ms,
     details:String(payload.error?.message||'HTTP error').slice(0,180)};
    errors.push(error);console.log('LAB98_HTTP',JSON.stringify(error));
    if(response.status===429){stopped=true;stopReason='HTTP_429';results.push({source:id,level,mode:spec.mode,valid:false,error});persist();return}
    if(response.status===503&&tries===1&&attempts<MAX_CALLS){await sleep(3000);continue}
    if(response.status===503){stopped=true;stopReason='HTTP_503';}
    results.push({source:id,level,mode:spec.mode,valid:false,error});persist();return;
   }
   let content=String(payload.choices?.[0]?.message?.content||'').trim();
   if(content.startsWith('~~~'))content=content.replace(/^~~~json\s*/i,'').replace(/\s*~~~$/,'');
   let json={};try{json=JSON.parse(content)}catch{}
   const metrics=evaluateLean(source,level,json.text);
   const valid=metrics.valid===true;
   const guard=valid?semanticGuard(source.id,source.concepts.join(' '),metrics.text,{level}):
      {alerts:[],totalApplicable:0,orthography:[],semanticCertified:false};
   const data={source:id,level,mode:spec.mode,valid,ms,metrics,guard,
    tokens:payload.usage?.completion_tokens??null,semanticallyCertified:false};
   results.push(data);
   console.log('LAB98_CASE',JSON.stringify({id,level,mode:spec.mode,valid,percent:metrics.reduction,
    rows:metrics.grid?.rows,cap:metrics.grid?.maxRows,band:metrics.band?.passes,
    geometry:metrics.grid?.passes,both:metrics.completeMathPass,
    semanticFlags:guard.alerts.length,lexicalFactFlags:metrics.facts?.missing?.length,ms}));
   persist();return;
  }catch(e){
   const error={source:id,level,mode:spec.mode,attempt:attempts,error:String(e?.name||e).slice(0,150)};
   errors.push(error);results.push({source:id,level,mode:spec.mode,valid:false,error});
   persist();console.log('LAB98_RUNTIME',JSON.stringify(error));return;
  }
 }
}
if(!KEY){errors.push({reason:'MISSING_EXISTING_GEMINI_SECRET'});persist();process.exit(1)}
console.log('LAB98_START',JSON.stringify({scheduled:ORDER.length,maxCalls:MAX_CALLS,model:MODEL}));
for(const [id,level] of ORDER){
 if(stopped||attempts>=MAX_CALLS)break;
 await request(id,level);
 if(stopped)break;
 await sleep(800);
}
const report=persist();
console.log('LAB98_FINAL',JSON.stringify({summary:report.summary,provider:report.provider,errors:report.errors.length}));
