import '../src/lib/promiseTryPolyfill.js';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import 'fake-indexeddb/auto';
import {jsPDF} from 'jspdf';

// PDF.js 6 requires DOMMatrix during module evaluation in Node.js tests.
if(typeof globalThis.DOMMatrix==='undefined')
  globalThis.DOMMatrix=class TestDOMMatrix {
    constructor(){this.a=1;this.b=0;this.c=0;this.d=1;this.e=0;this.f=0;}
  };
const {readSourceFile}=await import('../src/lib/documentParserV11.js');
const {loadIntegrity360Pages}=await import('../src/lib/ocrResumeStore.js');
const {readPdfMirrorV35}=await import('../src/lib/readPdfMirrorV35.js');
const {readPdfIntegrity360}=await import('../src/lib/pdfIntegrityTurbo.js');
const pdfjsLib=await import('pdfjs-dist');
pdfjsLib.GlobalWorkerOptions.workerSrc=
  new URL('../node_modules/pdfjs-dist/build/pdf.worker.min.mjs',import.meta.url).toString();

const asFile=(doc,name)=>{
  const bytes=new Uint8Array(doc.output('arraybuffer'));
  return {file:{name,type:'application/pdf',size:bytes.byteLength,
    arrayBuffer:async()=>bytes.slice().buffer},bytes};
};

// Digital PDF with vector drawings: the reader must not rasterize, catalog or
// duplicate them. The graphical path cannot be used for IA chapter processing.
const digital=new jsPDF({unit:'pt',format:'a4'});
for(let i=1;i<=24;i++){
  if(i>1)digital.addPage();
  digital.setFontSize(15);
  digital.text('Capitolo '+i+' - Filosofia del diritto',30,54);
  digital.setFontSize(11);
  digital.text('Il testo della pagina '+i+' descrive norme, eccezioni e definizioni.',30,83);
  digital.text('Le condizioni originali e le fonti sono conservate integralmente.',30,101);
  digital.setFillColor(200,100,110);
  digital.rect(30,135,125,40,'F'); // graphical content, not study text
}
const {file,bytes}=asFile(digital,'libro-con-grafici.pdf');
const progress=[];
const parsed=await readSourceFile(file,{
  autoOcr:true, // legacy callers must NOT override the new book text-only policy
  onProgress:item=>progress.push(item.phase),
});
assert.equal(parsed.structure.pageCount,24);
assert.equal(parsed.pages.length,24);
assert.equal(parsed.integrity360.verifiedPages,24);
assert.equal(parsed.integrity360.ready,true);
assert.equal(parsed.structure.textOnlyBookImport,true);
assert.equal(parsed.integrity360.textOnlyBookImport,true);
assert.equal(parsed.integrity360.runtime.ocrLanes,0);
assert.equal(parsed.structure.imageCount,0);
assert.equal(parsed.structure.assetCount,0);
assert.deepEqual(parsed.assets,[]);
assert.deepEqual(parsed.visualAnchors,[]);
assert.deepEqual(parsed.canonicalBookMap.visualAnchors,[]);
assert.ok(parsed.canonicalBookMap.pages.every(p=>p.imageReferences.length===0));
assert.ok(parsed.fullText.includes('pagina 24'));
assert.ok(parsed.chapters.length>0);
assert.ok(progress.includes('turbo-inventory')&&progress.includes('turbo-verify'));
assert.ok(!progress.some(phase=>/rich-assets|mirror-figure-map|ocr-page|ocr-loading|ocr-recognize/.test(phase)));
assert.deepEqual(new Uint8Array(await file.arrayBuffer()),bytes,'Original PDF unchanged');

// New checkpoints store verified text only, without any image anchors or
// copied page snapshots. Reopening the same file reuses exactly those pages.
const rows=await loadIntegrity360Pages(parsed.ocrCheckpointSignature);
assert.equal(rows.length,24);
assert.ok(rows.every(row=>!Object.hasOwn(row,'visualAnchors') &&
  !Object.hasOwn(row,'imageCount') && !Object.hasOwn(row,'inkCount')));
const restored=await readSourceFile(file,{autoOcr:false});
assert.equal(restored.integrity360.checkpointResumedPages,24);
assert.deepEqual(restored.assets,[]);

// A PDF page with *no selectable text* is NOT falsely marked verified and
// must never invoke OCR or the picture renderer.
const drawings=new jsPDF({unit:'pt',format:'a4'});
drawings.setFillColor(20,55,130);
drawings.rect(30,40,220,140,'F');
const pictureOnly=asFile(drawings,'pagina-fotografata.pdf').file;
const unselectable=await readPdfMirrorV35(pictureOnly,{autoOcr:true});
assert.equal(unselectable.pages[0].status,'text-unavailable');
assert.equal(unselectable.integrity360.ready,false);
assert.deepEqual(unselectable.assets,[]);
assert.equal(unselectable.integrity360.runtime.ocrLanes,0);
const direct=await readPdfIntegrity360(pictureOnly,{textOnly:true,autoOcr:false});
assert.equal(direct.pages[0].issue,'no-selectable-text-image-skipped');

const adapter=readFileSync(new URL('../src/lib/readPdfMirrorV35.js',import.meta.url),'utf8');
const turbo=readFileSync(new URL('../src/lib/pdfIntegrityTurbo.js',import.meta.url),'utf8');
const recovery=readFileSync(new URL('../src/lib/sourceRecoveryV34.js',import.meta.url),'utf8');
const app=readFileSync(new URL('../src/AppV15.jsx',import.meta.url),'utf8');
const scanner=readFileSync(new URL('../src/lib/scannerOcrRuntime.js',import.meta.url),'utf8');
assert.ok(!/scanPdfPageFigures|loadMirrorVisualPages|saveMirrorVisualPage|getOperatorList|withPdfMirrorRenderer|renderMirrorImage/.test(adapter));
assert.ok(!turbo.includes('extractPdfVisualAssetsFromDocument'));
assert.ok(adapter.includes('autoOcr:false,textOnly:true'));
assert.ok(recovery.includes('autoOcr:false,textOnly:true'));
assert.ok(app.includes('autoOcr: false, textOnly: true'));
assert.ok(app.includes('Immagini escluse dall’importazione libri'));
assert.ok(scanner.includes('recognizeScannerImage'),'Voluntary Scanner OCR remains intact');
console.log('LAB47 PASS: 24 pages digital+vectors, 24 text checkpoints, no pictures/OCR/snapshots, unreadable-page guard, original PDF identical');
