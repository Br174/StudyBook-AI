// LAB75 real A/B: same synthetic original pages and Gemini free-tier model.
// A = LAB74 direct draft (one Gemini call). B = plan then write (two calls).
// Six bounded calls, two levels. No retries, no user PDFs, no paid services.
import {STUDY_DRAFT_PROTOCOL_V75} from '../src/lib/studyTwoPromptV75.js';
import {STUDY_DRAFT_PROTOCOL_V74} from '../src/lib/studyDraftProtocolV74.js';
import {pageLetterBudgetsV74} from '../src/lib/studyPageBudgetsV74.js';
import {buildUnitBudgetsV71} from '../src/lib/studyDraftProtocolV71.js';
import {studyLetters} from '../src/lib/studyPillarV38.js';
import {immutableViolationsV67} from '../src/lib/immutableFragmentsV67.js';
import {auditFidelity} from '../src/lib/fidelityEngine.js';
const base=process.env.STUDYBOOK_TEST_WORKER_BASE ||
 'https://studybook-ai-lab75-qa.brunoverlezza.workers.dev';
const endpoint=base+'/api/editions/bulk/v51';
const topics=[
 'La Terra ruota attorno al proprio asse e alterna il giorno e la notte. Questo moto si distingue dalla rivoluzione attorno al Sole.',
 'La luce solare raggiunge zone differenti del globo mentre la Terra gira, modificando l’illuminazione locale.',
 'La temperatura varia secondo l’energia solare ricevuta, l’altitudine e le condizioni meteorologiche.',
 'Le stagioni dipendono dall’inclinazione dell’asse terrestre e non principalmente dalla distanza dal Sole.',
 'L’orbita della Terra è ellittica e l’anno civile corregge le ore eccedenti con gli anni bisestili.',
 'La gravità mantiene i pianeti in orbita; la forza gravitazionale di Luna e Sole contribuisce alle maree.',
 'Le eclissi richiedono un allineamento preciso di Sole, Terra e Luna e non avvengono a ogni lunazione.',
 'La ricerca scientifica esige osservazioni controllabili, ipotesi verificabili e prove ripetibili.'
];
const units=[
 {id:'0:0',source:topics.join(' '),pageStart:1,pageEnd:1},
 {id:'0:1',source:topics.map((t,i)=>t+' La condizione '+(i+1)+
  ' è spiegata attraverso osservazioni e relazioni che compaiono nel testo.').join(' '),
  pageStart:2,pageEnd:2}
];
const levels=['50','20'];
const runs=[];
const totalLetters=units.reduce((n,u)=>n+studyLetters(u.source),0);
async function checkReady(){
 let last=null;
 for(let i=0;i<12;i++){
  try{
   const response=await fetch(endpoint,{method:'GET',
    headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(10000)});
   const candidate=response.headers.get('X-StudyBook-Planning-Protocol');
   if(response.status===405&&candidate===STUDY_DRAFT_PROTOCOL_V75){
    console.log('LAB75_QA_WORKER_READY',JSON.stringify({status:response.status,protocol:candidate}));
    return;
   }
   last={status:response.status,protocol:candidate};
  }catch(e){last={type:String(e?.name||'Network')}}
  await new Promise(resolve=>setTimeout(resolve,2000));
 }
 throw Error('LAB75_QA_WORKER_NOT_READY: '+JSON.stringify(last));
}
async function request(level,phase,draftProtocol,plansV75){
 const started=Date.now();
 const pageBudgetsV74=pageLetterBudgetsV74(units,level);
 const targetLetters=pageBudgetsV74.reduce((n,g)=>n+g.targetLetters,0);
 const body={phase,draftProtocol,level,bookTitle:'Test didattico sintetico',
  targetLetters,summaryCapLetters:null,
  units,unitBudgets:buildUnitBudgetsV71(units,level),pageBudgetsV74,
  maxOutputTokens:9000,timeoutMs:160000,
  ...(plansV75?{plansV75}:{})};
 try{
  const response=await fetch(endpoint,{method:'POST',
   headers:{'Content-Type':'application/json'},
   body:JSON.stringify(body),signal:AbortSignal.timeout(175000)});
  const reply=await response.json().catch(()=>({code:'INVALID_JSON'}));
  if(!response.ok)return {ok:false,code:reply.code||'UNKNOWN',
   status:response.status,elapsedMs:Date.now()-started};
  return {ok:true,response:reply,elapsedMs:Date.now()-started};
 }catch(error){return {ok:false,code:'NETWORK_OR_TIMEOUT',
  type:String(error?.name||'Unknown'),elapsedMs:Date.now()-started}}
}
function score(level,phase,value,elapsedMs){
 const pageBudgets=pageLetterBudgetsV74(units,level);
 const got=new Map((value.parts||[]).map(x=>[x.id,x.text]));
 const pages=pageBudgets.map(g=>{
  const actual=g.unitIds.reduce((n,id)=>n+studyLetters(got.get(id)||''),0);
  const within=actual>=g.minLetters&&actual<=g.maxLetters;
  const source=units.filter(u=>g.unitIds.includes(u.id))
   .map(u=>u.source).join('\n');
  const candidate=g.unitIds.map(id=>got.get(id)||'').join('\n');
  const immutableCount=immutableViolationsV67(source,candidate).length;
  const missingProtected=(auditFidelity(source,candidate).missingProtected||[]).length;
  return {page:g.pageStart,originalLetters:g.originalLetters,
   targetLetters:g.targetLetters,actualLetters:actual,
   min:g.minLetters,max:g.maxLetters,withinBand:within,
   immutableViolations:immutableCount,missingProtected};
 });
 const error=pages.reduce((n,p)=>n+Math.abs(p.actualLetters-p.targetLetters),0);
 return {level,method:phase,elapsedMs,pages,
  pagePasses:pages.filter(x=>x.withinBand).length,
  allPagesInBand:pages.every(x=>x.withinBand),
  aggregateAbsoluteLetterError:error,
  finishReason:value.finishReason||null,
  outputTokensUsed:value.outputTokensUsed??null,
  engineCompliant:value.lengthReview?.compliant===true};
}
await checkReady();
for(const level of levels){
 const before=await request(level,'draft-v74',STUDY_DRAFT_PROTOCOL_V74);
 if(!before.ok){
  console.log('LAB75_AB_PAIR_INCOMPLETE',JSON.stringify({level,phase:'baseline',...before}));
  break;
 }
 const baseline=score(level,'LAB74_direct',before.response,before.elapsedMs);
 runs.push(baseline);
 console.log('LAB75_AB_METHOD',JSON.stringify(baseline));
 const planned=await request(level,'plan-v75',STUDY_DRAFT_PROTOCOL_V75);
 if(!planned.ok){
  console.log('LAB75_AB_PAIR_INCOMPLETE',JSON.stringify({level,phase:'planning',...planned}));
  break;
 }
 if(planned.response?.version!=='plan-v75'||!Array.isArray(planned.response.plans)||
     planned.response.plans.length!==units.length){
  console.log('LAB75_AB_PAIR_INCOMPLETE',JSON.stringify({level,phase:'planning-invalid'}));
  break;
 }
 const written=await request(level,'draft-v75',STUDY_DRAFT_PROTOCOL_V75,planned.response.plans);
 if(!written.ok){
  console.log('LAB75_AB_PAIR_INCOMPLETE',JSON.stringify({level,phase:'writing',...written}));
  break;
 }
 const two=score(level,'LAB75_plan_then_write',written.response,
  planned.elapsedMs+written.elapsedMs);
 runs.push(two);
 console.log('LAB75_AB_METHOD',JSON.stringify(two));
 console.log('LAB75_AB_LEVEL_COMPARISON',JSON.stringify({
  level,baselineAllPages:baseline.allPagesInBand,
  plannedAllPages:two.allPagesInBand,
  baselineWithinPages:baseline.pagePasses,
  plannedWithinPages:two.pagePasses,
  baselineLetterError:baseline.aggregateAbsoluteLetterError,
  plannedLetterError:two.aggregateAbsoluteLetterError,
  baselineMs:baseline.elapsedMs,twoPromptsMs:two.elapsedMs
 }));
}
const matched=levels.filter(level=>runs.some(x=>x.level===level&&x.method==='LAB74_direct')&&
 runs.some(x=>x.level===level&&x.method==='LAB75_plan_then_write'));
const improvements=matched.map(level=>{
 const a=runs.find(x=>x.level===level&&x.method==='LAB74_direct');
 const b=runs.find(x=>x.level===level&&x.method==='LAB75_plan_then_write');
 return {level,passDelta:b.pagePasses-a.pagePasses,
  errorDelta:a.aggregateAbsoluteLetterError-b.aggregateAbsoluteLetterError,
  extraTimeMs:b.elapsedMs-a.elapsedMs};
});
console.log('LAB75_AB_FINAL',JSON.stringify({pairsComplete:matched.length,
 totalLevels:levels.length,results:improvements,
 realFreeGemini:true,syntheticOnly:true,model:'configured-existing-free-tier',
 semanticSafety:'heuristic-protected-fragments-only-not-certified',
 recommendRollout:false}));
if(matched.length!==levels.length)process.exitCode=1;
