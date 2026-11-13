#!/usr/bin/env node
// LAB129: no provider or device calls. Protect all four study tools and screen-only layout.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {studyToolBookForExplainedV129} from '../src/lib/explainedStudyToolsV129.js';
import {glossaryForExplainedPageV129} from '../src/lib/explainedMobileLayoutV129.js';
import {buildFlashcards,buildQuiz,buildOralQuestions,buildConceptMap}
 from '../src/lib/studyTools.js';

const paragraph=[
 'Il diritto è un insieme di norme che disciplina i rapporti tra persone.',
 'La validità è la condizione che permette di riconoscere le regole del sistema.',
 'La sociologia del diritto indica lo studio dei comportamenti e delle norme.'
].join(' ');
const source={canonicalBookMap:{
 originalFingerprint:'f'.repeat(64),pageCount:2,chapters:[],
 pages:[1,2].map(n=>({physicalPage:n,label:String(n),sourceStatus:'verified',
  text:paragraph,widthPt:595,heightPt:842}))
}};
const explained={chapters:[],canonicalBookMap:source.canonicalBookMap};
const adapted=studyToolBookForExplainedV129(explained,source);
assert.equal(adapted.chapters.length,2);
assert.equal(adapted.chapters[0].paragraphs[0].original,paragraph);
assert.notEqual(adapted,explained,'Only the ephemeral study view may be adapted.');
const chapter=adapted.chapters[0];
assert.ok(buildFlashcards(chapter).length>0,'Flashcards must be available.');
assert.ok(buildQuiz(chapter).length>0,'Quiz must be available.');
assert.ok(buildOralQuestions(chapter).length>0,'Oral questions must be available.');
assert.ok(buildConceptMap(chapter).length>0,'Concept map must be available.');
assert.equal(JSON.stringify(explained),JSON.stringify({
 chapters:[],canonicalBookMap:source.canonicalBookMap
}),'Stored source/view must remain untouched.');
const already={...adapted,chapters:[{title:'Capitolo esistente',paragraphs:[
 {original:paragraph,sourcePageStart:1}]}]};
assert.equal(studyToolBookForExplainedV129(already,source),already,
 'Never change existing chapter-based study tools.');
const glossary=glossaryForExplainedPageV129([
 {notes:[{term:'Sociologia del diritto',definition:'Disciplina giuridica.'},
  {term:'Validità',definition:'Proprietà di una norma.'}]},
 {notes:[{term:'sociologia del diritto',definition:'Duplicato.'},
  {term:'Effettività',definition:'Applicazione concreta.'}]}
]);
assert.deepEqual(glossary.map(n=>n.term),[
 'Sociologia del diritto','Validità','Effettività'
]);
const app=readFileSync('src/AppV15.jsx','utf8');
const reader=readFileSync('src/components/ExplainedReaderV122.jsx','utf8');
const css=readFileSync('src/components/ExplainedReaderV122.css','utf8');
const mirrorCss=readFileSync('src/components/MirrorReaderV35.css','utf8');
const mode=readFileSync('src/components/StudyMode.jsx','utf8');
assert.ok(app.includes("isExplainedBookV122(studyBook) && studyEntryMode==='reader'"),
 'Explained books must use different components for reading and studying.');
assert.ok(app.includes('book={studyToolBook}'));
assert.ok(reader.includes('onStudy')&&reader.includes('Studia: carte, quiz'));
assert.ok(reader.includes('sb-explained-simple')&&
 reader.includes('sb-explained-toolbar-top'));
assert.ok(reader.includes('glossary.map('));
assert.ok(!reader.includes('sb-explained-row-aside'));
assert.ok(css.includes('aspect-ratio:auto !important'));
assert.ok(css.includes('overflow-y:auto'));
assert.ok(css.includes('sb-explained-page-controls'));
assert.ok(mirrorCss.includes('aspect-ratio:auto!important'));
assert.ok(mirrorCss.includes('overflow-y:auto'));
assert.ok(mode.includes("'flashcards', 'Flashcard'")&&
 mode.includes("'quiz', 'Quiz'")&&mode.includes("'map', 'Mappa'")&&
 mode.includes("'oral', 'Interrogazione'"));
console.log('LAB129 PASS: grounded quiz, cards, oral, map, source-preserving adapter,');
console.log('top glossary deduplication, independent reader/tools routes and scroll CSS.');
