// LAB73: READ/POST ONLY to the EXISTING isolated LAB72 Worker.
// No secrets in request/logs, no user pages, no production write.
// Evidence separates Android/Worker route, Gemini upstream and excessive block.
import {studyLetters,exactRetained} from '../src/lib/studyPillarV38.js';
import {buildUnitBudgetsV71} from '../src/lib/studyDraftProtocolV71.js';
import {STUDY_DRAFT_PROTOCOL_V72} from '../src/lib/studyDraftProtocolV72.js';
const base='https://studybook-ai-lab72.brunoverlezza.workers.dev';
const endpoint=base+'/api/editions/bulk/v51';
async function timed(name,method,body=null){
 const began=Date.now();
 try{
  const res=await fetch(endpoint,{method,
   headers:{'Content-Type':'application/json','Origin':'http://localhost'},
   body:body?JSON.stringify(body):undefined,
   signal:AbortSignal.timeout(100000)});
  const reply=await res.json().catch(()=>({code:'INVALID_JSON'}));
  const output=(reply?.parts||[]).reduce((n,p)=>n+studyLetters(p.text),0);
  console.log('LAB73_LIVE_WORKER_DIAG',JSON.stringify({
    case:name,httpStatus:res.status,elapsedMs:Date.now()-began,
    protocol:res.headers.get('X-StudyBook-Draft-Protocol'),
    cors:res.headers.get('Access-Control-Allow-Origin'),
    code:reply?.code||null,
    providerReason:reply?.diagnostic?.reason||null,
    providerHttpStatus:reply?.diagnostic?.status||null,
    providerElapsedMs:reply?.diagnostic?.elapsedMs||null,
    model:reply?.diagnostic?.model||reply?.model||null,
    parts:reply?.parts?.length??null,
    outputLetters:output||null,
    completeParts:reply?.completeParts??null,
    finishReason:reply?.finishReason??null
  }));
 }catch(error){
  console.log('LAB73_LIVE_WORKER_FETCH_EXCEPTION',JSON.stringify({
   case:name,elapsedMs:Date.now()-began,
   errorType:error?.name||'unknown',
   code:error?.cause?.code||null
  }));
 }
}
await timed('route-get','GET');
await timed('invalid-no-gemini','POST',{level:'50',units:[]});
const sentences=[
 'La temperatura misura lo stato termico di una sostanza e può cambiare se riceve energia.',
 'L’acqua possiede tre stati comuni: solido, liquido e aeriforme.',
 'Durante la fusione il ghiaccio diventa acqua perché assorbe calore dall’ambiente.',
 'La massa resta invariata quando l’acqua si trasforma da liquido a vapore.',
 'La pressione influenza la temperatura di ebollizione dell’acqua.',
 'Il trasferimento di calore avviene per conduzione, convezione oppure irraggiamento.',
 'Un corpo caldo e uno freddo tendono a raggiungere un equilibrio termico.',
 'Nel processo di condensazione il vapore cede calore e torna liquido.'
];
async function sample(name,repeats){
 const source=sentences.join(' ').repeat(repeats);
 const unit={id:'0:0',source,pageStart:1,pageEnd:1,
 chapterTitle:'Cambiamenti di stato',sectionTitle:'Termodinamica'};
 const originalLetters=studyLetters(source);
 const body={
  phase:'draft-v72',draftProtocol:STUDY_DRAFT_PROTOCOL_V72,
  level:'50',bookTitle:'Diagnostica di un testo didattico inventato',
  targetLetters:exactRetained(originalLetters,50),summaryCapLetters:null,
  unitBudgets:buildUnitBudgetsV71([unit],'50'),units:[unit],
  maxOutputTokens:repeats===1?4096:10000,
  timeoutMs:70000
 };
 console.log('LAB73_LIVE_WORKER_REQUEST',JSON.stringify({case:name,originalLetters,
  inputChars:source.length,outputTokenLimit:body.maxOutputTokens,
  source:'synthetic-only'}));
 await timed(name,'POST',body);
}
await sample('small-synthetic',1);
// Only test a larger request if explicitly enabled in one controlled CI run.
if(process.env.LAB73_TEST_MEDIUM==='yes')await sample('medium-synthetic',12);
