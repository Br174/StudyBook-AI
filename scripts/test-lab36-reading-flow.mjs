// LAB36 paper/reader regression: source physical pages are immutable.
import assert from 'node:assert/strict';
import { normalizeStudyParagraphFlow, countRenderedLetters } from '../src/lib/readingFlowV36.js';
import { buildCanonicalBookMap, composeMirrorPages } from '../src/lib/libroSpecchioV35.js';

assert.equal(normalizeStudyParagraphFlow('La paro-\nla continua.\nLettura fluida.\n\nIl paragrafo nuovo.'),'La parola continua. Lettura fluida.\n\nIl paragrafo nuovo.');
assert.equal(normalizeStudyParagraphFlow('Testo su\npiù righe. '),'Testo su più righe.');
assert.equal(countRenderedLetters('Pa\ngina'),6);

const map=buildCanonicalBookMap({
  originalFingerprint:'a'.repeat(64),pdfPageCount:2,
  pages:[{pageNumber:1,status:'verified',text:'Fonte uno'},{pageNumber:2,status:'verified',text:'Fonte due'}],
  pageLabels:['1','2'],
  chapters:[{title:'Il titolo',pageStart:1,pageEnd:2,sections:[],paragraphs:['A','B']}],
});
const book={chapters:[{title:'Il titolo',pageStart:1,pageEnd:2,sections:[],paragraphs:[
  {original:'Fonte uno',summary:'La prima frase\nprosegue in modo\nfluido.\n\nNuovo periodo.',sourcePageStart:1,sourcePageEnd:1},
  {original:'Fonte due',summary:'La pagina due\nrimane separata.',sourcePageStart:2,sourcePageEnd:2},
]}]};
const layout=composeMirrorPages(map,book,{maxLines:20,wrapLines:(s)=>String(s).split(/\s+/)});
const pages=layout.pages.filter(p=>p.kind==='text');
assert.equal(pages.length,2);
assert.deepEqual(pages.map(p=>p.sourcePage),[1,2]);
assert.ok(pages[0].blocks.some(b=>b.kind==='paragraph'&&b.text.includes('prima frase prosegue')));
assert.ok(pages[0].blocks.some(b=>b.kind==='paragraph'&&Array.isArray(b.layoutLines)));
assert.ok(pages[1].blocks.some(b=>b.text.includes('pagina due rimane')));
console.log('LAB36 reading paragraph flow, paper lines and page ownership: OK');
