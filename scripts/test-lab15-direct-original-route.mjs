import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import 'fake-indexeddb/auto';
import {saveLibraryBook,getLibraryBook,listLibraryBooks} from '../src/lib/library.js';

// LAB15: the navigation changes, never the stored original bytes or book identity.
const raw=new File(['Capitolo primo. Documento integrale originale.'],'romanzo.txt',{type:'text/plain'});
const source={chapters:[{title:'Capitolo primo',paragraphs:['Documento integrale originale.']}]};
await saveLibraryBook({id:'lab15-original',fileName:raw.name,originalFile:raw,sourceData:source});
assert.equal((await listLibraryBooks()).length,1,'single original entry');
assert.equal(await (await getLibraryBook('lab15-original')).originalFile.text(),await raw.text(),'original unchanged');
await saveLibraryBook({id:'lab15-original',fileName:raw.name,sourceData:source,studyBook:{chapters:[{title:'Capitolo primo',paragraphs:[{summary:'Sintesi'}]}]}});
assert.equal((await listLibraryBooks()).length,1,'existing elaboration shares record');
assert.equal(await (await getLibraryBook('lab15-original')).originalFile.text(),await raw.text(),'original unchanged after study');

const [app,screens,css,workflow] = await Promise.all(['src/AppV15.jsx','src/components/AppScreens.jsx','src/appShellV16.css','.github/workflows/android-apk.yml'].map(p=>readFile(p,'utf8')));
const loader=app.slice(app.indexOf('async function openLibraryItem('),app.indexOf('async function removeLibraryItem('));
const home=app.slice(app.indexOf('function openOriginalHome()'),app.indexOf('async function refreshArchiveForLibrary()'));
const reader=app.slice(app.indexOf('function readOriginalFromBook()'),app.indexOf('async function openOriginalPdfFromBook()'));
assert.ok(screens.includes('<strong>Versione originale</strong>') && screens.includes('onClick={onOpenOriginals}'),'Home tile stays unchanged');
assert.ok(app.includes('onOpenOriginals={openOriginalHome}'),'Home tile opens direct router');
assert.ok(home.includes('libraryItems.filter(item => item.metadata?.hasOriginal)'),'choose existing original');
assert.ok(home.includes('originalRecord?.id') && home.includes('originals[0]'),'prefer last selected then newest');
assert.ok(home.includes('openLibraryItem(selected.id, { original: true, openReader: false })'),'Home opens existing original direct');
assert.ok(home.includes("navigateTo('studio')") && home.includes("setStudyBook(null)"),'empty-library chooser uses same studio screen');
assert.ok(loader.includes('if (original) {') && loader.includes("navigateTo('studio')") && loader.includes('setStudyBook(record.studyBook || null)'),'library original opens same book overview');
assert.ok(!app.includes("navigateTo('original')") && !app.includes("activeScreen === 'original'"),'old original screen route unreachable');
assert.ok(!screens.includes('export function OriginalBookScreen'),'old intermediate view removed');
assert.ok(screens.includes('function OriginalInlineReader(') && screens.includes('<OriginalInlineReader key={originalRecord.id}'),'original reader is inline');
assert.ok(reader.includes('setOriginalReading(true)') && !reader.includes('navigateTo('),'source reader never changes page');
assert.ok(app.includes("activeScreen === 'studio' && originalReading"),'Android back closes inline reader first');
assert.ok(screens.includes('Scegli un libro originale') && screens.includes('onChooseOriginal') && screens.includes('onImportOriginal'),'empty originals supports choose/import');
assert.ok(app.includes('setOriginalRecord(parsedOriginal)'), 'newly imported original becomes selectable without a second navigation');
assert.ok(screens.includes('Prepara testo di studio') && screens.includes('Non adesso'),'original preparation still optional');
assert.ok(app.includes("if (format === 'pdf' && variant === 'original') return openOriginalPdfFromBook();"),'PDF route preserved');
assert.ok(css.includes('.sb-original-picker') && css.includes('.sb-studio-screen .sb-original-reading'),'new optional panels scoped to existing UI');
assert.ok(workflow.includes('StudyBook-AI-LAB-15-AGGIORNAMENTO') && workflow.includes('it.studybook.ai.lab'),'APK identity preserved');
console.log('LAB15 direct original to Studio, empty archive, inline reading and raw byte preservation: PASS');
