import {writeFileSync,mkdirSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
const key=process.env.AI_TEST_KEY||'',model='gemini-3.5-flash-lite';
const endpoint='https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
const out='audit/reports/lab80-container-real-gemini.json',levels=[10,30,50],MAX=12;
const inputs=[
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
 'Le condizioni e le eccezioni sono essenziali per applicare correttamente la procedura.']}];
const letters=x=>(String(x||'').normalize('NFC').match(/\p{L}/gu)||[]).length;
const numbers=x=>(String(x||'').match(/\b\d+(?:[.,]\d+)*\b/g)||[]);
const budget=(n,r)=>({n,r,target:Math.round(n*(100-r)/100),min:Math.ceil(n*(98-r)/100),max:Math.floor(n*(102-r)/100)});
const base='Rielabora il testo in italiano naturale mantenendo tutti i concetti, i nessi causali, le condizioni, le eccezioni, i numeri e le negazioni. Non inventare dati o aggiungere riempitivi. Conta come lettere solo i caratteri Unicode alfabetici, senza spazi né punteggiatura. La verifica avverrà solo DOPO la creazione.';
function prompt(item,b,mode){
 const src=item.parts.map((s,i)=>'C'+(i+1)+': '+s).join('\n');
 const common=base+'\nOriginale '+b.n+' lettere. Riduzione '+b.r+'%, obiettivo '+b.target+' lettere, fascia da '+b.min+' a '+b.max+'.\n'+src;
 return mode==='direct'
 ?common+'\nScrivi un testo unico di studio fluido. Mantieni tutti i punti. Rispondi SOLO con JSON {"text":"..."}.'
 :common+'\nPer ognuno dei '+item.parts.length+' concetti scrivi ESATTAMENTE tre alternative di lunghezza diversa: 1 quasi completa, 2 intermedia, 3 più compatta. OGNI alternativa deve conservare il significato e tutte le informazioni importanti di quel concetto. Non scegliere la combinazione finale: lo farà un algoritmo. Rispondi SOLO JSON {"variants":[{"id":"C1","options":["...","...","..."]},...]}.';
}
const schema=mode=>mode==='direct'?{type:'json_schema',json_schema:{name:'lab80direct',strict:true,schema:{type:'object',additionalProperties:false,properties:{text:{type:'string'}},required:['text']}}}:{type:'json_schema',json_schema:{name:'lab80variants',strict:true,schema:{type:'object',additionalProperties:false,properties:{variants:{type:'array',items:{type:'object',additionalProperties:false,properties:{id:{type:'string'},options:{type:'array',items:{type:'string'}}},required:['id','options']}}},required:['variants']}}};
function solve(vars,b,parts){
 if(!Array.isArray(vars)||vars.length!==parts.length)return null;
 let combos=[{texts:[],choice:[],len:0}];
 for(let i=0;i<vars.length;i++){
  if(vars[i]?.id!=='C'+(i+1)||!Array.isArray(vars[i].options)||vars[i].options.length!==3)return null;
  const needed=numbers(parts[i]),next=[];
  for(const prev of combos)for(let j=0;j<3;j++){
   const v=vars[i].options[j];
   if(typeof v!=='string'||v.trim().length<4||needed.some(n=>!numbers(v).includes(n)))continue;
   next.push({texts:[...prev.texts,v],choice:[...prev.choice,j],len:prev.len+letters(v)});
  }
  combos=next;
  if(!combos.length)return null;
 }
 return combos.filter(x=>x.len>=b.min&&x.len<=b.max).sort((x,y)=>Math.abs(x.len-b.target)-Math.abs(y.len-b.target))[0]||null;
}
let calls=0,quota=false;
const records=[],errors=[];
function save(){
 const pairs=[];
 for(const item of inputs)for(const level of levels){
  const direct=records.find(x=>x.item===item.name&&x.level===level&&x.mode==='direct');
  const container=records.find(x=>x.item===item.name&&x.level===level&&x.mode==='container');
  if(direct&&container)pairs.push({item:item.name,level,direct,container});
 }
 const aggregate=mode=>{
  const rows=pairs.map(x=>x[mode]);
  return {pairs:rows.length,within:rows.filter(x=>x.within).length,
   meanErrorLetters:rows.length?Math.round(rows.reduce((a,x)=>a+Math.abs(x.len-x.b.target),0)*100/rows.length)/100:null,
   meanAiMs:rows.length?Math.round(rows.reduce((a,x)=>a+x.ms,0)/rows.length):null,
   meanOutputTokens:rows.length?Math.round(rows.reduce((a,x)=>a+(x.tokens||0),0)/rows.length):null};
 };
 const report={title:'StudyBook LAB80 direct vs elastic container real Gemini QA',at:new Date().toISOString(),model,
  freeQuotaMode:true,maxCalls:MAX,calls,quotaStopped:quota,expectedPairs:6,pairs:pairs.length,
  policy:'±2 percentage points; Unicode NFC letters; separate post-generation numeric check',
  source:'two synthetic samples from LAB79',appChanged:false,productionChanged:false,
  semanticLimit:'Numbers audited heuristically, full semantic fidelity requires independent expert review',
  summary:{direct:aggregate('direct'),container:aggregate('container')},
  negativeTest:{impossibleContainerCorrectlyRejected:solve([{id:'C1',options:['ciao','ciao','ciao']}],{min:100,max:110,target:105},['ciao'])===null},
  records,errors};
 mkdirSync('audit/reports',{recursive:true});writeFileSync(out,JSON.stringify(report,null,2)+'\n');return report;
}
async function call(item,level,mode){
 const source=item.parts.join(' '),b=budget(letters(source),level),start=performance.now();
 calls++;
 try{
  const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+key},
   body:JSON.stringify({model,temperature:0.2,max_tokens:5000,response_format:schema(mode),
    messages:[{role:'user',content:prompt(item,b,mode)}]}),signal:AbortSignal.timeout(85000)});
  const ms=Math.round(performance.now()-start),json=await r.json().catch(()=>({}));
  if(!r.ok){
   const msg=String(json.error?.message||'HTTP '+r.status).slice(0,190);
   if(r.status===429||r.status===503||/quota|resource.exhausted|rate limit/i.test(msg))quota=true;
   const e={item:item.name,level,mode,ok:false,http:r.status,error:msg,ms};errors.push(e);return e;
  }
  let raw=String(json.choices?.[0]?.message?.content||'').trim();
  const fence=String.fromCharCode(96).repeat(3);
  if(raw.startsWith(fence))raw=raw.replace(new RegExp('^'+fence+'(?:json)?\\s*','i'),'').replace(new RegExp('\\s*'+fence+'$'),'');
  let obj;try{obj=JSON.parse(raw)}catch{obj=null}
  if(!obj){const e={item:item.name,level,mode,ok:false,error:'INVALID_JSON',ms};errors.push(e);return e}
  let text='',choice=null,solverMs=0;
  if(mode==='direct')text=typeof obj.text==='string'?obj.text:'';
  else{const t=performance.now();choice=solve(obj.variants,b,item.parts);solverMs=Math.round((performance.now()-t)*1000)/1000;if(choice)text=choice.texts.join(' ')}
  const len=letters(text),missing=numbers(source).filter(x=>!numbers(text).includes(x));
  return {item:item.name,level,mode,ok:true,b,len,within:!!text&&len>=b.min&&len<=b.max,
   feasible:!!text,ms,solverMs,tokens:json.usage?.completion_tokens||null,missingNumbers:missing,
   chosen:choice?.choice||null,text,variants:mode==='container'?obj.variants:null};
 }catch(e){const err={item:item.name,level,mode,ok:false,error:String(e.name||'NETWORK'),ms:Math.round(performance.now()-start)};errors.push(err);return err}
}
if(!key){errors.push({error:'MISSING_SECRET',calls:0});save();process.exit(1)}
for(let i=0;i<levels.length*inputs.length;i++){
 if(quota||calls>=MAX)break;
 const level=levels[Math.floor(i/inputs.length)],item=inputs[i%inputs.length];
 const order=i%2===0?['direct','container']:['container','direct'];
 for(const mode of order){
  if(quota||calls>=MAX)break;
  const x=await call(item,level,mode);
  if(x.ok)records.push(x);
  console.log('LAB80_CASE',JSON.stringify({item:item.name,level,mode,ok:x.ok,len:x.len??null,within:x.within??null,feasible:x.feasible??null,error:x.error??null,ms:x.ms}));
  save();
 }
}
const result=save();
console.log('LAB80_FINAL',JSON.stringify({calls,quotaStopped:quota,paired:result.pairs,summary:result.summary,errors:errors.length}));
if(result.pairs===0||quota||errors.length)process.exitCode=1;