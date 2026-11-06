import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import { jsPDF } from 'jspdf';
// pdfjs-dist 6 expects a browser DOMMatrix at module-evaluation time.
// This minimal test-only definition permits text-extraction checks in Node.
// It is never shipped to the Android/browser application.
if (typeof globalThis.DOMMatrix === 'undefined') {
  globalThis.DOMMatrix = class TestOnlyDOMMatrix {
    constructor() { this.a=1; this.b=0; this.c=0; this.d=1; this.e=0; this.f=0; }
  };
}
const { readPdfIntegrity360 } = await import('../src/lib/pdfIntegrityTurbo.js');
const pdfjsLib = await import('pdfjs-dist');
pdfjsLib.GlobalWorkerOptions.workerSrc =
  new URL('../node_modules/pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

const source = new jsPDF({ unit:'pt', format:'a4' });
for (let page = 1; page <= 24; page += 1) {
  if (page > 1) source.addPage();
  source.setFontSize(15);
  source.text('Capitolo ' + page + ' - Studio del diritto', 32, 58);
  source.setFontSize(11);
  source.text('Questo principio della pagina ' + page + ' conserva condizioni ed eccezioni.', 32, 85);
  source.text('Il testo originale rimane verificabile senza tagli o pagine omesse.', 32, 103);
}
const data = source.output('arraybuffer');
const originalBytes = new Uint8Array(data);
const file = {
  name:'manuale-universitario.pdf', type:'application/pdf',
  size:originalBytes.byteLength, lastModified:1,
  arrayBuffer: async () => originalBytes.slice().buffer,
};
const updates = [];
const first = await readPdfIntegrity360(file, {
  autoOcr:true, onProgress: update => updates.push(update.phase),
});
assert.equal(first.structure.pageCount,24);
assert.equal(first.pages.length,24);
assert.equal(first.integrity360.verifiedPages,24);
assert.equal(first.integrity360.ready,true);
assert.equal(first.integrity360.missingPages,0);
assert.ok(first.integrity360.fingerprint.length===64);
assert.ok(first.fullText.includes('pagina 24'));
assert.ok(first.pages.every((row,i)=>row.pageNumber===i+1));
assert.ok(first.chapters.length>=1);
assert.ok(first.integrity360.checkpointSavedPages>=24);
assert.ok(updates.includes('turbo-inventory') && updates.includes('turbo-verify'));

const replay = await readPdfIntegrity360(file,{autoOcr:true});
assert.equal(replay.integrity360.checkpointResumedPages,24);
assert.equal(replay.integrity360.ready,true);
assert.equal(replay.originalFingerprint,first.originalFingerprint);
console.log('LAB31 digital PDF: 24 physical pages verified and resumed from content-addressed IndexedDB checkpoints.');
