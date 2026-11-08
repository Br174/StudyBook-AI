// LAB77 reproducible live comparison: same synthetic source, same free Gemini,
// same per-page reduction bands; 4 numbered methods and unnumbered reference.
// Hard cap 18 provider requests. No real books, no user secrets or text in logs.
import {writeFileSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import {STUDY_DRAFT_PROTOCOL_V74} from '../src/lib/studyDraftProtocolV74.js';
import {pageLetterBudgetsV74} from '../src/lib/studyPageBudgetsV74.js';
import {buildUnitBudgetsV71} from '../src/lib/studyDraftProtocolV71.js';
import {studyLetters} from '../src/lib/studyPillarV38.js';
import {immutableViolationsV67} from '../src/lib/immutableFragmentsV67.js';
import {auditFidelity} from '../src/lib/fidelityEngine.js';
import {alphabeticalLettersV77,stripNumberMarkersV77,markerAuditV77,
 NUMBERING_EXPERIMENT_PROTOCOL_V77} from '../src/lib/studyNumberingExperimentV77.js';

const base=process.env.STUDYBOOK_COUNTING_QA_URL||
 'https://studybook-ai-numbering-qa.brunoverlezza.workers.dev';
const endpoint=base+'/api/editions/bulk/v51';
const MAX_MODEL_CALLS=18;
const sources=[
 {id:'scienze',text:[
  'La Terra ruota attorno al proprio asse. La rotazione causa il giorno e la notte, perché una parte della superficie riceve luce solare mentre l’altra rimane al buio.',
  'La rivoluzione attorno al Sole dura circa un anno. Le stagioni dipendono soprattutto dall’inclinazione dell’asse terrestre, non dalla distanza tra la Terra e il Sole.',
  'La Luna influisce sulle maree insieme al Sole. Le eclissi richiedono un allineamento particolare e non avvengono a ogni lunazione.',
  'Il metodo scientifico richiede ipotesi verificabili e osservazioni ripetibili. Un risultato isolato non basta per dimostrare una spiegazione.',
  'Per comprendere il fenomeno bisogna distinguere fra descrizione del movimento e cause delle variazioni osservate.'
 ].join(' ')},
 {id:'procedura',text:[
  'In un esercizio scolastico del 2024, una biblioteca simulata ha introdotto una procedura per richiedere i libri.',
  'La regola interna numero 12 prevede che lo studente registri il titolo prima del prestito e confermi la restituzione entro dieci giorni.',
  'Il personale può concedere una proroga soltanto se il volume non è stato prenotato da altri studenti.',
  'La proroga non è automatica: senza conferma scritta resta valida la data iniziale.',
  'Quando un libro è già riservato, lo studente deve restituirlo alla scadenza anche se non ha completato la lettura.',
  'Il registro consente di ricostruire chi ha ricevuto il libro e in quale giorno, ma non contiene dati sulle opinioni personali dei lettori.',
  'Le condizioni e le eccezioni sono essenziali per applicare correttamente la procedura.'
 ].join(' ')}
];
const modes=['direct','sentence-up','sentence-down','word-down','letter-up'];
const cases=[];
for(const source of sources){
 for(const level of ['50','20']){
  for(const mode of modes){
   if(mode==='letter-up'&&level!=='50')continue;
   cases.push({source,level,mode});
  }
 }
}
if(cases.length!==MAX_MODEL_CALLS)throw Error('Unexpected request cap');
const rows=[],errors=[],startedAt=Date.now();
function summarize(label,items){
 const ok=items.filter(x=>x.ok);
 const mean=k=>ok.length?Math.round(ok.reduce((n,x)=>n+Number(x[k]||0),0)/ok.length):null;
 return {method:label,requested:items.length,completed:ok.length,
  compliant:ok.filter(x=>x.withinBand).length,
  numerationValid:ok.filter(x=>x.markerValid===true).length,
  meanAbsoluteErrorLetters:mean('absoluteErrorLetters'),
  meanElapsedMs:mean('elapsedMs'),meanOutputTokens:mean('outputTokens'),
  protectedWarnings:ok.reduce((n,x)=>n+x.immutableWarnings+x.fidelityWarnings,0)};
}
async function ready(){
 for(let i=0;i<10;i++){
  try{
   const response=await fetch(endpoint,{method:'GET',
    signal:AbortSignal.timeout(10000),headers:{'Cache-Control':'no-cache'}});
   if(response.status===405&&
     response.headers.get('X-StudyBook-Counting-Experiment')===NUMBERING_EXPERIMENT_PROTOCOL_V77)
    return;
  }catch{}
  await new Promise(r=>setTimeout(r,1500));
 }
 throw Error('LAB77_QA_WORKER_UNVERIFIED');
}
async function one({source,level,mode}){
 const units=[{id:'0:0',source:source.text,pageStart:1,pageEnd:1}];
 const budget=pageLetterBudgetsV74(units,level)[0];
 const request={phase:'draft-v74',draftProtocol:STUDY_DRAFT_PROTOCOL_V74,
   bookTitle:'Prova comparativa sintetica LAB77',
   level,units,unitBudgets:buildUnitBudgetsV71(units,level),
   pageBudgetsV74:[budget],
   targetLetters:budget.targetLetters,maxOutputTokens:16000,timeoutMs:125000,
   ...(mode==='direct'?{}:{countingModeV77:mode})};
 const t=performance.now();
 try{
  const response=await fetch(endpoint,{method:'POST',
   headers:{'Content-Type':'application/json'},
   body:JSON.stringify(request),signal:AbortSignal.timeout(137000)});
  const data=await response.json().catch(()=>({code:'RESPONSE_NOT_JSON'}));
  const elapsedMs=Math.round(performance.now()-t);
  if(!response.ok||!Array.isArray(data.parts)||data.parts.length!==1){
   return {ok:false,source:source.id,level,mode,status:response.status,
    code:data.code||'INCOMPLETE',elapsedMs};
  }
  const annotated=String(data.parts[0].text||'');
  const cleaned=mode==='direct'?annotated:stripNumberMarkersV77(annotated);
  const outputLetters=alphabeticalLettersV77(cleaned);
  const originalLetters=studyLetters(source.text);
  const audit=mode==='direct'?null:markerAuditV77(annotated,mode,budget.targetLetters);
  const protectedCount=immutableViolationsV67(source.text,cleaned).length;
  const fidelity=(auditFidelity(source.text,cleaned).missingProtected||[]).length;
  return {ok:true,source:source.id,level,mode,
   originalLetters,targetLetters:budget.targetLetters,minLetters:budget.minLetters,
   maxLetters:budget.maxLetters,outputLetters,withinBand:
    outputLetters>=budget.minLetters&&outputLetters<=budget.maxLetters,
   achievedReductionPct:+((1-outputLetters/originalLetters)*100).toFixed(2),
   absoluteErrorLetters:Math.abs(budget.targetLetters-outputLetters),
   elapsedMs,outputTokens:data.outputTokensUsed??null,
   immutableWarnings:protectedCount,fidelityWarnings:fidelity,
   markerCount:audit?.tagCount??0,markerErrors:audit?.sequenceErrors??0,
   missingTags:audit?.missingTags??0,unparsedTags:audit?.unparsedTagSyntax??false,
   markerValid:audit?.markersValid??null,
   finishReason:data.finishReason,providerProtocol:data.draftProtocol};
 }catch(e){
  return {ok:false,source:source.id,level,mode,
   code:'CLIENT_NETWORK_OR_TIMEOUT',type:String(e?.name||'Unknown'),
   elapsedMs:Math.round(performance.now()-t)};
 }
}
await ready();
console.log('LAB77_QA_WORKER_READY',JSON.stringify({protocol:NUMBERING_EXPERIMENT_PROTOCOL_V77,
 methods:modes,requestCap:MAX_MODEL_CALLS,sourceCount:sources.length,
 freeModel:'worker-allowlisted-free-model-only'}));
for(const trial of cases){
 if(rows.length>=MAX_MODEL_CALLS)break;
 const row=await one(trial);
 rows.push(row);
 console.log('LAB77_NUMBERING_RESULT',JSON.stringify(row));
 if(!row.ok){
  errors.push(row);
  if(row.status===429||row.status===503||row.code==='AI_QUOTA_LIMIT'||
     row.code==='AI_TEMPORARY_OVERLOAD'){
   console.log('LAB77_TEST_STOP_ON_QUOTA',JSON.stringify({after:rows.length,code:row.code}));
   break;
  }
 }
}
const byMode=modes.map(mode=>summarize(mode,rows.filter(r=>r.mode===mode)));
const sameCases=[];
for(const source of sources){
 for(const level of ['50','20']){
  const current=rows.filter(x=>x.source===source.id&&x.level===level&&x.ok);
  const baseline=current.find(x=>x.mode==='direct');
  sameCases.push({source:source.id,level,baselineInBand:baseline?.withinBand??null,
   comparisons:current.filter(x=>x.mode!=='direct').map(x=>({
    mode:x.mode,withinBand:x.withinBand,
    improvedVsDirect:baseline?x.absoluteErrorLetters<baseline.absoluteErrorLetters:null,
    deltaErrorLetters:baseline?x.absoluteErrorLetters-baseline?.absoluteErrorLetters:null
   }))});
 }
}
const report={experiment:'LAB77 Gemini counting four marker modes and reference',
 dateUTC:new Date().toISOString(),geminiCalls:rows.length,
 plannedCalls:MAX_MODEL_CALLS,complete:rows.length===MAX_MODEL_CALLS&&
 errors.length===0,syntheticOnly:true,installedAppUnchanged:true,
 yalpsAndContainerMethodsSuspended:true,
 bodyNotLogged:true,elapsedWallMs:Date.now()-startedAt,
 resultsByMode:byMode,pairedComparisons:sameCases,
 modelSafety:'existing free Gemini allowlist enforced by Worker',
 fidelityAssessment:'heuristics only; human semantic audit not performed',
 observations:rows,errors};
writeFileSync('studybook-lab77-numbering-report.json',JSON.stringify(report,null,2)+'\n');
console.log('LAB77_NUMBERING_FINAL',JSON.stringify({
 complete:report.complete,calls:rows.length,methods:byMode,errors:errors.length,
 individualTests:rows.length,reportFile:'studybook-lab77-numbering-report.json'
}));
if(!report.complete)process.exitCode=1;
