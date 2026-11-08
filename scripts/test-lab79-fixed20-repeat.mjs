// MotorLab LAB79: FIVE reduction levels x THREE synthetic pages x TWO
// matched Gemini methods. Up to 30 FREE-provider calls, STOP on any 429/503.
// YALPS/container methods are excluded, Android/main/LAST_GOOD unchanged.
// The matched-control prompt and fixed20 share the SAME pedagogical setup.
import {writeFileSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import {STUDY_DRAFT_PROTOCOL_V74} from '../src/lib/studyDraftProtocolV74.js';
import {FAIR_CONTROL_PROTOCOL_V79} from '../src/lib/studyMarkerControlV79.js';
import {MARKER_PROBE_PROTOCOL_V78,markerSpacingAuditV78}
 from '../src/lib/studyMarkerExperimentsV78.js';
import {pageLetterBudgetsV74} from '../src/lib/studyPageBudgetsV74.js';
import {buildUnitBudgetsV71} from '../src/lib/studyDraftProtocolV71.js';
import {studyLetters} from '../src/lib/studyPillarV38.js';
import {stripNumberMarkersV77} from '../src/lib/studyNumberingExperimentV77.js';
import {immutableViolationsV67} from '../src/lib/immutableFragmentsV67.js';
import {auditFidelity} from '../src/lib/fidelityEngine.js';

const BASE=process.env.STUDYBOOK_FIXED20_QA_URL||
 'https://studybook-ai-fixed20-v79-qa.brunoverlezza.workers.dev';
const url=BASE+'/api/editions/bulk/v51';
const MAX_CALLS=30,LEVELS=['10','20','30','40','50'];
const SOURCES=[
 {name:'scienze',original:[
  'La Terra ruota attorno al proprio asse. La rotazione causa il giorno e la notte, perché una parte della superficie riceve luce solare mentre l’altra rimane al buio.',
  'La rivoluzione attorno al Sole dura circa un anno. Le stagioni dipendono soprattutto dall’inclinazione dell’asse terrestre, non dalla distanza tra la Terra e il Sole.',
  'La Luna influisce sulle maree insieme al Sole. Le eclissi richiedono un allineamento particolare e non avvengono a ogni lunazione.',
  'Il metodo scientifico richiede ipotesi verificabili e osservazioni ripetibili. Un risultato isolato non basta per dimostrare una spiegazione.',
  'Per comprendere il fenomeno bisogna distinguere fra descrizione del movimento e cause delle variazioni osservate.'
 ].join(' ')},
 {name:'procedura',original:[
  'In un esercizio scolastico del 2024, una biblioteca simulata ha introdotto una procedura per richiedere i libri.',
  'La regola interna numero 12 prevede che lo studente registri il titolo prima del prestito e confermi la restituzione entro dieci giorni.',
  'Il personale può concedere una proroga soltanto se il volume non è stato prenotato da altri studenti.',
  'La proroga non è automatica: senza conferma scritta resta valida la data iniziale.',
  'Quando un libro è già riservato, lo studente deve restituirlo alla scadenza anche se non ha completato la lettura.',
  'Il registro consente di ricostruire chi ha ricevuto il libro e in quale giorno, ma non contiene dati sulle opinioni personali dei lettori.',
  'Le condizioni e le eccezioni sono essenziali per applicare correttamente la procedura.'
 ].join(' ')},
 {name:'storia',original:[
  'Durante la prima metà del Novecento numerosi Stati europei affrontarono cambiamenti politici, economici e sociali.',
  'La Prima guerra mondiale iniziò nel 1914 e modificò profondamente i rapporti tra molti Paesi.',
  'La conclusione del conflitto nel 1918 non eliminò tutte le tensioni e la crisi economica del 1929 aggravò difficoltà già presenti.',
  'La Seconda guerra mondiale iniziò in Europa nel 1939 e terminò nel 1945. Non tutti gli Stati parteciparono alle stesse operazioni nello stesso momento.',
  'Le trasformazioni del dopoguerra favorirono la nascita di nuove istituzioni internazionali, concepite per migliorare il dialogo e prevenire altri conflitti.',
  'Lo studio della storia richiede di distinguere fatti documentati, interpretazioni e cause multiple senza ridurre ogni evento a un unico fattore.'
 ].join(' ')}
];
const cases=[];
for(let sweep=0;sweep<SOURCES.length;sweep++){
 for(let li=0;li<LEVELS.length;li++){
  const source=SOURCES[(li+sweep)%SOURCES.length],level=LEVELS[li];
  cases.push({source,level,sweep});
 }
}
const results=[],errors=[];
let calls=0,quotaStopped=false;
const started=Date.now();

async function ready(){
 let last={};
 for(let i=0;i<12;i++){
  try{
   const r=await fetch(url,{method:'GET',
    headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(12000)});
   last={status:r.status,control:r.headers.get('X-StudyBook-Fixed20-Matched-Protocol'),
    marker:r.headers.get('X-StudyBook-Marker-Probe')};
   if(last.status===405&&last.control===FAIR_CONTROL_PROTOCOL_V79&&
      last.marker===MARKER_PROBE_PROTOCOL_V78)return;
  }catch(e){last={code:String(e?.name||'NETWORK')}}
  await new Promise(r=>setTimeout(r,1400));
 }
 throw Error('LAB79_WRONG_QA_WORKER '+JSON.stringify(last));
}
async function call(source,level,mode){
 if(calls>=MAX_CALLS)return {ok:false,code:'CALL_LIMIT'};
 const units=[{id:'0:0',source:source.original,pageStart:1,pageEnd:1}];
 const budget=pageLetterBudgetsV74(units,level)[0];
 const body={phase:'draft-v74',draftProtocol:STUDY_DRAFT_PROTOCOL_V74,
  level,units,pageBudgetsV74:[budget],unitBudgets:buildUnitBudgetsV71(units,level),
  targetLetters:budget.targetLetters,bookTitle:'Sorgente sintetica LAB79',
  maxOutputTokens:9000,timeoutMs:140000,
  ...(mode==='control'?{matchedControlV79:'control'}:{markerModeV78:'fixed20'})};
 calls++;
 const t=performance.now();
 try{
  const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},
   signal:AbortSignal.timeout(155000),body:JSON.stringify(body)});
  const data=await r.json().catch(()=>({code:'BAD_JSON'}));
  const elapsedMs=Math.round(performance.now()-t);
  if(!r.ok||!Array.isArray(data.parts)||data.parts.length!==1){
   const code=data.code||'INCOMPLETE';
   if(r.status===429||r.status===503||code==='AI_QUOTA_LIMIT'||
      code==='AI_TEMPORARY_OVERLOAD'||code==='AI_QUOTA_MANUAL_REVIEW')
    quotaStopped=true;
   return {ok:false,status:r.status,code,elapsedMs,source:source.name,level,mode};
  }
  const annotated=String(data.parts[0].text||'');
  const stripped=mode==='fixed20'?stripNumberMarkersV77(annotated):annotated;
  const actual=studyLetters(stripped);
  const audit=mode==='fixed20'?markerSpacingAuditV78(annotated,'fixed20'):null;
  const immutableWarnings=immutableViolationsV67(source.original,stripped).length;
  const fidelityWarnings=(auditFidelity(source.original,stripped).missingProtected||[]).length;
  const markerSyntaxCorrect=mode==='control'?null:
    audit.markerCount>0&&!audit.invalidSyntax;
  const inRange=actual>=budget.minLetters&&actual<=budget.maxLetters;
  return {ok:true,source:source.name,level,mode,
   originalLetters:budget.originalLetters,targetLetters:budget.targetLetters,
   min:budget.minLetters,max:budget.maxLetters,observedLetters:actual,
   reduction:+((1-actual/budget.originalLetters)*100).toFixed(2),
   inRange,letterError:Math.abs(actual-budget.targetLetters),
   elapsedMs,outputTokens:data.outputTokensUsed??null,
   finishReason:data.finishReason||null,
   markerCount:audit?.markerCount??0,
   markerSequenceErrors:audit?.sequenceErrors??0,
   markerSpacingMisses:audit?.spacingMisses??0,
   markerSyntaxCorrect,
   immutableWarnings,fidelityWarnings,
   semanticWarnings:immutableWarnings+fidelityWarnings,
   // Synthetic only. Full output is retained in artifact for independent
   // human review; never logs user's book text.
   syntheticOutput:stripped,
   markersAreNotTrustedForNumericVerification:true};
 }catch(e){
  return {ok:false,source:source.name,level,mode,
   code:'NETWORK_OR_TIMEOUT',type:String(e?.name||'Unknown'),
   elapsedMs:Math.round(performance.now()-t)};
 }
}
try{
 await ready();
 console.log('LAB79_READY',JSON.stringify({protocol:FAIR_CONTROL_PROTOCOL_V79,
  target:'five levels, three synthetic texts, paired same-source comparisons',
  callsMaximum:MAX_CALLS,freeModel:true,installedAppUnchanged:true}));
 for(const item of cases){
  if(quotaStopped||calls>=MAX_CALLS)break;
  // Fair paired comparison: never claim superiority on unpaired records.
  // Alternate ordering to reduce warm-up/cadence bias.
  const order=(results.length/2)%2===0?['control','fixed20']:['fixed20','control'];
  const pair=[];
  for(const mode of order){
   if(quotaStopped||calls>=MAX_CALLS)break;
   const out=await call(item.source,item.level,mode);
   if(out.ok){
    results.push(out);pair.push(out);
    const {syntheticOutput,...safe}=out;
    console.log('LAB79_RESULT',JSON.stringify(safe));
   }else{
    errors.push(out);
    console.log('LAB79_FAILED',JSON.stringify(out));
   }
  }
  if(pair.length===2){
   const control=pair.find(x=>x.mode==='control');
   const marked=pair.find(x=>x.mode==='fixed20');
   const compare={
    source:item.source.name,level:item.level,
    controlPass:control.inRange,markedPass:marked.inRange,
    letterErrorImprovement:control.letterError-marked.letterError,
    markedTimeRatio:+(marked.elapsedMs/control.elapsedMs).toFixed(2),
    controlQualityWarnings:control.semanticWarnings,
    markedQualityWarnings:marked.semanticWarnings,
    markerCount:marked.markerCount,
    malformedMarkers:marked.markerSyntaxCorrect===false
   };
   console.log('LAB79_PAIRED',JSON.stringify(compare));
  }
  if(quotaStopped)break;
 }
}finally{
 const grouped=new Map();
 for(const x of results){
  const k=x.source+'|'+x.level;
  if(!grouped.has(k))grouped.set(k,{source:x.source,level:x.level});
  grouped.get(k)[x.mode]=x;
 }
 const pairs=[...grouped.values()].filter(x=>x.control?.ok&&x.fixed20?.ok);
 const summary=['control','fixed20'].map(mode=>{
  const rows=pairs.map(p=>p[mode]);
  return {mode,pairedSamples:rows.length,pass:rows.filter(r=>r.inRange).length,
   averageError:rows.length?+(rows.reduce((s,r)=>s+r.letterError,0)/rows.length).toFixed(1):null,
   averageMs:rows.length?Math.round(rows.reduce((s,r)=>s+r.elapsedMs,0)/rows.length):null,
   semanticWarnings:rows.reduce((s,r)=>s+r.semanticWarnings,0),
   malformedMarkerResponses:mode==='fixed20'?rows.filter(x=>x.markerSyntaxCorrect===false).length:null,
   exactMarkerSequences:mode==='fixed20'?rows.filter(x=>x.markerSequenceErrors===0).length:null,
   averageOutputTokens:rows.length?Math.round(rows.reduce((s,r)=>s+(r.outputTokens||0),0)/rows.length):null};
 });
 const perLevel=LEVELS.map(level=>{
  const selected=pairs.filter(p=>p.level===level);
  return {level,pairs:selected.length,
   directPass:selected.filter(p=>p.control.inRange).length,
   fixed20Pass:selected.filter(p=>p.fixed20.inRange).length};
 });
 const report={experiment:'StudyBook LAB79 matched fixed20 repeat',timestamp:new Date().toISOString(),
  quotaStopped,complete:pairs.length===cases.length&&errors.length===0,
  maxCalls:MAX_CALLS,calls,sourceNames:SOURCES.map(s=>s.name),
  levels:LEVELS,pairedComparisons:pairs.length,methods:summary,perLevel,
  syntheticOnly:true,appModified:false,YALPSAndContainersPaused:true,
  semanticQA:'heuristic warnings only; human review still required',
  results,errors,wallMs:Date.now()-started};
 writeFileSync('studybook-lab79-fixed20-report.json',JSON.stringify(report,null,2)+'\n');
 console.log('LAB79_FINAL',JSON.stringify({
  complete:report.complete,quotaStopped,calls,paired:pairs.length,methods:summary,perLevel,
  failures:errors.length,report:'studybook-lab79-fixed20-report.json'}));
}
if(quotaStopped||errors.length||results.length!==cases.length*2)process.exitCode=1;
