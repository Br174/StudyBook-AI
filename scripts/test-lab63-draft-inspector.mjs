import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inspectStudyDraftPagesV63,STUDY_LEVELS_V63} from '../src/lib/studyDraftInspectorV63.js';

const N=44;
const chapters=[{title:'Filosofia del diritto',pageStart:1,pageEnd:N,
 paragraphs:Array.from({length:N},(_,i)=>({
  original:'Testo originale della pagina '+(i+1),
  sourcePageStart:i+1,sourcePageEnd:i+1}))}];
const six=['summary','50','40','30','20','10'];
const checkpoint={
 draftComplete:true,checkpointPersistent:true,phase:'review',
 draftRowsV57:[Array.from({length:N},(_,i)=>({
  editions:Object.fromEntries(six.map(k=>[k,'Bozza '+k+' pagina '+(i+1)]))
 }))],
 stagedRows:[Array.from({length:N},(_,i)=>({
  editions:Object.fromEntries(six.map(k=>[k,k==='summary'&&i>=1&&i<=16
   ?'Testo approvato pagina '+(i+1):null])),
  verified:Object.fromEntries(six.map(k=>[k,k==='summary'&&i>=1&&i<=16]))
 }))],
 rows:[Array.from({length:N},()=>({
  editions:Object.fromEntries(six.map(k=>[k,null])),
  verified:Object.fromEntries(six.map(k=>[k,false]))
 }))],
 publishedThroughPage:Object.fromEntries(six.map(k=>[k,0]))
};
const book={canonicalBookMap:{pageCount:N},chapters,editionsV36:checkpoint};
const before=JSON.stringify(book);
const report=inspectStudyDraftPagesV63(book,'summary');
assert.equal(report.total,44);
assert.equal(report.approved,16,'16 real approved checkpoint pages');
assert.equal(report.published,0,'page 1 missing blocks public reader');
assert.equal(report.drafted,44,'all 44 summary drafts exist');
assert.deepEqual(report.pages.filter(p=>p.approved).map(p=>p.page),
 Array.from({length:16},(_,i)=>i+2),'identify actual approved pages 2..17');
assert.equal(report.pages[0].state,'draft');
assert.equal(report.pages[0].approved,false);
assert.match(report.pages[0].original,/pagina 1/);
assert.match(report.pages[0].draft,/Bozza summary pagina 1/);
assert.equal(report.pages[0].accepted,'');
assert.equal(report.pages[1].approved,true);
assert.equal(report.pages[1].publishedInReader,false);
assert.match(report.pages[1].accepted,/approvato pagina 2/);
assert.equal(report.canProveOriginLab,false,
 'old checkpoints never record per-page LAB version');
assert.equal(report.checkpointUpdatedAt,null);
assert.equal(JSON.stringify(book),before,'read-only; no mutations');
const other=inspectStudyDraftPagesV63(book,'10');
assert.equal(other.drafted,44);assert.equal(other.approved,0);
assert.deepEqual(STUDY_LEVELS_V63.map(x=>x.id),six);
const distinct=structuredClone(book);
distinct.editionsV36.publishedThroughPage.summary=2;
distinct.editionsV36.rows[0][1].editions.summary='Testo approvato pagina 2';
distinct.editionsV36.rows[0][1].verified.summary=true;
const mixed=inspectStudyDraftPagesV63(distinct,'summary');
assert.equal(mixed.approved,16);
assert.equal(mixed.published,1,'published text is a separate status');

// Two conceptual units in same physical page: a page is not approved unless
// EVERY unit has text and approval, exactly as the LAB59 counter works.
const partial=structuredClone(book);
partial.chapters[0].paragraphs.push({
 original:'Seconda parte pagina 2',sourcePageStart:2,sourcePageEnd:2});
partial.editionsV36.draftRowsV57[0].push({
 editions:Object.fromEntries(six.map(k=>[k,'Altra bozza '+k]))});
partial.editionsV36.stagedRows[0].push({
 editions:Object.fromEntries(six.map(k=>[k,null])),
 verified:Object.fromEntries(six.map(k=>[k,false]))});
partial.editionsV36.rows[0].push({
 editions:Object.fromEntries(six.map(k=>[k,null])),
 verified:Object.fromEntries(six.map(k=>[k,false]))});
const p=inspectStudyDraftPagesV63(partial,'summary');
assert.equal(p.pages[1].state,'partial');
assert.equal(p.pages[1].acceptedUnits,1);
assert.equal(p.pages[1].units,2);
assert.equal(p.approved,15,'do not falsely count partially approved page');
const noMap=structuredClone(book);
noMap.chapters[0].paragraphs[43].sourcePageStart=null;
noMap.chapters[0].paragraphs[43].sourcePageEnd=null;
const missing=inspectStudyDraftPagesV63(noMap,'summary');
assert.equal(missing.pages[43].state,'unmapped');
assert.equal(missing.pages[43].accepted,'');
assert.equal(inspectStudyDraftPagesV63({...book,editionsV36:{
 ...checkpoint,checkpointPersistent:false}},'summary').approved,0,
 'unsaved checkpoint must not claim verified and persisted pages');
const ui=readFileSync('src/components/StudyDraftInspectorV63.jsx','utf8');
const screen=readFileSync('src/components/AppScreens.jsx','utf8');
assert.ok(screen.includes('Controlla pagine elaborate'));
assert.ok(screen.includes('<StudyDraftInspectorV63'));
assert.ok(ui.includes('Solo approvate'));
assert.ok(ui.includes('Bozza Gemini salvata'));
assert.ok(ui.includes('Testo approvato nel checkpoint'));
assert.ok(ui.includes('Testo originale'));
assert.ok(ui.includes('non registrano da quale LAB proviene ogni pagina'));
for(const disallowed of [/fetch\s*\(/,/axios\./,/generateDraftFirstV57/,/saveLibraryBook/,/setStudyBook/,/localStorage\./]){
 assert.equal(disallowed.test(ui),false,'inspector must not write or call network: '+disallowed);
}
console.log('LAB63 PASS: 16/44 real approved pages identified in checkpoint, 0 visible with page1 unpublished, 44/44 drafts inspectable, six independent versions, partial/missing mapping guarded, only read existing texts, no invented provenance or Gemini call.');
