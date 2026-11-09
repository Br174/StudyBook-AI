// StudyBook AI LAB82: read-only real Gemini benchmark of two virtual-line prompts.
// Isolated GitHub audit branch only. No app deployment, APK, production mutation.
// Bounded free-tier calls: 2 sources x 3 levels x 3 conditions = 18 maximum.
// Stop immediately after 429 or 503. Never retry on errors.
import {writeFileSync,mkdirSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
const key=process.env.AI_TEST_KEY||'';
const model='gemini-3.5-flash-lite';
const endpoint='https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
const path='audit/reports/lab82-virtual-lines-gemini.json';
const MAX=18,ROW_SIZE=50,levels=[10,30,50];
const sources=[
{name:'scienze',parts:[
'La Terra ruota attorno al proprio asse. La rotazione causa il giorno e la notte, perché una parte della superficie riceve luce solare mentre l’altra rimane al buio.',
'La rivoluzione attorno al Sole dura circa un anno. Le stagioni dipendono soprattutto dall’inclinazione dell’asse terrestre, non dalla distanza tra la Terra e il Sole.',
'La Luna influisce sulle maree insieme al Sole. Le eclissi richiedono un allineamento particolare e non avvengono a ogni lunazione.',
'Il metodo scientifico richiede ipotesi verificabili e osservazioni ripetibili. Un risultato isolato non basta per dimostrare una spiegazione.',
'Per comprendere il fenomeno bisogna distinguere fra descrizione del movimento e cause delle variazioni osservate.']},
{name:'procedura',parts:[
'In un esercizio scolastico del 2024, una biblioteca simulata ha introdotto una procedura per richiedere i libri.',
'La regola interna numero 12 prevede che lo studente registri il titolo prima del prestito e confermi la restituzione entro dieci giorni.',
'Il personale può concedere una proroga soltanto se il volume non è stato prenotato da altri studenti.',
'La proroga non è automatica: senza conferma scritta resta valida la data iniziale.',
'Quando un libro è già riservato, lo studente deve restituirlo alla scadenza anche se non ha completato la lettura.',
'Il registro consente di ricostruire chi ha ricevuto il libro e in quale giorno, ma non contiene dati sulle opinioni personali dei lettori.',
'Le condizioni e le eccezioni sono essenziali per applicare correttamente la procedura.']}
];
const count=s=>(String(s||'').normalize('NFC').match(/\p{L}/gu)||[]).length;
const digits=s=>(String(s||'').match(/\b\d+(?:[.,]\d+)*\b/g)||[]);
function budget(source,level){
 const original=count(source.parts.join(' ')),target=Math.round(original*(100-level)/100);
 const min=Math.ceil(original*(98-level)/100),max=Math.floor(original*(102-level)/100);
 const sourceRows=Math.max(1,Math.round(original/ROW_SIZE));
 const targetRows=Math.max(1,Math.round(target/ROW_SIZE));
 return {original,level,target,min,max,sourceRows,targetRows,removedRows:sourceRows-targetRows,averageLettersPerTargetRow: +(target/targetRows).toFixed(2)};
}
const policy='Sei StudyBook AI. Rielabora in italiano naturale e corretto mantenendo tutti i concetti essenziali, le condizioni, le eccezioni, le negazioni, le relazioni di causa ed effetto, i numeri e le date. Non inventare fatti, non allungare con ripetizioni, non eliminare informazioni per obbedire al formato. Se esiste un conflitto, conserva la fedeltà. Le righe sono virtuali: ogni riga rappresenta orientativamente 50 lettere alfabetiche, indipendenti dallo schermo. Usa una vera frase o una proposizione leggibile per riga; non spezzare parole. Rispondi esclusivamente in JSON.';
const responseFormat={type:'json_schema',json_schema:{name:'lab82_virtual_lines',strict:true,schema:{
 type:'object',additionalProperties:false,properties:{text:{type:'string'}},required:['text']}}};
function prompt(source,b,mode){
 const input=source.parts.join(' ');
 const guide=policy+'\nFonte integrale da riassumere:\n'+input+'\nNon aggiungere titoli, elenchi puntati, numeri di riga o marcatori artificiali.';
 if(mode==='target_rows'){
  return guide+'\nPROVA A: SCRIVI IL TESTO FINALE IN ESATTAMENTE '+b.targetRows+' RIGHE DI TESTO (separate da un singolo a capo), ognuna indicativamente lunga 50 lettere alfabetiche. Le righe devono formare un unico testo di studio scorrevole. Conta solo lettere, senza spazi o punteggiatura. Non devi calcolare una percentuale. JSON {"text":"riga uno\\nriga due"} con '+b.targetRows+' righe vere.';
 }
 if(mode==='remove_rows'){
  return guide+'\nPROVA B: IL TESTO ORIGINALE OCCUPA CIRCA '+b.sourceRows+' RIGHE VIRTUALI DI 50 LETTERE. RISCRIVILO ELIMINANDO CIRCA '+b.removedRows+' RIGHE VIRTUALI di ridondanze, conservando tutti i contenuti importanti. Il risultato deve occupare circa '+b.targetRows+' righe virtuali di 50 lettere. Scrivi una riga per riga virtuale, separate da a capo. Non devi calcolare una percentuale. JSON {"text":"riga uno\\nriga due"}.';
 }
 return guide+'\nCONTROLLO: originale '+b.original+' lettere alfabetiche. Riscrivi il testo in circa '+b.target+' lettere; fascia ammessa '+b.min+'-'+b.max+'. Non servono righe virtuali e il testo può essere un singolo paragrafo. JSON {"text":"testo"}.'; 
}
const runs=[],errors=[];let calls=0,stop=false;
function persist(){
 const paired=[];
 for(const s of sources)for(const level of levels){
  const a=runs.find(x=>x.source===s.name&&x.level===level&&x.mode==='target_rows');
  const b=runs.find(x=>x.source===s.name&&x.level===level&&x.mode==='remove_rows');
  const c=runs.find(x=>x.source===s.name&&x.level===level&&x.mode==='letters_control');
  if(a&&b&&c)paired.push({source:s.name,level,targetRows:a,removeRows:b,lettersControl:c});
 }
 const summary={};
 for(const mode of ['target_rows','remove_rows','letters_control']){
  const sample=paired.map(p=>mode==='target_rows'?p.targetRows:mode==='remove_rows'?p.removeRows:p.lettersControl);
  summary[mode]={completePairs:sample.length,withinBand:sample.filter(x=>x.withinBand).length,
   meanAbsErrorLetters:sample.length?+(sample.reduce((x,v)=>x+Math.abs(v.letters-v.budget.target),0)/sample.length).toFixed(2):null,
   meanResponseMs:sample.length?Math.round(sample.reduce((x,v)=>x+v.responseMs,0)/sample.length):null,
   meanOutputTokens:sample.length?Math.round(sample.reduce((x,v)=>x+(v.outputTokens||0),0)/sample.length):null,
   actualRequestedLines:mode==='letters_control'?null:sample.filter(x=>x.lineCount===x.budget.targetRows).length};
 }
 const report={experiment:'LAB82 real Gemini virtual line comparison',
  timestamp:new Date().toISOString(),model,source:'same two synthetic LAB80 pages',
  maxCalls:MAX,calls,stoppedOn429Or503:stop,quotaMayNotBeCauseOf503:true,
  resultsComplete:paired.length===6&&errors.length===0,completedTriples:paired.length,
  lineSizeLetters:ROW_SIZE,counting:'Unicode NFC alphabetic, excludes punctuation, spaces, digits',
  tolerance:'±2 percentage points of original source length',
  warning:'Virtual lines are only prompt guidance; actual text length must be calculated programmatically. Numeric-token checks are heuristics, not full semantic tests.',
  summary,paired,runs,errors,
  offlinePreflight:{sameTargetRowsForBothLineModes:true,formulaVerified:levels.every(r=>sources.every(s=>{const b=budget(s,r);return b.sourceRows-b.removedRows===b.targetRows && b.min<=b.target && b.target<=b.max}))},
  appModified:false,productionModified:false,androidBuild:false};
 mkdirSync('audit/reports',{recursive:true});writeFileSync(path,JSON.stringify(report,null,2)+'\n');
 return report;
}
async function call(source,level,mode){
 const b=budget(source,level),t=performance.now();calls++;
 try{
  const res=await fetch(endpoint,{method:'POST',
   headers:{'Content-Type':'application/json','Authorization':'Bearer '+key},
   body:JSON.stringify({model,temperature:.2,max_tokens:2400,response_format:responseFormat,
    messages:[{role:'user',content:prompt(source,b,mode)}]}),
   signal:AbortSignal.timeout(90000)});
  const responseMs=Math.round(performance.now()-t);
  const data=await res.json().catch(()=>({}));
  if(!res.ok){
   const reason=String(data?.error?.message||'HTTP '+res.status).slice(0,200);
   if(res.status===429||res.status===503||/quota|rate.limit|resource.exhausted|overload/i.test(reason))stop=true;
   const entry={source:source.name,level,mode,status:res.status,reason,responseMs};errors.push(entry);return null;
  }
  let raw=String(data?.choices?.[0]?.message?.content||'').trim();
  const fence=String.fromCharCode(96).repeat(3);
  if(raw.startsWith(fence))raw=raw.replace(new RegExp('^'+fence+'(?:json)?\\s*','i'),'').replace(new RegExp('\\s*'+fence+'$'),'');
  let parsed;try{parsed=JSON.parse(raw)}catch{parsed=null}
  if(!parsed||typeof parsed.text!=='string'||!parsed.text.trim()){
   const entry={source:source.name,level,mode,reason:'INVALID_JSON_OR_EMPTY',responseMs};
   errors.push(entry);return null;
  }
  const output=parsed.text,letters=count(output);
  const lineCount=output.split(/\r?\n/).filter(x=>x.trim()).length;
  const expected=digits(source.parts.join(' ')),seen=digits(output);
  const numericMissing=expected.filter(x=>!seen.includes(x));
  const withinBand=letters>=b.min&&letters<=b.max;
  const item={source:source.name,level,mode,budget:b,letters,lineCount,withinBand,
   actualReduction:+(100*(1-letters/b.original)).toFixed(2),
   letterError:letters-b.target,requestedLineCountMatched:lineCount===b.targetRows,
   lineLengths:output.split(/\r?\n/).filter(x=>x.trim()).map(count),
   numericMissing,outputTokens:data.usage?.completion_tokens??null,responseMs,output};
  runs.push(item);return item;
 }catch(e){
  const item={source:source.name,level,mode,reason:String(e?.name||'NETWORK'),responseMs:Math.round(performance.now()-t)};
  errors.push(item);return null;
 }
}
if(!key){errors.push({reason:'NO_EXISTING_GEMINI_SECRET',calls:0});persist();process.exit(1)}
console.log('LAB82_SETUP',JSON.stringify({model,maxCalls:MAX,sourceCount:sources.length,levels,methods:['target_rows','remove_rows','letters_control'],lineSizeLetters:ROW_SIZE}));
let itemIndex=0;
for(const level of levels)for(const source of sources){
 if(stop||calls>=MAX)break;
 // Rotate condition order to distribute warmup effects evenly.
 const rotation=itemIndex%3,itemModes=['target_rows','remove_rows','letters_control'];
 const ordered=[...itemModes.slice(rotation),...itemModes.slice(0,rotation)];itemIndex++;
 for(const mode of ordered){
  if(stop||calls>=MAX)break;
  const item=await call(source,level,mode);
  console.log('LAB82_CASE',JSON.stringify({source:source.name,level,mode,ok:!!item,letters:item?.letters??null,
   withinBand:item?.withinBand??null,lines:item?.lineCount??null,
   requestedLines:item?.budget.targetRows??null,numericMissing:item?.numericMissing??null}));
  persist();
 }
}
const final=persist();
console.log('LAB82_FINAL',JSON.stringify({calls,stopped:stop,completeTriples:final.completedTriples,
 summary:final.summary,errorCount:errors.length,output:path}));
if(stop||errors.length||final.completedTriples===0)process.exitCode=1;
