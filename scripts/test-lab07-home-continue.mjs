import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [app, screens] = await Promise.all([
  readFile('src/AppV15.jsx', 'utf8'),
  readFile('src/components/AppScreens.jsx', 'utf8'),
]);

const homeStart = screens.indexOf('export function HomeScreen(');
const libraryStart = screens.indexOf('export function LibraryScreen(', homeStart);
const studioStart = screens.indexOf('export function StudioScreen(', libraryStart);
const home = screens.slice(homeStart, libraryStart);
const studio = screens.slice(studioStart);
const openLibraryStart = app.indexOf('async function openLibraryItem(');
const openLibraryEnd = app.indexOf('async function removeLibraryItem(', openLibraryStart);
const openLibrary = app.slice(openLibraryStart, openLibraryEnd);
const continueStart = app.indexOf('function openContinueBook(');
const continueEnd = app.indexOf('const scannerPanel', continueStart);
const continueFunc = app.slice(continueStart, continueEnd);

assert.ok(home.includes('className="sb-continue-card"'), 'Home Continua still present');
assert.ok(home.includes("onClick={() => onContinueBook(latest)}"), 'Home Continua uses its specific callback');
assert.ok(!home.includes("onClick={() => onOpenBook(latest, 'processed')}"), 'Home Continua does not open Reader');
assert.ok(app.includes('onOpenBook={openFromLibrary} onContinueBook={openContinueBook}'), 'Home callback correctly connected');
assert.ok(continueFunc.includes('openLibraryItem(item.id, { original: false, openReader: false })'), 'Full book screen without automatic reading');
assert.ok(openLibrary.includes("setStudyBook(record.studyBook)"), 'Same selected book loaded');
assert.ok(openLibrary.includes("navigateTo('studio')"), 'StudioScreen is the destination');
assert.ok(openLibrary.includes('setStudyModeOpen(false)'), 'Reading overlay closed when returning to book overview');
assert.ok(studio.includes('sb-open-book-workspace'), 'Full book page preserved');
for (const name of ['Leggi sul telefono','Leggi in PDF','Studia sul telefono','Scarica libro','Controllo del libro']) {
  assert.ok(studio.includes(name), 'Full book page must preserve ' + name);
}
assert.ok(app.includes("return openLibraryItem(item.id, { original: view === 'original', openReader: view !== 'original' })"), 'Recenti/Libreria behavior preserved');
assert.ok(app.includes('className="sb-back-button" onClick={goBack}'), 'Return navigation preserved');
console.log('LAB07 Home Continua -> full Libro aperto, back navigation and unchanged other routes: PASS');
