import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [screens, shell, study, studyCss, icons, app, priorTest] = await Promise.all([
  'src/components/AppScreens.jsx','src/appShellV16.css','src/components/StudyMode.jsx',
  'src/studyTools.css','src/components/StudyUiIcons.jsx','src/AppV15.jsx',
  'scripts/test-lab08-library-overview.mjs',
].map(p => readFile(p,'utf8')));

const home = screens.slice(screens.indexOf('export function HomeScreen('), screens.indexOf('export function LibraryScreen('));
const book = screens.slice(screens.indexOf('export function StudioScreen('), screens.indexOf('function SettingRange('));
const nav = screens.slice(screens.indexOf('export function BottomNav('), screens.indexOf('export function HomeScreen('));

assert.ok(icons.includes('export function StudyIcon(') && icons.includes("drawings[name]"), 'one shared SVG icon family');
assert.ok(!icons.includes('http:') && !icons.includes('https:'), 'offline icons');
for (const name of ['scanner','book','photo','document','pdf','graduate','download','home','library','flashcards','quiz','map','oral','coverage','compression']) {
  assert.ok(icons.includes(name + ':'), 'icon definition: ' + name);
}
assert.ok(home.includes('<StudyIcon name="scanner"') && home.includes('<StudyIcon name="book"') &&
  home.includes('<StudyIcon name="photo"') && home.includes('<StudyIcon name="document"'), 'all import icons replaced');
assert.ok(home.includes('onClick={onScanner}') && home.includes('onClick={onImport}'), 'scanner/import behavior preserved');
assert.ok(home.includes('onContinueBook(latest)'), 'Home Continua route preserved');
assert.ok(book.includes('onClick={onRead}') && book.includes('onClick={onStudy}'), 'reading and study work');
assert.ok(book.includes("onExport('pdf', 'study')") && book.includes('setExportOpen((value) => !value)'), 'PDF and export functionality preserved');
assert.ok(book.includes('<StudyIcon name="graduate"') && book.includes('<StudyIcon name="download"'), 'new Book icons');
assert.ok(book.includes('<StudyIcon name="coverage"') && book.includes('<StudyIcon name="compression"'), 'quality metric icons');
assert.ok(!book.includes('Verifica richiesta') && !book.includes('Tutto quello che fai qui appartiene'), 'redudancies stay removed');
assert.ok(book.includes('Controllo del libro') && book.includes('fidelity?.conceptUnits'), 'quality values preserved');
assert.ok(nav.includes('<StudyIcon name={icon}'), 'shared navigation icon family');
assert.ok(study.includes('<StudyIcon name={icon} size={23}') && study.includes("['oral', 'Interrogazione', 'oral']"), 'study tabs use real icons');
assert.ok(study.includes('sb-lab06-chapter-full-title') && study.includes('changeChapter(chapterIndex + 1)'), 'chapters navigable');
assert.ok(study.includes('onClick={closeReader}'), 'reader back works');
assert.ok(studyCss.includes('flex-direction: column') && studyCss.includes('.sb-lab05-study-tabs button svg'), 'icon stacked over label in study');
assert.ok(shell.includes('.sb-home-screen .sb-screen-head h1') && shell.includes('.sb-studio-screen .sb-screen-head.compact h1'), 'titles resized');
assert.ok(shell.includes('(max-height:760px)') && shell.includes('.sb-studio-screen .sb-quality-card > div'), 'height-aware Book layout');
assert.ok(!shell.includes('overflow-y: hidden') && !shell.includes('overflow: hidden; /* LAB09'), 'accessibility overflow safeguarded');
assert.ok(app.includes('onOpenBook={openFromLibraryCover}') && app.includes('onContinueBook={openContinueBook}'), 'LAB07/LAB08 navigation preserved');
assert.ok(priorTest.includes('openFromLibraryCover'), 'prior regression still required');
console.log('LAB09 compact three-screen typography, monocolor stacked icons and navigation invariants: PASS');
