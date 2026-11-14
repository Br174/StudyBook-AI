#!/usr/bin/env node
// LAB132 offline tests only: no Gemini/Worker requests or Android signing.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import 'fake-indexeddb/auto';
import {acceptReformulationV132,readReformulationsV132,
 storeReworkedPdfV132,readReworkedPdfV132,catalogReformulationsV132,
 deleteReformulationsV132} from '../src/lib/reformulationsStoreV132.js';

const ui=readFileSync('src/components/AppScreens.jsx','utf8');
const reader=readFileSync('src/components/ExplainedReaderV122.jsx','utf8');
const app=readFileSync('src/AppV15.jsx','utf8');
const source=readFileSync('src/lib/pageReformulationV132.js','utf8');
const style=readFileSync('src/appShellV16.css','utf8');
for(const label of ['Originali','Scannerizzati','Riassunto al 50%','In parole semplici','Da rielaborare','Rielaborati']){
 assert.ok(ui.includes("title:'"+label+"'"),'Missing root folder: '+label);
}
assert.ok(ui.includes('sb-library-folder-grid'));
assert.ok(style.includes('grid-template-columns:repeat(3,minmax(0,1fr))'));
assert.ok(ui.includes('}, 2000);'),'Long press must be 2 seconds');
assert.ok(ui.includes('Ripristina copertina originale'));
assert.ok(ui.includes('Riesamina dal PDF originale'));
assert.ok(ui.includes('Rielabora libro'));
assert.ok(reader.includes('Tieni riformulazione'));
assert.ok(reader.includes('Riformula ancora'));
assert.ok(reader.includes('In parole semplici'));
assert.ok(reader.includes('explainStudyPageOnDemandV49'));
assert.ok(source.includes("phase:'explain'"));
assert.ok(source.includes('originalExplainedPagesV122'));
assert.ok(!source.includes('previousDraft:'));
assert.equal((app.match(/from '\.\/lib\/fileDelivery\.js';/g)||[]).length,1);
assert.ok(app.includes('onReformulated={()=>void refreshReworkCatalog()}'));
assert.ok(app.includes('setOriginalRecord(record);'));
const id='lab132-offline-test',fingerprint='a'.repeat(64);
const example=page=>({sourcePage:page,id:'p'+page,label:String(page),
 sourceFingerprint:fingerprint,review:{ready:true},
 segments:[{id:'p'+page+'-s0',text:'Spiegazione corretta pagina '+page+'.'}],glossary:[]});
const first=await acceptReformulationV132(id,example(3));
assert.equal(first.revision,1);
const second=await acceptReformulationV132(id,example(6));
assert.equal(second.revision,2);
assert.equal(Object.keys(second.accepted).length,2);
const doc={blob:new Blob(['%PDF-1.4\nTEST'],{type:'application/pdf'}),
 fileName:'Libro_Rielaborato.pdf',sourcePages:44};
await assert.rejects(()=>storeReworkedPdfV132(id,fingerprint,1,doc));
const saved=await storeReworkedPdfV132(id,fingerprint,2,doc);
const catalog=await catalogReformulationsV132([id,'other']);
assert.equal(catalog.states[id].acceptedCount,2);
assert.equal(catalog.states[id].exportedRevision,2);
assert.equal(catalog.pdfs.length,1);
assert.equal((await readReworkedPdfV132(saved.id)).blob.size,doc.blob.size);
await acceptReformulationV132(id,example(3));
const next=await readReformulationsV132(id);
assert.equal(next.revision,3);
assert.equal(Object.keys(next.accepted).length,2,'Same page replacement is counted once');
assert.equal(next.exportedRevision,2,'A new accepted page creates pending PDF work');
assert.equal((await catalogReformulationsV132([id])).pdfs.length,1,'Old PDF snapshot persists');
await assert.rejects(()=>acceptReformulationV132(id,
 {...example(7),sourceFingerprint:'b'.repeat(64)}));
await deleteReformulationsV132(id);
assert.equal(await readReformulationsV132(id),null);
assert.equal((await catalogReformulationsV132([id])).pdfs.length,0);
console.log('LAB132 PASS: six folders, original source, 2s menu, accepted edits and immutable PDFs.');
