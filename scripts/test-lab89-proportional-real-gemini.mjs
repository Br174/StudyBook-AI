// MotorLab StudyBook LAB89 real Gemini: proportional semantic row-budget test.
// 5 subjects x 6 levels (30 unique cases), bounded free credential, one generation per case.
// No app modifications, no autonomous recurring run; stop on 429 or 2 consecutive 503.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import {alpha,wrap,allocate,validate,LEVELS,WIDTH,MEAN_LETTERS,MEAN_SPACES} from './lab89-budget-engine.mjs';
const fixtures=JSON.parse(readFileSync('audit/test-fixtures/lab89-semantic-concepts.json','utf8')).sources;
const KEY=process.env.AI_TEST_KEY||'';
const MODEL='gemini-3.5-flash-lite';
const URL='https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
const OUT='audit/reports/lab89-proportional-real-gemini.json';
const MAX_PROVIDER_CALLS=33,MAX_TESTS=30;
const format={type:'json_schema',json_schema:{name:'studybook_lab89_concept_sections',strict:true,schema:{
 type:'object',additionalProperties:false,properties:{
  sections:{type:'array',items:{type:'object',additionalProperties:false,properties:{id:{type:'string'},text:{type:'string'}},required:['id','text']}}
 },required:['sections']}}};
let attempts=0,stop=false,stopReason='',errors=[],records=[];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const sourceById=id=>fixtures.find(s=>s.id===id);
function getRubric(id){
 return {
 scienze:[
  {c:'C1',tests:['ruot|rotaz','giorno','notte']},
  {c:'C2',tests:['rivoluz','stagion','inclin','distanza|vicin|lontan']},
  {c:'C3',tests:['maree','Luna','Sole','ecliss','allineam','lunaz|ogni']},
  {c:'C4',tests:['ipotes','verific','ripet','non basta|singol|isolat','caus|descriz']}
 ],
 procedura:[
  {c:'C1',tests:['2024','12|dodici','titolo','dieci|10']},
  {c:'C2',tests:['prorog','prenot|riserv','scritt','non|solo|senza']},
  {c:'C3',tests:['prenot|riserv','scaden|restit|reso','lettur|letto|complet|finito']},
  {c:'C4',tests:['registr','chi|student|lettor','giorno|data|quando','opinion','non|senza']}
 ],
 medicina:[
  {c:'C1',tests:['diaframma','inspir','espir','contr|rilass']},
  {c:'C2',tests:['alveol','ossigeno','anidride carbonica','sangu']},
  {c:'C3',tests:['emoglob','ossigeno','sforzo|attivit|esercizio','respira']},
  {c:'C4',tests:['medic|diagnos','sintom','storia|anamnesi','singol|isolat|solo|basta']}
 ],
 concetto_sbilanciato:[
  {c:'C1',tests:['font|document|testimoni|cronac','confront','interess|punto di vista|divers','fatti|opinioni|incert']},
  {c:'C2',tests:['fonte primaria','periodo|epoca|contempor']},
  {c:'C3',tests:['fonte secondaria','interpret']},
  {c:'C4',tests:['ipotes','fatti|document']}
 ],
 pagina_breve_continua:[
  {c:'C1',tests:['termine perentorio','15|quindici','notifica','osservaz']},
  {c:'C2',tests:['perd|decad|impossibil','deposit','motivaz|ragion|giustific']}
 ]
 }[id]||[];
}
function semanticFlags(source,sections){
 if(!Array.isArray(sections))return ['INVALID_SECTIONS'];
 const missing=[];
 for(const rubric of getRubric(source.id)){
  const text=String(sections.find(s=>s.id===rubric.c)?.text||'');
  for(const pat of rubric.tests)if(!new RegExp(pat,'iu').test(text))missing.push(rubric.c+':'+pat);
 }
 return missing;
}
function planPrompt(src,p){
 const parts=[
  'StudyBook AI | LAB89 | PRIMA E UNICA GENERAZIONE DI QUESTA VERSIONE DELLA PAGINA.',
  'Questo testo e stato compreso e diviso in concetti nella lettura iniziale. Devi RISCRIVERE ogni concetto SENZA SPOSTARE FATTI TRA LE SEZIONI. Non aggiungere nozioni da pagine diverse.',
  'GRIGLIA NON MODIFICABILE: larghezza di esattamente 60 posizioni a caratteri monospaziati. Ogni concetto ha un numero MASSIMO di righe assegnato PRIMA della scrittura. Non puoi allungare una riga, aggiungere righe a un concetto, ridurre dimensione caratteri, tagliare parole, spezzare parole con trattini o usare grafie errate. NON INSERIRE A CAPO: genera ogni sezione come un unico paragrafo con spazi normali; il programma dispone automaticamente le parole in righe di massimo 60 posizioni.',
  'Non fissiamo un numero di parole per riga. La misurazione empirica di 500 righe italiane indica circa 46,346 lettere alfabetiche e 11,502 spazi per riga, con punteggiatura/cifre residue. La griglia e il conteggio reale vengono verificati matematicamente dal programma.',
  'Le condizioni, cifre, eccezioni, negazioni, definizioni, terminologia specialistica, cause ed effetti non possono sparire. Non inserire testo di riempimento. Se non entra, preserva la correttezza: il programma segnala il vincolo non soddisfatto invece di pubblicare un testo scorretto.',
  'La semplificazione deve aumentare gradualmente da 10% a Riassunto 65%: 10/20% mantengono tutti i termini tecnici importanti, dal 30% usa parole piu semplici con i termini indispensabili e spiegazioni. Anche il 10% deve essere comprensibile. «In parole semplici» e una FUNZIONE SEPARATA e NON devi generarla.',
  'Questa pagina deve contenere esattamente '+p.segments.length+' concetti e al massimo '+p.maxRows+' righe complessive.',
  'RIDUZIONE RICHIESTA: '+p.reduction+'%; '+(p.short?'pagina originale breve, fino a 5 righe: la percentuale e libera, ma la semplificazione e obbligatoria e i concetti rimangono tutti':'testo originale '+p.totalLetters+' lettere; obiettivo circa '+p.desired+' lettere; banda ammessa '+p.reductionBand.minLetters+'-'+p.reductionBand.maxLetters+' lettere alfabetiche totali, escluse cifre, spazi e punteggiatura.'),
  'PIANO PREVENTIVO CONCETTI E RIGHE (il limite per concetto e OBBLIGATORIO):'
 ];
 p.segments.forEach(s=>{
  parts.push(s.id+' | SPAZIO MASSIMO '+s.maxRows+' RIGHE x 60 caratteri, circa '+s.estimatedLettersCapacity+' lettere di capacita statistica; '+(s.suggestedLetters===null?'percentuale libera':'obiettivo indicativo di '+s.suggestedLetters+' lettere per questa sezione')+'.');
  parts.push('Fonte del concetto '+s.id+': '+s.source);
  parts.push('Informazioni obbligatorie di '+s.id+': '+s.keyPoints.join('; ')+'.');
 });
 if(src.contextOnly)parts.push('CONTESTO PAGINE VICINE SOLO PER COMPRENDERE, ASSOLUTAMENTE VIETATO COPIARLO NEL TESTO: PRIMA '+src.contextOnly.before+' DOPO '+src.contextOnly.after);
 parts.push('RISPOSTA: JSON valido con {"sections":[{"id":"C1","text":"testo unico senza a capo"},{"id":"C2","text":"..."}]}. Ci devono essere esattamente C1..C'+p.segments.length+' nell ordine. No commenti, nessun testo al di fuori del JSON. Il programma verifica e rifiuta righe o lettere fuori limite.');
 return parts.join('\n');
}
const order=[
 ['scienze',40],['scienze',65],['scienze',50],['scienze',30],['scienze',20],['scienze',10],
 ['procedura',40],['procedura',65],['procedura',50],['procedura',30],['procedura',20],['procedura',10],
 ['concetto_sbilanciato',40],['concetto_sbilanciato',65],['concetto_sbilanciato',10],
 ['pagina_breve_continua',65],['pagina_breve_continua',10],
 ['medicina',40],['medicina',20],['medicina',50],
 ['medicina',65],['medicina',30],['medicina',10],
 ['concetto_sbilanciato',50],['concetto_sbilanciato',30],['concetto_sbilanciato',20],
 ['pagina_breve_continua',50],['pagina_breve_continua',40],['pagina_breve_continua',30],['pagina_breve_continua',20]
];
if(order.length!==MAX_TESTS)throw Error('bad schedule');
function persist(){
 const summary={attemptedResults:records.length,completedWithText:records.filter(r=>r.textReturned).length,
  feasible:records.filter(r=>r.plan?.feasible).length,
  gridPass:records.filter(r=>r.validation?.gridPass).length,
  bandPass:records.filter(r=>r.validation?.bandPass).length,
  combinedPass:records.filter(r=>r.validation?.combinedPass).length,
  preliminaryQualityPass:records.filter(r=>r.preliminaryQualityPass).length,
  bySource:Object.fromEntries(fixtures.map(s=>[s.id,{
   attempts:records.filter(x=>x.source===s.id).length,
   combinedPass:records.filter(x=>x.source===s.id&&x.validation?.combinedPass).length
  }]))};
 const report={experiment:'StudyBook LAB89 proportional per-concept preallocated rows, real Gemini',date:new Date().toISOString(),
  branch:'audit/studybook-proportional-semantic-grid-v89-20261109',
  model:MODEL,sampleSource:'audit/test-fixtures/lab89-semantic-concepts.json',
  rigor:'First-reading concept grouping provided in fixture, NOT independently generated by Gemini; tests downstream allocation and generation. All percentage, layout and heuristic rubric checks are preliminary until human QA.',
  controls:{productionChanged:false,mainChanged:false,APKChanged:false,onDemandSimpleLanguageCalls:0,providerMaxCalls:MAX_PROVIDER_CALLS,singlePassPerScenario:true},
  provider:{attempts,stop,stopReason},summary,errors,records};
 mkdirSync('audit/reports',{recursive:true});
 writeFileSync(OUT,JSON.stringify(report,null,2)+'\n');
 return report;
}
async function call(source,level){
 const p=allocate(source,level);
 const record={source:source.id,level,plan:p,providerAttemptsForCase:0,textReturned:false,validation:null,preliminaryQualityPass:false,errors:[]};
 if(!p.feasible){record.errors.push('INFEASIBLE_BEFORE_GEMINI');records.push(record);persist();console.log('LAB89_INFEASIBLE',JSON.stringify({source:source.id,level,reason:p.reason,rows:p.maxRows}));return}
 let tries=0;
 while(attempts<MAX_PROVIDER_CALLS&&!stop&&tries<2){
  tries++;attempts++;record.providerAttemptsForCase++;
  const begin=performance.now();
  try{
   const res=await fetch(URL,{method:'POST',headers:{Authorization:'Bearer '+KEY,'Content-Type':'application/json'},
    body:JSON.stringify({model:MODEL,temperature:0.2,max_tokens:3200,response_format:format,
     messages:[{role:'user',content:planPrompt(source,p)}]}),
    signal:AbortSignal.timeout(80000)});
   const ms=Math.round(performance.now()-begin);
   const body=await res.json().catch(()=>({}));
   if(!res.ok){
    const msg=String(body.error?.message||'HTTP '+res.status).slice(0,180);
    const issue={source:source.id,level,status:res.status,attempt:attempts,ms,message:msg};
    errors.push(issue);record.errors.push(issue);
    console.log('LAB89_HTTP_ERROR',JSON.stringify(issue));persist();
    if(res.status===429){stop=true;stopReason='HTTP_429';records.push(record);persist();return}
    if(res.status===503&&tries===1&&attempts<MAX_PROVIDER_CALLS){
     console.log('LAB89_BACKOFF',JSON.stringify({source:source.id,level,ms:3200}));
     await new Promise(r=>setTimeout(r,3200));continue;
    }
    if(res.status===503){stop=true;stopReason='HTTP_503';records.push(record);persist();return}
    records.push(record);persist();return;
   }
   let raw=String(body.choices?.[0]?.message?.content||'').trim();
   if(raw.startsWith('~~~'))raw=raw.replace(/^~~~json\s*/i,'').replace(/\s*~~~$/,'');
   let parsed;try{parsed=JSON.parse(raw)}catch(e){record.errors.push('INVALID_JSON');}
   const sections=parsed?.sections;
   record.textReturned=Array.isArray(sections);
   record.sections=sections||null;
   record.ms=ms;
   record.completionTokens=body.usage?.completion_tokens??null;
   record.validation=validate(source,p,sections);
   record.semanticFlags=semanticFlags(source,sections);
   const explicitTechnicalOK=(record.validation.missingTechnicalTermsAt1020||[]).length===0;
   const rawParagraphOnly=Array.isArray(sections)&&sections.every(s=>!String(s.text).includes('\n'));
   record.preliminaryQualityPass=record.validation.combinedPass&&record.validation.wordIntegrityPass&&
    explicitTechnicalOK&&record.semanticFlags.length===0&&rawParagraphOnly;
   record.checkedRubricHeuristicallyOnly=true;
   records.push(record);
   console.log('LAB89_CASE',JSON.stringify({source:source.id,level,rows:p.segments.map(s=>s.maxRows),
    letters:p.totalLetters,target:p.desired,actual:record.validation.actualLetters,reduction:record.validation.actualReduction,
    grid:record.validation.gridPass,band:record.validation.bandPass,
    preliminary:record.preliminaryQualityPass,flags:record.semanticFlags.length,ms}));
   persist();return;
  }catch(e){
   const issue={source:source.id,level,attempt:attempts,error:String(e?.name||e).slice(0,160)};
   errors.push(issue);record.errors.push(issue);records.push(record);console.log('LAB89_NETWORK_ERROR',JSON.stringify(issue));persist();return;
  }
 }
}
if(!KEY){errors.push({error:'NO_EXISTING_GEMINI_SECRET'});persist();process.exit(1)}
console.log('LAB89_START',JSON.stringify({cases:order.length,maxAttempts:MAX_PROVIDER_CALLS,sources:fixtures.map(x=>x.id),model:MODEL}));
for(const [sourceId,level] of order){
 if(stop||attempts>=MAX_PROVIDER_CALLS||records.length>=MAX_TESTS)break;
 await call(sourceById(sourceId),level);
 if(stop)break;
 await sleep(800);
}
const report=persist();
console.log('LAB89_FINAL',JSON.stringify({provider:report.provider,summary:report.summary,errorCount:errors.length}));
if(stop||errors.length||records.filter(x=>x.textReturned).length===0)process.exitCode=1;
