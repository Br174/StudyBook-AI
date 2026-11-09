// StudyBook AI LAB90: flexible semantic letter budgets with useful elaboration.
// Modes: --offline: 12,000 seeded math allocations and LAB89 reflow checks, zero AI calls.
//        --real: up to 30 one-pass Gemini tests; stop immediately on 429, after one 503 retry.
// Never edits production code, Android APK, source book or Google/Cloudflare assets.
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
const RAW='audit/test-fixtures/lab89-semantic-concepts.json';
const FIX=JSON.parse(readFileSync(RAW,'utf8')).sources;
const PREV=JSON.parse(readFileSync('audit/reports/lab89-proportional-real-gemini.json','utf8'));
const OUTPUT='audit/reports/lab90-fluid-useful-elaboration-real.json';
const OFFLINE='audit/reports/lab90-fluid-budget-offline.json';
const MODEL='gemini-3.5-flash-lite', API='https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
const W=60,MEAN_LETTERS=46.346,SPACES_TOTAL=11.502,PUNCT=1.966,DIGITS=0.186;
const LEVELS=[40,65,50,30,20,10], ALL=[65,50,40,30,20,10];
const alpha=s=>(String(s||'').normalize('NFC').match(/\p{L}/gu)||[]).length;
function wrap(s){
 const parts=String(s||'').normalize('NFC').replace(/\s+/gu,' ').trim().split(' ').filter(Boolean),rows=[];let row='',wide=false;
 for(const word of parts){
  if([...word].length>W)wide=true;
  const next=row?row+' '+word:word;
  if([...next].length>W&&row){rows.push(row);row=word}else row=next;
 }
 if(row)rows.push(row);
 return {rows,wide};
}
const sum=x=>x.reduce((a,b)=>a+b,0);
function largest(total,weights){
 if(!Number.isInteger(total)||total<0||!weights.length||weights.some(x=>x<0||!Number.isFinite(x)))throw Error('bad input');
 const mass=sum(weights), fractions=(mass?weights.map(w=>w/mass):weights.map(()=>1/weights.length)).map(w=>total*w);
 const result=fractions.map(Math.floor);
 const left=total-sum(result);
 const order=fractions.map((v,i)=>({i,rem:v-result[i]})).sort((a,b)=>b.rem-a.rem||a.i-b.i);
 for(let i=0;i<left;i++)result[order[i].i]++;
 if(sum(result)!==total)throw Error('budget mismatch');
 return result;
}
function plan(s,level){
 const lengths=s.concepts.map(alpha),total=sum(lengths),originalLines=wrap(s.concepts.join(' ')).rows.length;
 const short=originalLines<=5;
 const target=Math.round(total*(1-level/100));
 const min=short?null:Math.ceil(total*(1-(level+5)/100));
 const max=short?null:Math.floor(total*(1-(level-5)/100));
 // Keep a partial last line. A desired 9.25 equivalent lines occupies at most 10 physical rows.
 const equivalentLines=target/MEAN_LETTERS;
 const physicalCap=short?5:Math.ceil(equivalentLines);
 const softLetters=largest(target,lengths.map((v,i)=>v*(s.importance?.[i]||1)));
 const rawShares=softLetters.map(x=>x/MEAN_LETTERS);
 const concepts=s.concepts.map((text,i)=>({
  id:'C'+(i+1),source:text,sourceLetters:lengths[i],importance:s.importance?.[i]||1,
  softLetterGoal:softLetters[i],equivalentLineShare:+rawShares[i].toFixed(3),
  requiredInformation:s.keyPoints?.[i]||[],
  usefulExpansionHint:'Se la quota risulta libera, chiarisci un nesso, definizione o condizione GIA presente nella fonte. Non riempire con ridondanze.'
 }));
 return {source:s.id,level,originalLetters:total,originalLines,short,letterTarget:target,letterBand:{min,max},
  equivalentLines:+equivalentLines.toFixed(4),physicalMaxRows:physicalCap,width:W,
  totalNaturalSlots:Math.round(target*W/MEAN_LETTERS),
  allocationsSum:sum(softLetters),concepts,importance:s.importance,
  noExclusiveSectionRows:true};
}
function assess(s,p,sections){
 if(!Array.isArray(sections)||sections.length!==p.concepts.length||sections.some((v,i)=>v.id!==p.concepts[i].id||!String(v.text||'').trim())){
  return {structural:false,reason:'BAD_SECTION_SHAPE'};
 }
 const paragraphs=sections.map(x=>String(x.text).normalize('NFC').replace(/\s+/gu,' ').trim());
 const combined=paragraphs.join(' ');
 const layout=wrap(combined);
 const letters=alpha(combined), reduction=100*(1-letters/p.originalLetters);
 const missingTerms=(p.level===10||p.level===20)?(s.flags||[]).filter(x=>!combined.toLocaleLowerCase('it').includes(x.toLocaleLowerCase('it'))):[];
 const suspicious=/\b(?:dall|l|all|un)\s+(?:asse|inclinazione|aria|altra)\b|\b(?:Mareee|di e la notte)\b/iu.test(combined);
 const split=/\p{L}-\s*\n\s*\p{L}/u.test(sections.map(x=>x.text).join('\n'));
 const rawNewline=sections.some(x=>/\r|\n/u.test(x.text));
 const ends=layout.rows.at(-1)||'';
 const occupiedEquivalent=layout.rows.length?layout.rows.length-1+([...ends].length/W):0;
 return {structural:true,actualLetters:letters,actualReduction:+reduction.toFixed(2),
  deltaFromTargetLetters:letters-p.letterTarget,
  bandPass:p.short||(letters>=p.letterBand.min&&letters<=p.letterBand.max),
  linePass:layout.rows.length<=p.physicalMaxRows&&!layout.wide,
  actualPhysicalRows:layout.rows.length,partialLastLineLength:[...ends].length,
  actualEquivalentLines:+occupiedEquivalent.toFixed(3),lineWidths:layout.rows.map(x=>[...x].length),
  geometryAndLettersPass:layout.rows.length<=p.physicalMaxRows&&!layout.wide&&(p.short||(letters>=p.letterBand.min&&letters<=p.letterBand.max)),
  missingTerms,redFlags:{suspiciousSpelling:suspicious,hyphenSplit:split,rawNewline},
  conceptLetterUse:paragraphs.map((x,i)=>({id:'C'+(i+1),targetLetters:p.concepts[i].softLetterGoal,actualLetters:alpha(x),
   deviation:alpha(x)-p.concepts[i].softLetterGoal})),
  text:combined,sections,lines:layout.rows
 };
}
function seed(){let x=123456789;return()=>((x=(Math.imul(x,1664525)+1013904223)>>>0)/4294967296)}
function offline(){
 const results=FIX.flatMap(s=>ALL.map(level=>plan(s,level)));
 let rand=seed(),passed=0,failures=[],infeasible=0;
 for(let k=0;k<12000;k++){
  const n=1+Math.floor(rand()*18);
  const conceptLines=Array.from({length:n},()=>Math.max(2,Math.floor(Math.pow(rand(),2)*110)));
  const fake={id:'random'+k,concepts:conceptLines.map(x=>'pensiero '.repeat(x).trim()),importance:conceptLines.map(()=>0.5+rand()*2),
    keyPoints:conceptLines.map(()=>[])};
  const p=plan(fake,ALL[k%6]);
  try{
   if(p.allocationsSum!==p.letterTarget)throw Error('Sum allocation');
   if(p.concepts.length!==fake.concepts.length)throw Error('Concepts');
   if(p.concepts.some(x=>x.softLetterGoal<0))throw Error('Negative share');
   if(!p.short&&p.physicalMaxRows!==Math.ceil(p.letterTarget/MEAN_LETTERS))throw Error('Nonfractional');
   if(p.physicalMaxRows<1)throw Error('No rows');
   passed++;
  }catch(e){failures.push({k,error:String(e)});if(failures.length>=10)break}
 }
 const prior=PREV.records.filter(x=>x.textReturned&&x.validation?.structurallyValid);
 const rechecks=prior.map(x=>{
  const s=FIX.find(y=>y.id===x.source);
  const p=plan(s,x.level);
  const v=assess(s,p,x.sections);
  return {source:x.source,level:x.level,physicalCap:p.physicalMaxRows,equivalentLines:p.equivalentLines,
   prevStrictPagePass:x.validation.gridPass,
   sharedNewLinePass:v.linePass,newPctPass:v.bandPass,newCombinedPass:v.geometryAndLettersPass,
   fractionsRemainingAtLastRow:v.partialLastLineLength,lettersInvariant:x.validation.actualLetters===v.actualLetters};
 });
 const summary={fixtures:results.length,randomRuns:passed,failed:failures.length,
  baselineReplays:rechecks.length,replayNoLetterChanges:rechecks.every(x=>x.lettersInvariant),
  previousStrictAndPercent:prior.filter(x=>x.validation.combinedPass).length,
  sharedAndPercent:rechecks.filter(x=>x.newCombinedPass).length};
 const data={method:'LAB90 dynamic shared line, fractional targets, deterministic letter balances',
  note:'No AI model called in offline mode; baseline replay measures geometry only, no semantic certification.',
  calibration:{rowWidth:W,lettersPerRow:MEAN_LETTERS,naturalSpaces:7.844,justificationSpaces:3.658,punctuation:PUNCT,digits:DIGITS},
  summary,fixtures:results.map(x=>({source:x.source,level:x.level,target:x.letterTarget,fractionalEquivalent:x.equivalentLines,physicalCap:x.physicalMaxRows,softShares:x.concepts.map(z=>z.softLetterGoal)})),rechecks,failures};
 mkdirSync('audit/reports',{recursive:true});writeFileSync(OFFLINE,JSON.stringify(data,null,2)+'\n');
 console.log('LAB90_OFFLINE_RESULT',JSON.stringify(summary));
 if(failures.length||rechecks.some(x=>!x.lettersInvariant))process.exitCode=1;
}
const ORDER=[
 ['scienze',40],['procedura',40],['concetto_sbilanciato',40],['medicina',40],['pagina_breve_continua',40],
 ['scienze',65],['procedura',65],['concetto_sbilanciato',65],['medicina',65],['pagina_breve_continua',65],
 ['scienze',50],['procedura',50],['concetto_sbilanciato',50],['medicina',50],['pagina_breve_continua',50],
 ['scienze',30],['procedura',30],['concetto_sbilanciato',30],['medicina',30],['pagina_breve_continua',30],
 ['scienze',20],['procedura',20],['concetto_sbilanciato',20],['medicina',20],['pagina_breve_continua',20],
 ['scienze',10],['procedura',10],['concetto_sbilanciato',10],['medicina',10],['pagina_breve_continua',10]
];
let attempts=0,completed=0,stopped=false,stopReason='',records=[],errors=[];
const MAX_CALLS=32;
const responseFormat={type:'json_schema',json_schema:{name:'studybook_lab90_continuous_semantic_sections',strict:true,schema:{
 type:'object',additionalProperties:false,properties:{sections:{type:'array',items:{type:'object',additionalProperties:false,properties:{id:{type:'string'},text:{type:'string'}},required:['id','text']}}},required:['sections']}}};
function instructions(s,p){
 const rows=[
 'LAB90 STUDIO: Riscrivi la pagina in italiano in UN UNICO PASSAGGIO. Non devi aggiungere né perdere fatti essenziali. Ogni concetto ha una quota preventiva in LETTERE, ma le quote sono FLESSIBILI e possono compensarsi.',
 'FONTE DI QUESTA PAGINA (unica autorità per i contenuti): '+s.concepts.join(' '),
 'LIMITE DI PAGINA: righe lunghe massimo 60 celle monospaziate; massimo '+p.physicalMaxRows+' righe fisiche. Il bersaglio continuo di capacità è '+p.equivalentLines+' righe equivalenti, NON un obbligo di riempire l’ultima riga. Non cambiare font, non spezzare parole, non alterare apostrofi e accenti.',
 'OBIETTIVO ALFABETICO: originale '+p.originalLetters+' lettere, riduzione '+p.level+'%, mantenere circa '+p.letterTarget+' lettere Unicode (solo lettere alfabetiche, non spazi/numeri/punteggiatura). '+(p.short?'Eccezione <=5 righe originali: percentuale libera, ma chiarimento obbligatorio.':'Intervallo consentito '+p.letterBand.min+'–'+p.letterBand.max+' lettere, pari a riduzione ±5 punti percentuali.'),
 'STIMA PREVENTIVA da 500 righe vere: mediamente su 60 posizioni 46,346 lettere + 7,844 spazi naturali + 3,658 spazi di giustificazione (da aggiungere dopo, NON nella risposta) + 1,966 punteggiatura + 0,186 cifre. Le parole hanno lunghezze variabili; la stima non è conteggio esatto.',
 'IMPORTANTE: non iniziare un concetto su una riga nuova, se il precedente lascia spazio. Ogni sezione va scritta in un UNICO PARAGRAFO senza interruzioni interne: StudyBook unirà le sezioni con UNO SPAZIO e farà il ritorno a capo soltanto se la prossima parola non entra.',
 'COMPENSAZIONE FLUIDA: se un concetto occupa meno lettere/celle del previsto, passa il risparmio a un concetto successivo o anche precedente che necessita di una spiegazione più chiara. Se un concetto ha bisogno di più spazio per preservare dettagli, sintetizza un altro solo se non perde fatti essenziali. Non fare sezioni uguali, rispetta proporzioni iniziali senza pareti rigide.',
 'APPROFONDIMENTO UTILE, NON RIEMPITIVO: quando resta budget rispetto al target di LETTERE, recuperalo esplicitando cause, conseguenze, definizioni, negazioni, differenze, condizioni o eccezioni già presenti nel testo originale e finora poco chiare; non inventare esempi o fatti esterni, non ripetere parole soltanto per arrivare al limite. Non usare più testo del necessario per un concetto semplice.',
 'PROGRESSIONE DIDATTICA: al 10/20% conserva i termini tecnici esatti; dal 30% spiega più semplicemente i termini non essenziali, mantenendo i termini imprescindibili. La funzionalità separata «In parole semplici» non deve essere generata ora.',
 'PLAN SEMANTICO completo, calcolato PRIMA della generazione:'
 ];
 p.concepts.forEach(c=>{
  rows.push(c.id+': quota ORIENTATIVA '+c.softLetterGoal+' lettere (~'+c.equivalentLineShare+' righe equivalenti). Non è una sezione fisicamente separata, puoi spendere più o meno quota. FONTE: '+c.source+'.');
  rows.push('Conservare i seguenti contenuti: '+c.requiredInformation.join('; '));
 });
 if(s.contextOnly)rows.push('Contesto sole pagine adiacenti, SOLA LETTURA, non copiarlo nella risposta: PRECEDENTE '+s.contextOnly.before+'; SUCCESSIVA '+s.contextOnly.after);
 rows.push('Devi restituire SOLO JSON {"sections":[{"id":"C1","text":"..."} ...]}, UNA stringa per concetto nello stesso ordine, nessuna riga nuova in ciascun text, nessun commento. Lo StudyBook unisce con un solo spazio e verifica l’intera griglia e le lettere.');
 return rows.join('\n');
}
const rubric={
 scienze:[/rotaz|ruot/i,/giorno/i,/notte/i,/rivoluz/i,/stagion/i,/inclin/i,/non.{0,35}distanza|distanza.{0,30}non/i,/maree/i,/luna/i,/sole/i,/ecliss/i,/allineam/i,/lunaz|ogni/i,/ipotes/i,/verific/i,/ripet/i,/caus/i],
 procedura:[/2024|duemilaventiquattro/i,/12|dodici/i,/titolo/i,/prestito/i,/dieci|10/i,/prorog/i,/prenot|riserv/i,/scritt/i,/scaden|data iniziale/i,/lettur|letto|finito|complet/i,/registr/i,/opinioni/i],
 medicina:[/diaframma/i,/inspir/i,/espir/i,/alveol/i,/ossigeno/i,/anidride carbonica/i,/emoglobin/i,/sforzo/i,/diagnos|medic/i,/sintom/i],
 concetto_sbilanciato:[/font/i,/confront/i,/document/i,/primaria/i,/secondaria/i,/ipotes/i,/fatt/i],
 pagina_breve_continua:[/termine perentorio/i,/15|quindici/i,/notifica/i,/deposit/i,/motivaz/i]
};
function rubricFlags(s,a){
 const body=a?.text||'';
 return (rubric[s.id]||[]).filter(r=>!r.test(body)).map(r=>String(r));
}
function persist(){
 const data={experiment:'LAB90 fluid per-concept soft letter sharing with useful elaboration',date:new Date().toISOString(),model:MODEL,
  source:'audit/test-fixtures/lab89-semantic-concepts.json',
  methodologicalLimits:'Semantically grouped source concepts pre-supplied; not a full PDF ingestion test, 60-cell monospace not physical A4; automated flags are heuristic and require human review.',
  stops:{attempts,stopped,stopReason,maxCalls:MAX_CALLS},
  summary:{casesPlanned:ORDER.length,casesAttempted:records.length,geminiReturned:records.filter(x=>x.validJson).length,
   gridPass:records.filter(x=>x.validation?.linePass).length,
   percentPass:records.filter(x=>x.validation?.bandPass).length,
   both:records.filter(x=>x.validation?.geometryAndLettersPass).length,
   allPreliminary:records.filter(x=>x.preliminaryPass).length,
   sourceCount:new Set(records.filter(x=>x.validJson).map(x=>x.source)).size},
  controls:{productionChanged:false,mainChanged:false,apkChanged:false,noPreGenerationInParoleSemplici:true,oneGenerationPerCase:true},
  records,errors};
 mkdirSync('audit/reports',{recursive:true});
 writeFileSync(OUTPUT,JSON.stringify(data,null,2)+'\n');return data;
}
async function request(s,level,key){
 const p=plan(s,level);
 let tried=0;
 while(attempts<MAX_CALLS&&!stopped&&tried<2){
  tried++;attempts++;
  const now=performance.now();
  try{
   const res=await fetch(API,{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},
    body:JSON.stringify({model:MODEL,temperature:0.15,max_tokens:3500,response_format:responseFormat,
     messages:[{role:'user',content:instructions(s,p)}]}),
    signal:AbortSignal.timeout(70000)});
   const ms=Math.round(performance.now()-now);
   const payload=await res.json().catch(()=>({}));
   if(!res.ok){
    const issue={source:s.id,level,attempt:attempts,http:res.status,reason:String(payload.error?.message||'HTTP_ERROR').slice(0,160)};
    errors.push(issue);
    console.log('LAB90_PROVIDER_ERROR',JSON.stringify(issue));
    if(res.status===429){stopped=true;stopReason='HTTP_429';records.push({source:s.id,level,validJson:false,error:issue});persist();return;}
    if(res.status===503&&tried===1&&attempts<MAX_CALLS){await new Promise(r=>setTimeout(r,3000));continue}
    if(res.status===503){stopped=true;stopReason='HTTP_503';records.push({source:s.id,level,validJson:false,error:issue});persist();return;}
    records.push({source:s.id,level,validJson:false,error:issue});persist();return;
   }
   let raw=String(payload.choices?.[0]?.message?.content||'').trim();
   if(raw.startsWith('~~~'))raw=raw.replace(/^~~~json\s*/i,'').replace(/\s*~~~$/,'');
   let parsed;try{parsed=JSON.parse(raw)}catch(e){parsed={};}
   const validJson=Array.isArray(parsed.sections);
   const validation=assess(s,p,parsed.sections);
   const missingRubric=rubricFlags(s,validation);
   const flags=validation?.redFlags||{};
   const preliminary=!!validation.geometryAndLettersPass&&!flags.suspiciousSpelling&&!flags.hyphenSplit&&!flags.rawNewline&&
    (validation.missingTerms||[]).length===0&&missingRubric.length===0;
   const record={source:s.id,level,ms,validJson,plan:p,
    rawSections:validJson?parsed.sections:null,validation,missingRubric,preliminaryPass:preliminary,
    completionTokens:payload.usage?.completion_tokens??null};
   records.push(record);
   console.log('LAB90_CASE',JSON.stringify({source:s.id,level,percent:validation.actualReduction,rows:validation.actualPhysicalRows,
    cap:p.physicalMaxRows,letters:validation.actualLetters,target:p.letterTarget,
    grid:validation.linePass,band:validation.bandPass,both:validation.geometryAndLettersPass,
    prelim:preliminary,missingRubric:missingRubric.length}));
   persist();return;
  }catch(e){
   const issue={source:s.id,level,attempt:attempts,error:String(e?.name||e).slice(0,170)};
   errors.push(issue);records.push({source:s.id,level,validJson:false,error:issue});persist();
   console.log('LAB90_NETWORK_ERROR',JSON.stringify(issue));return;
  }
 }
}
if(process.argv.includes('--offline'))offline();
else if(process.argv.includes('--real')){
 const key=process.env.AI_TEST_KEY;
 if(!key){errors.push({error:'MISSING_EXISTING_SECRET'});persist();process.exit(1)}
 console.log('LAB90_START',JSON.stringify({model:MODEL,maxCalls:MAX_CALLS,cases:ORDER.length}));
 for(const [id,level] of ORDER){
  if(stopped||attempts>=MAX_CALLS)break;
  await request(FIX.find(s=>s.id===id),level,key);
  if(stopped)break;
  await new Promise(r=>setTimeout(r,750));
 }
 const report=persist();
 console.log('LAB90_FINAL',JSON.stringify({stops:report.stops,summary:report.summary,errorCount:errors.length}));
 // Provider errors are recorded as partial results; do not accidentally imply educational certification.
}else throw Error('pass --offline or --real');
