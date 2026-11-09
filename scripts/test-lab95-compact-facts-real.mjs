// MotorLab / StudyBook AI LAB95. Semantic facts condensed IN ITALIAN in one pass.
// No source book, Android, Cloudflare or production modifications.
// Design test: prompt A (fuse facts), prompt B (fuse + soft per-concept range).
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import {FIXTURES,sourceById,requiredFacts,checkFactCoverage} from './lab93-semantic-gate.mjs';
import {budget,evaluate} from './lab92-stop-complete-engine.mjs';
const ITALIAN=JSON.parse(readFileSync('audit/test-fixtures/lab94-facts-italiano.json','utf8')).sources;
const MODEL='gemini-3.5-flash-lite',API='https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
const KEY=process.env.AI_TEST_KEY||'',OUTPUT='audit/reports/lab95-compact-facts-real.json',LIMIT=14;
const ORDER=[
 ['scienze',20,'A'],['scienze',20,'B'],
 ['medicina',20,'A'],['medicina',20,'B'],
 ['procedura',20,'A'],['procedura',20,'B'],
 ['concetto_sbilanciato',20,'A'],['concetto_sbilanciato',20,'B'],
 ['pagina_breve_continua',20,'A'],
 ['scienze',10,'B'],['procedura',10,'B'],
 ['scienze',50,'B'],['medicina',50,'B']
];
const FORMAT={type:'json_schema',json_schema:{name:'lab95_compact_italian_sections',strict:true,
 schema:{type:'object',additionalProperties:false,properties:{sections:{type:'array',items:{type:'object',
 additionalProperties:false,properties:{id:{type:'string'},text:{type:'string'}},required:['id','text']}}},required:['sections']}}};
const English=/\b(?:the|oxygen|deadline|filing|peremptory|testable|hypotheses|repeatable|observations|contracts|relaxes|tides|revolution|seasons|axis tilt|not every|diagnostic triad|written confirmation|initial date|what|who when|secondary source|primary source|co2 opposite|partial pressure|source grounded|human-readable)\b/iu;
let attempts=0,stopped=false,reason='',errors=[],records=[];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function prompt(src,plan,variant){
 const facts=requiredFacts(src,plan.level);
 const p=[
  'STUDYBOOK AI, VERSIONE DI STUDIO ITALIANA. Produce UNA sola generazione. NON rispondere in inglese, NON copiare termini tecnici interni.',
  'IL COMPITO E UNA RIFORMULAZIONE FEDELE, NON UN ELENCO DI RIASSUNTI. Ogni informazione indispensabile compare una volta sola; combina più fatti con congiunzioni, subordinate e punteggiatura naturale nella stessa frase, invece di ripetere un periodo per ogni punto.',
  'Importante per il '+plan.level+'%: il testo ORIGINALE ha '+plan.originalLetters+' lettere. Target '+plan.targetLetters+' lettere alfabetiche Unicode (no spazi/punteggiatura/numeri), fascia '+plan.band.low+'–'+plan.band.high+'. ',
  'LARGHEZZA BLOCCATA: fino a '+plan.targetCap+' righe fisiche di 60 caratteri monospaziati. Non spezzare parole e non inserire nuove righe nelle sezioni. Quando un concetto termina, il successivo continua dopo un solo spazio sulla stessa riga se la parola entra. I budget sono morbidi, la pagina unica.',
  'Non aggiungere esempi, spiegazioni non richieste o frasi per riempire righe. QUANDO IL PENSIERO E COMPLETO STOP; una mezza riga vuota è accettabile. Non comprimere drasticamente un 10% o un 20%: preserva dettagli e lessico tecnico essenziali.',
  'Se comprimere troppo significa perdere una negazione, condizione, eccezione, cifra, definizione o causa, NON eliminarla. Se la checklist contiene più frasi simili, esprimi l idea UNA SOLA VOLTA ma preserva tutti i suoi significati.',
  'Mai integrare concetti delle pagine vicine. Conservare ordine degli argomenti, niente spostamenti di materiale verso un altra pagina.',
  'Piano della pagina: il contesto è suddiviso in '+src.concepts.length+' concetti. Le quote indicano la proporzione suggerita in lettere; NON sono pagine separate, non inserirle nella risposta.'
 ];
 if(plan.level<=20)p.push('LIVELLO '+plan.level+'% QUASI ESTESO: stesse definizioni, condizioni e dettagli importanti dell originale, ma senza ripetizioni e con frasi più scorrevoli, non un mini riassunto.');
 if(plan.level>=40)p.push('LIVELLO '+plan.level+'%: sintesi comprensibile, ma ogni fatto obbligatorio fondamentale resta esplicito.');
 if(variant==='B')p.push('BUDGET ORIENTATIVO MIGLIORATO: valuta in anticipo le quote per tutte le sezioni. Se una sezione usa meno lettere, redistribuisci solo per esprimere FATTI gia presenti altrove; NON espandere un pensiero completo. Mira a un totale della pagina vicinissimo a '+plan.targetLetters+' lettere; non scrivere un paragrafo separato per ciascuna voce checklist.');
 for(let i=0;i<src.concepts.length;i++){
  const c=plan.goalPerConcept[i],entry=facts[i];
  p.push('CONCETTO '+(i+1)+': testo originale: '+c.text);
  p.push('FATTI FONDAMENTALI ITALIANI DA INCORPORARE nella prosa di questo concetto (senza ripetere le frasi della lista): '+entry.core.map(f=>ITALIAN[src.id][f.id]).join('; '));
  if(entry.support.length)p.push('DETTAGLI DA CONSERVARE in questa riduzione leggera: '+entry.support.map(f=>ITALIAN[src.id][f.id]).join('; '));
  if(variant==='B')p.push('Lunghezza proporzionale suggerita per il concetto '+(i+1)+': ~'+c.softTargetLetters+' LETTERE, flessibili, non obbligo di riempimento.');
 }
 if(src.contextOnly)p.push('CONTESTO di pagine precedenti/seguenti SOLO PER COMPRENSIONE, non copiarlo: '+src.contextOnly.before+' / '+src.contextOnly.after);
 p.push('Restituisci SOLO JSON {"sections":[{"id":"C1","text":"..."}...]}, esattamente '+src.concepts.length+' sezioni C1..C'+src.concepts.length+' in ordine. Ogni sezione un paragrafo italiano senza a capo. Non stampare elenco dei fatti né altri commenti.');
 return p.join('\n\n');
}
function persist(){
 const valid=records.filter(x=>x.valid),long=valid.filter(x=>!x.plan.short);
 const stats={scheduled:ORDER.length,attempted:records.length,returned:valid.length,long:long.length,
  longGrid:long.filter(x=>x.metrics.fitsTarget).length,longPercent:long.filter(x=>x.metrics.strictBand).length,
  longBoth:long.filter(x=>x.metrics.strictCombined).length,
  longAllAlertsClear:long.filter(x=>x.metrics.strictCombined&&x.coverage.missingCount===0&&!x.englishFlag&&x.metrics.wordIntegrity).length,
  englishFlags:valid.filter(x=>x.englishFlag).length,
  byVariant:Object.fromEntries(['A','B'].map(v=>[v,{returned:valid.filter(x=>x.variant===v).length,
   longBoth:long.filter(x=>x.variant===v&&x.metrics.strictCombined).length}])),
  paired20:['scienze','medicina','procedura','concetto_sbilanciato'].map(id=>({
    id,variants:valid.filter(x=>x.source===id&&x.level===20).map(x=>({mode:x.variant,pct:x.metrics.reduction,grid:x.metrics.fitsTarget,band:x.metrics.strictBand,missing:x.coverage.missingCount}))
   }))
 };
 const payload={experiment:'LAB95 Italian compact atomic facts with two one-pass prompt variants A/B',
  date:new Date().toISOString(),model:MODEL,
  limitations:'Synthetic presegmented pages, not PDF; 60-cell monospace research grid, not proof of physical A4; lexical coverage not proof of entailment. English heuristic may overflag foreign terms.',
  controls:{productionChanged:false,mainChanged:false,AndroidChanged:false,noOnDemandSimpleLanguageGeneration:true},
  provider:{attempts,stopped,reason,maxAttempts:LIMIT},stats,errors,records};
 mkdirSync('audit/reports',{recursive:true});writeFileSync(OUTPUT,JSON.stringify(payload,null,2)+'\n');return payload;
}
async function call(id,level,variant){
 const source=sourceById(id),plan=budget(source,level);
 let tryN=0;
 while(!stopped&&attempts<LIMIT&&tryN<2){
  attempts++;tryN++;
  const start=performance.now();
  try{
   const response=await fetch(API,{method:'POST',headers:{Authorization:'Bearer '+KEY,'Content-Type':'application/json'},
    body:JSON.stringify({model:MODEL,temperature:0.1,max_tokens:2500,response_format:FORMAT,messages:[{role:'user',content:prompt(source,plan,variant)}]}),
    signal:AbortSignal.timeout(72000)});
   const ms=Math.round(performance.now()-start);const json=await response.json().catch(()=>({}));
   if(!response.ok){
    const error={source:id,level,variant,status:response.status,attempt:attempts,ms,message:String(json.error?.message||'HTTP error').slice(0,180)};
    errors.push(error);console.log('LAB95_HTTP',JSON.stringify(error));
    if(response.status===429){stopped=true;reason='HTTP_429';records.push({source:id,level,variant,valid:false,error});persist();return;}
    if(response.status===503&&tryN===1&&attempts<LIMIT){await sleep(3000);continue;}
    if(response.status===503){stopped=true;reason='HTTP_503';}
    records.push({source:id,level,variant,valid:false,error});persist();return;
   }
   let content=String(json.choices?.[0]?.message?.content||'').trim();
   if(content.startsWith('~~~'))content=content.replace(/^~~~json\s*/i,'').replace(/\s*~~~$/,'');
   let result={};try{result=JSON.parse(content)}catch{}
   const metrics=evaluate(source,plan,result.sections),valid=metrics.valid===true;
   const coverage=valid?checkFactCoverage(source,level,result.sections):{valid:false,missingCount:-1};
   const englishFlag=valid?English.test(metrics.rawText):null;
   const record={source:id,level,variant,valid,ms,plan,metrics,coverage,
    englishFlag,sections:valid?result.sections:null,
    preliminaryOnly:true,expertVerified:false};
   records.push(record);
   console.log('LAB95_CASE',JSON.stringify({id,level,variant,pct:metrics.reduction,letters:metrics.letters,target:plan.targetLetters,rows:metrics.rows,cap:plan.targetCap,grid:metrics.fitsTarget,band:metrics.strictBand,combined:metrics.strictCombined,atomicMissing:coverage.missingCount,englishFlag}));
   persist();return;
  }catch(e){
   const error={source:id,level,variant,attempt:attempts,error:String(e?.name||e).slice(0,180)};
   errors.push(error);records.push({source:id,level,variant,valid:false,error});console.log('LAB95_ERROR',JSON.stringify(error));persist();return;
  }
 }
}
if(!KEY){errors.push({error:'NO_EXISTING_GEMINI_KEY'});persist();process.exit(1)}
console.log('LAB95_START',JSON.stringify({planned:ORDER.length,maxCalls:LIMIT}));
for(const [id,level,variant] of ORDER){
 if(stopped||attempts>=LIMIT)break;
 await call(id,level,variant);
 if(stopped)break;
 await sleep(1000);
}
const out=persist();console.log('LAB95_FINAL',JSON.stringify({provider:out.provider,stats:out.stats,errors:out.errors.length}));
