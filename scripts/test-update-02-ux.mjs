import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { summarizeLocally } from '../src/lib/studyEngine.js';
import { editorialParagraphText } from '../src/lib/editorialModel.js';

const screens = await readFile('src/components/AppScreens.jsx', 'utf8');
const app = await readFile('src/AppV15.jsx', 'utf8');
const css = await readFile('src/appShellV16.css', 'utf8');
const library = await readFile('src/lib/library.js', 'utf8');
const tools = await readFile('src/lib/studyTools.js', 'utf8');

assert.ok(screens.includes('sb-open-book-workspace'));
assert.ok(screens.includes('Leggi in PDF'));
assert.ok(screens.includes("onExport('pdf', 'study')"));
assert.ok(screens.includes('Scarica libro'));
assert.ok(screens.includes("setExportOpen((value) => !value)"));
assert.ok(screens.includes('Libro di studio'));
assert.ok(screens.includes('Controllo del libro'));
assert.ok(screens.includes('Leggi sul telefono'));
assert.ok(screens.includes('Studia sul telefono'));
assert.ok(app.includes("setStudyEntryMode('reader')"));
assert.ok(app.includes("setStudyEntryMode('study')"));
assert.ok(app.includes("import { deliverBlob } from './lib/fileDelivery.js'"));
assert.ok(app.includes('record.originalFile'));
assert.ok(app.includes('{ preferOpen: true }'));
assert.ok(library.includes('hasOriginal: Boolean(originalFile || previous?.originalFile)'));
assert.ok(css.includes('.sb-book-quick-actions'));
assert.ok(!tools.includes('...splitSentences(paragraphText(paragraph))'));

const local = summarizeLocally('La disciplina si applica mediante tre condizioni. La prima condizione richiede un requisito specifico. Tuttavia esiste una eccezione espressa. Pertanto occorre verificare il caso concreto.', 'studio');
assert.ok(local.simpleSummary);
assert.notEqual(local.simpleSummary, local.summary);
assert.equal(editorialParagraphText(local, { variant: 'simple' }), local.simpleSummary);
assert.equal(editorialParagraphText(local, { variant: 'study' }), local.summary);

console.log(JSON.stringify({ ok:true, openBookCover:true, compactActions:true, processedPdfExplicit:true, originalFormatReader:true, distinctStudyAndSimpleText:true, groundedQuizFlashcardsOnly:true }, null, 2));
