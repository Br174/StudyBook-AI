import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import 'fake-indexeddb/auto';
import {sanitizeTitle,isGenericTitle,suggestDocumentTitle,suggestPageTitle} from '../src/lib/smartTitles.js';
import {
  saveCapturedScannerPage,updateArchivedScannerText,
  listArchivedScannerPages,renameArchivedCollection,renameArchivedPhoto,
  deleteArchivedScannerPages,getArchivedScannerPages,
} from '../src/lib/scannerSessionStore.js';
import {saveLibraryBook,getLibraryBook,updateLibraryMetadata} from '../src/lib/library.js';

assert.equal(sanitizeTitle('  Storia: Roma / Impero '),'Storia Roma Impero');
assert.equal(isGenericTitle('Appunti fotografati'),true);
assert.equal(isGenericTitle('Appunti fotografati - 4 pagine.pdf'),true);
assert.equal(isGenericTitle('Storia e società romana'),false);
const suggest=suggestDocumentTitle([{text:'STORIA E SOCIETÀ NELL’ANTICA ROMA\nPremessa\nUna città complessa.'}]);
assert.ok(suggest?.title.includes('STORIA E SOCIETÀ'), 'clear heading in OCR yields relevant title');
assert.equal(suggest?.source,'ocr');
assert.equal(suggestDocumentTitle([{text:'PREMESSA\nPAGINA 2'}]),null,'generic headings never become book titles');
assert.ok(suggestPageTitle('METODI DI ANALISI ECONOMICA\nLe principali grandezze del mercato.')?.title.includes('METODI DI ANALISI'),'discipline agnostic');

const scan=(id,text,collection='Appunti fotografati')=>({
  id,archiveId:id,file:new Blob(['photo '+id],{type:'image/jpeg'}),text,status:'ready'
});
const pageA=scan('a1','STORIA ROMANA E VITA QUOTIDIANA\nI rapporti sociali...');
const pageB=scan('a2','LE ISTITUZIONI DELLA REPUBBLICA\nIl Senato...');
assert.equal(await saveCapturedScannerPage(pageA),true);
assert.equal(await saveCapturedScannerPage(pageB),true);
assert.equal(await updateArchivedScannerText(pageA),true);
let records=await listArchivedScannerPages();
assert.ok(records.find(x=>x.id==='a1').pageTitle.includes('STORIA ROMANA'),'OCR title persisted');
assert.equal(await renameArchivedCollection(['a1','a2'],'Storia antica',{manual:true}),true);
records=await listArchivedScannerPages();
assert.ok(records.every(x=>x.collection==='Storia antica' && x.collectionManual),'collection rename persisted without changing photos');
assert.equal(await renameArchivedCollection(['a1','a2'],'Titolo automatico',{manual:false}),true);
records=await listArchivedScannerPages();
assert.ok(records.every(x=>x.collection==='Storia antica'),'automatic suggestion cannot override manual title');
assert.equal(await renameArchivedPhoto('a1','Roma, Capitolo I'),true);
assert.equal(await updateArchivedScannerText({...pageA,text:'TITOLO NUOVO PER OCR'}),true);
records=await listArchivedScannerPages();
assert.equal(records.find(x=>x.id==='a1').pageTitle,'Roma, Capitolo I','manual photo title survives OCR update');
assert.equal(records.find(x=>x.id==='a1').pageTitleManual,true);
assert.equal((await getArchivedScannerPages(['a1']))[0].blob.size,pageA.file.size,'renames preserve image bytes');
assert.equal((await getArchivedScannerPages(['a2']))[0].text,pageB.text,'renames preserve OCR text');
assert.equal(await deleteArchivedScannerPages(['a1','a2']),true);
assert.equal((await listArchivedScannerPages()).length,0,'deletion unchanged');

const book={chapters:[{title:'La società romana',paragraphs:[{text:'Il testo originale' }]}],generatedAt:'2026-10-10'};
const source={pages:[{text:'Pagina originale'}],chapters:[{title:'La società romana',paragraphs:['Il testo originale']}],structure:{pageCount:1}};
await saveLibraryBook({id:'book12',fileName:'Appunti fotografati.pdf',sourceData:source,studyBook:book});
const prior=await getLibraryBook('book12');
const renamed=await updateLibraryMetadata('book12',{fileName:'Società romana e storia delle istituzioni'});
const later=await getLibraryBook('book12');
assert.equal(later.fileName,'Società romana e storia delle istituzioni','library title persists');
assert.deepEqual(later.sourceData,prior.sourceData,'book original paragraphs and OCR remain intact');
assert.deepEqual(later.studyBook,prior.studyBook,'processed book content remains intact');
assert.equal(renamed.id,prior.id,'same ID: no duplicate book');

const [ui, archive, app, storage, css, oldTest] = await Promise.all([
  'src/components/AppScreens.jsx','src/components/ScannerArchive.jsx','src/AppV15.jsx',
  'src/lib/scannerSessionStore.js','src/renameTitle.css','scripts/test-lab11-scanner-turbo.mjs',
].map(f=>readFile(f,'utf8')));
assert.ok(ui.includes('onRenameRequest={setRenameCandidate}') && ui.includes('onRenameBook={') ,'book rename in library');
assert.ok(ui.includes('className="sb-studio-rename"') && ui.includes('Rinomina libro di studio'),'book overview supports rename');
assert.ok(archive.includes('onRenameCollection') && archive.includes('onRenamePhoto') && archive.includes('RenameTitleDialog'),'photo and archive collection can be renamed');
assert.ok(app.includes('scanTitleManualRef.current') && app.includes('suggestDocumentTitle'),'scan OCR title has explicit manual override');
assert.ok(app.includes('nameToSave') && app.includes('persistBook(result, sourceData, nameToSave'),'processed book gets appropriate title');
assert.ok(storage.includes('if (current.collectionManual && !manual) continue'),'manual archive title cannot be overwritten by OCR');
assert.ok(css.includes('.sb-title-overlay'),'accessible rename dialog');
assert.ok(oldTest.includes('deleteArchivedScannerPages'),'LAB11 scanner regression still present');
console.log('LAB12 smart titles, scan group and photo names, processed-book renames, no data loss, manual priority: PASS');
