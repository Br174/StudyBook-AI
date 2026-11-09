// StudyBook LAB92: bounded REAL Gemini one-pass semantic simplification, stop when complete.
// Credentials are pre-existing GH Actions secrets; no paid services, no production code changes.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import {budget,evaluate,letters,WIDTH,AVG} from './lab92-stop-complete-engine.mjs';
const fixture=JSON.parse(readFileSync('audit/test-fixtures/lab89-semantic-concepts.json','utf8')).sources;
const KEY=process.env.AI_TEST_KEY||'';
const MODEL='gemini-3.5-flash-lite',API='https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
const OUT='audit/reports/lab92-stop-complete-real-gemini.json';
const ROWS=[40,50,20,10,65,30]; // first 40% and 50% across all genres before expensive levels
const ORDER=ROWS.flatMap(level=>fixture.map(s=>({id:s.id,level})));
const MAX_ATTEMPTS=25;let calls=0,stop=false,stopReason='',results=[],errors=[];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const format={type:'json_schema',json_schema:{name:'studybook_lab92_complete_thoughts',strict:true,schema:{
 type:'object',additionalProperties:false,properties:{sections:{type:'array',items:{type:'object',additionalProperties:false,properties:{id:{type:'string'},text:{type:'string'}},required:['id','text']}}},required:['sections']}}};
const defaultInstruction=[
 'Sei l’assistente didattico StudyBook AI. Riscrivi fedelmente il testo fornito in italiano comprensibile, mantenendo tutti i concetti essenziali, i fatti, le condizioni, le eccezioni, le definizioni, le negazioni, le cifre e i nessi causali.',
 'RISPETTA UNA REGOLE FONDAMENTALE: quando hai espresso tutto ciò che serve, FERMATI. Non aggiungere parole, aggettivi, spiegazioni secondarie o frasi per completare la riga, la pagina o il numero di lettere. Meglio un poco più corto che artificiosamente lungo. NON inventare nulla.',
 'Durante la prima comprensione i concetti sono stati identificati e assegnati a quote MORBIDE e proporzionali in lettere. Queste quote sono obiettivi orientativi, NON confini rigidi o righe separate. Se un concetto breve consuma meno, altro concetto complesso può usare lo spazio residuo SOLO per preservare informazioni originali e fondamentali; MAI per gonfiare il risultato.',
 'TUTTE LE SEZIONI FORMANO UN UNICO TESTO CONTINUO: unisci le sezioni con UN SOLO SPAZIO e vai a capo automaticamente quando la parola completa successiva non entra in 60 caratteri. NON scrivere interruzioni di riga nei testi delle sezioni. Font monospaziato a grandezza fissa, nessun rimpicciolimento o troncamento delle parole.',
 'Il conteggio percentuale si basa sulle sole lettere Unicode, non comprende spazi, punteggiatura o cifre. Controllo successivo matematico indipendente. Gli spazi extra per giustificazione verranno aggiunti SOLO dalla grafica, non da te.',
 'Su fonte originale di 1–5 righe, semplifica comunque le frasi ma NON forzare una percentuale; se il testo è già chiaro, non aggiungere niente. Nei 10%/20% conserva i termini tecnici fondamentali; negli altri livelli semplifica gradualmente il lessico, senza eliminare i termini indispensabili.',
 'Non creare la funzione separata «In parole semplici», perché si attiverà solo quando l’utente premerà il pulsante sullo schermo.',
 'Non copiare dati dalle pagine adiacenti. Non spostare contenuti nella pagina successiva. Vietato alterare il significato soltanto per far entrare il testo nei margini.'
];
function prompt(source,p){
 const base=[...defaultInstruction];
 base.push('RIDUZIONE OBIETTIVO '+p.level+'%. La fonte di questa pagina contiene '+p.originalLetters+' lettere su '+p.originalRows+' righe virtuali originali.');
 base.push('BUDGET COMPLESSIVO: circa '+p.targetLetters+' lettere, equivalentemente '+p.lineEquivalents+' righe statistiche da 60 celle. Limite fisico della versione: fino a '+p.targetCap+' righe x '+WIDTH+' caratteri. '+(p.short?'PAGINA BREVE: la percentuale non vincola il testo, ma non superare 5 righe.': 'Fascia ordinaria sulle LETTERE: da '+p.band.low+' a '+p.band.high+' (±5 punti di riduzione), senza mai sacrificare il contenuto. Piccola porzione finale di riga vuota consentita.').replace(/\s+/g,' '));
 base.push('MEDIE MISURATE SU 500 RIGHE: '+AVG.letters+' lettere, '+AVG.naturalSpaces+' spazi naturali, '+AVG.justifySpaces+' spazi grafici extra non da scrivere, '+AVG.punctuation+' segni, '+AVG.digits+' cifre per riga. Sono STIME, non righe fisse da completare.');
 base.push('PIANO COMPLETO dei concetti, in ordine (unica richiesta, nessuna revisione prevista):');
 for(const c of p.goalPerConcept){
  base.push(c.id+' ≈ '+c.softTargetLetters+' lettere orientative (parte del totale). FONTE esclusiva di '+c.id+': '+c.text);
  base.push('INFORMAZIONI INDISPENSABILI di '+c.id+': '+c.requiredFacts.join('; '));
 }
 if(source.contextOnly)base.push('CONTESTO PRECEDENTE/SEGUENTE DI SOLA LETTURA, NON COPIARLO: '+source.contextOnly.before+' / '+source.contextOnly.after);
 base.push('Rispondi esclusivamente JSON {"sections":[{"id":"C1","text":"frasi complete senza a capo"},...]}. Usa esattamente le sezioni in ordine. Non mettere righe vuote tra i pensieri. Se una frase è completa non ampliarla per raggiungere il budget. Qualità didattica prima di ogni cifra.');
 return base.join('\n\n');
}
function persist(){
 const completed=results.filter(r=>r.outputValid);
 const short=completed.filter(r=>r.plan.short),long=completed.filter(r=>!r.plan.short);
 const summary={
  plannedCases:ORDER.length,requested:results.length,completed:completed.length,
  longPages:long.length,shortPages:short.length,
  longStrictMath:long.filter(x=>x.check.strictBand).length,
  longStrictGrid:long.filter(x=>x.check.fitsTarget).length,
  longStrictBoth:long.filter(x=>x.check.strictCombined).length,
  longSmallShortfallReview:long.filter(x=>x.check.smallShortfall).length,
  allGrid:completed.filter(x=>x.check.fitsTarget).length,
  allMath:completed.filter(x=>x.check.strictBand).length,
  allCombined:completed.filter(x=>x.check.strictCombined).length,
  heuristicallyClean:completed.filter(x=>x.preliminaryHeuristicPass).length,
  genres:[...new Set(completed.map(x=>x.source))]};
 const payload={
  experiment:'LAB92 stop on complete thought; flexible proportional semantics, no padding',
  date:new Date().toISOString(),model:MODEL,
  reason:'Prompt forbids explaining more merely to reach the target; source essential content still preserved.',
  provenance:'First semantic segmentation pre-supplied in 5 benchmark fixtures, NOT proof of real PDF segmentation.',
  metrics:'60-character monospace virtual rows; Unicode alphabetic letter totals; no proof of actual physical A4 proportional font rendering.',
  review:'Preliminary string/rubric checks ARE NOT independent academic, medical or legal semantic validation.',
  controls:{mainChanged:false,productionChanged:false,androidBuildChanged:false,noAdditionalCost:true,modelCallsForInParoleSemplici:0},
  provider:{attempts:calls,stopped:stop,reason:stopReason,requestLimit:MAX_ATTEMPTS},
  summary,results,errors
 };
 mkdirSync('audit/reports',{recursive:true});writeFileSync(OUT,JSON.stringify(payload,null,2)+'\n');
 return payload;
}
async function request(id,level){
 const source=fixture.find(x=>x.id===id),p=budget(source,level);
 let retries=0;
 while(!stop&&calls<MAX_ATTEMPTS&&retries<2){
  calls++;retries++;
  const begin=performance.now();
  try{
   const res=await fetch(API,{method:'POST',headers:{Authorization:'Bearer '+KEY,'Content-Type':'application/json'},
    body:JSON.stringify({model:MODEL,temperature:0.1,max_tokens:2300,response_format:format,messages:[{role:'user',content:prompt(source,p)}]}),
    signal:AbortSignal.timeout(80000)});
   const ms=Math.round(performance.now()-begin);
   const j=await res.json().catch(()=>({}));
   if(!res.ok){
    const issue={source:id,level,http:res.status,attempt:calls,timeMs:ms,message:String(j.error?.message||'HTTP error').slice(0,180)};
    errors.push(issue);console.log('LAB92_PROVIDER_ERROR',JSON.stringify(issue));
    if(res.status===429){stop=true;stopReason='HTTP_429';results.push({source:id,level,outputValid:false,error:issue});persist();return}
    if(res.status===503&&retries===1&&calls<MAX_ATTEMPTS){console.log('LAB92_ONE_BACKOFF',id,level);await sleep(3000);continue}
    if(res.status===503){stop=true;stopReason='HTTP_503';results.push({source:id,level,outputValid:false,error:issue});persist();return}
    results.push({source:id,level,outputValid:false,error:issue});persist();return;
   }
   let raw=String(j.choices?.[0]?.message?.content||'').trim();
   if(raw.startsWith('~~~'))raw=raw.replace(/^~~~json\s*/i,'').replace(/\s*~~~$/,'');
   let payload;try{payload=JSON.parse(raw)}catch{}
   const sections=payload?.sections;
   const check=evaluate(source,p,sections);
   const outputValid=check.valid===true;
   const preliminaryHeuristicPass=!!outputValid&&check.strictCombined&&check.possibleSemanticPass&&!check.spuriousMultipleSpaces;
   const item={source:id,level,outputValid,plan:p,rawSections:sections||null,check,timeMs:ms,
    preliminaryHeuristicPass,missingContentSignals:check.missingRubric?.length||null,
    reviewStatus:'NOT_INDEPENDENTLY_SEMANTICALLY_CERTIFIED'};
   results.push(item);
   console.log('LAB92_CASE',JSON.stringify({source:id,level,short:p.short,cap:p.targetCap,
    rows:check.rows,letters:check.letters,target:p.targetLetters,percent:check.reduction,
    band:check.strictBand,grid:check.fitsTarget,both:check.strictCombined,
    smallShortfall:check.smallShortfall,heuristic:preliminaryHeuristicPass,ms}));
   persist();return;
  }catch(e){
   const issue={source:id,level,attempt:calls,error:String(e?.name||e).slice(0,180)};
   errors.push(issue);results.push({source:id,level,outputValid:false,error:issue});
   console.log('LAB92_RUNTIME_ERROR',JSON.stringify(issue));persist();return;
  }
 }
}
if(!KEY){errors.push({error:'NO_EXISTING_GEMINI_CREDENTIAL'});persist();process.exit(1)}
console.log('LAB92_REAL_START',JSON.stringify({planned:ORDER.length,maxAttempts:MAX_ATTEMPTS,model:MODEL}));
for(const item of ORDER){
 if(stop||calls>=MAX_ATTEMPTS)break;
 await request(item.id,item.level);
 if(stop)break;
 await sleep(750);
}
const report=persist();console.log('LAB92_REAL_FINAL',JSON.stringify({summary:report.summary,provider:report.provider,errorCount:errors.length}));
