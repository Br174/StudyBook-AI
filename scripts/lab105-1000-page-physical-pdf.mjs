// LAB105: 1000 actual PDF pages, generated from synthetic Italian content.
// Calls StudyBook's REAL PDF ingestion engine, with persistent IndexedDB via
// fake-indexeddb. Zero Gemini. No Android app writes or production changes.
// This tests text-based PDF pages, NOT scanned/image PDFs or actual Android UI.
import '../src/lib/promiseTryPolyfill.js';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import {jsPDF} from 'jspdf';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import {FIXTURES} from './lab93-semantic-gate.mjs';
if(typeof globalThis.DOMMatrix==='undefined'){
 globalThis.DOMMatrix=class TestOnlyDOMMatrix{
  constructor(){this.a=1;this.b=0;this.c=0;this.d=1;this.e=0;this.f=0}
 };
}
const {readPdfIntegrity360}=await import('../src/lib/pdfIntegrityTurbo.js');
const pdfjsLib=await import('pdfjs-dist');
pdfjsLib.GlobalWorkerOptions.workerSrc=
 new URL('../node_modules/pdfjs-dist/build/pdf.worker.min.mjs',import.meta.url).toString();
const LIMIT=1000,CHAPTERS=25,PAGES_PER_CHAPTER=40;
const source=new jsPDF({unit:'pt',format:'a4',compress:true});
const hasSignature=i=>'CODICEUNICO'+String(i).padStart(5,'0');
const labelFor=i=>'Pagina '+i+' - capitolo '+(Math.floor((i-1)/PAGES_PER_CHAPTER)+1);
let sourceBytes=0;
for(let i=1;i<=LIMIT;i++){
 if(i>1)source.addPage();
 const section=Math.floor((i-1)/PAGES_PER_CHAPTER)+1;
 if((i-1)%PAGES_PER_CHAPTER===0){
  source.setFont('helvetica','bold');source.setFontSize(15);
  source.text('CAPITOLO '+section+' - STUDIO E VERIFICA',36,45);
 }
 source.setFont('helvetica','normal');source.setFontSize(11);
 source.text('Pagina originale '+i+' su '+LIMIT,36,65);
 source.text('Identificativo '+hasSignature(i),36,84);
 const fixture=FIXTURES[(i-1)%FIXTURES.length];
 const main=fixture.concepts.join(' ').normalize('NFC');
 sourceBytes+=Buffer.byteLength(main);
 const lines=source.splitTextToSize(main,520);
 source.text(lines,36,115,{lineHeightFactor:1.22});
 source.setFontSize(9);
 source.text('Verifica univoca pagina '+i+' - archivio con testo selezionabile.',36,812);
}
const pdfBytes=new Uint8Array(source.output('arraybuffer'));
const file={name:'LAB105_1000_PAGINE_TEST_SINTETICO.pdf',type:'application/pdf',
 size:pdfBytes.byteLength,lastModified:1,arrayBuffer:async()=>pdfBytes.slice().buffer};
let lastCompleted=0,regressions=0;const phases=new Set();
const firstStart=performance.now();
const first=await readPdfIntegrity360(file,{
 autoOcr:false,textOnly:true,
 onProgress:info=>{
  if(info?.phase)phases.add(info.phase);
  const done=Number(info?.done);
  if(info?.phase==='turbo-extract'&&Number.isFinite(done)){
   if(done<lastCompleted)regressions++;
   lastCompleted=Math.max(lastCompleted,done);
  }
 }
});
const firstMs=performance.now()-firstStart;
assert.equal(first.structure.pageCount,LIMIT,'INCORRECT_PDF_PAGE_COUNT');
assert.equal(first.pages.length,LIMIT,'MISSING_PAGE');
assert.equal(first.integrity360.verifiedPages,LIMIT,'NOT_EVERY_PHYSICAL_PDF_PAGE_VERIFIED');
assert.equal(first.integrity360.missingPages,0,'PDF_PAGES_MISSING');
assert.equal(first.integrity360.ready,true,'PDF_NOT_READY');
assert(first.pages.every((p,index)=>p.pageNumber===index+1),'PAGE_ORDER_REGRESSION');
const lost=[],markerLost=[];
for(let i=1;i<=LIMIT;i++){
 const page=first.pages[i-1];
 if(!page.text.includes(hasSignature(i)))markerLost.push(i);
 if(!page.text.includes('Pagina originale '+i+' su '+LIMIT))lost.push(i);
}
assert.equal(markerLost.length,0,'PDF_UNIQUE_TEXT_LOST '+markerLost.slice(0,10));
assert.equal(lost.length,0,'PDF_ORIGINAL_PAGE_NUMBERS_LOST '+lost.slice(0,10));
assert(!first.pages.some(p=>p.status==='text-unavailable'),'NON_TEXT_PDF_PAGE');
const chapters=first.chapters||[];
// 25 chapter headings are expected in the original source. The parser may
// group unexpected headings differently: document it, do not invent success.
const titles=chapters.map(c=>c.title||'');
const detectedChapterHeadings=titles.filter(t=>/^CAPITOLO\s+\d+/iu.test(t)).length;
const replayStart=performance.now();
const again=await readPdfIntegrity360(file,{autoOcr:false,textOnly:true});
const replayMs=performance.now()-replayStart;
assert.equal(again.structure.pageCount,LIMIT);
assert.equal(again.integrity360.checkpointResumedPages,LIMIT,'1000_PAGE_RESUME_FAILURE');
assert.equal(again.originalFingerprint,first.originalFingerprint);
const report={
 name:'StudyBook LAB105 real 1000-physical-page PDF ingestion and repeat load',
 testedAt:new Date().toISOString(),source:'Locally synthesized PDF with 5 repeated Italian source archetypes and 1000 UNIQUE page markers',
 physicalPdfPages:LIMIT,totalChaptersExpected:CHAPTERS,detectedChapterHeadings,
 detectedChapterCount:chapters.length,headingsSample:titles.slice(0,5),
 inputBytes:pdfBytes.byteLength,inputTextBytes:sourceBytes,
 extractedPages:first.pages.length,verifiedPages:first.integrity360.verifiedPages,
 lostUniquePageMarkers:markerLost.length,lostOriginalPageNumbers:lost.length,
 missingPages:first.integrity360.missingPages,
 checkpointSavedPages:first.integrity360.checkpointSavedPages,
 checkpointResumedPages:again.integrity360.checkpointResumedPages,
 sourceFingerprintEqual:again.originalFingerprint===first.originalFingerprint,
 progressRegressionsObserved:regressions,
 parseMs:Math.round(firstMs),resumeMs:Math.round(replayMs),
 exactChapterStructurePass:detectedChapterHeadings===CHAPTERS,
 phases:[...phases],
 limitations:'Generated PDF, not a public-domain book or user textbook. Text-only pages, no scanned images. Does NOT run Gemini or six reductions. Uses real StudyBook import engine and fake IndexedDB, not a physical Android device. A4 visual parity and font rendering not established.',
 additionalPaidCostEuro:0,geminiCalls:0,androidChanged:false,productionChanged:false};
mkdirSync('audit/reports',{recursive:true});
writeFileSync('audit/reports/lab105-1000-physical-pdf.json',JSON.stringify(report,null,2)+'\n');
console.log('LAB105_1000_PDF_REAL_INGEST',JSON.stringify(report));
assert.equal(detectedChapterHeadings,CHAPTERS,'CHAPTER_STRUCTURE_NOT_FIDELITOUS'); 
