import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildUniversalGlossary,splitUniversalText} from '../src/lib/universalGlossary.js';

const source = 'Il TFR è un diritto nel rapporto di lavoro. INPS e MEF. La CGIL. Art. 2120 del Codice civile; D.Lgs. 81/2008.';
const found = buildUniversalGlossary(source);
const byName=(name)=>found.find(e=>e.term.toLowerCase()===name.toLowerCase());
for (const term of ['TFR','INPS','MEF','CGIL']) {
  assert.ok(byName(term)?.definition?.length > 10, 'curated acronym explained: '+term);
}
assert.ok(found.some(e=>e.kind==='reference' && /2120/.test(e.term)), 'citations detected');
assert.ok(found.some(e=>e.kind==='reference' && /81\/2008/.test(e.term)), 'legislative reference recognized');
assert.ok(found.filter(e=>e.basis==='unverified').every(e=>!e.definition), 'not invented references');

const generic=buildUniversalGlossary('DNA, RNA e CPU: HTTP, RAM e JSON; inoltre il PIL.',[],[]);
for(const name of ['DNA','RNA','CPU','HTTP','RAM','JSON','PIL']){
  assert.ok(generic.some(e=>e.term===name && e.definition),'discipline-agnostic '+name);
}
const unknown=buildUniversalGlossary('Il metodo XYZ è specifico del testo. Il corso ABCD fornisce dettagli.');
assert.equal(unknown.find(x=>x.term==='XYZ')?.definition,null,'no invented meanings for unknown acronym');
assert.equal(unknown.find(x=>x.term==='ABCD')?.basis,'unverified');

const sourceFirst=buildUniversalGlossary('CPU e microbioma.',[
  {term:'CPU',definition:'Definizione contestuale del testo.',basis:'source'},
  {term:'microbioma',definition:'Insieme di microrganismi di un ambiente.',basis:'source'},
]);
assert.equal(sourceFirst.find(e=>e.term==='CPU')?.definition,'Definizione contestuale del testo.','source overrides generic');
assert.equal(sourceFirst.find(e=>e.term==='microbioma')?.basis,'source');

const parts=splitUniversalText('I dati del PILOTA differiscono dal PIL. Il protocollo HTTP.',buildUniversalGlossary('I dati del PILOTA differiscono dal PIL. Il protocollo HTTP.'));
assert.equal(parts.map(p=>p.text).join(''),'I dati del PILOTA differiscono dal PIL. Il protocollo HTTP.','text content preserved');
assert.ok(!parts.some(p=>p.entry && p.text==='PIL' && p.text==='PILOTA'),'avoid substring');
assert.equal(parts.filter(p=>p.entry?.term==='PIL').length,1,'only full word PIL');
assert.ok(parts.some(p=>p.entry?.term==='HTTP'),'full word HTTP');

const [view,css,prior]=await Promise.all([
  'src/components/StudyMode.jsx','src/studyContinuous.css','scripts/test-lab09-approved-ui.mjs'
].map(x=>readFile(x,'utf8')));
assert.ok(view.includes('buildUniversalGlossary')&&view.includes('splitUniversalText'),'universal inline text integrated');
assert.ok(view.includes('chapterTerms={glossary}'),'chapter-level glossary reused');
assert.ok(!view.includes('<aside className="study-chapter-glossary"'),'sidebar removed from rendered reader');
assert.ok(view.includes('sb-lab10-glossary-sheet')&&view.includes('sb-lab10-glossary-backdrop'),'bottom sheet and dismiss overlay');
assert.ok(view.includes("setAnswer(glossaryEntry?.definition ? {"),'only known definitions shown immediately');
assert.ok(view.includes("runAction('meaning')"),'unknown definitions accessible on demand');
assert.ok(view.includes('answer.fallback'),'fallback visibly not labeled verified');
assert.ok(view.includes('onTouchEnd={() => window.setTimeout(useSelection, 0)}'),'long-press term selection preserved');
assert.ok(view.includes("{!isReader && tool === 'flashcards' && ("),'study mode unchanged');
assert.ok(css.includes('.study-mode .study-continuous-sheet')&&css.includes('grid-template-columns: minmax(0,1fr)'),'full width reader');
assert.ok(css.includes('top: auto;')&&css.includes('bottom: 0;'),'sheet appears from bottom');
assert.ok(css.includes('@media(max-width:430px)'),'narrow Android responsive');
assert.ok(prior.includes('LAB09'),'LAB09 baseline regression stays');
console.log('LAB10 universal glossary: vocabulary matching, no false acronyms, references, source priority, reader UX and study isolation PASS');
