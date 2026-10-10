import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [app, screens] = await Promise.all([
  readFile('src/AppV15.jsx', 'utf8'),
  readFile('src/components/AppScreens.jsx', 'utf8'),
]);

const libraryStart = screens.indexOf('export function LibraryScreen(');
const bookStart = screens.indexOf('export function StudioScreen(', libraryStart);
const library = screens.slice(libraryStart, bookStart);
const studio = screens.slice(bookStart, screens.indexOf('function SettingRange(', bookStart));
const openCode = app.slice(app.indexOf('async function openLibraryItem('), app.indexOf('async function removeLibraryItem('));
const handlers = app.slice(app.indexOf('function openFromLibrary('), app.indexOf('const scannerPanel'));

assert.ok(library.includes('<BookCover') && library.includes("view={view === 'all'") && library.includes('onOpen={onOpenBook}'), 'Library cover honors selected Elaborati/Originali tab');
assert.ok(app.includes('<LibraryScreen items={libraryItems} initialView={libraryInitialView} onOpenBook={openFromLibraryCover}'), 'Library uses dedicated opener');
assert.ok(handlers.includes("function openFromLibraryCover(item, view = 'processed')"), 'Processed cover routed separately');
assert.ok(handlers.includes("openLibraryItem(item.id, { original: view === 'original', openReader: false })"), 'Processed item does not auto-enter Reader');
assert.ok(openCode.includes("navigateTo('studio')"), 'Processed book navigates to StudioScreen');
assert.ok(openCode.includes('setStudyModeOpen(false)'), 'Processed books close any previous reading overlay');
assert.ok(openCode.includes("if (original) {") && openCode.includes('record.originalFile') && openCode.includes("navigateTo('studio')"), 'Original view opens shared book overview without rewriting raw file');
assert.ok(handlers.includes("function openContinueBook(item)"), 'Home Continue still has its own callback');
assert.ok(app.includes("onOpenBook={openFromLibrary} onContinueBook={openContinueBook}"), 'Home Recenti and Continua untouched');
assert.ok(studio.includes('LIBRO APERTO') && studio.includes('sb-open-book-workspace'), 'Complete page kept');
for (const name of ['Leggi sul telefono','Leggi in PDF','Studia sul telefono','Scarica libro','Controllo del libro']) {
  assert.ok(studio.includes(name), 'The full book view retains ' + name);
}
assert.ok(!studio.includes('Tutto quello che fai qui appartiene a'), 'Redundant context removed');
assert.ok(!studio.includes('Verifica richiesta'), 'Yellow verification banner removed');
assert.ok(!studio.includes('sb-fidelity warn'), 'Quality status banner element not rendered');
assert.ok(studio.includes('fidelity?.conceptUnits') && studio.includes('fidelity.averageCoveragePercent'), 'Quality statistics preserved');
assert.ok(app.includes('className="sb-back-button" onClick={goBack}'), 'Back button unchanged');
console.log('LAB08 Library Elaborati -> full Libro aperto, originals preserved, redundant banner removed: PASS');
