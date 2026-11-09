// LAB108: source-literal-only correction on three existing real Gemini drafts.
// Reuse LAB106's authoritative localSourcePatchV106; no new generator or provider calls.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {localSourcePatchV106,virtualRowsV106} from '../src/lib/studySingleCallGateV106.js';
import {sourceLetterBudgetV74} from '../src/lib/studyPageBudgetsV74.js';
import {studyLetters} from '../src/lib/studyPillarV38.js';
import {classifyMeasuredResultV107} from '../src/lib/studyInverseCalibrationV107.js';
import {semanticGuard} from './lab98-modal-semantic-guard.mjs';
const base=JSON.parse(readFileSync('audit/reports/lab108-real-source-preserving.json','utf8'));
const fixture=JSON.parse(readFileSync('audit/test-fixtures/lab89-semantic-concepts.json','utf8')).sources.find(x=>x.id==='procedura');
const source=fixture.concepts.join(' ').replace(/\s+/gu,' ').trim();
const cases=[
 {level:'10',arm:'ANCHORED_SECTIONS',oldSpan:'regola',newSpan:'regola interna',expectedLetters:603,expectedRows:13,expectedReduction:5.19},
 {level:'20',arm:'COPY_EDIT',oldSpan:'norma',newSpan:'regola interna',expectedLetters:481,expectedRows:11,expectedReduction:24.37},
 {level:'40',arm:'ANCHORED_SECTIONS',oldSpan:'regola',newSpan:'regola interna',expectedLetters:404,expectedRows:9,expectedReduction:36.48}
];
const out={lab:'LAB108 source-literal offline postchecks',createdAt:new Date().toISOString(),
 source:'procedura',sourceOriginalPreserved:true,canonicalPatchOwner:'localSourcePatchV106',
 geminiCalls:0,certifiedSemantic:0,approvedForApp:false,
 sourceFact:'regola interna',cases:[],complete:false};
for(const c of cases){
 const old=base.results.find(r=>r.id==='procedura'&&r.level===c.level&&r.arm===c.arm&&r.valid);
 assert.ok(old,'existing immutable Gemini answer for '+c.level);
 const patch=localSourcePatchV106(source,old.outputText,{oldSpan:c.oldSpan,newSpan:c.newSpan});
 assert.equal(patch.applied,true,'patch must reuse verified source literal');
 assert.equal(old.outputText.split(c.oldSpan).length,2,'single unique replacement');
 const budget=sourceLetterBudgetV74(studyLetters(source),c.level);
 const layout=virtualRowsV106(patch.text);
 const measured=classifyMeasuredResultV107({budget,outputLetters:studyLetters(patch.text),
  originalPageRows:virtualRowsV106(source).rows,
  gridPass:layout.rows<=old.maxRows&&!layout.overlong,semanticReviewPassed:false});
 const alerts=semanticGuard('procedura',source,patch.text,{level:Number(c.level)}).alerts||[];
 assert.equal(studyLetters(patch.text),c.expectedLetters);
 assert.equal(layout.rows,c.expectedRows);
 assert.equal(measured.achievedReduction,c.expectedReduction);
 assert.equal(measured.quantitativePass,true);
 assert.equal(measured.gridPass,true);
 assert.equal(measured.fullyApproved,false);
 out.cases.push({level:c.level,arm:c.arm,oldDraftRetained:true,patchApplied:true,
  sourcePatch:{oldSpan:c.oldSpan,newSpan:c.newSpan},
  before:{letters:old.outputLetters,reduction:old.achievedReduction,rows:old.rows,warnings:old.preliminarySemanticWarnings},
  after:{letters:studyLetters(patch.text),reduction:measured.achievedReduction,rows:layout.rows,
   maxRows:old.maxRows,mathGridPass:true,preliminaryWarnings:alerts,semanticCertified:false,approvedForApp:false,
   outputText:patch.text}});
}
out.complete=true;
mkdirSync('audit/reports',{recursive:true});
writeFileSync('audit/reports/lab108-three-local-literal-patches.json',JSON.stringify(out,null,2)+'\n');
console.log('LAB108_THREE_LITERAL_PATCHES',JSON.stringify({cases:out.cases.length,complete:out.complete,
 percentages:out.cases.map(c=>c.after.reduction),warnings:out.cases.map(c=>c.after.preliminaryWarnings.length),
 providerCalls:0,approvedForApp:false}));
