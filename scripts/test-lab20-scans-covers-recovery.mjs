import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import 'fake-indexeddb/auto';
import {renderAICover,pickLocalTheme,coverContext,isScannerBook} from '../src/lib/libraryCoverEngine.js';
import {saveLibraryBook,updateLibraryMetadata,getLibraryBook,listLibraryBooks} from '../src/lib/library.js';
const [archive,scanCss,app,ui,libCss,android] = await Promise.all([
  'src/components/ScannerArchive.jsx','src/scannerArchive.css','src/AppV15.jsx',
  'src/components/AppScreens.jsx','src/appShellV16.css','.github/workflows/android-apk.yml',
].map(path=>readFile(path,'utf8')));

// Regression: two photos belonging to DIFFERENT collections must still occupy
// adjacent cells of ONE real gallery, not the first cells of separate rows.
const galleryStart=archive.indexOf('{entries.length > 0 && <div className="sb-archive-grid"');
const galleryEnd=archive.indexOf('{renameTarget && <RenameTitleDialog',galleryStart);
assert.ok(galleryStart>0 && galleryEnd>galleryStart,'archive renders one global photo grid');
const gallery=archive.slice(galleryStart,galleryEnd);
assert.ok(gallery.includes('entries.map((page, index)'), 'gallery renders ALL scans in one grid');
assert.ok(!gallery.includes('group.photos.map'), 'no per-collection nested gallery');
assert.ok(archive.includes('groups.map(group =>') && archive.includes('sb-archive-collection-tools'),'collection rename remains available');
assert.ok(gallery.includes('thumbs[page.id]'),'scanner uses real captured blob thumbnail');
for(const action of ['onRenamePhoto','onDelete','onRestore','onRenameCollection']) assert.ok(archive.includes(action),'retains '+action);
assert.ok(scanCss.includes('.sb-scanner-archive > .sb-archive-grid') && scanCss.includes('repeat(3,minmax(0,1fr))'),'mobile three-column global gallery');
assert.ok(scanCss.includes('env(safe-area-inset-bottom'),'lower photo actions scroll above nav');

// Regression: user's manual AI cover action must save immediately even if the
// remote provider times out; online concept remains an OPTIONAL improvement.
const begin=app.indexOf('async function generateLibraryCover(');
const end=app.indexOf('async function chooseLibraryCover(',begin);
const cover=app.slice(begin,end);
assert.ok(cover.includes('pickLocalTheme(coverContext(record))'),'local theme from actual book content');
assert.ok(cover.includes('renderAICover({title:record.fileName,theme:localTheme,variant})'),'immediate illustrated cover generation');
assert.ok(cover.includes('await updateLibraryMetadata(id,{'),'saves real cover to IndexedDB');
assert.ok(cover.indexOf('await updateLibraryMetadata(id,{',cover.indexOf('const localCover=')) < cover.indexOf('requestAiCoverTheme(originalRecord,'),'local save precedes optional online request');
assert.ok(cover.includes('coverRemoteTailRef.current=coverRemoteTailRef.current.catch(()=>{}).then(improve)'),'AI improvement is nonblocking and sequential');
assert.ok(cover.includes('coverAI:localCover') && cover.includes('coverStatus:\'ready\''),'local result survives service failure');
assert.ok(cover.includes('latest.coverVariant!==variant') && cover.includes('latest.coverAI!==localCover'),'late AI results cannot overwrite newer user edits');
assert.ok(!app.includes("item.coverStatus!=='failed'"),'failed LAB19 entries are retried/recovered by LAB20');
assert.ok(ui.includes('setCoverNotice(')&&ui.includes('sb-true-cover-progress'),'genuine image progress and saved-cover feedback visible');
assert.ok(ui.includes('onGenerateCover(id,{onStage:setCoverPhase})'),'LAB22 automatic web-cover lookup stays wired via long-press');
assert.ok(app.includes('coverOrigin:result.kind===\'original\'?\'online-catalog\':\'online-thematic\''),'LAB22 saves catalog or thematic photo without touching originals');
assert.ok(app.includes('if(automatic)return false;'),'LAB21 never generates misleading fake art automatically');

// Regeneration changes actual SVG artwork, not merely a 5-pixel text offset.
const a=decodeURIComponent(renderAICover({title:'Storia romana',theme:'storia',variant:0}).split(',')[1]);
const b=decodeURIComponent(renderAICover({title:'Storia romana',theme:'storia',variant:1}).split(',')[1]);
const c=decodeURIComponent(renderAICover({title:'Storia romana',theme:'storia',variant:2}).split(',')[1]);
assert.notEqual(a,b);assert.notEqual(b,c);
assert.ok(b.includes('M30 90Q160 10 292 98'),'different layout ornament on regenerate');
assert.equal(pickLocalTheme('I romani e la storia antica'),'storia');
assert.equal(isScannerBook({sourceData:{sourceFormat:'scan'}}),true,'unprocessed scan remains photo');
assert.equal(isScannerBook({sourceData:{sourceFormat:'scan'},studyBook:{chapters:[]}}),false,'processed scanned book can generate AI cover');
assert.equal(isScannerBook({metadata:{sourceFormat:'scan',hasProcessed:true}}),false,'stored processed scan book may regenerate AI cover');

assert.ok(coverContext({fileName:'Matematica',sourceData:{chapters:[{title:'Calcolo',paragraphs:['L equazione']} ]}}).includes('equazione'));

await saveLibraryBook({id:'lab20-book',fileName:'Storia antica.pdf',profileId:'default'});
await updateLibraryMetadata('lab20-book',{coverAI:renderAICover({title:'Storia antica',theme:'storia'}),coverStatus:'ready',coverOrigin:'local'});
const record=await getLibraryBook('lab20-book');
assert.equal(record.fileName,'Storia antica.pdf');
assert.equal(record.coverOrigin,'local');
assert.equal((await listLibraryBooks({profileId:'default'})).length,1,'no cloned PDF records');
assert.ok(android.includes('StudyBook-AI-LAB-20-AGGIORNAMENTO') && android.includes('STUDYBOOK_SIGNING_MODE=update'),'APK keeps update-in-place family identity');
console.log('LAB20 PASS: contiguous 3-column original photos across folders; immediate local cover with optional online AI; regeneration and data retained');
