// MotorLab StudyBook LAB85: isolated real Gemini six-level virtual-line experiment.
// Uses existing Gemini credential, bounded requests. Never touches production/app/Android files.
import {mkdirSync,writeFileSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
const KEY=process.env.AI_TEST_KEY||'';
const MODEL='gemini-3.5-flash-lite';
const URL='https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
const OUTPUT='audit/reports/lab85-six-levels-real-gemini.json';
const CAL={width:60,normalSpaces:7.844,extraSpaces:3.658,allSpaces:11.502,lettersPerLine:46.346,punctuation:1.966,digits:0.186};
const LEVELS=[
 {name:'Riassunto finale',reduction:65,style:'Elenca in forma discorsiva solo i concetti minimi, ma preserva cause, eccezioni e definizioni realmente indispensabili.'},
 {name:'50%',reduction:50,style:'Usa una sintesi compatta, spiegazioni semplici e conserva i termini specialistici che non possono essere rimpiazzati.'},
 {name:'40%',reduction:40,style:'Preferisci frasi comprensibili, spiega in poche parole il gergo non essenziale, preserva i vocaboli di settore obbligatori.'},
 {name:'30%',reduction:30,style:'Inizia a usare parole meno tecniche dove possibile, ma spiega e conserva i termini cruciali alla prima comparsa.'},
 {name:'20%',reduction:20,style:'Conserva esattamente la terminologia disciplinare fondamentale, chiarendola brevemente quando opportuno.'},
 {name:'10%',reduction:10,style:'Conserva esattamente tutti i vocaboli specialistici importanti; rendi più semplice la sintassi e rimuovi ripetizioni, non perdere dettagli.'}
];
const TEXTS=[
 {id:'procedura',kind:'istruzioni scolastiche giuridiche',parts:[
 'In un esercizio scolastico del 2024, una biblioteca simulata ha introdotto una procedura per richiedere i libri.',
 'La regola interna numero 12 prevede che lo studente registri il titolo prima del prestito e confermi la restituzione entro dieci giorni.',
 'Il personale può concedere una proroga soltanto se il volume non è stato prenotato da altri studenti.',
 'La proroga non è automatica: senza conferma scritta resta valida la data iniziale.',
 'Quando un libro è già riservato, lo studente deve restituirlo alla scadenza anche se non ha completato la lettura.',
 'Il registro consente di ricostruire chi ha ricevuto il libro e in quale giorno, ma non contiene dati sulle opinioni personali dei lettori.',
 'Le condizioni e le eccezioni sono essenziali per applicare correttamente la procedura.'],
   importantTerms:['proroga','scadenza'],prevContext:'',nextContext:''},
 {id:'scienze',kind:'scienze e metodo scientifico',parts:[
 'La Terra ruota attorno al proprio asse. La rotazione causa il giorno e la notte, perché una parte della superficie riceve luce solare mentre l’altra rimane al buio.',
 'La rivoluzione attorno al Sole dura circa un anno. Le stagioni dipendono soprattutto dall’inclinazione dell’asse terrestre, non dalla distanza tra la Terra e il Sole.',
 'La Luna influisce sulle maree insieme al Sole. Le eclissi richiedono un allineamento particolare e non avvengono a ogni lunazione.',
 'Il metodo scientifico richiede ipotesi verificabili e osservazioni ripetibili. Un risultato isolato non basta per dimostrare una spiegazione.',
 'Per comprendere il fenomeno bisogna distinguere fra descrizione del movimento e cause delle variazioni osservate.'],
   importantTerms:['inclinazione','maree','eclissi'],prevContext:'',nextContext:''},
 {id:'pagina_breve_continua',kind:'testo legale breve in continuita di articolo',parts:[
 'Il termine perentorio per depositare le osservazioni è di 15 giorni dalla notifica. Se scade, la parte perde la possibilità di depositarle; resta però il diritto di conoscere la motivazione.'],
   importantTerms:['termine perentorio','notifica'],
   prevContext:'La procedura comincia con una fase istruttoria dedicata alla richiesta di accesso agli atti.',
   nextContext:'La motivazione viene poi comunicata con le modalità organizzative stabilite dall’ufficio.'}
];
const MAX_TESTS=18, MAX_ATTEMPTS=19;
const letterCount=s=>(String(s||'').normalize('NFC').match(/\p{L}/gu)||[]).length;
const onlyDigits=s=>(String(s||'').match(/\b\d+(?:[.,]\d+)*\b/g)||[]);
const textOf=s=>s.parts.join(' ');
function wrap(s,max=60){
 const words=String(s||'').replace(/\s+/g,' ').trim().split(' ').filter(Boolean);
 const rows=[];let row='';
 for(const word of words){
  const cand=row?row+' '+word:word;
  if(cand.length>max&&row){rows.push(row);row=word}else row=cand;
 }
 if(row)rows.push(row);
 return rows;
}
function target(source,level){
 const original=letterCount(textOf(source)),short=wrap(textOf(source),60).length<=5;
 return {original,sourceRows:wrap(textOf(source),60).length,short,
  reduction:level.reduction,desired:Math.round(original*(1-level.reduction/100)),
  minimum:Math.ceil(original*(1-(level.reduction+5)/100)),
  maximum:Math.floor(original*(1-(level.reduction-5)/100)),
  targetRows:Math.max(1,Math.round((original*(1-level.reduction/100))/CAL.lettersPerLine))};
}
const jsonFormat={type:'json_schema',json_schema:{name:'lab85_six_levels',strict:true,schema:{
 type:'object',additionalProperties:false,properties:{text:{type:'string'}},required:['text']}}};
const governance='Riscrivi fedelmente in italiano. Devi SEMPRE rendere le frasi più comprensibili dove serve, ma NON inventare fatti, NON alterare negazioni, cifre, date, definizioni, condizioni e nessi causali. Tutti i concetti essenziali rimangono anche nel riassunto. Non aggiungere parole di riempimento per raggiungere una misura. Non tagliare parole, evita frasi incomplete. Nessun titolo e nessun marcatore. Il testo dato come contesto è di SOLA LETTURA; NON copiare, anticipare o spostare sul segmento della pagina corrente informazioni di pagine adiacenti.';
function prompt(s,level,t){
 let p=governance+'\nMateria: '+s.kind+'. Versione: '+level.name+' (riduzione orientativa '+level.reduction+'%).\n' +level.style;
 p+='\nFONTE DELLA SOLA PAGINA DA RISCRIVERE:\n'+textOf(s);
 if(s.prevContext||s.nextContext)p+='\nCONTESTO di sola lettura delle pagine vicine, utile soltanto per capire il ragionamento; NON includerne contenuto nel testo da generare: PRECEDENTE: '+s.prevContext+'; SUCCESSIVA: '+s.nextContext;
 p+='\nCALIBRAZIONE MISURATA su 500 righe italiane: una riga virtuale occupa 60 caratteri, con 11,502 spazi totali (7,844 normali e 3,658 per uniformare), 1,966 segni, 0,186 cifre, 46,346 lettere alfabetiche. Conta solo i caratteri alfabetici Unicode e non gli spazi.';
 p+='\nQuesta pagina ha '+t.original+' lettere e '+t.sourceRows+' righe virtuali originali.';
 if(t.short){
  p+='\nPAGINA BREVE DA 1 A 5 RIGHE: ECCEZIONE. Semplifica comunque il linguaggio secondo la versione richiesta, ma NON forzare la percentuale. Puoi mantenere quasi tutto se imprescindibile. Non inserire il contenuto delle pagine adiacenti.';
 }else{
  p+='\nOBIETTIVO DELLA PAGINA: circa '+t.desired+' lettere alfabetiche, corrispondenti a circa '+t.targetRows+' righe virtuali da 60 caratteri, con '+CAL.allSpaces+' spazi previsti per riga. Riduzione ammessa: da '+(level.reduction-5)+'% a '+(level.reduction+5)+'%, cioe testo finale fra '+t.minimum+' e '+t.maximum+' lettere. Evita righe troppo corte. La correttezza dei contenuti prevale sul conteggio.';
 }
 p+='\nScrivi un TESTO NATURALE con spazi normali, senza spazi artificiali o lettere incollate. L’app distribuirà poi le parole in righe da 60 caratteri senza spezzarle. Non fare più versioni in questa richiesta; rispondi solo con JSON {"text":"..."}.';
 return p;
}
let attempts=0,stopped=false,stoppedReason='',callsFinished=0;
const records=[],errors=[];
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function persist(){
 const stats={};
 for(const s of TEXTS){
  const r=records.filter(x=>x.source===s.id);
  stats[s.id]={completed:r.length,shortPage:wrap(textOf(s),60).length<=5,
   acceptedByNumericRule:r.filter(x=>x.numericAccepted).length,
   inBand:r.filter(x=>x.inBand).length,
   exactTechnical10and20:r.filter(x=>[10,20].includes(x.level)&&x.termsMissing.length===0).length,
   totalOutputTokens:r.reduce((a,v)=>a+(v.tokens||0),0),totalProviderMs:r.reduce((a,v)=>a+v.ms,0)};
 }
 const report={name:'MotorLab StudyBook AI LAB85 real Gemini six levels with calibrated virtual lines',date:new Date().toISOString(),
  gitBranch:'audit/studybook-six-levels-lines-v85-20261109',
  model:MODEL,methods:'one pass per reduction and page; 60 character virtual rows, averages from LAB84; no extra simple-language calls',
  calibration:CAL,limits:{maxTests:MAX_TESTS,maxProviderAttempts:MAX_ATTEMPTS,completedProviderAttempts:attempts},
  requestedLevels:LEVELS.map(v=>v.reduction),sources:TEXTS.map(s=>({id:s.id,category:s.kind,source:textOf(s),sourceLetters:letterCount(textOf(s)),sourceRows:wrap(textOf(s),60).length,importantTerms:s.importantTerms,contextOnly:{prev:s.prevContext,next:s.nextContext}})),
  requestedReductionRange:'±5 percentage points for original source pages over 5 virtual lines; 1-5 rows exempt but clarity required',
  note:'Numeric passage alone does not certify semantic fidelity, technical correctness, or educational usefulness. Page continuity flags are heuristic; human QA required.',
  controls:{onDemandSimpleLanguageCalls:0,onDemandNotGeneratedAutomatically:true,productionChanged:false,androidChanged:false,freeQuotaWithoutPaidUpgrades:true},
  provider:{attempts,stopped,stoppedReason},summary:stats,records,errors};
 mkdirSync('audit/reports',{recursive:true});writeFileSync(OUTPUT,JSON.stringify(report,null,2)+'\n');return report;
}
async function ask(source,level){
 const t=target(source,level);let finalStatus=null;
 for(let retry=0;retry<2;retry++){
  if(attempts>=MAX_ATTEMPTS||stopped)return null;
  attempts++;const start=performance.now();
  try{
   const res=await fetch(URL,{method:'POST',headers:{Authorization:'Bearer '+KEY,'Content-Type':'application/json'},
    body:JSON.stringify({model:MODEL,temperature:0.15,max_tokens:3100,response_format:jsonFormat,
     messages:[{role:'user',content:prompt(source,level,t)}]}),signal:AbortSignal.timeout(80000)});
   const ms=Math.round(performance.now()-start);
   const json=await res.json().catch(()=>({}));
   if(!res.ok){
    const msg=String(json.error?.message||'HTTP '+res.status).slice(0,180);
    const issue={source:source.id,level:level.reduction,attempt:attempts,status:res.status,message:msg,ms};
    errors.push(issue);finalStatus=res.status;
    console.log('LAB85_PROVIDER_ERROR',JSON.stringify(issue));persist();
    if(res.status===503&&retry===0&&attempts<MAX_ATTEMPTS){
     console.log('LAB85_BACKOFF',JSON.stringify({ms:3000,reason:'one retry only after transient 503'}));
     await sleep(3000);continue;
    }
    if(res.status===429||res.status===503||/quota|billing|resource.exhausted|rate.limit/i.test(msg)){
     stopped=true;stoppedReason='HTTP_'+res.status;
    }
    return null;
   }
   let raw=String(json.choices?.[0]?.message?.content||'').trim();
   const fence=String.fromCharCode(96).repeat(3);
   if(raw.startsWith(fence))raw=raw.replace(new RegExp('^'+fence+'(?:json)?\\s*','i'),'').replace(new RegExp('\\s*'+fence+'$'),'');
   let obj;try{obj=JSON.parse(raw)}catch{obj=null}
   if(!obj||typeof obj.text!=='string'||!obj.text.trim()){
    errors.push({source:source.id,level:level.reduction,attempt:attempts,error:'INVALID_JSON_OR_EMPTY'});persist();return null;
   }
   const content=obj.text.trim(),count=letterCount(content),rows=wrap(content,60);
   const actual=100*(1-count/t.original),inBand=count>=t.minimum&&count<=t.maximum;
   const missingNums=onlyDigits(textOf(source)).filter(v=>!onlyDigits(content).includes(v));
   const termsMissing=source.importantTerms.filter(term=>!content.toLocaleLowerCase('it').includes(term.toLocaleLowerCase('it')));
   const leaks=[...source.prevContext.matchAll(/fase istruttoria|accesso agli atti/gi),...source.nextContext.matchAll(/modalità organizzative/gi)].map(m=>m[0]).filter(x=>content.toLocaleLowerCase('it').includes(x.toLocaleLowerCase('it')));
   const rowLength=rows.map(x=>x.length);
   const result={source:source.id,level:level.reduction,label:level.name,shortPage:t.short,
    originalLetters:t.original,originalRows:t.sourceRows,targetLetters:t.desired,targetRows:t.targetRows,
    minLetters:t.minimum,maxLetters:t.maximum,actualLetters:count,actualReductionPct:+actual.toFixed(2),
    errorPoints:+(actual-level.reduction).toFixed(2),inBand,
    numericAccepted:(t.short||inBand)&&missingNums.length===0,
    rowCount:rows.length,averageRowSlots:+(rowLength.reduce((a,b)=>a+b,0)/rows.length).toFixed(2),
    lineWidthMax:Math.max(...rowLength),shortLastLine:rows.at(-1)?.length<60,
    missingNumbers:missingNums,termsMissing,contextLeakSignals:leaks,
    ms,tokens:json.usage?.completion_tokens??null,text:content,virtualRows:rows};
   records.push(result);callsFinished++;
   console.log('LAB85_RESULT',JSON.stringify({source:source.id,level:level.reduction,shortPage:t.short,actualReductionPct:result.actualReductionPct,accepted:result.numericAccepted,missingNums:missingNums.length,termsMissing:termsMissing.length,rows:rows.length,ms}));
   persist();return result;
  }catch(e){
   errors.push({source:source.id,level:level.reduction,attempt:attempts,error:String(e?.name||'NETWORK')});
   persist();return null;
  }
 }
 return null;
}
if(!KEY){errors.push({error:'MISSING_EXISTING_GEMINI_KEY'});persist();process.exit(1)}
console.log('LAB85_START',JSON.stringify({model:MODEL,levels:LEVELS.map(l=>l.reduction),sources:TEXTS.map(s=>s.id),maxTests:MAX_TESTS,maxAttempts:MAX_ATTEMPTS}));
for(const source of TEXTS){
 for(const level of LEVELS){
  if(stopped||records.length>=MAX_TESTS||attempts>=MAX_ATTEMPTS)break;
  await ask(source,level);
  if(stopped)break;
  await sleep(750);
 }
 if(stopped||attempts>=MAX_ATTEMPTS)break;
}
const final=persist();console.log('LAB85_FINAL',JSON.stringify({attempts,completed:records.length,stopped,stoppedReason,summary:final.summary,errors:errors.length}));
if(stopped||errors.length||records.length===0)process.exitCode=1;
