// LAB109: ONE real Gemini model generation through the ACTUAL StudyBook
// API/Worker handler, not an imitation of a model call. Synthetic fixture only.
// Preserve all evidence on isolated GitHub LAB branch; never deploy Worker/APK.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import handler from '../api/editionsBulkV51.js';
import {STUDY_FACT_FIRST_V109} from '../src/lib/studyFactFirstV109.js';
import {STUDY_DRAFT_PROTOCOL_V74} from '../src/lib/studyDraftProtocolV74.js';
import {STUDY_GEOMETRY_V78,studyGeometryPlanV78} from '../src/lib/studyGeometryV78.js';
import {buildUnitBudgetsV71} from '../src/lib/studyDraftProtocolV71.js';
import {pageLetterBudgetsV74} from '../src/lib/studyPageBudgetsV74.js';
import {studyLetters} from '../src/lib/studyPillarV38.js';
import {auditFidelity} from '../src/lib/fidelityEngine.js';

const KEY=process.env.AI_TEST_KEY||'';
const BASE='audit/reports/lab109-real-worker-science40.json';
const fixture=JSON.parse(readFileSync('audit/test-fixtures/lab109-worker-source.json','utf8'));
const source=fixture.sources.find(s=>s.id==='scienze').text;
const old=fixture.historicalScience40;
const units=[{id:'1:1',source,pageStart:1,pageEnd:1,chapterTitle:'Scienze',sectionTitle:'Fisica'}];
const b=pageLetterBudgetsV74(units,'40')[0];
const body={
 phase:'draft-v74',draftProtocol:STUDY_DRAFT_PROTOCOL_V74,
 geometryPolicyV78:STUDY_GEOMETRY_V78,experimentV109:STUDY_FACT_FIRST_V109,
 bookTitle:'LAB109 synthetic original study',level:'40',
 targetLetters:b.targetLetters,summaryCapLetters:null,
 pageBudgetsV74:pageLetterBudgetsV74(units,'40'),
 unitBudgets:buildUnitBudgetsV71(units,'40'),
 units,repairDrafts:[],maxOutputTokens:4096,timeoutMs:125000
};
const evidence={lab:'LAB109 real Worker fact-first pilot',
 date:new Date().toISOString(),usesActualWorkerHandler:true,model:'gemini-3.5-flash-lite',
 privateBookUsed:false,workerDeployed:false,productionModified:false,appBuilt:false,
 originalSourceSHA256:createHash('sha256').update(source).digest('hex'),
 originalLetters:studyLetters(source),targetLetters:b.targetLetters,minLetters:b.minLetters,
 maxLetters:b.maxLetters,officialGrid:studyGeometryPlanV78(units,'40').groups[0].maxRows,
 priorHistorical:{reduction:old.lab99Metrics.reduction,rows:old.lab99Metrics.rows,
  missingKnownConcept:old.knownMissingFact,semanticCertified:false},
 realModelGenerationsRequested:0,modelGenerationsReceived:0,
 countTokensCallsUnknown:true,providerResult:null,finalText:null,
 sourceFactChecklist:null,semanticCertified:false,approvedForApp:false,
 finishedAt:null};
function persist(){mkdirSync('audit/reports',{recursive:true});writeFileSync(BASE,JSON.stringify(evidence,null,2)+'\n')}
function relationChecks(text){
 const t=String(text||'').normalize('NFC').toLocaleLowerCase('it');
 const checks={
  rotationDayNight:/terr|rotaz|ruot/iu.test(t)&&/asse/iu.test(t)&&/giorn/iu.test(t)&&/nott/iu.test(t),
  sunlightShadow:/luce|illumina/iu.test(t)&&/buio|ombr/iu.test(t),
  revolutionYear:/rivoluz|orbit/iu.test(t)&&/sole/iu.test(t)&&/anno/iu.test(t),
  seasonsNotDistance:/stagion/iu.test(t)&&/inclin|asse/iu.test(t)&&/non.{0,55}distanz/iu.test(t),
  tidesMoonSun:/luna/iu.test(t)&&/sole/iu.test(t)&&/maree/iu.test(t)&&/influen|influis|incid|contrib/iu.test(t),
  eclipseAlignmentNotEveryLunation:/ecliss/iu.test(t)&&/alline/iu.test(t)&&/non.{0,55}lunazion/iu.test(t),
  hypothesesRepeatability:/ipotes/iu.test(t)&&/verific/iu.test(t)&&/osserv/iu.test(t)&&/ripet/iu.test(t),
  singleResultNoProof:/risultat|dato|esito/iu.test(t)&&/isolat|singol|sol(o|a)/iu.test(t)&&/non.{0,65}(dimostr|prov|bast)/iu.test(t),
  descriptionVsCauses:/descriz|descriv/iu.test(t)&&/caus/iu.test(t)&&/variazion/iu.test(t)
 };
 return {checks,passed:Object.values(checks).filter(Boolean).length,
  total:Object.keys(checks).length,heuristicOnly:true};
}
if(!KEY){evidence.providerResult={status:0,code:'MISSING_PREEXISTING_FREE_KEY'};persist();process.exit(2)}
const res={code:200,head:{},payload:null,status(n){this.code=n;return this},json(x){this.payload=x;return this},setHeader(k,v){this.head[k]=v;return this}};
const req={method:'POST',body,headers:{},env:{AI_API_KEY:KEY,AI_MODEL:evidence.model,STUDYBOOK_FACT_FIRST_V109:'1'}};
evidence.realModelGenerationsRequested=1;persist();
try{
 await handler(req,res);
 const data=res.payload;
 evidence.providerResult={status:res.code,code:data?.code||null,
  finishReason:data?.finishReason||null,model:data?.model||evidence.model,
  experiment:data?.factFirstPilotV109||null,
  outputTokensUsed:data?.outputTokensUsed??null};
 if(res.code!==200){
  evidence.providerResult.recoverable=[429,503,504].includes(res.code);
  evidence.providerResult.providerMessage=String(data?.error||'').slice(0,150);
 }else{
  const text=data?.parts?.find(x=>x.id==='1:1')?.text||'';
  if(text){
   evidence.modelGenerationsReceived=1;
   evidence.finalText=text;
   const checklist=relationChecks(text);
   const fidelity=auditFidelity(source,text);
   evidence.sourceFactChecklist=checklist;
   evidence.actualLetters=studyLetters(text);
   evidence.achievedReduction=100*(1-evidence.actualLetters/evidence.originalLetters);
   evidence.geometryReview=data?.geometryReviewV78?.groups?.[0]??null;
   evidence.lengthReview=data?.lengthReview?{
     withinBand:data.lengthReview.withinBand,compliant:data.lengthReview.compliant,
     achievedReduction:data.lengthReview.achievedReduction
   }:null;
   evidence.preliminaryFidelity={
    missingProtectedCount:fidelity.missingProtected?.length||0,
    qualifierMismatchCount:fidelity.qualifierMismatches?.length||0,
    heuristicOnly:true};
   evidence.numericGridPass=evidence.geometryReview?.pass===true &&
    evidence.lengthReview?.compliant===true;
  }
 }
}catch(e){evidence.providerResult={status:0,code:'WORKER_EXECUTION_ERROR',
  errorType:String(e?.name||'Unknown').slice(0,50)}}
evidence.finishedAt=new Date().toISOString();persist();
console.log('LAB109_REAL_WORKER',JSON.stringify({status:evidence.providerResult?.status,
 received:evidence.modelGenerationsReceived,actualReduction:evidence.achievedReduction,
 geometry:evidence.geometryReview?{rows:evidence.geometryReview.rows,cap:evidence.geometryReview.maxRows,pass:evidence.geometryReview.pass}:null,
 sourceChecks:evidence.sourceFactChecklist?{passed:evidence.sourceFactChecklist.passed,total:evidence.sourceFactChecklist.total}:null,
 semanticCertified:false,approvedForApp:false}));
if(evidence.modelGenerationsReceived!==1||evidence.providerResult?.status!==200)process.exitCode=2;
