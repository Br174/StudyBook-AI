// LAB78 genuine free-tier Gemini benchmark: count markers every 5/10/20,
// adaptive marker pacing, and two-call externally verified counter.
// Two fully synthetic sources, no private documents, no paid provider.
// Max 12 Gemini completions; stop immediately on quota/overload errors.
// Writes provenance and results JSON without text or secrets.
import {writeFileSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import {studyLetters} from '../src/lib/studyPillarV38.js';
import {STUDY_DRAFT_PROTOCOL_V74} from '../src/lib/studyDraftProtocolV74.js';
import {pageLetterBudgetsV74} from '../src/lib/studyPageBudgetsV74.js';
import {buildUnitBudgetsV71} from '../src/lib/studyDraftProtocolV71.js';
import {markerSpacingAuditV78,MARKER_PROBE_PROTOCOL_V78} from '../src/lib/studyMarkerExperimentsV78.js';
import {stripNumberMarkersV77} from '../src/lib/studyNumberingExperimentV77.js';
import {immutableViolationsV67} from '../src/lib/immutableFragmentsV67.js';
import {auditFidelity} from '../src/lib/fidelityEngine.js';
const BASE=process.env.STUDYBOOK_MARKER_QA_URL ||
 'https://studybook-ai-markers-qa.brunoverlezza.workers.dev';
const ENDPOINT=BASE+'/api/editions/bulk/v51';
const MAX_CALLS=12;
const sources=[
 {name:'scienze',level:'50',original:[
  'La Terra ruota attorno al proprio asse. La rotazione causa il giorno e la notte, perché una parte della superficie riceve luce solare mentre l’altra rimane al buio.',
  'La rivoluzione attorno al Sole dura circa un anno. Le stagioni dipendono soprattutto dall’inclinazione dell’asse terrestre, non dalla distanza tra la Terra e il Sole.',
  'La Luna influisce sulle maree insieme al Sole. Le eclissi richiedono un allineamento particolare e non avvengono a ogni lunazione.',
  'Il metodo scientifico richiede ipotesi verificabili e osservazioni ripetibili. Un risultato isolato non basta per dimostrare una spiegazione.',
  'Per comprendere il fenomeno bisogna distinguere fra descrizione del movimento e cause delle variazioni osservate.'
 ].join(' '),methods:['direct','fixed5','fixed10','fixed20','progressive','verified-checkpoint']},
 {name:'procedura',level:'20',original:[
  'In un esercizio scolastico del 2024, una biblioteca simulata ha introdotto una procedura per richiedere i libri.',
  'La regola interna numero 12 prevede che lo studente registri il titolo prima del prestito e confermi la restituzione entro dieci giorni.',
  'Il personale può concedere una proroga soltanto se il volume non è stato prenotato da altri studenti.',
  'La proroga non è automatica: senza conferma scritta resta valida la data iniziale.',
  'Quando un libro è già riservato, lo studente deve restituirlo alla scadenza anche se non ha completato la lettura.',
  'Il registro consente di ricostruire chi ha ricevuto il libro e in quale giorno, ma non contiene dati sulle opinioni personali dei lettori.',
  'Le condizioni e le eccezioni sono essenziali per applicare correttamente la procedura.'
 ].join(' '),methods:['direct','fixed10','progressive','verified-checkpoint']}
];
let calls=0,rateLimited=false;
const results=[],failures=[],start=Date.now();
function infoFor(s){
 const units=[{id:'0:0',source:s.original,pageStart:1,pageEnd:1}];
 const budget=pageLetterBudgetsV74(units,s.level)[0];
 return {units,budget};
}
async function checkWorker(){
 let last={};
 for(let i=0;i<12;i++){
  try{
   const r=await fetch(ENDPOINT,{method:'GET',signal:AbortSignal.timeout(10000)});
   last={status:r.status,protocol:r.headers.get('X-StudyBook-Marker-Probe')};
   if(last.status===405&&last.protocol===MARKER_PROBE_PROTOCOL_V78)return;
  }catch(e){last={code:String(e?.name||'NETWORK')}}
  await new Promise(resolve=>setTimeout(resolve,1200));
 }
 throw Error('UNVERIFIED_MARKER_WORKER '+JSON.stringify(last));
}
async function ask(s,mode,checkpoint){
 if(calls>=MAX_CALLS)return {ok:false,code:'CALL_CAP_REACHED'};
 const {units,budget}=infoFor(s);
 const body={
  phase:'draft-v74',draftProtocol:STUDY_DRAFT_PROTOCOL_V74,
  level:s.level,units,pageBudgetsV74:[budget],
  unitBudgets:buildUnitBudgetsV71(units,s.level),
  bookTitle:'Prova sintetica LAB78 senza dati utente',
  targetLetters:budget.targetLetters,
  maxOutputTokens:7000,timeoutMs:110000,
  ...(mode==='direct'?{}:{markerModeV78:mode}),
  ...(checkpoint?{checkpointV78:checkpoint}:{})
 };
 calls++;
 const before=performance.now();
 try{
  const r=await fetch(ENDPOINT,{method:'POST',
   headers:{'Content-Type':'application/json'},
   body:JSON.stringify(body),signal:AbortSignal.timeout(120000)});
  const data=await r.json().catch(()=>({code:'RESPONSE_JSON_INVALID'}));
  const elapsedMs=Math.round(performance.now()-before);
  if(!r.ok||!Array.isArray(data.parts)||data.parts.length!==1){
   const code=data.code||'INCOMPLETE';
   if(r.status===429||r.status===503||['AI_QUOTA_LIMIT','AI_TEMPORARY_OVERLOAD'].includes(code))
    rateLimited=true;
   return {ok:false,status:r.status,code,elapsedMs};
  }
  return {ok:true,text:String(data.parts[0].text||''),
   elapsedMs,outputTokens:data.outputTokensUsed||null,
   finishReason:data.finishReason||null};
 }catch(e){return {ok:false,code:'NETWORK_OR_TIMEOUT',
  type:String(e?.name||'UNKNOWN'),elapsedMs:Math.round(performance.now()-before)}}
}
function score(s,mode,apiResponses,completeText){
 const {budget}=infoFor(s);
 const annotated=mode==='verified-checkpoint'||mode==='direct'
  ?completeText:completeText;
 const cleaned=mode==='direct'||mode==='verified-checkpoint'
  ?annotated:stripNumberMarkersV77(annotated);
 const actual=studyLetters(cleaned);
 const audit=mode==='direct'?null:markerSpacingAuditV78(annotated,mode);
 return {source:s.name,level:s.level,mode,
  originalLetters:budget.originalLetters,targetLetters:budget.targetLetters,
  minLetters:budget.minLetters,maxLetters:budget.maxLetters,
  actualLetters:actual,deltaLetters:actual-budget.targetLetters,
  reductionPct:+((1-actual/budget.originalLetters)*100).toFixed(2),
  withinBand:actual>=budget.minLetters&&actual<=budget.maxLetters,
  markerCount:audit?.markerCount??0,
  markerSequenceErrors:audit?.sequenceErrors??0,
  spacingMisses:audit?.spacingMisses??0,
  unparsedTagSyntax:audit?.invalidSyntax??false,
  semanticWarnings:immutableViolationsV67(s.original,cleaned).length+
   (auditFidelity(s.original,cleaned).missingProtected?.length||0),
  calls:apiResponses.length,
  elapsedMs:apiResponses.reduce((t,r)=>t+r.elapsedMs,0),
  outputTokens:apiResponses.reduce((t,r)=>t+(r.outputTokens||0),0),
  finishReasons:apiResponses.map(x=>x.finishReason),
  allProviderResponsesCompleted:apiResponses.every(x=>x.ok)
 };
}
try{
 await checkWorker();
 console.log('LAB78_QA_READY',JSON.stringify({
  protocol:MARKER_PROBE_PROTOCOL_V78,
  maxCalls:MAX_CALLS,methods:sources.map(s=>({source:s.name,level:s.level,modes:s.methods})),
  freeTier:true,actualBooksSent:false}));
 for(const s of sources){
  for(const mode of s.methods){
   if(rateLimited||calls>=MAX_CALLS)break;
   const r1=await ask(s,mode);
   if(!r1.ok){
    const failed={source:s.name,level:s.level,mode,call:calls,stage:1,...r1};
    failures.push(failed);console.log('LAB78_FAILED',JSON.stringify(failed));
    if(rateLimited)break;
    continue;
   }
   let chain=[r1],finished=r1.text;
   if(mode==='verified-checkpoint'){
    const measured=studyLetters(r1.text);
    const second=await ask(s,mode,{previous:r1.text,claimedLetters:measured});
    if(!second.ok){
     const failed={source:s.name,level:s.level,mode,call:calls,stage:2,
      firstPartLetters:measured,...second};
     failures.push(failed);console.log('LAB78_FAILED',JSON.stringify(failed));
     if(rateLimited)break;
     continue;
    }
    chain.push(second);
    finished=r1.text.trimEnd()+' '+second.text.trimStart();
   }
   const result=score(s,mode,chain,finished);
   results.push(result);
   console.log('LAB78_REAL_RESULT',JSON.stringify(result));
  }
  if(rateLimited)break;
 }
}finally{
 const comparisons=[];
 for(const s of sources){
  const base=results.find(x=>x.source===s.name&&x.mode==='direct');
  for(const a of results.filter(x=>x.source===s.name&&x.mode!=='direct')){
   comparisons.push({source:s.name,level:s.level,method:a.mode,
    baselineWithinBand:base?.withinBand??null,withinBand:a.withinBand,
    letterErrorImprovement:base?Math.abs(base.deltaLetters)-Math.abs(a.deltaLetters):null,
    relativeTimeVsDirect:base?+(a.elapsedMs/base.elapsedMs).toFixed(2):null,
    additionalCalls:base?a.calls-base.calls:null});
  }
 }
 const report={name:'MotorLab StudyBook LAB78 checkpoint marker comparison',
  timestamp:new Date().toISOString(),origin:'existing verified free-tier Gemini via isolated QA Worker',
  qaWorker:'studybook-ai-markers-qa',geminiCalls:calls,maxGeminiCalls:MAX_CALLS,
  quotaStop:rateLimited,syntheticOnly:true,appModified:false,
  yalpsAndContainersUnchanged:true,
  noTextOrSecretsInLogs:true,semanticQuality:'heuristics not human certified',
  totalWallMs:Date.now()-start,results,failures,comparisons,
  conclusion:'No method promoted automatically; compare numeric and semantic reliability before any app change'};
 writeFileSync('studybook-lab78-markers-report.json',JSON.stringify(report,null,2)+'\n');
 console.log('LAB78_FINAL',JSON.stringify({
  calls,maxCalls:MAX_CALLS,rateLimited,successes:results.length,
  failures:failures.length,
  passByMode:Object.fromEntries([...new Set(results.map(r=>r.mode))].map(mode=>{
   const matching=results.filter(r=>r.mode===mode);
   return [mode,{pass:matching.filter(r=>r.withinBand).length,tested:matching.length}];
  })),
  comparisons,reportFile:'studybook-lab78-markers-report.json'}));
}
if(rateLimited||failures.length||results.length!==sources.reduce((n,x)=>n+x.methods.length,0))
 process.exitCode=1;
