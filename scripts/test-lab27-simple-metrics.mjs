import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildPrecisionEdition } from '../src/lib/precisionCore.js';
import { explainInSimpleWords } from '../src/lib/simpleLanguage.js';
import { countLetters, splitCompleteSentences } from '../src/lib/studyQualityGuard.js';
import { buildEditorialDocument, editorialParagraphText } from '../src/lib/editorialModel.js';

const sample = {
  title: 'Diritto e procedure',
  chapters: [{title: 'L’ordinamento giuridico', paragraphs: [
    {
      original: 'La norma giuridica è una regola riconosciuta dal diritto. Qualora il requisito non sussista, il ricorso non può essere accolto. Pertanto l’autorità competente è tenuta a verificare i presupposti previsti. Il diritto soggettivo è una posizione tutelata dall’ordinamento.',
      simpleSummary: 'Vecchio riassunto indipendente che accorcia ancora il libro.',
      sourceSection: 'Principi',
    },
    {
      original: 'Art. 12. Il ricorso può essere presentato entro 30 giorni dalla notifica, salvo eccezioni previste dalla legge.\nE = mc²',
      simpleSummary: 'Vecchia sintesi senza legge o formula.',
      sourceSection: 'Principi',
    },
  ]}],
};
const snapshot = JSON.stringify(sample);
for (const level of [0, 10, 20, 30, 40, 50, 'summary']) {
  const book = buildPrecisionEdition(sample, level);
  const paragraph = book.chapters[0].paragraphs[0];
  assert.notEqual(paragraph.simpleSummary, sample.chapters[0].paragraphs[0].simpleSummary,
    'La vecchia sintesi indipendente non deve mai essere riciclata');
  assert.equal(paragraph.simpleSummary, explainInSimpleWords(paragraph.summary));
  assert.equal(splitCompleteSentences(paragraph.simpleSummary).length,
    splitCompleteSentences(paragraph.summary).length,
    'Non eliminare frasi o concetti nella lettura semplice');
  assert.ok(paragraph.simpleSummary.includes('non') || !paragraph.summary.includes('non'),
    'Non alterare negazioni del testo selezionato');
  assert.ok(editorialParagraphText(paragraph,{variant:'study'}).length > 0);
  assert.equal(editorialParagraphText(paragraph,{variant:'simple'}), paragraph.simpleSummary,
    'Il PDF e il telefono devono utilizzare la stessa versione semplificata');
  const legal = book.chapters[0].paragraphs[1];
  assert.equal(legal.simpleSummary, legal.summary,
    'Articoli e formule devono restare interi senza riformulazioni nascoste');
  const pdfModel = buildEditorialDocument(book,{variant:'simple'});
  assert.equal(pdfModel.variants[0].chapters[0].blocks[0].text, paragraph.simpleSummary);
  assert.equal(pdfModel.variants[0].chapters[0].blocks[0].originalText, sample.chapters[0].paragraphs[0].original);
}
assert.equal(JSON.stringify(sample), snapshot,'Mai modificare i libri originali');
const s = explainInSimpleWords('Qualora il presupposto sussista, pertanto è necessario verificare la fattispecie.');
assert.ok(s.includes('Se') && s.includes('quindi') && s.includes('serve'));
assert.ok(s.includes('fattispecie (situazione descritta dalla norma)'), 'Spiegare i termini settoriali');
assert.ok(countLetters('Caffè 123') === 5, 'Conta soltanto le lettere, con accenti');
const reader = readFileSync(new URL('../src/components/StudyMode.jsx',import.meta.url),'utf8');
assert.ok(!reader.includes('study-quality-table'), 'Nessuna tabella gigantesca');
assert.ok(reader.includes('study-chapter-letter-count') && !reader.includes('study-paragraph-letter-count'), 'La statistica resta una sola volta a fine capitolo, senza spezzare la narrazione');
assert.ok(reader.includes('Originale:') && reader.includes('Rielaborato:') && reader.includes('Risparmiate:'));
const pdf = readFileSync(new URL('../src/lib/exportersV12.js',import.meta.url),'utf8');
assert.ok(pdf.includes('pageLetterStats') && pdf.includes('addPageLetters'), 'PDF con conta per foglio fisico');
assert.ok(pdf.includes('Originale:') && pdf.includes('Rielaborato:') && pdf.includes('Risparmiate:'));
console.log('LAB27/30: parole semplici senza nuova sintesi; tre contatori a fine capitolo; footer PDF verificati');
