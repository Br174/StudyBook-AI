import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {studyHomeAction,studyProgressLabel,sameStoredDocument} from '../src/lib/studyHomeFlowV38.js';
const read=(p)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

assert.equal(studyHomeAction({hasSource:true}),'create');
assert.equal(studyHomeAction({hasSource:true,hasCurrentIncomplete:true}),'resume',
  'Never offer a second Create when the selected source has partial editions');
assert.equal(studyHomeAction({hasSavedIncomplete:true}),'resume');
assert.equal(studyHomeAction({hasSource:true,hasCurrentBook:true}),'open',
  'Completed current book must open rather than start a new generation');
assert.equal(studyHomeAction({hasSource:true,generating:true,hasCurrentIncomplete:true}),'active',
  'A running pipeline must not be re-created or restarted');
assert.equal(studyHomeAction({}),'empty');
assert.equal(sameStoredDocument({id:'book-1'},'book-1','different.pdf'),true);
assert.equal(sameStoredDocument({id:'book-2',fileName:'altra.pdf'},'book-1','libro.pdf'),false);
assert.equal(sameStoredDocument({id:'book-2',fileName:'libro.pdf'},'', 'libro.pdf'),true);
assert.match(studyProgressLabel({phase:'preparing',done:119,total:119,status:'119/119 blocchi'}),/Preparazione del documento/);
assert.doesNotMatch(studyProgressLabel({phase:'preparing',done:119,total:119,status:'119\/119 blocchi'}),/100%/);
assert.match(studyProgressLabel({phase:'gemini',done:1,total:1452}),/1\/1452 parti IA verificate/);

const app=read('src/AppV15.jsx');
const home=read('src/components/HomeDashboardV16.jsx');
const studio=read('src/components/AppScreens.jsx');
const pillar=read('docs/STUDYBOOK_STUDIO_PROGRESSIVO_PILASTRO_V1.md');
const generator=read('src/lib/generativeEditionsV36.js');
assert.match(app,/const homeAction=studyHomeAction/);
assert.match(app,/if\(homeAction==='resume'\)\{\s*await resumeFromHome\(\);/);
assert.match(app,/if\(homeAction==='open'\)\{\s*navigateTo\('studio'\)/);
assert.match(app,/if\(generating\)\{\s*\/\/ Opening the processing page is safe/);
assert.match(app,/if\(!geminiStalled\)\{/);
assert.match(app,/setWorkPhase\('preparing'\)/);
assert.match(app,/setWorkPhase\('gemini'\)/);
assert.match(app,/if\(!firstSave\)/);
assert.match(home,/documentData && !generating && \(homeAction==='create'\|\|homeAction==='open'\)/);
assert.match(home,/workPhase==='preparing'/);
assert.match(home,/Apri libro in elaborazione/);
assert.doesNotMatch(home,/Elaborazione \{progressPercent\}%/,
  'Local preprocessing must never be presented as 100% Gemini progress');
assert.match(studio,/if \(!studyBook && generating\)/);
assert.match(studio,/\(!generating\|\|geminiStalled\)/);
assert.match(studio,/Elaborazione Gemini attiva/);
assert.match(studio,/Apri il testo originale mentre Gemini elabora/);
assert.match(pillar,/stessi concetti fondamentali/i);
assert.match(generator,/STUDY_PILLAR_VERSION/);
console.log('LAB38 hotfix: source ready vs active vs resumable, 119 local != 1452 Gemini, no duplicate create, no abort on navigation, partial reader, pillar preserved PASS');
