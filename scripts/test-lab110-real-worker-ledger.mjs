// LAB110 REAL evidence: up to 2 Gemini 3.5 Flash Lite generations
// through the exact StudyBook Worker handler (not an API imitation).
// Source fixture only. No paid fallback, no retry, no APK/Worker deployment.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import handler from '../api/editionsBulkV51.js';
import {studyLetters} from '../src/lib/studyPillarV38.js';
import {pageLetterBudgetsV74} from '../src/lib/studyPageBudgetsV74.js';
import {buildUnitBudgetsV71} from '../src/lib/studyDraftProtocolV71.js';
import {STUDY_DRAFT_PROTOCOL_V74} from '../src/lib/studyDraftProtocolV74.js';
import {STUDY_GEOMETRY_V78} from '../src/lib/studyGeometryV78.js';
import {STUDY_SOURCE_LEDGER_V110} from '../src/lib/studySourceLedgerV110.js';
import {auditFidelity} from '../src/lib/fidelityEngine.js';

const KEY=process.env.AI_TEST_KEY||'';
const sources=JSON.parse(readFileSync('audit/test-fixtures/lab109-worker-source.json','utf8')).sources
 .filter(s=>['scienze','procedura'].includes(s.id));
const FILE='audit/reports/lab110-real-worker-ledger.json';
const report={
 lab:'LAB110 source clause ledger',date:new Date().toISOString(),
 source:'existing synthetic science and library fixtures, not user PDF',
 path:'actual api/editionsBulkV51.js Worker handler',
 model:'gemini-3.5-flash-lite',existingFreeKey:true,noPaidFallback:true,
 productionAppModified:false,cloudflareDeployed:false,realAndroidTested:false,
 maximumModelGenerations:2,attempted:0,received:0,
 stopped:false,stopReason:null,results:[],complete:false,
 semanticCertifiedCount:0,approvedForApp:false,
 baseline:{science40:{lab:'LAB109',reduction:24.37,rows:10,cap:8},
  procedure40:{lab:'LAB108 after local source-literal patch',reduction:36.48,rows:9,cap:9}},
 finalSummary:null
};
function persist(){mkdirSync('audit/reports',{recursive:true});writeFileSync(FILE,JSON.stringify(report,null,2)+'\n')}
const checks={
 scienze:(v)=>{
  const x=String(v).normalize('NFC').toLocaleLowerCase('it');
  return {
   rotationDayNight:/terr|rotaz|ruot/iu.test(x)&&/asse/iu.test(x)&&/giorn/iu.test(x)&&/nott/iu.test(x),
   lightDark:/luce|illumin/iu.test(x)&&/buio|ombr/iu.test(x),
   revolutionYear:/rivoluz|orbit/iu.test(x)&&/sole/iu.test(x)&&/anno/iu.test(x),
   seasonsInclinationNotDistance:/stagion/iu.test(x)&&/inclin|asse/iu.test(x)&&/non.{0,55}distanz/iu.test(x),
   tidesMoonAndSun:/luna/iu.test(x)&&/sole/iu.test(x)&&/maree/iu.test(x)&&/influen|influis|risent/iu.test(x),
   eclipseAlignmentNotEveryLunation:/ecliss/iu.test(x)&&/alline/iu.test(x)&&/non.{0,55}lunazion/iu.test(x),
   hypothesisAndRepeatability:/ipotes/iu.test(x)&&/verific/iu.test(x)&&/osserv/iu.test(x)&&/ripet/iu.test(x),
   isolatedResultNotProof:/risultat|dato|esito/iu.test(x)&&/isolat|singol/iu.test(x)&&/non.{0,65}(dimostr|prov|bast)/iu.test(x),
   describingMotionVsCausesOfVariations:/descriz|descriv/iu.test(x)&&/caus/iu.test(x)&&/variazion/iu.test(x)
  };
 },
 procedura:(v)=>{
  const x=String(v).normalize('NFC').toLocaleLowerCase('it');
  return {
   simulationAndYear:/2024/iu.test(x)&&/bibliotec/iu.test(x)&&/eserciz|simulat|scolastic/iu.test(x),
   internalRule12:/regol/iu.test(x)&&/intern/iu.test(x)&&/\b12\b/iu.test(x),
   registerTitleBeforeLoan:/titol/iu.test(x)&&/prim/iu.test(x)&&/prestito/iu.test(x),
   returnWithinTenDays:/dieci|10/iu.test(x)&&/restitu|reso|conferm/iu.test(x),
   extensionOnlyWhenUnreserved:/prorog/iu.test(x)&&/non.{0,50}prenot|non.{0,50}riserv/iu.test(x),
   notAutomaticWrittenConfirmation:/prorog/iu.test(x)&&/non.{0,35}automatic/iu.test(x)&&/scritt/iu.test(x)&&/data inizial|scadenz/iu.test(x),
   returnReservedEvenIfUnread:/prenot|riserv/iu.test(x)&&/scadenz/iu.test(x)&&/anche se|pur/iu.test(x)&&/lettur|lett|finit|completat/iu.test(x),
   registerWhoAndWhenWithoutOpinions:/registr/iu.test(x)&&/chi|student/iu.test(x)&&/quando|giorn|dat/iu.test(x)&&/non.{0,55}opinion|non.{0,55}giudiz/iu.test(x),
  };
 }
};
if(!KEY){report.stopped=true;report.stopReason='EXISTING_FREE_KEY_MISSING';persist();process.exit(2)}
for(const item of sources){
 if(report.stopped||report.attempted>=report.maximumModelGenerations)break;
 const source=item.text;
 const units=[{id:'1:1',source,pageStart:1,pageEnd:1,chapterTitle:item.id}];
 const budget=pageLetterBudgetsV74(units,'40')[0];
 const body={
  phase:'draft-v74',draftProtocol:STUDY_DRAFT_PROTOCOL_V74,
  geometryPolicyV78:STUDY_GEOMETRY_V78,experimentV110:STUDY_SOURCE_LEDGER_V110,
  level:'40',units,bookTitle:'LAB110 controlled source',
  pageBudgetsV74:pageLetterBudgetsV74(units,'40'),
  unitBudgets:buildUnitBudgetsV71(units,'40'),
  targetLetters:budget.targetLetters,maxOutputTokens:4096,timeoutMs:125000,repairDrafts:[]
 };
 const req={method:'POST',body,headers:{},env:{
  AI_API_KEY:KEY,AI_MODEL:report.model,STUDYBOOK_SOURCE_LEDGER_V110:'1'
 }};
 const res={statusCode:200,payload:null,headers:{},
  setHeader(k,v){this.headers[k]=v;return this},
  status(n){this.statusCode=n;return this},json(v){this.payload=v;return this}};
 report.attempted++;
 const started=Date.now();
 try{
  await handler(req,res);
  const d=res.payload;
  if(res.statusCode!==200){
   report.results.push({fixture:item.id,valid:false,status:res.statusCode,code:d?.code,
    modelGenerationsReceived:0,reason:String(d?.error||'PROVIDER_ERROR').slice(0,180)});
   if([429,503].includes(res.statusCode)){report.stopped=true;report.stopReason='QUOTA_OR_PROVIDER_'+res.statusCode}
   persist();
   if(report.stopped)break;
   continue;
  }
  const outputText=d?.parts?.find(x=>x.id==='1:1')?.text;
  if(typeof outputText!=='string'||!outputText.trim()){
   report.results.push({fixture:item.id,valid:false,status:200,reason:'MISSING_RETURNED_SOURCE_PART'});
   persist();continue;
  }
  const facts=checks[item.id](outputText);
  const fidelity=auditFidelity(source,outputText);
  const factsPass=Object.values(facts).filter(Boolean).length,allFacts=Object.keys(facts).length;
  const group=d?.geometryReviewV78?.groups?.[0];
  report.received++;
  report.results.push({
   fixture:item.id,valid:true,status:200,level:'40',model:d?.model,
   sourceSha256:createHash('sha256').update(source,'utf8').digest('hex'),
   sourceLetters:studyLetters(source),outputLetters:studyLetters(outputText),
   targetLetters:budget.targetLetters,minLetters:budget.minLetters,maxLetters:budget.maxLetters,
   observedReduction:+(100*(1-studyLetters(outputText)/studyLetters(source))).toFixed(2),
   grid:{rows:group?.rows,maxRows:group?.maxRows,pass:group?.fitsRows,inBand:group?.inBand},
   quantitativeAndGridPass:group?.pass===true,
   sourceClauseCount:d?.ledgerClauseCountV110,
   factChecks:{checks:facts,passed:factsPass,total:allFacts,heuristicOnly:true},
   priorFidelityChecks:{missingProtected:fidelity.missingProtected?.length||0,
    qualifierMismatches:fidelity.qualifierMismatches?.length||0,heuristicOnly:true},
   finishReason:d?.finishReason??null,elapsedMs:Date.now()-started,
   semanticCertified:false,approvedForApp:false,
   outputText
  });
  persist();
 }catch(e){
  report.results.push({fixture:item.id,valid:false,errorType:String(e?.name||'Unknown')});
  persist();
 }
}
report.complete=report.received===sources.length;
report.finalSummary={
 completedRealGenerations:report.received,
 numericGridPass:report.results.filter(x=>x.quantitativeAndGridPass).length,
 allFixtureHeuristics:report.results.filter(x=>x.valid&&x.factChecks.passed===x.factChecks.total).length,
 professionalSemanticCertifications:0,releaseEligible:false
};
report.finishedAt=new Date().toISOString();persist();
console.log('LAB110_REAL_WORKER_EVIDENCE',JSON.stringify({
 attempted:report.attempted,received:report.received,stopped:report.stopped,
 results:report.results.map(x=>({source:x.fixture,reduction:x.observedReduction,
  rows:x.grid?.rows,maxRows:x.grid?.maxRows,mathGridPass:x.quantitativeAndGridPass,
  facts:x.factChecks?.passed,total:x.factChecks?.total})),
 approved:false
}));
if(!report.complete)process.exitCode=2;
