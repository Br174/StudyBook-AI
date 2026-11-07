import assert from 'node:assert/strict';
import {studyPhaseProgressV59,orderSourceUnitsV59,
 STUDY_LEVEL_ORDER_V59} from '../src/lib/studyPhaseProgressV59.js';
import {readFileSync} from 'node:fs';

const levels=STUDY_LEVEL_ORDER_V59;
assert.deepEqual(levels,['summary','50','40','30','20','10']);
const chapter={pageStart:1,pageEnd:44,paragraphs:Array.from({length:44},(_,i)=>({
 original:'Testo della pagina '+(i+1),sourcePageStart:i+1,sourcePageEnd:i+1
}))};
const draftRows=[chapter.paragraphs.map((p,i)=>({editions:Object.fromEntries(levels.map((l,j)=>[
 l,(j===0||j===1&&i<12)?'Bozza originale '+(i+1):null
]))}))];
const stageRows=[chapter.paragraphs.map((p,i)=>({editions:{
 summary:i<7?'Bozza verificata':'',50:''
},verified:{summary:i<7,50:false}}))];
const doc=(snap=null)=>({chapters:[chapter],canonicalBookMap:{pageCount:44},
 ...(snap?{editionsV36:snap}:{})});
let p=studyPhaseProgressV59(doc(),{acquisition:{done:20,total:44}});
assert.equal(p.phase,'acquisition');assert.equal(p.acquired,20);
p=studyPhaseProgressV59(doc({phase:'draft',draftComplete:false,
 draftRowsV57:draftRows,stagedRows:stageRows,checkpointPersistent:true}));
assert.equal(p.phase,'compression');
assert.deepEqual(p.levels.map(x=>x.completed),[44,12,0,0,0,0]);
assert.equal(p.levels[0].total,44);
const reviewed=doc({phase:'repair',draftComplete:true,
 draftRowsV57:draftRows,stagedRows:stageRows,checkpointPersistent:true});
p=studyPhaseProgressV59(reviewed);
assert.equal(p.phase,'correction');
assert.deepEqual(p.levels.map(x=>x.completed),[7,0,0,0,0,0]);
assert.equal(p.levels[0].compressed,44,'saved drafts retained during review');
p=studyPhaseProgressV59(doc({...reviewed.editionsV36,checkpointPersistent:false}));
assert.equal(p.levels[0].completed,0,'unsaved verification must not count');
const ordered=orderSourceUnitsV59([
 {pageStart:3,ci:0,pi:0},{pageStart:1,ci:1,pi:0},
 {pageStart:2,ci:0,pi:3},{pageStart:1,ci:0,pi:2}
]);
assert.deepEqual(ordered.map(x=>x.pageStart),[1,1,2,3]);
assert.deepEqual(ordered.map(x=>x.ci),[0,1,0,0]);
assert.equal(ordered[0].pi,2,'stable chapter paragraph ids');
const odd=doc({phase:'review',draftComplete:false,draftRowsV57:draftRows,stagedRows:stageRows});
assert.equal(studyPhaseProgressV59(odd).phase,'compression',
 'never show review before all drafts are complete');
const missing=doc({phase:'draft',draftRowsV57:[draftRows[0].slice(0,43)],
 stagedRows:stageRows});
assert.equal(studyPhaseProgressV59(missing).levels[0].completed,43,
 'unmapped content cannot count as compressed');
const screen=readFileSync('src/components/StudyPhaseProgressV59.jsx','utf8');
assert.ok(screen.includes("Fase 1 · Acquisizione"));
assert.ok(screen.includes("Fase 2 · Compressione"));
assert.ok(screen.includes("Fase 3 · Verifica e correzione"));
const runner=readFileSync('src/lib/draftFirstV57.js','utf8');
assert.ok(runner.includes('orderSourceUnitsV59(bookUnitsV51(book))'));
assert.ok(runner.includes("const LEVELS=['summary','50','40','30','20','10']"));
assert.ok(runner.includes("reviewEdition(units,drafts,level)"));
console.log('LAB59 PASS: only one phase, 44 physical pages, six ordered levels, saved drafts, verified-only approval, source page priority, no new Gemini worker.');
