// MotorLab LAB87: one-pass, targeted real-Gemini corrections of LAB86 results.
// Isolated audit only. No app change, deployment, paid tier or autofill/truncation.
// Provider limit: <=8 repairs, <=9 HTTP attempts; pause on 429, 503 after one backoff.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
const RAW='audit/reports/lab86-six-levels-real-gemini.json';
const OUT='audit/reports/lab87-targeted-repair-real-gemini.json';
const SRC=JSON.parse(readFileSync(RAW,'utf8'));
const KEY=process.env.AI_TEST_KEY||'';
const MODEL='gemini-3.5-flash-lite';
const URL='https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
const WIDTH=60,MAX_ATTEMPTS=9,MAX_CASES=8;
const ORDER=[
 ['scienze',50],['scienze',10],['scienze',65],['procedura',65],
 ['procedura',40],['procedura',50],['scienze',40],['scienze',30]
];
const NOTE={
 'scienze:50':'Una parola viene spezzata in "dipen-\\ndono" e la frase sulla rivoluzione del Sole e scientificamente sbagliata. La rivoluzione e il moto della Terra intorno al Sole; dura circa un anno. Non confondere il Sole con il movimento.',
 'scienze:10':'Il testo viene ridotto del 20,70% invece del 10%; e da espandere con contenuto fondamentale esistente nella fonte, non con riempitivi. Le maree dipendono dall interazione gravitazionale di Luna e Sole, NON dalla luce solare.',
 'scienze:65':'Il precedente testo occupa 6 righe anziche il massimo di 5 e scende soltanto del 53,59% anziche circa il 65%. Mantieni i concetti indispensabili e la condizione delle eclissi; se non e possibile non inventare e non sacrificare la fedelta.',
 'procedura:65':'Il precedente testo occupa 6 righe anziche 5. Restano indispensabili regola 12, prenotazione/proroga, conferma scritta, scadenza, registro e la restituzione anche se non letto; non puoi inventare o spostare informazioni.',
 'procedura:40':'Omissioni: regola interna numero 12, eccezione della lettura non conclusa, dettagli del registro su chi riceve il volume e il giorno. Mantieni tutti i dettagli fondamentali.',
 'procedura:50':'Omissioni: libro prenotato da restituire pur se non finito di leggere, e registro contenente chi e quando. Conserva numero 12 e conferma scritta.',
 'scienze:40':'Manca apostrofo in "dall asse", e il vincolo che le eclissi non si verificano a ogni lunazione. Mantieni i vocaboli scientifici esatti.',
 'scienze:30':'Rendi esplicita la distinzione fra descrizione del moto e le sue cause. Conserva stagioni/asse/distanza, allineamenti e ripetibilita delle prove.'
};
const scenarios={
 scienze:[
  ['Giorno e notte dalla rotazione',[/rotaz|ruot/,/giorno/,/notte/]],
  ['Rivoluzione della Terra e durata annua',[/rivoluz/,/ann/]],
  ['Stagioni dipendono dall inclinazione dell asse',[/stagion/,/inclin/,/ass/]],
  ['Stagioni non dipendono dalla distanza dal Sole',[/distanza/,/non|anziche|invece/]],
  ['Maree: Luna e Sole',[/maree/,/luna/,/sole/]],
  ['Eclissi con allineamento',[/ecliss/,/allineam/]],
  ['Eclissi non ad ogni lunazione',[/ecliss/,/lunaz|ogni|sempre/]],
  ['Ipotesi verificabili e osservazioni ripetibili',[/ipotes/,/verific/,/ripet/]],
  ['Un singolo risultato non basta',[/risultat|prova|osservaz/,/singol|isolat|unic|non basta/]],
  ['Descrizione del moto diversa dalle cause',[/descriz|moto|movimen/,/caus/]]
 ],
 procedura:[
  ['Anno 2024',[/2024/]],
  ['Biblioteca simulata',[/bibliotec/,/simulat/]],
  ['Regola interna numero 12',[/regol|norm/,/\b12\b|dodici/]],
  ['Registrare titolo prima del prestito',[/titolo/,/prima/]],
  ['Confermare restituzione in dieci giorni',[/restit|reso|riconsegn/,/dieci|\b10\b/,/giorn/]],
  ['Proroga consentita solo senza prenotazione',[/prorog/,/prenot|riserv/,/solo|soltanto|nessun|non/]],
  ['Proroga non automatica; conferma scritta',[/prorog/,/non automat|senza conferma/,/scritt/]],
  ['Libro prenotato: reso anche se non letto',[/prenot|riserv/,/scaden|restit|reso/,/lettur|letto|complet|finito/]],
  ['Registro identifica lettore e data',[/registr/,/chi|student|lettor/,/giorn|data|quando/]],
  ['Non registra opinioni',[/opinioni?/,/non|senza/]]
 ]
};
const normalize=s=>String(s||'').normalize('NFC').toLocaleLowerCase('it');
const alpha=s=>(String(s||'').normalize('NFC').match(/\p{L}/gu)||[]).length;
const wordWrap=s=>{
 const words=String(s||'').replace(/\s+/gu,' ').trim().split(' ').filter(Boolean);
 const rows=[];let row='';let overlong=false;
 for(const w of words){
  if(w.length>WIDTH)overlong=true;
  if(!row){row=w;continue}
  if((row+' '+w).length<=WIDTH){row+=' '+w}else{rows.push(row);row=w}
 }
 if(row)rows.push(row);
 return {rows,overlong};
};
const checks=(source,output)=>{
 const norms=normalize(output);
 return (scenarios[source]||[]).map(([name,rules])=>({
  name,plausible:rules.every(re=>re.test(norms))
 }));
};
const conceptsOf=(source,s)=>checks(source,s).filter(x=>!x.plausible).map(x=>x.name);
const contextWords=/fase istruttoria|accesso agli atti|modalita organizzative|modalità organizzative/iu;
const jsonFormat={type:'json_schema',json_schema:{name:'lab87_repaired_text',strict:true,schema:{
 type:'object',additionalProperties:false,properties:{text:{type:'string'}},required:['text']}}};
let attempts=0,stopped=false,reason='',errors=[];
let records=[];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function persist(){
 const summary={
  candidates:ORDER.length,attemptedCases:records.length,providerAttempts:attempts,
  beforeGridPass:records.filter(x=>x.before.gridPass).length,
  afterGridPass:records.filter(x=>x.after.gridPass).length,
  beforeMathPass:records.filter(x=>x.before.mathPass).length,
  afterMathPass:records.filter(x=>x.after.mathPass).length,
  afterCombined:records.filter(x=>x.after.gridPass&&x.after.mathPass).length,
  afterStrictProvisional:records.filter(x=>x.after.gridPass&&x.after.mathPass&&x.after.wordIntegrityPass&&x.after.heuristicConceptPass&&x.after.noContextLeak).length
 };
 const report={experiment:'LAB87 isolated targeted Gemini correction from LAB86',date:new Date().toISOString(),
  sourceReport:RAW,model:MODEL,grid:'60 monospace cells max, predetermined row cap; no clipping',calibration:{letters:46.346,spaces:11.502,width:60},
  policy:'One correction per case; max one temporary HTTP503 retry (total at most 9 attempts), halt 429/503, no paid plans',
  semantics:'Concept checks are heuristics; manual expert review still required. None of numeric or heuristic passes certify semantic fidelity.',
  controls:{productionChanged:false,APKChanged:false,onDemandSimpleLanguageGenerated:false},
  provider:{attempts,stopped,reason},summary,records,errors};
 mkdirSync('audit/reports',{recursive:true});writeFileSync(OUT,JSON.stringify(report,null,2)+'\n');
 return report;
}
function score(source,old,content){
 const wrap=wordWrap(content);
 const originalLetters=old.originalLetters;
 const count=alpha(content);
 const rawLines=content.split('\n');
 const hasHyphenBreak=/\p{L}-\s*\n\s*\p{L}/u.test(content);
 const apostropheError=/\b(?:dall|l|un|all)\s+(?:asse|inclinazione|eclisse|altra)\b/iu.test(content);
 return {
  letters:count,reduction:+(100*(1-count/originalLetters)).toFixed(2),
  letterBand:[old.minLetters,old.maxLetters],mathPass:count>=old.minLetters&&count<=old.maxLetters,
  maxRows:old.targetRows,rows:wrap.rows.length,wrapPreview:wrap.rows,
  gridPass:wrap.rows.length<=old.targetRows&&!wrap.overlong,
  rawLineCompliant:rawLines.length<=old.targetRows&&rawLines.every(x=>x.length<=WIDTH),
  wordIntegrityPass:!hasHyphenBreak&&!apostropheError,
  hyphenBreak:hasHyphenBreak,apostropheError,
  heuristicMissingConcepts:conceptsOf(source,content),
  heuristicConceptPass:conceptsOf(source,content).length===0,
  contextLeakSignals:contextWords.test(normalize(content)),
  noContextLeak:!contextWords.test(normalize(content))
 };
}
function prompt(source,old,prior,problem){
 const original=SRC.sources.find(x=>x.id===source);
 if(!original)throw new Error('source absent');
 const miss=conceptsOf(source,prior);
 return [
  'StudyBook AI: correggi UNA SOLA VOLTA il testo per una pagina del libro. Non inventare; la fonte originale e la sola autorita. Riporta tutti i contenuti imprescindibili, numeri, condizioni, eccezioni, negazioni e riferimenti. Non riportare contenuti delle pagine vicine.',
  'Il testo prodotto deve essere piu chiaro, coerente con il livello '+old.level+'% di RIDUZIONE. Al 10/20% conserva termini specialistici. Non allungare con riempitivi e non inventare informazioni.',
  'GRIGLIA FISSA E INVIOLABILE: '+old.targetRows+' righe massimo, ciascuna AL MASSIMO 60 caratteri visibili, compresi spazi e segni; griglia monospaziata, font e dimensioni IMMUTABILI. Non aggiungere una riga, non tagliare una parola, non giustificare con spazi aggiuntivi (lo fa il software). Il software RIFIUTERA righe in eccesso.',
  'OBIETTIVO LETTERE ALFABETICHE per la singola pagina: '+old.targetLetters+'; fascia ammessa '+old.minLetters+'-'+old.maxLetters+'. Solo caratteri alfabetici, non spazi, punteggiatura o cifre. Media empirica: 46,346 lettere e 11,502 spazi per riga da 60 posizioni.',
  'Errori da riparare: '+problem,
  'Concetti probabilmente mancanti (elenco automatico da confermare e correggere sulla fonte): '+miss.join('; '),
  'Fonte originale UNICA (solo questo segmento di pagina): '+original.source,
  'Testo precedentemente respinto: '+prior,
  'Riscrivi il testo interamente, non rispondere con spiegazioni. Usa righe separabili da a capo reali solo fra parole intere. Non inserire testo inventato, nessuna parola spezzata con trattino, apostrofi e accenti corretti. Se tutti i vincoli sono incompatibili, salvaguarda la verita e non inventare; la verifica esterna registrera eventuali scostamenti.',
  'Rispondi soltanto JSON {"text":"..."}.'
 ].join('\n\n');
}
async function call(caseItem){
 const [source,level]=caseItem;
 const old=SRC.records.find(x=>x.source===source&&x.level===level);
 if(!old)throw new Error('LAB86 candidate absent '+source+level);
 let attemptInCase=0;
 while(attempts<MAX_ATTEMPTS&&!stopped){
  attempts++;attemptInCase++;const t=performance.now();
  try{
   const response=await fetch(URL,{
    method:'POST',headers:{Authorization:'Bearer '+KEY,'Content-Type':'application/json'},
    body:JSON.stringify({model:MODEL,temperature:0.1,max_tokens:1800,response_format:jsonFormat,
      messages:[{role:'user',content:prompt(source,old,old.text,NOTE[source+':'+level]||'Conserva informazioni e controlla le righe')}]}),
    signal:AbortSignal.timeout(75000)
   });
   const ms=Math.round(performance.now()-t);
   const payload=await response.json().catch(()=>({}));
   if(!response.ok){
    const error={source,level,status:response.status,ms,attempt:attempts,message:String(payload.error?.message||'http error').slice(0,160)};
    errors.push(error);console.log('LAB87_HTTP_ERROR',JSON.stringify(error));persist();
    if(response.status===503&&attemptInCase===1&&attempts<MAX_ATTEMPTS){
     console.log('LAB87_BACKOFF_ONE',JSON.stringify({source,level,ms:3000}));await sleep(3000);continue;
    }
    if(response.status===503||response.status===429||/quota|billing|resource.exhausted/i.test(error.message)){stopped=true;reason='HTTP_'+response.status}
    persist();return;
   }
   let content=String(payload.choices?.[0]?.message?.content||'').trim();
   if(content.startsWith('~~~'))content=content.replace(/^~~~json\s*/i,'').replace(/\s*~~~$/,'');
   let obj;try{obj=JSON.parse(content)}catch{}
   if(typeof obj?.text!=='string'||!obj.text.trim()){
    errors.push({source,level,attempt:attempts,error:'NO_JSON_CONTENT'});persist();return;
   }
   const corrected=obj.text.trim();
   const before=score(source,old,old.text);
   const after=score(source,old,corrected);
   records.push({source,level,label:old.label,providerMs:ms,providerOutputTokens:payload.usage?.completion_tokens??null,
    originalSource:SRC.sources.find(x=>x.id===source)?.source,problem:NOTE[source+':'+level],
    previous:old.text,repaired:corrected,before,after,
    afterProvisionalAccepted:after.gridPass&&after.mathPass&&after.wordIntegrityPass&&after.heuristicConceptPass&&after.noContextLeak});
   console.log('LAB87_CASE',JSON.stringify({source,level,attempts,oldReduction:before.reduction,newReduction:after.reduction,oldRows:before.rows,newRows:after.rows,cap:old.targetRows,gridPass:after.gridPass,mathPass:after.mathPass,wordIntegrity:after.wordIntegrityPass,conceptFlags:after.heuristicMissingConcepts.length,overallProvisional:after.gridPass&&after.mathPass&&after.wordIntegrityPass&&after.heuristicConceptPass}));
   persist();return;
  }catch(e){
   errors.push({source,level,attempt:attempts,error:String(e?.name||e).slice(0,140)});
   persist();return;
  }
 }
}
if(!KEY){errors.push({error:'MISSING_EXISTING_GEMINI_SECRET'});persist();process.exit(1)}
console.log('LAB87_START',JSON.stringify({cases:ORDER.length,maxAttempts:MAX_ATTEMPTS,model:MODEL}));
for(const item of ORDER){
 if(stopped||attempts>=MAX_ATTEMPTS||records.length>=MAX_CASES)break;
 await call(item);
 if(stopped)break;
 await sleep(1100);
}
const end=persist();console.log('LAB87_END',JSON.stringify({provider:end.provider,summary:end.summary,errors:errors.length}));
if(errors.length||stopped||!records.length)process.exitCode=1;
