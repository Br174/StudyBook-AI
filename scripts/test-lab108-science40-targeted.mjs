// StudyBook LAB108: ONLY the remaining science/40% failure from the primary
// experiment. Two distinct one-dispatch experimental prompts; no production retries.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {studyLetters} from '../src/lib/studyPillarV38.js';
import {sourceLetterBudgetV74} from '../src/lib/studyPageBudgetsV74.js';
import {virtualRowsV106} from '../src/lib/studySingleCallGateV106.js';
import {classifyMeasuredResultV107} from '../src/lib/studyInverseCalibrationV107.js';
import {semanticGuard} from './lab98-modal-semantic-guard.mjs';

const KEY=process.env.AI_TEST_KEY||'',MODEL='gemini-3.5-flash-lite';
const API='https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
const PATH='audit/reports/lab108-science40-targeted.json';
const fixture=JSON.parse(readFileSync('audit/test-fixtures/lab89-semantic-concepts.json','utf8')).sources.find(s=>s.id==='scienze');
const source=fixture.concepts.join(' ').replace(/\s+/gu,' ').trim();
const original=JSON.parse(readFileSync('audit/reports/lab108-real-source-preserving.json','utf8')).results.find(x=>x.id==='scienze'&&x.level==='40'&&x.arm==='COPY_EDIT');
const budget=sourceLetterBudgetV74(studyLetters(source),'40');
const maxRows=Math.ceil(budget.targetLetters/46.346);
const schema={type:'json_schema',json_schema:{name:'studybook_lab108_sci40',strict:true,
 schema:{type:'object',additionalProperties:false,properties:{text:{type:'string'}},required:['text']}}};
const common=[
 'Rielabora UNA pagina di Studio in italiano, senza aggiungere fatti. Output ESCLUSIVAMENTE JSON {"text":"..."} con un solo paragrafo.',
 'Riduzione alfabetica DEL 40%, cioè circa '+budget.targetLetters+' lettere DA CONSERVARE, minimo '+budget.minLetters+' e massimo '+budget.maxLetters+' delle '+budget.originalLetters+' lettere originali. Escludi spazi, cifre e punteggiatura.',
 'Il layout è fissato PRIMA: massimo '+maxRows+' righe da 60 caratteri; parole intere, nessun cambio font e nessun trasferimento di concetti su altra pagina.',
 'Conserva tutti i fatti essenziali, specialmente "non a ogni lunazione", "Luna e Sole influiscono sulle maree", "un risultato isolato non dimostra una spiegazione", e la distinzione tra descrizione del movimento e causa delle variazioni.',
 'Non trasformare l’influenza in causalità, non annullare negazioni, non inventare. Non riempire righe con parole inutili: se non è possibile non simulare conformità.'
].join('\n\n');
const cases=[
 {arm:'SOURCE_SHORT_FIDELITY',prompt:common+'\n\nNon correggere la precedente bozza. Riscrivi direttamente dall’ORIGINALE conservando tutti i concetti e usando frasi più concise, senza perdite.\n\nTESTO ORIGINALE:\n'+source},
 {arm:'SOURCE_GROUNDED_REPAIR',prompt:common+'\n\nUna bozza precedente era lunga '+original.outputLetters+' lettere e '+original.rows+' righe, fuori limite. Inoltre mancavano negazione sulle eclissi e il Sole accanto alla Luna: usa SEMPRE la fonte originale per correggere questi errori e riscrivere integralmente nel budget, senza inventare.\n\nTESTO ORIGINALE:\n'+source+'\n\nBOZZA ERRATA NON AUTOREVOLE:\n'+original.outputText}
];
const report={lab:'LAB108 narrow final science40 trial',date:new Date().toISOString(),
 model:MODEL,source:'scienze',level:'40',
 baseline:{letters:original.outputLetters,reduction:original.achievedReduction,rows:original.rows,cap:original.maxRows},
 planned:2,attempted:0,valid:0,mathGridPass:0,providerStopped:false,
 approvedForApp:false,semanticCertified:false,
 results:[],errors:[]};
function save(){mkdirSync('audit/reports',{recursive:true});writeFileSync(PATH,JSON.stringify(report,null,2)+'\n')}
save();
if(!KEY){report.providerStopped=true;report.errors.push({error:'EXISTING_KEY_UNAVAILABLE'});save();process.exit(2)}
for(const item of cases){
 report.attempted++;
 try{
  const response=await fetch(API,{method:'POST',headers:{Authorization:'Bearer '+KEY,'Content-Type':'application/json'},
   body:JSON.stringify({model:MODEL,temperature:0.1,max_tokens:2000,response_format:schema,messages:[{role:'user',content:item.prompt}]}),
   signal:AbortSignal.timeout(70000)});
  const json=await response.json().catch(()=>({}));
  if(!response.ok){
   report.errors.push({arm:item.arm,http:response.status,reason:String(json.error?.message||'HTTP').slice(0,160)});
   save();if([429,503].includes(response.status)){report.providerStopped=true;break}continue;
  }
  let text='';try{text=String(JSON.parse(String(json.choices?.[0]?.message?.content||'')).text||'').trim()}catch{}
  if(!text){report.errors.push({arm:item.arm,error:'EMPTY_OR_INVALID_JSON'});save();continue}
  const rows=virtualRowsV106(text),n=studyLetters(text),m=classifyMeasuredResultV107({budget,outputLetters:n,
   originalPageRows:virtualRowsV106(source).rows,gridPass:rows.rows<=maxRows&&!rows.overlong,semanticReviewPassed:false});
  let warnings=[];
  try{warnings=semanticGuard('scienze',source,text,{level:40}).alerts||[]}
  catch(e){warnings=[{id:'SEMANTIC_GUARD_UNAVAILABLE',reason:String(e?.message||e)}]}
  report.valid++;
  if(m.quantitativePass&&m.gridPass)report.mathGridPass++;
  report.results.push({arm:item.arm,letters:n,reduction:m.achievedReduction,rows:rows.rows,maxRows,
   numericPass:m.quantitativePass,gridPass:m.gridPass,preliminaryWarnings:warnings,
   approvedForApp:false,semanticCertified:false,outputText:text});
  save();
 }catch(e){report.errors.push({arm:item.arm,error:String(e?.name||e).slice(0,120)});save()}
 await new Promise(resolve=>setTimeout(resolve,650));
}
report.complete=report.attempted===2&&report.valid===2;report.finishedAt=new Date().toISOString();save();
console.log('LAB108_SCIENCE40_FINAL',JSON.stringify({attempted:report.attempted,valid:report.valid,
 pass:report.mathGridPass,errors:report.errors.length,providerStopped:report.providerStopped}));
if(!report.complete)process.exitCode=2;
