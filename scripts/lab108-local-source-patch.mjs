// MotorLab StudyBook LAB108: zero-provider, source-anchored repair of a real
// Gemini draft from LAB108, using the existing LAB106 safe literal patch owner.
// This is an isolated proof, NOT an automatic correction of other books.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {localSourcePatchV106,virtualRowsV106} from '../src/lib/studySingleCallGateV106.js';
import {sourceLetterBudgetV74} from '../src/lib/studyPageBudgetsV74.js';
import {studyLetters} from '../src/lib/studyPillarV38.js';
import {classifyMeasuredResultV107} from '../src/lib/studyInverseCalibrationV107.js';
import {semanticGuard} from './lab98-modal-semantic-guard.mjs';
const previous=JSON.parse(readFileSync('audit/reports/lab108-real-source-preserving.json','utf8'));
const fixture=JSON.parse(readFileSync('audit/test-fixtures/lab89-semantic-concepts.json','utf8')).sources.find(x=>x.id==='procedura');
const source=fixture.concepts.join(' ').replace(/\s+/gu,' ').trim();
const candidate=previous.results.find(r=>r.id==='procedura'&&r.level==='20'&&r.arm==='COPY_EDIT'&&r.valid);
assert.ok(candidate);
const result=localSourcePatchV106(source,candidate.outputText,{oldSpan:'norma',newSpan:'regola interna'});
assert.equal(result.applied,true);
assert.equal((candidate.outputText.match(/norma/gu)||[]).length,1);
assert.ok(source.includes('regola interna'));
const budget=sourceLetterBudgetV74(studyLetters(source),'20'),layout=virtualRowsV106(result.text);
const originalRows=virtualRowsV106(source).rows;
const measured=classifyMeasuredResultV107({budget,outputLetters:studyLetters(result.text),originalPageRows:originalRows,gridPass:layout.rows<=candidate.maxRows&&!layout.overlong,semanticReviewPassed:false});
const warnings=semanticGuard('procedura',source,result.text,{level:20}).alerts||[];
const output={
 lab:'LAB108 source-anchored local correction',source:'procedura',level:'20',
 method:'reuse localSourcePatchV106 with immutable original literal',
 fromOriginalAnswer:'LAB108 COPY_EDIT',sourcePolicyOwner:'studyPageBudgetsV74',
 before:{letters:candidate.outputLetters,reduction:candidate.achievedReduction,rows:candidate.rows,preliminaryAlerts:candidate.preliminarySemanticWarnings.length},
 after:{letters:studyLetters(result.text),reduction:measured.achievedReduction,
  rows:layout.rows,maxRows:candidate.maxRows,numericPass:measured.quantitativePass,
  gridPass:measured.gridPass,preliminaryAlerts:warnings,
  semanticCertified:false,approvedForApp:false,outputText:result.text},
 realModelCallsInThisRepair:0,
 originalGeminiUnmodifiedInArchive:true,
 noNewSourceFacts:true,
 publicationBlocked:true};
assert.equal(output.after.letters,481);assert.equal(output.after.rows,11);
assert.equal(output.after.numericPass,true);assert.equal(output.after.gridPass,true);
assert.equal(output.after.reduction,24.37);assert.equal(output.after.approvedForApp,false);
mkdirSync('audit/reports',{recursive:true});
writeFileSync('audit/reports/lab108-local-source-patch.json',JSON.stringify(output,null,2)+'\n');
console.log('LAB108_SOURCE_PATCH',JSON.stringify({passed:true,after:output.after.reduction,rows:output.after.rows,alerts:warnings.length,approvedForApp:false}));
