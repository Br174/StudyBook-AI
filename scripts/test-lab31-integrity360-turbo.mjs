import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  makeLogicalBlocks, choosePdfLanes, shouldThrottlePdfLanes,
  joinOrderedPageText, auditIntegrityPages, mergePageBoundaryParagraphs,
  verifiedChapterStates, requireIntegrityForStudy,
} from '../src/lib/integrity360Core.js';

const blocks = makeLogicalBlocks(1000);
assert.equal(blocks.length, 10);
assert.equal(blocks[0].start, 1);
assert.equal(blocks.at(-1).end, 1000);
const visited = blocks.flatMap(block => Array.from({length: block.end-block.start+1}, (_,i) => block.start+i));
assert.deepEqual(visited, Array.from({length:1000}, (_,i) => i+1));
assert.equal(makeLogicalBlocks(1).length, 1);
assert.equal(makeLogicalBlocks(0).length, 0);
assert.equal(choosePdfLanes({hardwareConcurrency:8,deviceMemory:8,pageCount:1000}), 2);
assert.equal(choosePdfLanes({hardwareConcurrency:8,deviceMemory:2,pageCount:1000}), 1);
assert.equal(choosePdfLanes({hardwareConcurrency:2,deviceMemory:4,pageCount:1000}), 1);
assert.equal(shouldThrottlePdfLanes({durationMs:1300,baselineMs:100}), true);

const pages = Array.from({length:1000}, (_,i)=>({
  pageNumber:i+1,text:'Pagina '+(i+1),status:'verified',
}));
assert.equal(auditIntegrityPages(pages,1000,blocks).ready,true);
const missing = pages.filter(page => page.pageNumber!==500);
assert.equal(auditIntegrityPages(missing,1000,blocks).ready,false);
assert.equal(auditIntegrityPages([...pages, pages[42]],1000,blocks).ready,false);
assert.equal(auditIntegrityPages([...pages].reverse(),1000,blocks).ready,false);
assert.equal(auditIntegrityPages(pages.map(page=>page.pageNumber===400?{...page,status:'failed'}:page),1000,blocks).ready,false);
assert.equal(auditIntegrityPages(pages,1000,[{start:1,end:500},{start:502,end:1000}]).ready,false);

assert.equal(joinOrderedPageText([{text:'Questa è una continuazione,'},{text:'per una nuova pagina.'}]),'Questa è una continuazione, per una nuova pagina.');
assert.equal(joinOrderedPageText([{text:'L’ordinamento sto-'},{text:'rico rimane completo.'}]),'L’ordinamento storico rimane completo.');
const chapters = mergePageBoundaryParagraphs([{title:'Storia',paragraphs:['Il criterio fonda-','mentale è rispettato.'],paragraphMeta:[{pageStart:1,pageEnd:1,sectionTitle:'A'},{pageStart:2,pageEnd:2,sectionTitle:'A'}]}]);
assert.deepEqual(chapters[0].paragraphs,['Il criterio fondamentale è rispettato.']);
assert.equal(chapters[0].paragraphMeta[0].pageEnd,2);
assert.equal(verifiedChapterStates([{title:'C',pageStart:1,pageEnd:3}],pages,1000)[0].status,'verified');
assert.equal(verifiedChapterStates([{title:'C',pageStart:499,pageEnd:501}],missing,1000)[0].status,'pending');
assert.equal(requireIntegrityForStudy({integrity360:{ready:true,issues:[]}}),true);
assert.throws(()=>requireIntegrityForStudy({integrity360:{ready:false,issues:[{severity:'block'}]}}));

const parser=readFileSync(new URL('../src/lib/documentParserV11.js',import.meta.url),'utf8');
const turbo=readFileSync(new URL('../src/lib/pdfIntegrityTurbo.js',import.meta.url),'utf8');
const store=readFileSync(new URL('../src/lib/ocrResumeStore.js',import.meta.url),'utf8');
assert.ok(parser.includes("import('./pdfIntegrityTurbo.js')"));
assert.ok(turbo.includes("crypto.subtle.digest('SHA-256'"));
assert.ok(turbo.includes('loadIntegrity360Pages') && turbo.includes('saveIntegrity360Page'));
assert.ok(turbo.includes("ocrWorker.recognize(canvas)") && turbo.includes('canvas.width = 1'));
assert.ok(store.includes('loadIntegrity360Pages') && store.includes('saveIntegrity360Page'));
const reprocess=readFileSync(new URL('../src/lib/libraryReprocess.js',import.meta.url),'utf8');
assert.ok(reprocess.includes('requireIntegrityForStudy'));
const engine=readFileSync(new URL('../src/lib/studyEngineV10.js',import.meta.url),'utf8');
assert.ok(engine.includes('requireIntegrityForStudy'));
console.log('LAB31A-F: 1000 pagine, ordine, checkpoint, OCR, confini, gate studio e rielaborazione: verifiche locali superate');
