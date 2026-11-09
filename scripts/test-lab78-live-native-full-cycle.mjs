// LAB78 real end-to-end App DraftFirstV57 -> isolated Worker -> LIVE Gemini,
// including source-page targeted repair stage, checkpoint persistence and
// real numeric/60-cell QA. TWO fresh synthetic pages, NOT user's textbook.
// Zero new paid subscriptions; no retry storms after provider 429 or 503.
import assert from 'node:assert/strict';
import {indexedDB as fakeIndexedDB} from 'fake-indexeddb';
import {createHash} from 'node:crypto';
import {writeFileSync,mkdirSync} from 'node:fs';
import {generateDraftFirstV57} from '../src/lib/draftFirstV57.js';
import {clearGeminiPause} from '../src/lib/geminiQuotaControllerV36.js';
import {clearGeminiCadenceForTestV58} from '../src/lib/geminiCadenceV58.js';
import {clearGeminiThroughputForTestV77} from '../src/lib/geminiThroughputV77.js';

const BASE='https://studybook-ai-lab78-geometry.brunoverlezza.workers.dev';
const path='audit/reports/lab78-live-native-full-cycle.json';
const first="Il diritto distingue le regole destinate a una collettività dalle opinioni con cui vengono commentate. La pubblicazione di un testo non significa che tutte le sue interpretazioni siano automaticamente corrette. Per applicare una disposizione occorre leggere anche le condizioni, le eccezioni e il momento in cui la norma produce effetti. L'autorità che firma un documento e la fonte del potere esercitato sono informazioni diverse e devono essere ricostruite separatamente. Se una condizione non si verifica, l'effetto previsto può non prodursi: eliminare questa clausola cambierebbe la regola studiata.";
const second="Nello studio delle decisioni giuridiche bisogna separare ciò che è documentato da quanto viene soltanto ipotizzato. Due ricostruzioni dello stesso evento possono differire perché prendono in considerazione fonti o aspetti differenti. Una data indica quando si è verificato un atto, ma non dimostra da sola i motivi di chi lo ha compiuto. Per costruire una spiegazione corretta servono argomenti controllabili, citazioni fedeli e attenzione alle eccezioni. Il confronto fra documenti indipendenti può rafforzare una conclusione, senza renderla necessariamente certa.";
const originals=[first,second];
const sha=createHash('sha256').update(originals.join('|')).digest('hex');
const book={title:'Studio sintetico di fonti e regole LAB78',
 studyPillarV38:'studybook-progressive-v38-1',
 canonicalBookMap:{originalFingerprint:sha,pageCount:2,uncertain:[],
   pages:[1,2].map(page=>({physicalPage:page,sourceStatus:'verified'}))},
 chapters:[{title:'Fonti, condizioni e prove',pageStart:1,pageEnd:2,
  paragraphs:originals.map((original,i)=>({original,sourcePageStart:i+1,
   sourcePageEnd:i+1}))}]};
const previousFetch=globalThis.fetch,previousDb=globalThis.indexedDB;
const observations=[];
const report={study:'LAB78 true native Android study pipeline + actual Gemini Worker',
 startedAt:new Date().toISOString(),sourcePages:2,sourceHash:sha,
 scope:'same client engine as LAB78 experimental APK, fake-indexeddb storage on Github runner; NOT real Android phone',
 phases:[],modelGenerations:0,providerErrors:0,attempts:[],
 final:null,allSixNumericAndGeometryPass:false,semanticCertified:false,
 userBookTested:false,paidServicesUsed:false};
function save(){
 mkdirSync('audit/reports',{recursive:true});
 report.updatedAt=new Date().toISOString();
 writeFileSync(path,JSON.stringify(report,null,2)+'\n');
}
try{
 globalThis.indexedDB=fakeIndexedDB;
 await clearGeminiPause();
 await clearGeminiCadenceForTestV58();
 await clearGeminiThroughputForTestV77();
 globalThis.fetch=async (input,init)=>{
  const sourceUrl=String(input);
  if(!sourceUrl.includes('/api/editions/bulk/v51'))
   return previousFetch(input,init);
  const req=JSON.parse(init?.body||'{}');
  report.modelGenerations++;
  const started=Date.now();
  const result=await previousFetch(BASE+'/api/editions/bulk/v51',init);
  const body=await result.clone().json().catch(()=>null);
  report.attempts.push({level:req.level,phase:req.phase,
    sourceParts:req.units?.length||0,
    pageStart:req.units?.[0]?.pageStart,pageEnd:req.units?.at(-1)?.pageEnd,
    status:result.status,code:body?.code||null,
    outputTokensUsed:body?.outputTokensUsed??null,
    outputTokenLimit:body?.outputTokenLimit??null,
    finishReason:body?.finishReason??null,
    observedReduction:body?.lengthReview?.achievedReduction??null,
    pageBandPass:body?.lengthReview?.pageReviewV74?.withinBand??false,
    geometryRowsPass:body?.geometryReviewV78?.allRows??false,
    geometryFullPass:body?.geometryReviewV78?.complete??false,
    sameWorkerVersion:body?.geometryPolicyV78==='lab78-real-worker-60-cell-source-pages-v1',
    elapsedMs:Date.now()-started});
  if(!result.ok)report.providerErrors++;
  save();
  return result;
 };
 const state=await generateDraftFirstV57(book,{
  onActivity:data=>{
   const marker=String(data?.phase||'');
   if(marker&&!report.phases.includes(marker))report.phases.push(marker);
  }});
 const levels=['summary','50','40','30','20','10'];
 const qa=state.qualityV66?.levels||{};
 report.final={
  status:state.status,phase:state.phase,complete:state.complete,
  draftComplete:state.draftComplete,checkpointPersistent:state.checkpointPersistent,
  draftsSaved:state.draftUnitsSaved,booksUnchanged:true,
  levels:levels.map(level=>({
   level,reduction:qa?.[level]?.actualReduction??null,
   sourcePageBandPass:qa?.[level]?.reductionCompliant??false,
   geometryRowPass:qa?.[level]?.geometryV78?.allRows??false,
   both:qa?.[level]?.quantitativeAndGeometryCompliantV78??false,
   availablePages:qa?.[level]?.availablePages??0
  }))
 };
 report.allSixNumericAndGeometryPass=Boolean(state.complete&&
  levels.every(l=>qa?.[l]?.quantitativeAndGeometryCompliantV78===true));
 report.semanticCertified=false;
 save();
 console.log('LAB78_NATIVE_E2E_RESULT',JSON.stringify({status:state.status,
   generationCalls:report.modelGenerations,providerErrors:report.providerErrors,
   fullyConformant:report.allSixNumericAndGeometryPass,
   levels:report.final.levels}));
 if(!report.allSixNumericAndGeometryPass)process.exitCode=2;
}catch(err){
 report.final={exception:String(err?.code||err?.message||err)};
 save();
 console.error('LAB78_NATIVE_E2E_FAILED',JSON.stringify(report.final));
 process.exitCode=2;
}finally{
 globalThis.fetch=previousFetch;
 await clearGeminiPause().catch(()=>{});
 await clearGeminiCadenceForTestV58().catch(()=>{});
 await clearGeminiThroughputForTestV77().catch(()=>{});
 if(previousDb===undefined)delete globalThis.indexedDB;
 else globalThis.indexedDB=previousDb;
}
