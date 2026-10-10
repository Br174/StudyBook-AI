import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import 'fake-indexeddb/auto';
import {
  saveLibraryBook, getLibraryBook, listLibraryBooks, deleteLibraryVersion,
} from '../src/lib/library.js';

// LAB13: un solo record collega file originale, trascrizione e libro elaborato.
const original = new Blob(['DOCUMENTO INTEGRO\nCapitolo uno'], { type: 'text/plain' });
const source = { chapters: [{ title: 'Capitolo uno', paragraphs: ['Testo completo, invariato.'] }] };
const generated = { chapters: [{ title: 'Capitolo uno', paragraphs: [{ original: 'Testo completo, invariato.', summary: 'Testo ridotto.' }] }] };
await saveLibraryBook({ id: 'lab13-a', fileName: 'Manuale.txt', originalFile: original, profileId: 'default' });
let saved = await getLibraryBook('lab13-a');
assert.equal(saved.studyBook, null, 'importazione conserva originale senza elaborazione');
assert.equal(await saved.originalFile.text(), await original.text(), 'contenuto originale byte-identico');
await saveLibraryBook({ id: saved.id, fileName: saved.fileName, sourceData: source, studyBook: generated });
saved = await getLibraryBook('lab13-a');
assert.equal(saved.originalFile.size, original.size, 'elaborazione non altera blob');
assert.equal((await listLibraryBooks({profileId:'default'})).length, 1, 'mai duplicare le versioni');
await deleteLibraryVersion('lab13-a', 'processed');
saved = await getLibraryBook('lab13-a');
assert.equal(saved.studyBook, null, 'testo modificato rimosso');
assert.ok(saved.originalFile && saved.metadata.hasOriginal, 'originale conservato');
await saveLibraryBook({ id: saved.id, fileName: saved.fileName, sourceData: source, studyBook: generated });
await deleteLibraryVersion('lab13-a', 'original');
saved = await getLibraryBook('lab13-a');
assert.equal(saved.originalFile, null, 'originale rimosso solo quando richiesto');
assert.equal(saved.studyBook.chapters.length, 1, 'modificato conservato');
await deleteLibraryVersion('lab13-a', 'processed');
assert.equal(await getLibraryBook('lab13-a'), undefined, 'ultimo contenuto rimosso definitivamente');

const [screens, app, gallery, css] = await Promise.all([
  'src/components/AppScreens.jsx', 'src/AppV15.jsx',
  'src/components/ScannerArchive.jsx','src/appShellV16.css',
].map(file => readFile(file, 'utf8')));
for (const label of ['Scannerizzati','Modificati','Originali','Tutti']) {
  assert.ok(screens.includes("['" + (label === 'Scannerizzati' ? 'scans' : label === 'Modificati' ? 'processed' : label === 'Originali' ? 'original' : 'all') + "', '" + label + "']"), 'Categoria: ' + label);
}
assert.ok(screens.includes('onOpenOriginals') && !screens.includes('<strong>Documento</strong>'), 'tile Documento sostituita');
assert.ok(screens.includes('<ScannerArchive {...scannerProps}') && gallery.includes('backLabel'), 'scansioni riusate nella Libreria');
assert.ok(app.includes('const originalSaved = await saveLibraryBook(') && app.includes('sourceData: parsed'), 'import salva file originale e poi testo estratto');
assert.ok(app.includes('setOriginalRecord(record)') && app.includes("navigateTo('original')"), 'originali aprono scheda dedicata');
assert.ok(screens.includes('export function OriginalBookScreen') && screens.includes('Leggi sul telefono') && screens.includes('Esporta originale'), 'lettura ed esportazione');
assert.ok(app.includes("format === 'original'") && app.includes('record.originalFile') && app.includes('new Blob([text]'), 'originale binario e conversione separati');
assert.ok(css.includes('.sb-library-categories') && css.includes('.sb-original-reading'), 'quattro categorie responsive');
console.log('LAB13: immutabilità originali, categorie, lettura, esportazioni e eliminazione selettiva: PASS');
