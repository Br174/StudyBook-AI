// MotorLab StudyBook LAB95 compact semantic clauses versus source-only prompts.
// A/B real Gemini: no exemplars from manual references in prompts, no retries on 429.
// All constraints refer to virtual 60-cell monospaced lines, not actual A4 PDF.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import {FIXTURES,sourceById,requiredFacts,checkFactCoverage} from './lab93-semantic-gate.mjs';
import {budget,evaluate} from './lab92-stop-complete-engine.mjs';
const ITALIAN=JSON.parse(readFileSync('audit/test-fixtures/lab94-facts-italiano.json','utf8')).sources;
const GOLD=JSON.parse(readFileSync('audit/test-fixtures/lab94-golden-20-percent-manual.json','utf8')).samples;
const MODEL='gemini-3.5-flash-lite';
const API='https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
const KEY=process.env.AI_TEST_KEY||'';
const OUT='audit/reports/lab95-compact-clause-ab-real.json';
const OFFLINE='audit/reports/lab95-compact-clause-offline.json';
const MAX_CALLS=12;
const CASES=[
 ['scienze',20,'A'],['scienze',20,'B'],
 ['medicina',20,'A'],['medicina',20,'B'],
 ['procedura',20,'A'],['procedura',20,'B'],
 ['concetto_sbilanciato',20,'A'],['concetto_sbilanciato',20,'B'],
 ['scienze',50,'B'],['medicina',50,'B'],
 ['pagina_breve_continua',20,'B']
];
const fmt={type:'json_schema',json_schema:{name:'studybook_lab95_compact_sentences',strict:true,schema:{
 type:'object',additionalProperties:false,properties:{sections:{type:'array',items:{type:'object',additionalProperties:false,properties:{id:{type:'string'},text:{type:'string'}},required:['id','text']}}},required:['sections']}}};
const wordsEnglish=/\b(?:the|from|peremptory|oxygen|tides|testable|hypotheses|repeatable|observations|breathing|deadline|filing|returns|right to|diagnostic triad|respiratory route|source only|facts ledger|only if|day and night|revolution|seasons)\b/iu;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const alph=s=>(String(s).normalize('NFC').match(/\p{L}/gu)||[]).length;
function prompt(source,p,variant){
 const lines=[
  'STUDYBOOK AI: SCRIVI IN ITALIANO CORRETTO, in UN SOLO PASSAGGIO. Nessuna parola inglese. Una sola versione di questa pagina di libro.',
  'Scopo: semplificare senza cancellare contenuti fondamentali. La fonte contiene '+p.originalLetters+' lettere alfabetiche. Riduzione richiesta '+p.level+'%. Obiettivo circa '+p.targetLetters+' LETTERE; banda ammissibile '+p.band.low+'–'+p.band.high+' lettere (solo alfabetiche). '+(p.short?'PAGINA ORIGINARIA BREVE: percentuale libera, ma semplificazione obbligatoria.':'La versione al 20% deve essere QUASI ESTESA e non diventare un riassunto al 40 o 50%.'),
  'Limite di stampa simulata: massimo '+p.targetCap+' righe MONOSPAZIATE da 60 posizioni; tutti i concetti insieme e NON una riga separata per concetto. Nessun cambio di dimensione dei caratteri e nessuna parola spezzata. In ogni output produci sezioni C1..C'+p.goalPerConcept.length+', una frase continua per sezione senza ritorni a capo. Il programma le unirà con UNO SPAZIO e disporrà parole in righe.',
  'COMPATTA LE FRASI. Puoi esprimere più fatti con un unico periodo tramite virgole, punti e virgola o subordinate. Non ripetere la fonte come più frasi isolate, NON trasformare un fatto atomico in una frase aggiuntiva, non elencare le istruzioni. Elimina soltanto ridondanze e giri di parole, non fatti. Mantieni le negazioni esplicite e i termini scientifici o giuridici essenziali.',
  'Quando il pensiero è completo, FERMATI. Non riempire una riga o il totale di lettere con parole inutili; un piccolo scostamento in meno è accettabile, MA una riduzione del 40% quando è richiesto il 20% non lo è.',
  'Tieni presente che i budget per concetto sono SOFFICI e proporzionali: il testo è continuo, un concetto breve può lasciare spazio a uno più ricco. NON riservare righe intere vuote. Tutti i concetti devono restare nella propria pagina.',
  'FONTE ESCLUSIVA DELLA PAGINA:'
 ];
 const facts=requiredFacts(source,p.level);
 for(let i=0;i<p.goalPerConcept.length;i++){
  const x=p.goalPerConcept[i];
  lines.push(x.id+' | circa '+x.softTargetLetters+' lettere orientative. Testo fonte: '+x.text);
  if(variant==='B'){
   const required=[...facts[i].core,...facts[i].support];
   lines.push('VINCOLI DI SIGNIFICATO, NON FRASI DA COPIARE. Combina i seguenti fatti nella spiegazione in modo naturale e compatto: '+required.map(k=>ITALIAN[source.id][k.id]).join(' ; '));
  }
 }
 if(source.contextOnly)lines.push('Contesto di altre pagine per sola comprensione, NON inserire nella pagina: '+source.contextOnly.before+' | '+source.contextOnly.after);
 lines.push('RESTITUISCI SOLO JSON {"sections":[{"id":"C1","text":"testo in italiano, senza ritorni a capo"}, ...]}. Tutte le sezioni obbligatorie, in ordine. Niente inglese, codici semantici interni, titoletti, elenchi o note. Ogni sezione può contenere più frasi unite concisamente.');
 return lines.join('\n');
}
function testOffline(){
 const checks=[];for(const sample of GOLD){
  const src=sourceById(sample.id),p=budget(src,sample.level),ev=evaluate(src,p,sample.sections),
   facts=checkFactCoverage(src,sample.level,sample.sections);
  checks.push({source:sample.id,level:sample.level,manualReferenceNotGemini:true,letters:ev.letters,
   reduction:ev.reduction,rows:ev.rows,limit:p.targetCap,band:ev.strictBand,geometry:ev.fitsTarget,
   factLexicalSignalsMissing:facts.missingCount,languageEnglishDetected:wordsEnglish.test(ev.rawText)});
  if(!ev.strictCombined||facts.missingCount||wordsEnglish.test(ev.rawText))throw Error('Golden manual calibration failed: '+sample.id);
 }
 for(const [id,level,variant] of CASES){
  const src=sourceById(id),p=budget(src,level),content=prompt(src,p,variant);
  if(variant==='A'&&content.includes('VINCOLI DI SIGNIFICATO, NON FRASI DA COPIARE'))throw Error('bad A');
  if(variant==='B'&&!content.includes('VINCOLI DI SIGNIFICATO, NON FRASI DA COPIARE'))throw Error('bad B');
  if(wordsEnglish.test(content))throw Error('English leak in prompt '+id+level+variant);
  // Source-only and facts modes both keep all original information in source text.
 }
 const data={study:'LAB95 offline prior to Gemini',date:new Date().toISOString(),
  plannedComparisons:CASES.length,manualReferenceChecks:checks.length,
  warning:'Two GOLDEN references are authored manually for feasibility ONLY, not evidence of generated success nor independent expert review.',
  checks,passed:true};
 mkdirSync('audit/reports',{recursive:true});writeFileSync(OFFLINE,JSON.stringify(data,null,2)+'\n');
 console.log('LAB95_OFFLINE',JSON.stringify({checks:checks.length,scenarios:CASES.length,passed:true}));
}
let attempts=0,stop=false,reason='',results=[],errors=[];
function persist(){
 const completed=results.filter(r=>r.valid),long=completed.filter(r=>!r.plan.short);
 const group=Object.fromEntries(['A','B'].map(k=>[k,{
  n:long.filter(x=>x.variant===k).length,
  mathAndRows:long.filter(x=>x.variant===k&&x.metrics.strictCombined).length,
  coreHeuristicClean:long.filter(x=>x.variant===k&&x.cov.coreMissing===0).length,
  englishLeaks:long.filter(x=>x.variant===k&&x.englishLeak).length
 }]));
 const summary={planned:CASES.length,received:completed.length,long:long.length,
  longBand:long.filter(x=>x.metrics.strictBand).length,
  longRows:long.filter(x=>x.metrics.fitsTarget).length,
  longBoth:long.filter(x=>x.metrics.strictCombined).length,
  short:completed.filter(x=>x.plan.short).length,
  missingAtomicCoreFlags:long.reduce((sum,r)=>sum+r.cov.coreMissing,0),
  EnglishLeaks:completed.filter(x=>x.englishLeak).length,
  variants:group};
 const report={study:'LAB95 Gemini compact-clause A/B',date:new Date().toISOString(),model:MODEL,
  method:'A = source plus proportional soft letter budgets, B = same plus concise Italian atomic fact reminders. One generation per test.',
  limits:'Fixed width virtual 60 cells, no real A4 PDF benchmark or automatic concept extraction from source PDF.',
  controls:{productionModified:false,modelOnlyExperiment:true,APKModified:false,zeroAdditionalCost:true},
  provider:{attempts,maxCalls:MAX_CALLS,stopped:stop,reason},summary,errors,results,
  warnings:['Regex-based fact signal can be false negative or false positive.','Do not promote output without source-to-text semantic review.','No padding of final lines.']};
 mkdirSync('audit/reports',{recursive:true});writeFileSync(OUT,JSON.stringify(report,null,2)+'\n');return report;
}
async function call(id,level,variant){
 const source=sourceById(id),p=budget(source,level);let tries=0;
 while(attempts<MAX_CALLS&&!stop&&tries<2){
  tries++;attempts++;const start=performance.now();
  try{
   const res=await fetch(API,{method:'POST',headers:{Authorization:'Bearer '+KEY,'Content-Type':'application/json'},
    body:JSON.stringify({model:MODEL,temperature:0.15,max_tokens:2600,response_format:fmt,
     messages:[{role:'user',content:prompt(source,p,variant)}]}),
    signal:AbortSignal.timeout(65000)});
   const ms=Math.round(performance.now()-start),j=await res.json().catch(()=>({}));
   if(!res.ok){
    const e={id,level,variant,status:res.status,attempt:attempts,ms,error:String(j.error?.message||'HTTP issue').slice(0,170)};
    errors.push(e);console.log('LAB95_HTTP',JSON.stringify(e));
    if(res.status===429){stop=true;reason='HTTP_429';results.push({id,level,variant,valid:false,error:e});persist();return;}
    if(res.status===503&&tries===1&&attempts<MAX_CALLS){await wait(3000);continue;}
    if(res.status===503){stop=true;reason='HTTP_503';}
    results.push({id,level,variant,valid:false,error:e});persist();return;
   }
   let raw=String(j.choices?.[0]?.message?.content||'').trim();
   if(raw.startsWith('~~~'))raw=raw.replace(/^~~~json\s*/i,'').replace(/\s*~~~$/,'');
   let obj;try{obj=JSON.parse(raw)}catch{}
   const metrics=evaluate(source,p,obj?.sections),valid=metrics.valid===true;
   const fact=valid?checkFactCoverage(source,level,obj.sections):null;
   const cov={checked:fact?.required??0,matched:fact?.matched??0,
    coreMissing:fact?fact.missing.filter(x=>x.type==='core').length:null,
    supportMissing:fact?fact.missing.filter(x=>x.type==='support').length:null,
    missing:fact?.missing||[]};
   const englishLeak=valid&&wordsEnglish.test(metrics.rawText);
   const result={id,source:id,level,variant,valid,plan:p,metrics,rawSections:valid?obj.sections:null,cov,englishLeak,
    ms,semanticCertified:false};
   results.push(result);
   console.log('LAB95_CASE',JSON.stringify({id,level,variant,valid,rows:metrics.rows,cap:p.targetCap,
    pct:metrics.reduction,band:metrics.strictBand,geom:metrics.fitsTarget,both:metrics.strictCombined,
    coreMissing:cov.coreMissing,englishLeak,ms}));
   persist();return;
  }catch(e){const err={id,level,variant,attempt:attempts,error:String(e.name||e).slice(0,150)};
   errors.push(err);results.push({id,level,variant,valid:false,error:err});persist();return;
  }
 }
}
if(process.argv.includes('--offline'))testOffline();
else if(process.argv.includes('--real')){
 if(!KEY){errors.push({error:'NO_EXISTING_SECRET'});persist();process.exit(1)}
 console.log('LAB95_START',JSON.stringify({cases:CASES.length,maxCalls:MAX_CALLS}));
 for(const [id,level,variant] of CASES){if(stop||attempts>=MAX_CALLS)break;await call(id,level,variant);if(stop)break;await wait(800)}
 const r=persist();console.log('LAB95_END',JSON.stringify({summary:r.summary,provider:r.provider}));
}else throw Error('Specify --offline or --real');
