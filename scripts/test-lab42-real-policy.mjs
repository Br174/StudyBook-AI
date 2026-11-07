// LAB42 real free-tier Gemini test using actual mandatory study-pillar request fields.
// This probe does NOT claim the full user book is complete or accurately summarized.
import assert from 'node:assert/strict';
import {appendFileSync} from 'node:fs';
import {STUDY_PILLAR_VERSION,studyLetters,exactRetained,coreAnchors} from '../src/lib/studyPillarV38.js';
import {auditGeminiLevels} from '../src/lib/generativeEditionsV36.js';
const url='https://studybook-ai-lab42.brunoverlezza.workers.dev/api/editions/v36';
const names=coreAnchors('Piuttosto, le norme si distinguono. Distinzione tra leggi. Kant e Bobbio studiano il diritto.');
assert.ok(!names.includes('Piuttosto')&&!names.includes('Distinzione'));
assert.ok(names.includes('Kant')&&names.includes('Bobbio'));
const source='La norma giuridica disciplina i rapporti sociali. La norma giuridica è generale e obbligatoria. La norma giuridica stabilisce regole di convivenza e attribuisce diritti e obblighi. La filosofia del diritto studia il significato delle norme e della giustizia.';
const before=studyLetters(source);
const level='summary';
const cap=exactRetained(before,58);
async function makeRequest(repairIssues=[],repairDraft=null){
 const response=await fetch(url,{
  method:'POST',headers:{'Content-Type':'application/json'},
  body:JSON.stringify({source,level,policy:STUDY_PILLAR_VERSION,summaryCapLetters:cap,
    repairIssues,repairDraft,
    context:{chapterTitle:'Filosofia del diritto',sectionTitle:'La norma giuridica'}}),
  signal:AbortSignal.timeout(145000)
 });
 const body=await response.json().catch(()=>null);
 if([429,503].includes(response.status)&&['AI_QUOTA_LIMIT','AI_QUOTA_MANUAL_REVIEW','AI_TEMPORARY_OVERLOAD'].includes(body?.code)){
  console.log('LAB42_REAL_PILLAR=QUOTA_BLOCKED_NOT_VERIFIED');
  appendFileSync(process.env.GITHUB_STEP_SUMMARY,'\\nLAB42 real study-pillar Gemini: NOT VERIFIED because of free quota, no billing.\\n');
  process.exit(0);
 }
 if(!response.ok){
  console.log('LAB42_REAL_PILLAR=PROVIDER_ERROR',response.status,body?.code||'unknown',body?.diagnostic?.reason||'unknown');
  throw Error('Real Gemini failed actual study-policy request; cannot claim acceptance');
 }
 assert.equal(body.policyVersion,STUDY_PILLAR_VERSION);
 assert.equal(body.diagnostic?.format,'json_schema');
 assert.ok(typeof body?.editions?.summary==='string'&&body.editions.summary.trim(),'No real generated content');
 return body.editions.summary;
}
let content=await makeRequest();
let audit=auditGeminiLevels(source,{summary:content},{pillar:true,summaryCapLetters:cap});
console.log('LAB42_POLICY_DRAFT',JSON.stringify({originalLetters:before,cap,draftLetters:studyLetters(content),
  passed:audit.verified.summary,issueCodes:(audit.issues.summary||[]).map(s=>s.split(':')[0])}));
if(!audit.verified.summary){
 // Exactly the same focused single repair that StudyBook invokes on a failed edition.
 const previous=content;
 content=await makeRequest(audit.issues.summary,previous);
 audit=auditGeminiLevels(source,{summary:content},{pillar:true,summaryCapLetters:cap});
}
const outputLetters=studyLetters(content);
const result=audit.verified.summary?'SEMANTIC_AND_FORMAT_GUARDS_PASS':'QUALITY_REVIEW_REQUIRED';
console.log('LAB42_REAL_PILLAR='+result,
 'sourceLetters='+before,'summaryCap='+cap,'resultLetters='+outputLetters,
 'issues='+JSON.stringify((audit.issues.summary||[]).map(s=>s.split(':')[0])));
appendFileSync(process.env.GITHUB_STEP_SUMMARY,
 '\\nLAB42 real progressive policy: '+result+
 '. Real generated summary '+outputLetters+' letters; hard cap '+cap+
 '. Full 44-page device acceptance remains PENDING.\\n');
if(!audit.verified.summary)throw Error('Real Gemini refused actual study-pillar constraints even after focused repair');

