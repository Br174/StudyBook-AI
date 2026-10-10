import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import 'fake-indexeddb/auto';
import {
  saveScannerMeta, loadScannerSession, clearScannerSessionStore,
  saveScannerPage, scannerPageFromRecord,
  saveCapturedScannerPage, archiveScannerSessionPages,
  listArchivedScannerPages, getArchivedScannerPages, updateArchivedScannerText,
  deleteArchivedScannerPages,
} from '../src/lib/scannerSessionStore.js';
import {scannerOcrStats} from '../src/lib/scannerOcrRuntime.js';

const photo = (id, text = '', origin = id) => ({
  id, archiveId:origin, file:new Blob(['JPEG photo '+id],{type:'image/jpeg'}),
  fileName:id+'.jpg', text,status:text?'ready':'processing',
  originalBytes:80,storedBytes:30,optimized:true,
});

const p1=photo('page-1');
assert.equal(await saveCapturedScannerPage(p1,'Diritto'),true,'capture persisted in archive and temp collection');
await saveScannerMeta('Diritto',[p1]);
const recovered=await loadScannerSession();
assert.equal(recovered.pages.length,1,'active session recoverable');
assert.equal(recovered.pages[0].archiveId,'page-1','archive origin preserved in temporary session');
let archives=await listArchivedScannerPages();
assert.equal(archives.length,1,'photo visible in archive after initial capture');
assert.equal(archives[0].id,'page-1');
assert.equal(archives[0].collection,'Diritto');
assert.ok(archives[0].blob instanceof Blob,'permanent photo remains a Blob');

assert.equal(await updateArchivedScannerText({...p1,status:'ready',text:'Testo fotografato'},'Diritto'),true);
archives=await listArchivedScannerPages();
assert.equal(archives[0].text,'Testo fotografato','completed OCR stored with image');
assert.equal((await getArchivedScannerPages(['page-1']))[0].id,'page-1','single photo recoverable');

assert.equal(await clearScannerSessionStore(),true,'delete active working session');
assert.equal(await loadScannerSession(),null,'working session emptied');
archives=await listArchivedScannerPages();
assert.equal(archives.length,1,'completed book cannot delete permanent archive');
assert.equal(archives[0].text,'Testo fotografato');

const reprocess=photo('reprocess-1','Testo fotografato','page-1');
assert.equal(await saveCapturedScannerPage(reprocess,'Rielabora',{archive:false}),true);
assert.equal((await listArchivedScannerPages()).length,1,'reprocessing must not duplicate permanent photo');
assert.equal(scannerPageFromRecord({id:'restore',archiveId:'page-1',blob:p1.file,status:'ready',text:'ok'}).archiveId,'page-1');

assert.equal(await deleteArchivedScannerPages(['page-1']),true,'explicit delete supported');
assert.equal((await listArchivedScannerPages()).length,0,'delete affects archive, not books');
assert.equal(await updateArchivedScannerText({...p1,status:'ready',text:'orphan update'}),false,'late OCR cannot resurrect deleted photo');
assert.equal(await archiveScannerSessionPages([p1,reprocess],'Diritto'),true,'post-book archiving can skip deleted LAB11 photo');
assert.equal((await listArchivedScannerPages()).length,0,'deleted photos never restored on finish');

const legacy = {id:'legacy-10',file:new Blob(['old scan'],{type:'image/jpeg'}),text:'Testo recuperato',status:'ready'};
assert.equal(await saveScannerPage(legacy),true,'old scanner v1 page still saved');
assert.equal(await archiveScannerSessionPages([legacy],'Archivio vecchio'),true,'legacy session migrated');
archives=await listArchivedScannerPages();
assert.equal(archives.length,1,'legacy photograph recoverable');
assert.equal(archives[0].id,'legacy-10');
assert.equal(archives[0].collection,'Archivio vecchio');
const db=await new Promise((resolve,reject)=>{
  const req=indexedDB.open('studybook-ai-scanner',1);
  req.onsuccess=()=>resolve(req.result);
  req.onerror=()=>reject(req.error);
});
assert.equal(db.version,1,'working scanner database remains backward compatible with LAB10');
db.close();

const [app, home, gallery, css, worker, prior] = await Promise.all([
  'src/AppV15.jsx','src/components/AppScreens.jsx','src/components/ScannerArchive.jsx',
  'src/scannerArchive.css','src/lib/scannerOcrRuntime.js','scripts/test-scanner-session-store.mjs',
].map(p=>readFile(p,'utf8')));
assert.ok(app.includes('onScannerArchive={openScannerArchive}'),'new Home callback bound');
assert.ok(home.includes('<strong>Scannerizzati</strong>')&&!home.includes('<strong>Foto</strong>'),'Foto replaced');
assert.ok(app.includes("activeScreen === 'scans' && <ScannerArchive"),'archive page exists');
assert.ok(gallery.includes('Seleziona più pagine')&&gallery.includes('Rielabora selezionate')&&gallery.includes('Elimina selezionate'),'bulk actions wired');
assert.ok(gallery.includes('window.confirm'),'permanent delete requires confirmation');
assert.ok(app.includes("saveCapturedScannerPage(page, scanSessionName)") && app.includes('recognizeScanPage(id, optimizedFile, pageNumber)'),'durable capture precedes OCR');
assert.ok(app.indexOf("const stored = await saveCapturedScannerPage(page, scanSessionName)") <
  app.indexOf("recognizeScanPage(id, optimizedFile, pageNumber)"),'storage before recognition');
assert.ok(app.includes('scanOcrQueueRef.current.push')&&app.includes('drainScanOcrQueue'),'background OCR FIFO');
assert.ok(app.includes('recognizeScannerImage(job.file')&&app.includes('scanOcrRunningRef.current'),'one OCR at a time');
assert.ok(app.includes('precompressed: true'),'camera JPEG is not recompressed unnecessarily');
assert.ok(!app.includes('stopCamera();\n      await addScanPage(file)'), 'camera no longer closes after each photo');
assert.ok(app.includes('archiveScannerSessionPages(scanPagesRef.current'),'post-book archive gate');
assert.ok(app.includes('setScanPagesNow([])')&&app.includes('await clearScannerSessionStore()'),'temporary session can be cleared after save');
assert.ok(gallery.includes('URL.revokeObjectURL(ref)'),'image previews release memory');
assert.ok(css.includes('.sb-archive-photo-open'),'gallery responds to mobile');
assert.ok(worker.includes("createWorker('ita+eng'")&&worker.includes('if (!workerPromise)'),'same language/model across pages; lazy reusable worker');
assert.ok(worker.includes('IDLE_MS')&&worker.includes('scheduleRelease()'),'idle worker reclaimed');
assert.equal(scannerOcrStats().initializationCount,0,'no worker loaded just by opening app');
assert.ok(prior.includes('Scanner session persistence model'),'prior LAB regression preserved');
console.log('LAB11 Scanner Turbo + Scannerizzati: transactional photo survival, reusable OCR, retrocompatibility and UI PASS');
