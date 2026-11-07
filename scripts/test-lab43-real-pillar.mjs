import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import {auditProgressiveConcepts} from '../src/lib/fidelityEngine.js';
import {STUDY_PILLAR_VERSION,STUDY_ORDER,STUDY_PERCENTAGES,studyLetters,exactRetained,allocateExactLetterBudgets} from '../src/lib/studyPillarV38.js';
import {auditGeminiLevels,generateGeminiEditionsV36} from '../src/lib/generativeEditionsV36.js';
import {clearGeminiPause} from '../src/lib/geminiQuotaControllerV36.js';

assert.equal(STUDY_PILLAR_VERSION,'studybook-progressive-v38-1');
assert.deepEqual(STUDY_ORDER,['summary','50','40','30','20','10','0']);
assert.deepEqual(STUDY_PERCENTAGES,[10,20,30,40,50]);
assert.equal(auditProgressiveConcepts('La norma giuridica impone obblighi.','La regola prescrive doveri.').supported,true);
assert.equal(auditProgressiveConcepts('La norma tutela diritti e doveri.','La musica descrive un concerto.').supported,false);
assert.equal(auditProgressiveConcepts('La norma tutela il diritto.','La norma tutela il diritto secondo l’articolo 999.').supported,false);
assert.equal(auditGeminiLevels('La norma non consente il ricorso.',{summary:'La norma consente il ricorso.'},
 {pillar:true,summaryCapLetters:70}).verified.summary,false);
const clause='La norma disciplina i rapporti sociali. ';
const sources=[clause.repeat(8),clause.repeat(9),clause.repeat(10)].map(value=>value.trim());
const createBook=key=>({studyPillarV38:STUDY_PILLAR_VERSION,
 canonicalBookMap:{originalFingerprint:key,uncertain:[],pages:[{physicalPage:1,sourceStatus:'verified'}]},
 chapters:[{title:'Filosofia del diritto',paragraphs:sources.map(original=>({original,sourcePageStart:1,sourcePageEnd:1}))}]});
const caps=allocateExactLetterBudgets(sources,50);caps[0]--;
const originalLetters=sources.reduce((n,s)=>n+studyLetters(s),0);
function simulatedValid(target){
 let answer='';
 while(studyLetters(answer)+studyLetters(clause)<target-4)answer+=clause;
 return (answer+'n'.repeat(Math.max(0,target-studyLetters(answer)))+'.').trim();
}
const oldFetch=globalThis.fetch;
try{
 await clearGeminiPause();
 let failure=true,calls=[];
 globalThis.fetch=async(_url,{body})=>{
  const r=JSON.parse(body);calls.push(r);
  assert.equal(r.policy,STUDY_PILLAR_VERSION,'Real Android pillar must be enabled');
  const i=sources.indexOf(r.source);assert.ok(i>=0);
  assert.equal(r.summaryCapLetters,caps[i],'No fixed 42% summary cap');
  if(r.level!=='summary')assert.equal(r.targetLetters,allocateExactLetterBudgets(sources,Number(r.level))[i]);
  const target=r.level==='summary'?Math.max(1,caps[i]-8):r.targetLetters;
  const edition=failure&&i===0?'Una canzone senza attinenza.':simulatedValid(target);
  return new Response(JSON.stringify({engine:'ai',sourceVersion:'original',
    editions:{[r.level]:edition}}),{status:200});
 };
 const partial=await generateGeminiEditionsV36(createBook('lab43-actual-pillar'),{paceMs:0});
 assert.equal(partial.complete,false);
 assert.equal(partial.execution.haltedOn,'AI_QUALITY_REVIEW_REQUIRED','LAB46 staged pillar must pause later editions while a summary is unverified');
 assert.equal(partial.verifiedChunkVariants,2,'Other two summary chunks must be verified while the first is quarantined');
 assert.equal(partial.rows[0][1].verified.summary,true);
 assert.equal(partial.rows[0][2].verified.summary,true);
 assert.equal(partial.rows[0][1].verified['50'],undefined,'Do not start 50% before the whole summary is verified');
 assert.equal(partial.rows[0][0].verified.summary,false,'No silent approval of off-topic draft');
 assert.ok(partial.diagnostics.quality.reasons.includes('source-topic-support-insufficient'));
 assert.equal(calls.length,4,'Only 2 rejected draft attempts plus 2 successful summaries; no advanced reductions before verified summary');
 failure=false;const count=calls.length;
 const restored=await generateGeminiEditionsV36(createBook('lab43-actual-pillar'),{paceMs:0});
 assert.equal(restored.complete,true,'Persisted checkpoint must resume the first chunk');
 assert.equal(calls.length-count,16,'One repaired summary plus 15 later edition requests; two previously verified summaries are reused');
 assert.ok(calls[count].repairDraft,'The rejected draft is available for guided repair');
 for(const pct of STUDY_PERCENTAGES){
  const size=restored.rows[0].reduce((sum,row)=>sum+studyLetters(row.editions[String(pct)]),0);
  assert.equal(size,exactRetained(originalLetters,pct),'Exact whole-book '+pct+'%');
 }
 const completed=calls.length;
 assert.equal((await generateGeminiEditionsV36(createBook('lab43-actual-pillar'),{paceMs:0})).complete,true);
 assert.equal(calls.length,completed,'Verified checkpoints prevent duplicate calls');
 globalThis.fetch=async(_url,{body})=>{
  const r=JSON.parse(body);calls.push(r);
  return new Response(JSON.stringify({engine:'ai',sourceVersion:'original',
    editions:{[r.level]:'Una canzone estranea alla fonte.'}}),{status:200});
 };
 calls=[];
 const stopped=await generateGeminiEditionsV36(createBook('lab43-three-failed-chunks'),{paceMs:0});
 assert.equal(stopped.execution.haltedOn,'AI_QUALITY_REVIEW_REQUIRED','Systemic outage circuit preserved');
 assert.equal(calls.length,6,'At most six failed requests for three bad chunks');
 console.log('LAB43 / LAB46 STAGED PILLAR TEST PASS: semantic guard, complete summary before 50%, verified neighbors, exact budgets, resumable rejected chunk, systemic circuit');
}finally{globalThis.fetch=oldFetch;await clearGeminiPause();}
