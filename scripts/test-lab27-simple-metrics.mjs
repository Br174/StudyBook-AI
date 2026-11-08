import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildPrecisionEdition} from '../src/lib/precisionCore.js';
import {explainInSimpleWords} from '../src/lib/simpleLanguage.js';
import {countLetters} from '../src/lib/studyQualityGuard.js';
import {buildEditorialDocument,editorialParagraphText} from '../src/lib/editorialModel.js';

const sample={
  title:'Diritto e procedure',
  chapters:[{title:'L’ordinamento giuridico',paragraphs:[
    {original:'La norma giuridica è una regola riconosciuta dal diritto. Qualora il requisito non sussista, il ricorso non può essere accolto. Pertanto l’autorità competente è tenuta a verificare i presupposti previsti. Il diritto soggettivo è una posizione tutelata dall’ordinamento.',
      simpleSummary:'Vecchia sintesi automatica da non riutilizzare.',sourceSection:'Principi'},
    {original:'Art. 12. Il ricorso può essere presentato entro 30 giorni dalla notifica, salvo eccezioni previste dalla legge.\nE = mc²',
      simpleSummary:'Vecchia sintesi da eliminare.',sourceSection:'Principi'},
  ]}],
};
const snapshot=JSON.stringify(sample);
for(const level of [0,10,20,30,40,50,'summary']){
  const book=buildPrecisionEdition(sample,level);
  const paragraph=book.chapters[0].paragraphs[0];
  assert.equal(paragraph.simpleSummary,undefined,'Never generate/carry forward the obsolete automatic simple edition');
  assert.ok(paragraph.summary && paragraph.dsaSummary,'Primary study reduction stays present');
  assert.ok(editorialParagraphText(paragraph,{variant:'study'}).length>0);
  const legal=book.chapters[0].paragraphs[1];
  assert.equal(legal.simpleSummary,undefined,'No pre-generating legal page');
  const pdfModel=buildEditorialDocument(book,{variant:'study'});
  assert.ok(pdfModel.variants[0].chapters[0].blocks[0].text,
    'Study print maintains content and structure');
  assert.equal(pdfModel.variants[0].chapters[0].blocks[0].originalText,
    sample.chapters[0].paragraphs[0].original);
}
assert.equal(JSON.stringify(sample),snapshot,'Never modify original book or old source bytes');
const utility=explainInSimpleWords('Qualora il presupposto sussista, pertanto è necessario verificare la fattispecie.');
assert.ok(utility.includes('Se')&&utility.includes('quindi')&&utility.includes('serve'));
assert.equal(countLetters('Caffè 123'),5);
const reader=readFileSync(new URL('../src/components/StudyMode.jsx',import.meta.url),'utf8');
assert.ok(!reader.includes('study-quality-table'));
assert.ok(reader.includes('study-chapter-letter-count')&&!reader.includes('study-paragraph-letter-count'));
assert.ok(reader.includes('Lettere risparmiate:')&&reader.includes('Righe risparmiate:'));
assert.ok(!reader.includes('Rielaborato:')&&!reader.includes('Parole risparmiate:'),
  'LAB68 shows only two reader savings counters');
const pdf=readFileSync(new URL('../src/lib/exportersV12.js',import.meta.url),'utf8');
assert.ok(pdf.includes('pageLetterStats')&&pdf.includes('addPageLetters'));
assert.ok(pdf.includes('Originale:')&&pdf.includes('Rielaborato:')&&pdf.includes('Risparmiate:'));
console.log('LAB27/50: primary PDF and letter metrics preserved; automatic simple precomputation removed.');
