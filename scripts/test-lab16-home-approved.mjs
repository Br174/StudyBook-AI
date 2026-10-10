import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const [app,home,screens,css,workflow] = await Promise.all([
  'src/AppV15.jsx','src/components/HomeDashboardV16.jsx','src/components/AppScreens.jsx',
  'src/appShellV16.css','.github/workflows/android-apk.yml',
].map(path => readFile(path,'utf8')));
// LAB16: Home must follow the approved exact information hierarchy.
assert.ok(app.includes('<HomeDashboardV16') && app.includes('archivedScans={archivedScans}'),'new dashboard in live Home');
const scannerIndex=home.indexOf('<div className="sb-home-source-actions">');
const categoriesIndex=home.indexOf('<div className="sb-home-library-actions">');
const workIndex=home.indexOf('<div className="sb-home-workspace">');
const recentIndex=home.indexOf('<section className="sb-home-recent"');
assert.ok(scannerIndex >= 0 && categoriesIndex > scannerIndex && workIndex > categoriesIndex && recentIndex > workIndex, 'approved top -> middle -> bottom order');
assert.ok(home.includes('<strong>Scanner</strong>') && home.includes('<strong>PDF / eBook</strong>'),'two primary actions');
for (const title of ['Scannerizzati','Elaborati','Versioni originali']) assert.ok(home.includes(title),'archive category '+title);
assert.ok(!home.includes('Nuovo libro') && !home.includes('<h2>Studio</h2>'),'redundant Home headers removed');
assert.ok(home.includes('scrollBy({left:220') && css.includes('scroll-snap-type:x mandatory') && css.includes('touch-action:pan-x'), 'Recenti accessible as horizontal touch carousel');
assert.ok(home.includes("item.type==='scan' && photoUrls[item.id]") && home.includes('URL.revokeObjectURL'), 'real scan photos with temporary URL cleanup');
assert.ok(home.includes("item.type === 'original'") && home.includes("item.type === 'processed'"), 'original and processed both in recent cards');
assert.ok(app.includes("onCategory={view => { setLibraryInitialView(view); navigateTo('library'); }}"), 'category routes to existing Library');
assert.ok(app.includes('onRecentScan={restoreScannerArchiveSelection}'),'recent scan restores scanner without deleting photo');
assert.ok(app.includes('onOpenOriginal={item => openLibraryItem(item.id, { original:true, openReader:false })}'),'recent original opens original intact');
assert.ok(app.includes('scanArchivePhotoIds: scanPages.map(') && app.includes('scannedPhoto={documentData?.sourceFormat'), 'scanner-produced study book retains photo linkage');
assert.ok(screens.includes('function ScannedBookPhoto({ blob })') && screens.includes('sb-scanned-book-cover-photo'),'scanned cover shows actual captured photo');
assert.ok(screens.includes('function BookCover(') && screens.includes("view === 'original'"), 'existing Book and Library variants preserved');
assert.ok(app.includes("setCameraFlash(true)") && app.includes("setCameraFeedback('✓ Foto acquisita · OCR avviato')"), 'camera flash and saved-before-OCR feedback');
assert.ok(app.includes('if (!stored)') && app.indexOf("setCameraFeedback('✓ Foto acquisita") > app.indexOf('if (!stored)'), 'feedback after persisted capture');
assert.ok(css.includes('.sb-home-workspace') && css.includes('.sb-home-recent-track'),'home workspace and recent layout styled');
assert.ok(workflow.includes('StudyBook-AI-LAB-16-AGGIORNAMENTO') && workflow.includes('STUDYBOOK_SIGNING_MODE=update'),'same Android update family');
console.log('LAB16 approved Home, categories, horizontal Recenti, photo cover, scanner feedback: PASS');
