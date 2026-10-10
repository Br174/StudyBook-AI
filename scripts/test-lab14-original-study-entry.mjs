import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import 'fake-indexeddb/auto';
import { getLibraryBook, saveLibraryBook, listLibraryBooks } from '../src/lib/library.js';

// LAB14: originale acquisito indipendentemente dalla versione rielaborata.
const originalFile = new File(['CAPITOLO I\\nIl testo non deve essere cambiato.'], 'Manuale.txt', { type: 'text/plain' });
const sourceData = { chapters: [{ title: 'Capitolo I', paragraphs: ['Il testo non deve essere cambiato.'] }] };
await saveLibraryBook({ id:'lab14-a', fileName:originalFile.name, originalFile, sourceData });
let record = await getLibraryBook('lab14-a');
assert.ok(record.originalFile, 'original exists before processing');
assert.equal(record.studyBook, null, 'the navigation must not require a processed book');
assert.equal(await record.originalFile.text(), await originalFile.text(), 'original bytes preserved');
const originalOnly = (await listLibraryBooks()).find(x => x.id === record.id);
assert.equal(originalOnly.metadata.hasOriginal, true);
assert.equal(originalOnly.metadata.hasProcessed, false);

// Explicit study work must reuse the same record and never duplicate the original.
await saveLibraryBook({
  id:record.id, fileName:record.fileName, sourceData,
  studyBook:{ chapters:[{ title:'Capitolo I', paragraphs:[{original:sourceData.chapters[0].paragraphs[0],summary:'Sintesi'}]}] },
});
record=await getLibraryBook('lab14-a');
assert.equal((await listLibraryBooks()).length, 1, 'no duplicate on study creation');
assert.equal(await record.originalFile.text(), await originalFile.text(), 'stored raw original remains intact');

const [app, ui, css, workflow] = await Promise.all([
  'src/AppV15.jsx', 'src/components/AppScreens.jsx',
  'src/appShellV16.css', '.github/workflows/android-apk.yml',
].map(file=>readFile(file,'utf8')));

const originalScreen=ui.slice(ui.indexOf('export function OriginalBookScreen('));
const studyScreen=ui.slice(ui.indexOf('export function StudioScreen('),ui.indexOf('function SettingRange('));
const originalHandler=app.slice(app.indexOf('async function openOriginalStudyBook()'),app.indexOf('function readOriginalFromBook()'));
assert.ok(originalScreen.includes('onClick={onStudyBook}>Studia libro</button>'), 'main original button renamed');
assert.ok(!originalScreen.includes("onClick={onRead}>{reading ? 'Chiudi lettura' : 'Leggi sul telefono'}"), 'old immediate reader entry retired');
assert.ok(app.includes('onStudyBook={openOriginalStudyBook}'), 'CTA points to study overview');
assert.ok(originalHandler.includes('getLibraryBook(originalRecord.id)'), 'reload original from library');
assert.ok(originalHandler.includes('setStudyBook(record.studyBook || null)'), 'already processed and original-only supported');
assert.ok(originalHandler.includes("navigateTo('studio')"), 'same Libro aperto route');
assert.ok(!originalHandler.includes('createStudyBook(') && !originalHandler.includes('setStudyModeOpen(true)'), 'click does not auto-read or auto-generate');
assert.ok(studyScreen.includes('Il tuo libro di studio') && studyScreen.includes('sb-open-book-workspace'), 'same approved overview');
assert.ok(studyScreen.includes('isOriginalOnly = false') && studyScreen.includes('!studyBook && !isOriginalOnly'), 'original does not need study data');
assert.ok(studyScreen.includes('setPrepareOpen(true)') && studyScreen.includes('Prepara testo di studio') && studyScreen.includes('Non adesso'), 'study requires explicit second confirmation');
assert.ok(app.includes('async function prepareOriginalForStudy()') && app.includes('await createStudyBook(documentData, fileName)'), 'processing only after choice');
assert.ok(app.includes('readOriginalFromBook()') && app.includes('openOriginalPdfFromBook()'), 'original reader and original PDF paths');
assert.ok(app.includes('sourceFile={sourceFile}') === false, 'no unwanted extra reader dependency');
assert.ok(app.includes("setOriginalReading(true)") && app.includes("navigateTo('original')"), 'original reading available from chooser');
assert.ok(app.includes('if (format === \'pdf\' && variant === \'original\') return openOriginalPdfFromBook();'), 'PDF chooser favors original');
assert.ok(workflow.includes('StudyBook-AI-LAB-14-AGGIORNAMENTO') && workflow.includes('it.studybook.ai.lab'), 'Android identity unchanged');
assert.ok(css.includes('.sb-original-study-consent'), 'consent UI uses existing visual language');
console.log('LAB14: navigazione originale -> scheda studio, scelta esplicita e immutabilità: PASS');
