// MotorLab LAB93: one-pass real Gemini, stable prior-read atomic fact ledger reused for all six versions.
// No production changes. Bounded, stops at 429; only one retry on transient 503.
// Research benchmark: user-approved "no filler, stop on complete thought", 60-cell virtual monospace layout.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import {FIXTURES,sourceById,requiredFacts,checkFactCoverage} from './lab93-semantic-gate.mjs';
import {budget,evaluate} from './lab92-stop-complete-engine.mjs';
const OUT='audit/reports/lab93-real-atomic-fact-gemini.json';
const MODEL='gemini-3.5-flash-lite',URL='https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',KEY=process.env.AI_TEST_KEY||'';
const MAX_ATTEMPTS=14,ORDER=[
 ['medicina',20],['procedura',20],['scienze',20],['concetto_sbilanciato',20],['pagina_breve_continua',20],
 ['scienze',50],['medicina',50],['procedura',50],['concetto_sbilanciato',50],['pagina_breve_continua',50],
 ['medicina',40],['scienze',10],['procedura',10],['concetto_sbilanciato',10],
 ['medicina',10],['pagina_breve_continua',10],
 ['scienze',30],['procedura',30],['medicina',30],['concetto_sbilanciato',30],['pagina_breve_continua',30],
 ['scienze',65],['procedura',65],['medicina',65],['concetto_sbilanciato',65],['pagina_breve_continua',65]
];
const fmt={type:'json_schema',json_schema:{name:'lab93_complete_atomic_facts',strict:true,schema:{
 type:'object',additionalProperties:false,properties:{sections:{type:'array',items:{type:'object',additionalProperties:false,properties:{id:{type:'string'},text:{type:'string'}},required:['id','text']}}},required:['sections']}}};
let attempts=0,stopped=false,reason='',errors=[],results=[];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const factLine=(f)=>f.id.replace(/_/g,' '); // source itself accompanies the fact, this is an identifier
function prompt(s,p){
 const facts=requiredFacts(s,p.level);
 const z=[
  'STUDYBOOK AI LAB93: crea UNA sola versione didattica della PAGINA. Ragiona su tutti i concetti della pagina prima di scrivere la prima parola, poi produce JSON con sezioni C1..C'+s.concepts.length+'.',
  'REGOLA FONDAMENTALE: preserva OGNI FATTO ATOMICO OBBLIGATORIO indicato nella checklist, non soltanto il titolo generale del concetto. Non cambiare negazioni, condizioni, termini essenziali, date, nessi causa-effetto. Se non riesci a soddisfare anche la quantità di lettere, non omettere un fatto essenziale per il numero.',
  'NESSUN RIEMPIMENTO: quando un pensiero è completo, STOP; non aggiungere esempi o dettagli inventati per riempire l ultima riga. Se resta mezza o una riga libera è accettabile; piccoli scostamenti di lunghezza si segnalano, non si nascondono.',
  'PROGRESSIONE: la riduzione '+p.level+'% deve produrre '+(p.level<=20?'un testo quasi esteso, non un mini-riassunto; mantieni anche i dettagli di supporto importanti; frasi più semplici.':p.level===30?'un testo meno esteso ma conserva relazioni e condizioni essenziali.':p.level===40?'una spiegazione più sintetica e facile, ma conserva le condizioni indispensabili.':p.level===50?'una spiegazione breve e chiarissima senza perdere i fatti fondamentali.':'un riassunto minimo, conservando i fatti fondamentali o dichiarando non fattibilità come fallimento nel nostro validatore.')+'',
  'METRICA: originale '+p.originalLetters+' LETTERE ALFABETICHE; quantità obiettivo circa '+p.targetLetters+' lettere, banda ordinaria '+p.band.low+'–'+p.band.high+' (esclude spazi, segni e numeri). Griglia originale '+p.originalRows+' righe; massima capienza della versione '+p.targetCap+' righe da massimo 60 caratteri MONOSPAZIATI. '+(p.short?'PAGINA BREVE originale 1–5 righe, percentuale non vincolante; semplificare comunque e massimo 5 righe.':'Fascia ±5 punti sulla riduzione. Meglio un po più corto che un testo gonfiato, ma NON comprimere del 40% se è richiesto solo il 20%.'),
  'QUOTE MORBIDE: gli argomenti sono pesati sul testo originale, ma NON formano paragrafi separati fisici. Concateneremo le risposte con un solo spazio. Se un concetto è più breve, il resto serve agli altri soltanto per conservare fatti. Non sono obbligatori a capo né riempimenti. Font e larghezza invariati.',
  'CHECKLIST IMMUTABILE DA PRIMA LETTURA: ogni fatto qui richiesto è presente nel testo originale, non devi inventare niente. Gli identificatori sono promemoria, non vanno stampati.',
 ];
 for(let i=0;i<p.goalPerConcept.length;i++){
  const c=p.goalPerConcept[i],fs=facts[i];
  z.push(c.id+': circa '+c.softTargetLetters+' lettere orientative, flessibili, non un massimo. FONTE: '+c.text);
  z.push(c.id+' OBBLIGATORI, anche nelle versioni più sintetiche: '+fs.core.map(factLine).join('; '));
  if(fs.support.length)z.push(c.id+' DETTAGLI OBBLIGATORI al '+p.level+'%: '+fs.support.map(factLine).join('; '));
 }
 if(s.contextOnly)z.push('CONTESTO DI ALTRE PAGINE SOLO PER LEGGERE, mai copiare nella risposta: precedente '+s.contextOnly.before+'; successiva '+s.contextOnly.after);
 z.push('RISPONDI SOLO JSON {"sections":[{"id":"C1","text":"..."}]}; tutte le sezioni in ordine e una per concetto. Ogni testo è un singolo paragrafo senza nuove righe. Non ripetere né la checklist né i titoli; italiano corretto, apostrofi corretti, nessuna parola spezzata. Stop quando tutti i fatti obbligatori sono espressi.');
 return z.join('\n');
}
function save(){
 const completed=results.filter(x=>x.valid);
 const long=completed.filter(x=>!x.plan.short),short=completed.filter(x=>x.plan.short);
 const summary={
  planned:ORDER.length,attemptedCases:results.length,realGeminiAnswers:completed.length,
  long:long.length,short:short.length,
  longGeometry:long.filter(x=>x.metrics.fitsTarget).length,
  longMath:long.filter(x=>x.metrics.strictBand).length,
  longBoth:long.filter(x=>x.metrics.strictCombined).length,
  longSmallUnderReview:long.filter(x=>x.metrics.smallShortfall).length,
  allPreliminaryFactAlertsClear:completed.filter(x=>x.factCoverage.missingCount===0).length,
  longPreliminaryFactAlertsClear:long.filter(x=>x.factCoverage.missingCount===0).length,
  longBothPlusFactAlertsClear:long.filter(x=>x.metrics.strictCombined&&x.factCoverage.missingCount===0&&x.metrics.wordIntegrity).length,
  genres:[...new Set(completed.map(x=>x.source))]
 };
 const v={experiment:'LAB93 one-pass Gemini atomic fact ledger',
 date:new Date().toISOString(),model:MODEL,summary,
 scope:'Pre-segmented synthetic page fixtures; no real PDF ingestion or A4 proportional font rendered.',
 controls:{productionChanged:false,mainChanged:false,APKChanged:false,onDemandSimpleLanguageCalls:0},
 rigor:'Regex can miss valid synonyms or accept false relations. No test is expert-certified without source-by-source review.',
 provider:{attempts,stopped,reason,maxAttempts:MAX_ATTEMPTS},errors,results};
 mkdirSync('audit/reports',{recursive:true});writeFileSync(OUT,JSON.stringify(v,null,2)+'\n');return v;
}
async function run(id,level){
 const src=sourceById(id),p=budget(src,level);
 let tries=0;
 while(!stopped&&attempts<MAX_ATTEMPTS&&tries<2){
  tries++;attempts++;const time=performance.now();
  try{
   const res=await fetch(URL,{method:'POST',headers:{Authorization:'Bearer '+KEY,'Content-Type':'application/json'},
    body:JSON.stringify({model:MODEL,temperature:0.1,max_tokens:2400,response_format:fmt,messages:[{role:'user',content:prompt(src,p)}]}),
    signal:AbortSignal.timeout(75000)});
   const ms=Math.round(performance.now()-time),j=await res.json().catch(()=>({}));
   if(!res.ok){
    const issue={source:id,level,http:res.status,attempt:attempts,ms,providerError:String(j.error?.message||'error').slice(0,180)};
    errors.push(issue);console.log('LAB93_HTTP',JSON.stringify(issue));
    if(res.status===429){stopped=true;reason='HTTP_429';results.push({source:id,level,valid:false,error:issue});save();return;}
    if(res.status===503&&tries===1&&attempts<MAX_ATTEMPTS){await sleep(3200);continue;}
    if(res.status===503){stopped=true;reason='HTTP_503';}
    results.push({source:id,level,valid:false,error:issue});save();return;
   }
   const txt=String(j.choices?.[0]?.message?.content||'').trim();let obj={};try{obj=JSON.parse(txt)}catch{}
   const metrics=evaluate(src,p,obj.sections),valid=metrics.valid===true;
   const factCoverage=valid?checkFactCoverage(src,level,obj.sections):{valid:false,missingCount:-1,missing:[]};
   const item={source:id,level,valid,ms,plan:p,metrics,rawSections:valid?obj.sections:null,factCoverage,
    warning:'Math and automated lexical fact checks are not semantic certification'};
   results.push(item);
   console.log('LAB93_CASE',JSON.stringify({id,level,short:p.short,rows:metrics.rows,cap:p.targetCap,
    pct:metrics.reduction,target:p.targetLetters,actual:metrics.letters,band:metrics.strictBand,grid:metrics.fitsTarget,
    both:metrics.strictCombined,facts:factCoverage.matched,required:factCoverage.required,
    missing:factCoverage.missingCount,ms}));
   save();return;
  }catch(e){
   const issue={source:id,level,attempt:attempts,error:String(e?.name||e).slice(0,180)};
   errors.push(issue);console.log('LAB93_ERROR',JSON.stringify(issue));
   results.push({source:id,level,valid:false,error:issue});save();return;
  }
 }
}
if(!KEY){errors.push({error:'NO_PREEXISTING_GEMINI_KEY'});save();process.exit(1);}
console.log('LAB93_START',JSON.stringify({maxAttempts:MAX_ATTEMPTS,planned:ORDER.length}));
for(const [id,level] of ORDER){
 if(stopped||attempts>=MAX_ATTEMPTS)break;
 await run(id,level);
 if(stopped)break;
 await sleep(900);
}
const final=save();console.log('LAB93_FINAL',JSON.stringify({provider:final.provider,summary:final.summary}));
