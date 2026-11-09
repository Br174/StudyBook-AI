// MotorLab LAB78: anti-false-green parity test of REAL Worker handler + REAL
// StudyBook numeric/geometry gate, with a completely NEW synthetic source.
// It mocks only the external Gemini HTTP response and countTokens endpoint;
// it does not pretend this is an independent live Gemini semantic test.
// Historical golden tests remain regression controls, not a release proof.
import assert from 'node:assert/strict';
import handler from '../api/editionsBulkV51.js';
import {studyLetters} from '../src/lib/studyPillarV38.js';
import {studyGeometryPlanV78,studyGeometryReviewV78,studyGeometryPromptV78,
 STUDY_GEOMETRY_V78,wrapStudyWordsV78,largestRemainderV78} from '../src/lib/studyGeometryV78.js';
import {pageLetterBudgetsV74} from '../src/lib/studyPageBudgetsV74.js';
import {STUDY_DRAFT_PROTOCOL_V74} from '../src/lib/studyDraftProtocolV74.js';
import {buildUnitBudgetsV71} from '../src/lib/studyDraftProtocolV71.js';
import {blockLetterTargetV51,planNaturalBlocksV51} from '../src/lib/integralPlannerV51.js';
import {studyQualityInspectionV66,finalizeStudyQualityV66} from '../src/lib/studyQualityV66.js';

const levels=['summary','50','40','30','20','10'];
const original='Nel corso della storia delle idee giuridiche, le norme sono state interpretate in contesti differenti. Una regola può essere applicata soltanto alle condizioni previste dalla sua fonte. Gli studenti devono distinguere una descrizione generale da un obbligo preciso, conservando le eccezioni e i limiti. Una testimonianza documentata non è necessariamente una prova conclusiva, e il confronto con più fonti può ridurre gli errori. Nessuna conclusione dipende da una sola parola: occorre controllare chi agisce, in quale periodo e con quale ragione.';
const makeUnit=(page,id='0:0')=>({id,ci:0,pi:page-1,
 source:original+' Identificativo pagina '+page+'.',
 pageStart:page,pageEnd:page,chapterTitle:'Storia del diritto',sectionTitle:'Fonti'});
const units=[makeUnit(1)];
const sum=arr=>arr.reduce((a,b)=>a+b,0);
const scripts=[];
const first=studyGeometryPlanV78(units,'20');
assert.equal(first.policy,STUDY_GEOMETRY_V78);
assert.equal(first.width,60);
assert.equal(first.groups.length,1);
assert.equal(first.groups[0].sourceLetters,studyLetters(units[0].source));
assert(first.groups[0].maxRows>0);
assert.equal(first.groups[0].unitTargets.reduce((n,u)=>n+u.targetLetters,0),first.groups[0].targetLetters);
assert(studyGeometryPromptV78(first).includes('max '+first.groups[0].maxRows+' righe di 60 posizioni'));
assert.deepEqual(largestRemainderV78(10,[1,1,1]),[4,3,3]);
const layout=wrapStudyWordsV78('Una frase completa senza parole artificialmente spezzate.',60);
assert.equal(layout.overlong,false);
assert(layout.lines.every(t=>[...t].length<=60));
assert.equal(wrapStudyWordsV78('P'.repeat(61)).overlong,true);

const fortyFour=Array.from({length:44},(_,i)=>makeUnit(i+1,'0:'+i));
const batches={};
for(const level of levels){
 batches[level]=planNaturalBlocksV51(fortyFour,level).length;
 assert.equal(batches[level],1,'USER_APPROVED_LARGE_BLOCK_REGRESSION '+level);
 const plan=studyGeometryPlanV78(fortyFour,level);
 assert.equal(plan.groups.length,44);
 assert.equal(sum(plan.groups.map(g=>g.targetLetters)),
  plan.groups.reduce((n,g)=>n+g.targetLetters,0));
 assert(studyGeometryPromptV78(plan).includes('Pagina 44:'));
}
const oldFetch=globalThis.fetch;
const response={
 headers:new Map(),statusCode:200,setHeader(k,v){this.headers.set(k,v);return this},
 status(n){this.statusCode=n;return this},json(d){this.body=d;return this}
};
let generationCalls=0,tokenCountCalls=0,lastSystemPrompt='';
try{
 globalThis.fetch=async (url,opts)=>{
  if(String(url).includes(':countTokens')){
   tokenCountCalls++;
   return new Response(JSON.stringify({totalTokens:1800}),{status:200});
  }
  generationCalls++;
  const sent=JSON.parse(opts.body);
  lastSystemPrompt=sent.messages[0].content;
  // Simulated very short response, reproducing the observed REAL phone
  // underlength range but with an unrelated original page.
  return new Response(JSON.stringify({choices:[{
    message:{content:JSON.stringify({parts:[{id:'0:0',text:'Le norme cambiano nel tempo; serve confrontare fonti.'}]})},
    finish_reason:'stop'
   }],usage:{completion_tokens:32}}),{status:200});
 };
 const body={
   phase:'draft-v74',draftProtocol:STUDY_DRAFT_PROTOCOL_V74,
   geometryPolicyV78:STUDY_GEOMETRY_V78,
   pageBudgetsV74:pageLetterBudgetsV74(units,'20'),
   unitBudgets:buildUnitBudgetsV71(units,'20'),
   bookTitle:'Test nuovo, non presente nei campioni LAB104',
   level:'20',targetLetters:blockLetterTargetV51(units,'20').targetLetters,
   summaryCapLetters:null,maxOutputTokens:4096,timeoutMs:55000,
   units:units.map(u=>({id:u.id,source:u.source,
     chapterTitle:u.chapterTitle,sectionTitle:u.sectionTitle,
     pageStart:u.pageStart,pageEnd:u.pageEnd}))
 };
 await handler({method:'POST',env:{AI_API_KEY:'fake-offline-no-network',
    STUDYBOOK_PREFERRED_EDITION_MODEL:'gemini-3.5-flash-lite'},body},response);
 assert.equal(response.statusCode,200,JSON.stringify(response.body));
 assert.equal(generationCalls,1,'ONLY_ONE_MODEL_GENERATION_DISPATCH');
 assert.equal(tokenCountCalls,1,'TOKEN_PREFLIGHT_IS_NOT_GENERATION');
 assert.equal(response.body.geometryPolicyV78,STUDY_GEOMETRY_V78);
 assert.equal(response.body.geometryReviewV78.complete,false);
 assert.equal(response.body.lengthReview.pageReviewV74.withinBand,false);
 assert(lastSystemPrompt.includes('60 posizioni per riga monospaziata'));
 assert(lastSystemPrompt.includes('max '+first.groups[0].maxRows+' righe di 60 posizioni'));
 assert(lastSystemPrompt.includes('7,844 spazi naturali'));
 // A stale LAB77 app must never silently bypass LAB78 geometry contract.
 const rejected={...response,statusCode:200,body:null};
 await handler({method:'POST',env:{AI_API_KEY:'fake-offline-no-network'},
  body:{...body,geometryPolicyV78:null}},rejected);
 assert.equal(rejected.statusCode,409);
 assert.equal(rejected.body.code,'AI_GEOMETRY_PROTOCOL_REQUIRED');
 assert.equal(generationCalls,1);

 const book={canonicalBookMap:{pageCount:1},
 chapters:[{paragraphs:[{original:units[0].source}]}]};
 const bad=response.body.parts[0].text;
 const draft=[[{editions:Object.fromEntries(levels.map(l=>[l,bad]))}]];
 const staged=[[{editions:{},verified:{},issues:{}}]];
 const check=studyQualityInspectionV66(book,units,staged,draft);
 assert.equal(check.full,false,'DRAFT_MUST_NOT_BE_SIX_VERSIONS_COMPLETE');
 for(const level of levels){
  assert.equal(check.levels[level].quantitativeAndGeometryCompliantV78,false);
  assert.equal(check.publicRows[0][0].draftAvailableV78[level],true);
  assert.equal(check.publicRows[0][0].numericConformantV78[level],false);
  assert.equal(check.levels[level].state,'needs-calibration');
 }
 const status=finalizeStudyQualityV66(book,units,staged,draft,
  {draftComplete:true,checkpointPersistent:true,diagnostics:{},sourceFingerprint:'f'.repeat(64)});
 assert.equal(status.complete,false);
 assert.equal(status.status,'quality-notes');
 assert.equal(status.qualityV66.summary.numericAndGeometryCompleteV78,false);
 assert.equal(status.draftRowsV57,draft,'NEVER_DELETE_STORED_DRAFTS');
 scripts.push({test:'same-real-handler-geometry-source-to-prompt',passed:true});
 scripts.push({test:'single-model-generation-through-handler',passed:true});
 scripts.push({test:'real-handler-rejects-stale-geometry-client-before-model',passed:true});
 scripts.push({test:'real-StudyBook-final-qa-refuses-83-percent-fake-completion',passed:true});
 scripts.push({test:'all-44-source-pages-large-single-block-on-all-six-levels',passed:true});
 console.log('LAB78_WORKER_ANDROID_PARITY_PASS',JSON.stringify({
  tests:scripts.length,modelCalls:generationCalls,tokenCountCalls,
  promptContains60Col:true,sourceGroupCount:44,
  largeBlockCountByLevel:batches,savedDraftsIntact:true,
  falseGreenUnderlength:false,
  actualGeminiCalls:0,realAndroidBookSemanticsNotProven:true
 }));
}finally{
 globalThis.fetch=oldFetch;
}
