// LAB74: LIVE free-tier Gemini, source-grounded secondary correction on
// two tiny synthetic pages. No user's book/API key in logs. Bounded 4 calls.
import {STUDY_DRAFT_PROTOCOL_V74} from '../src/lib/studyDraftProtocolV74.js';
import {pageLetterBudgetsV74} from '../src/lib/studyPageBudgetsV74.js';
import {buildUnitBudgetsV71} from '../src/lib/studyDraftProtocolV71.js';
import {studyLetters} from '../src/lib/studyPillarV38.js';
const base=process.env.STUDYBOOK_PROBE_BASE||
 'https://studybook-ai-lab74-qa.brunoverlezza.workers.dev';
const url=base+'/api/editions/bulk/v51';
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
const partA=topics.join(' ');
const partB=topics.map((p,i)=>p+' In questo tema il rapporto causale '+(i+1)+
 ' è chiarito dalla descrizione dei fenomeni osservabili.').join(' ');
const units=[{id:'0:0',source:partA,pageStart:1,pageEnd:1},
 {id:'0:1',source:partB,pageStart:2,pageEnd:2}];
const levels=['50','20'];
const protocol=STUDY_DRAFT_PROTOCOL_V74;
async function call(level,phase,prior=[]){
 const originals=units.reduce((n,u)=>n+studyLetters(u.source),0);
 const body={phase,draftProtocol:protocol,level,bookTitle:'Prova sintetica LAB74',
  units,pageBudgetsV74:pageLetterBudgetsV74(units,level),
  unitBudgets:buildUnitBudgetsV71(units,level),
  targetLetters:Math.round(originals*(1-Number(level)/100)),
  maxOutputTokens:8500,timeoutMs:100000,
  ...(prior.length?{repairDrafts:prior.map(p=>({id:p.id,text:p.text}))}:{})};
 const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},
  body:JSON.stringify(body),signal:AbortSignal.timeout(115000)});
 const data=await response.json().catch(()=>({code:'BAD_JSON'}));
 const groups=data.lengthReview?.pageReviewV74?.groups||[];
 const report={level,phase,status:response.status,code:data.code||null,
  finishReason:data.finishReason||null,
  pages:groups.map(p=>({id:p.pageStart,
   original:p.originalLetters,achieved:p.outputLetters,target:p.targetLetters,
   min:p.minLetters,max:p.maxLetters,within:p.withinBand})),
  compliant:data.lengthReview?.compliant===true,
  outputLetters:data.lengthReview?.observedLetters??null};
 console.log('LAB74_LIVE_RECALIBRATION',JSON.stringify(report));
 return {ok:response.ok&&Array.isArray(data.parts)&&
  data.parts.length===units.length,parts:data.parts||[],report};
}
const head=await fetch(url,{method:'GET',signal:AbortSignal.timeout(12000)});
if(head.headers.get('X-StudyBook-Draft-Protocol')!==protocol)throw Error('WRONG_QA_WORKER');
let finalGood=0;
for(const level of levels){
 const first=await call(level,'draft-v74');
 if(!first.ok){console.log('LAB74_LIVE_STOP',level,'initial failed');break;}
 if(first.report.compliant){finalGood++;continue;}
 const second=await call(level,'recalibrate-v74',first.parts);
 if(second.report.compliant)finalGood++;
 if(!second.ok)break;
}
console.log('LAB74_LIVE_SECOND_PASS_SUMMARY',JSON.stringify({
 testedLevels:levels.length,globallyCompliant:finalGood,
 boundedRequests:true,syntheticOnly:true,noPaidModel:true,
 meaningfulOnlyWhenEveryPageConforms:true
}));
