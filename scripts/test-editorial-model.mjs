import assert from 'node:assert/strict';
import { buildEditorialDocument, editorialParagraphText } from '../src/lib/editorialModel.js';

const book = {
  chapters: [{
    title: 'Le obbligazioni',
    paragraphs: [{
      original: 'Testo originale molto lungo.',
      summary: 'Testo di studio completo.',
      simpleSummary: 'Spiegazione semplice.',
      dsaSummary: 'Testo di studio completo.',
      sourceSection: 'Fonti',
      sourcePageStart: 12,
      sourcePageEnd: 13,
      glossary: [{ term: 'obbligazione', definition: 'vincolo giuridico', basis: 'source' }],
    },{
      original: 'Secondo testo.',
      summary: 'Secondo concetto.',
      simpleSummary: 'Secondo, in breve.',
      dsaSummary: 'Secondo concetto.',
      sourceSection: 'Fonti',
      sourcePageStart: 13,
      sourcePageEnd: 13,
      glossary: [],
    }],
  }],
};

assert.equal(editorialParagraphText(book.chapters[0].paragraphs[0], { variant: 'study' }), 'Testo di studio completo.');
assert.equal(editorialParagraphText(book.chapters[0].paragraphs[0], { variant: 'simple' }), 'Spiegazione semplice.');

const both = buildEditorialDocument(book, { variant: 'both', dsaMode: false });
assert.equal(both.variants.length, 2);
assert.equal(both.variants[0].id, 'study');
assert.equal(both.variants[1].id, 'simple');
assert.equal(both.variants[0].chapters[0].blocks.length, 2);
assert.equal(both.variants[0].chapters[0].blocks[0].sectionTitle, 'Fonti');
assert.equal(both.variants[0].chapters[0].blocks[1].sectionTitle, '');
assert.equal(both.variants[0].chapters[0].blocks[0].sourcePageStart, 12);
assert.equal(both.variants[0].chapters[0].glossary.length, 1);

const visible = JSON.stringify(both);
assert.ok(!visible.includes('PARAGRAFO 1'));
assert.ok(!visible.includes('Parole chiave'));
assert.ok(!visible.includes('Punti chiave'));
assert.ok(!visible.includes('Da ricordare'));

console.log(JSON.stringify({ ok: true, variants: both.variants.map((v) => v.id), chapters: both.variants[0].chapters.length }, null, 2));
