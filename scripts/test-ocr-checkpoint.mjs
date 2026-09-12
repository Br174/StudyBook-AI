import assert from 'node:assert/strict';
import { applyOcrCache, makeOcrSignature } from '../src/lib/ocrResumeStore.js';

const fileA = {
  name: 'manuale-universitario.pdf',
  size: 42_000_000,
  lastModified: 1_799_999_999_000,
  type: 'application/pdf',
};
const fileB = { ...fileA, lastModified: fileA.lastModified + 1 };

const signatureA1 = makeOcrSignature(fileA, 600);
const signatureA2 = makeOcrSignature(fileA, 600);
const signatureDifferentRevision = makeOcrSignature(fileB, 600);
const signatureDifferentPages = makeOcrSignature(fileA, 599);

assert.equal(signatureA1, signatureA2, 'La firma OCR deve essere stabile per lo stesso file.');
assert.notEqual(signatureA1, signatureDifferentRevision, 'Una revisione diversa del file deve produrre una firma diversa.');
assert.notEqual(signatureA1, signatureDifferentPages, 'Un numero di pagine diverso deve produrre una firma diversa.');

const pages = [
  { pageNumber: 1, text: 'Testo incorporato già sufficiente e completo per non richiedere OCR.', source: 'embedded' },
  { pageNumber: 2, text: 'x', source: 'embedded' },
  { pageNumber: 3, text: 'testo breve', source: 'embedded' },
  { pageNumber: 4, text: 'pagina non candidata', source: 'embedded' },
];

const records = [
  { pageNumber: 2, text: 'Testo OCR recuperato dalla pagina due, sufficientemente lungo da sostituire il testo incorporato.' },
  { pageNumber: 3, text: 'corto' },
  { pageNumber: 4, text: 'Questo testo esiste nel checkpoint ma la pagina non è candidata e non deve essere toccata.' },
];

const result = applyOcrCache(pages, records, [2, 3]);

assert.deepEqual(result.resumedPages, [2], 'Solo la pagina con checkpoint migliore deve essere ripresa.');
assert.equal(result.pages[1].source, 'ocr-resume', 'La pagina ripresa deve essere marcata come OCR da checkpoint.');
assert.match(result.pages[1].text, /pagina due/i, 'Il testo OCR salvato deve essere ripristinato.');
assert.equal(result.pages[2].text, 'testo breve', 'Un checkpoint peggiore del testo esistente non deve sostituirlo.');
assert.equal(result.pages[3].text, 'pagina non candidata', 'Le pagine non candidate non devono essere modificate.');
assert.notStrictEqual(result.pages, pages, 'L’applicazione del checkpoint non deve riutilizzare lo stesso array.');
assert.equal(pages[1].text, 'x', 'L’input originale non deve essere mutato.');

console.log(JSON.stringify({
  ok: true,
  signature: signatureA1,
  resumedPages: result.resumedPages,
}, null, 2));
