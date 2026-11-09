// LAB78 real Gemini live smoke against the SAME isolated Worker the Android APK
// will use. This script is NEVER a fake-golden unit test. Reports exactly
// what the provider returned; stops at the first 429/503 to protect €0 quota.
// The source is fresh SYNTHETIC Italian, not a real 44-page user book.
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {studyLetters} from '../src/lib/studyPillarV38.js';
import {STUDY_GEOMETRY_V78} from '../src/lib/studyGeometryV78.js';
import {STUDY_DRAFT_PROTOCOL_V74} from '../src/lib/studyDraftProtocolV74.js';
import {buildUnitBudgetsV71} from '../src/lib/studyDraftProtocolV71.js';
import {pageLetterBudgetsV74,sourceLetterBudgetV74} from '../src/lib/studyPageBudgetsV74.js';

const base=process.env.LAB78_URL||'https://studybook-ai-lab78-geometry.brunoverlezza.workers.dev';
if(!base.startsWith('https://'))throw Error('HTTPS_REQUIRED');
const fixtures=[
 {id:'0:0',pageStart:1,pageEnd:1,chapterTitle:'Prove del diritto',sectionTitle:'Norme',
 source:'Per comprendere una regola giuridica bisogna individuare il soggetto a cui si applica, il comportamento richiesto e le condizioni che ne limitano gli effetti. Non ogni indicazione contenuta in una circolare crea automaticamente un nuovo obbligo. È necessario distinguere la fonte della regola dall’opinione di chi la commenta. Una disposizione può prevedere eccezioni motivate; queste eccezioni non devono essere trasformate in una regola generale. Quando due interpretazioni divergono, il confronto deve riferirsi al testo, alla data e alle circostanze del caso.'},
 {id:'0:1',pageStart:2,pageEnd:2,chapterTitle:'Prove del diritto',sectionTitle:'Argomenti',
 source:'Un argomento convincente espone una tesi, indica le ragioni che la sostengono e segnala eventuali limiti. Due studiosi possono partire dagli stessi documenti e arrivare a conclusioni differenti, perché scelgono criteri di interpretazione diversi. Una data certa dimostra quando è stato pubblicato un documento, ma da sola non dimostra che ogni affermazione contenuta sia vera. In un elaborato bisogna separare fatti documentati, ipotesi e valutazioni. Le citazioni devono conservare il significato originale anche quando vengono spiegate in termini più semplici.'}
].map((x,i)=>({...x,ci:0,pi:i}));
const levels=['summary','50','40','30','20','10'];
const report={
 label:'StudyBook LAB78 true Gemini Worker E2E, six levels for one synthetic two-page textbook',
 executedAt:new Date().toISOString(),backend:base,geometryPolicy:STUDY_GEOMETRY_V78,
 sourceHash:createHash('sha256').update(fixtures.map(x=>x.source).join('|')).digest('hex'),
 fullRealUserBook:false,sourcePages:2,levelsExpected:levels,
 results:[],attemptedProviderModelGenerations:0,modelResponses:0,
 sixLevelMathAndGeometrySuccess:false,
 semanticCertificates:0,additionalPaidCostEuro:0,
 noGuaranteedSuccessOnUnknownBooks:true
};
const OUT='audit/reports/lab78-real-worker-six-levels.json';
function save(){
 mkdirSync('audit/reports',{recursive:true});
 report.finishedAt=new Date().toISOString();
 writeFileSync(OUT,JSON.stringify(report,null,2)+'\n');
}
let blocked=false;
for(const level of levels){
 const budgets=pageLetterBudgetsV74(fixtures,level);
 const unitBudgets=buildUnitBudgetsV71(fixtures,level);
 const sourceLetters=fixtures.reduce((n,u)=>n+studyLetters(u.source),0);
 const global=sourceLetterBudgetV74(sourceLetters,level);
 const body={phase:'draft-v74',draftProtocol:STUDY_DRAFT_PROTOCOL_V74,
  geometryPolicyV78:STUDY_GEOMETRY_V78,level,bookTitle:'Esempi di metodo del diritto',
  pageBudgetsV74:budgets,unitBudgets,
  targetLetters:level==='summary'?null:global.targetLetters,
  summaryCapLetters:level==='summary'?global.targetLetters:null,
  units:fixtures.map(({id,source,pageStart,pageEnd,chapterTitle,sectionTitle})=>
   ({id,source,pageStart,pageEnd,chapterTitle,sectionTitle})),
  maxOutputTokens:4096,timeoutMs:190000};
 const started=Date.now();
 try{
  report.attemptedProviderModelGenerations++;
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),210000);
  let response;
  try{
   response=await fetch(base+'/api/editions/bulk/v51',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify(body),signal:controller.signal});
  }finally{clearTimeout(timer)}
  const data=await response.json().catch(()=>null);
  const complete=Boolean(response.ok&&data?.geometryPolicyV78===STUDY_GEOMETRY_V78&&
    data?.geometryReviewV78?.complete&&data?.lengthReview?.compliant&&
    data?.completeParts&&data?.finishReason!=='length');
  report.results.push({level,httpStatus:response.status,code:data?.code||null,
    phase:data?.diagnostic?.stage||null,elapsedMs:Date.now()-started,
    model:data?.model||null,
    inputTokens:data?.inputTokens??null,
    outputTokensUsed:data?.outputTokensUsed??null,outputTokenLimit:data?.outputTokenLimit??null,
    finishReason:data?.finishReason??null,
    originalLetters:sourceLetters,
    observedLetters:data?.lengthReview?.observedLetters??null,
    reductionPercent:data?.lengthReview?.achievedReduction??null,
    bookBandPassed:data?.lengthReview?.compliant??false,
    pageBandsPassed:data?.lengthReview?.pageReviewV74?.withinBand??false,
    pageRow60Passed:data?.geometryReviewV78?.allRows??false,
    geometryComplete:data?.geometryReviewV78?.complete??false,
    complete,semanticCertified:false,
    // Source content is synthetic, no private book text or API keys.
    pageChecks:data?.geometryReviewV78?.groups?.map(g=>({
     pageStart:g.pageStart,outputLetters:g.outputLetters,
     minLetters:g.minLetters,maxLetters:g.maxLetters,
     rows:g.rows,maxRows:g.maxRows,pass:g.pass}))||[]
  });
  if(response.ok)report.modelResponses++;
  save();
  if(response.status===429||response.status===503){
   blocked=true;report.stopReason='GEMINI_FREE_QUOTA_OR_PROVIDER_OVERLOAD';
   break;
  }
  if(!response.ok){blocked=true;report.stopReason=data?.code||'INVALID_HTTP';break}
  // Slow enough to distinguish provider transient load, not a hidden retry.
  if(level!==levels.at(-1))await new Promise(r=>setTimeout(r,16000));
 }catch(err){
  report.results.push({level,exception:String(err?.name||'UNKNOWN'),elapsedMs:Date.now()-started});
  blocked=true;report.stopReason='PROVIDER_NETWORK_FAILURE';save();break;
 }
}
report.sixLevelMathAndGeometrySuccess=report.results.length===6&&
 report.results.every(r=>r.complete===true);
report.blocked=blocked;save();
console.log('LAB78_REAL_GEMINI_WORKER_VERDICT',JSON.stringify({
 attempted:report.attemptedProviderModelGenerations,
 responses:report.modelResponses,allSixMath:report.sixLevelMathAndGeometrySuccess,
 results:report.results.map(x=>({level:x.level,http:x.httpStatus,reduction:x.reductionPercent,
   bookBand:x.bookBandPassed,pageBand:x.pageBandsPassed,rows:x.pageRow60Passed})),
 stopReason:report.stopReason||null}));
if(!report.sixLevelMathAndGeometrySuccess)process.exitCode=2;
