// LAB74: max 6 free-tier requests, synthetic pages, no customer book data or
// API keys in logs. Tests real Worker deployment and Gemini's obedience, not
// Android-device install nor semantic correctness of an entire study book.
import {STUDY_DRAFT_PROTOCOL_V74} from '../src/lib/studyDraftProtocolV74.js';
import {pageLetterBudgetsV74} from '../src/lib/studyPageBudgetsV74.js';
import {buildUnitBudgetsV71} from '../src/lib/studyDraftProtocolV71.js';
import {studyLetters,exactRetained} from '../src/lib/studyPillarV38.js';
const base=process.env.STUDYBOOK_PROBE_BASE||
 'https://studybook-ai-lab74.brunoverlezza.workers.dev';
const link=base+'/api/editions/bulk/v51';
const paragraphs=[
 'La Terra ruota attorno al proprio asse e alterna il giorno e la notte. La sua rotazione non deve essere confusa con la rivoluzione attorno al Sole.',
 'La luce del Sole illumina progressivamente diverse zone del pianeta. Il movimento apparente degli astri è influenzato dalla posizione di chi osserva.',
 'La temperatura varia durante il giorno a causa della radiazione solare e delle condizioni atmosferiche locali.',
 'Le stagioni dipendono principalmente dall’inclinazione dell’asse terrestre rispetto al piano dell’orbita.',
 'L’orbita terrestre è ellittica e l’anno dura approssimativamente trecentosessantacinque giorni, a cui si aggiungono alcune ore.',
 'La gravità tiene in orbita i pianeti, mentre l’attrazione della Luna e del Sole contribuisce alle maree.',
 'Le eclissi richiedono un allineamento geometrico particolare e non si verificano ad ogni Luna nuova o piena.',
 'La ricerca scientifica distingue osservazioni, ipotesi, esperimenti ripetibili e spiegazioni sottoposte a verifica.'
];
const pageA=paragraphs.join(' ').repeat(2);
const pageB=[...paragraphs].reverse().join(' ').repeat(2);
const units=[{id:'0:0',source:pageA,pageStart:1,pageEnd:1},
 {id:'0:1',source:pageB,pageStart:2,pageEnd:2}];
const levels=['summary','50','40','30','20','10'];
const originals=units.reduce((n,u)=>n+studyLetters(u.source),0);
const out=[];
const getter=await fetch(link,{method:'GET',signal:AbortSignal.timeout(15000)});
const protocol=getter.headers.get('X-StudyBook-Draft-Protocol');
if(getter.status!==405||protocol!==STUDY_DRAFT_PROTOCOL_V74){
 console.log('LAB74_LIVE_WORKER_VERSION_FAIL',JSON.stringify({
   code:'WORKER_PROTOCOL_MISMATCH',status:getter.status,protocol}));
 process.exit(1);
}
console.log('LAB74_LIVE_WORKER_VERSION_OK',JSON.stringify({protocol,pages:2,
 originalLetters:originals,source:'synthetic-only'}));
for(const level of levels){
 const b={phase:'draft-v74',draftProtocol:STUDY_DRAFT_PROTOCOL_V74,
  level,units,bookTitle:'Prova didattica sintetica LAB74',
  unitBudgets:buildUnitBudgetsV71(units,level),
  pageBudgetsV74:pageLetterBudgetsV74(units,level),
  targetLetters:level==='summary'?null:exactRetained(originals,Number(level)),
  summaryCapLetters:level==='summary'?Math.round(originals*.4):null,
  maxOutputTokens:9500,timeoutMs:90000};
 let res,reply;
 try{
  res=await fetch(link,{method:'POST',
   headers:{'Content-Type':'application/json'},body:JSON.stringify(b),
   signal:AbortSignal.timeout(105000)});
  reply=await res.json();
 }catch(error){
  out.push({level,code:'LIVE_TRANSPORT_ERROR',name:String(error?.name||'Unknown').slice(0,30)});
  break;
 }
 const page=reply?.lengthReview?.pageReviewV74;
 const result={level,status:res.status,
  code:reply?.code||null,protocol:reply?.draftProtocol||null,
  originalLetters:reply?.lengthReview?.sourceLetters||null,
  outputLetters:reply?.lengthReview?.observedLetters??null,
  reduction:reply?.lengthReview?.achievedReduction??null,
  pages:page?.groups?.length??null,
  pageResults:page?.groups?.map(x=>({page:x.pageStart,original:x.originalLetters,
   written:x.outputLetters,target:x.targetLetters,min:x.minLetters,max:x.maxLetters,
   conforms:x.withinBand}))??null,
  numericConformity:reply?.lengthReview?.compliant??false,
  finishReason:reply?.finishReason??null};
 out.push(result);
 console.log('LAB74_REAL_GEMINI_PAGE_RESULT',JSON.stringify(result));
 if(res.status!==200)break;
}
console.log('LAB74_LIVE_SUMMARY',JSON.stringify({requestedLevels:levels.length,
 processed:out.length,globallyCompliant:out.filter(x=>x.numericConformity).length,
 source:'synthetic-only',noPaidFallback:true}));
if(!out.length||out[0].status!==200)process.exitCode=1;
