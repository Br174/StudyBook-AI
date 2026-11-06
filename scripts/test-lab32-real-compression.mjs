import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildPrecisionEdition, buildReductionStatistics } from '../src/lib/precisionCore.js';
import { countLetters, auditNarrativeSource } from '../src/lib/studyQualityGuard.js';

const protectedSentence = 'Salvo le eccezioni espressamente previste, la legge fissa un termine entro 30 giorni per il ricorso.';
const original = [
  'Il diritto contiene principi fondamentali che costituiscono la materia della disciplina.',
  'La prima spiegazione illustra gli effetti e analizza il sistema giuridico.',
  'La seconda spiegazione individua la portata della norma all’interno della disciplina.',
  'Il caso concreto deve essere verificato secondo la fattispecie proposta.',
  'Questa ricostruzione consente di distinguere le posizioni soggettive dei partecipanti.',
  'Le regole del procedimento si applicano ai casi previsti dall’ordinamento.',
  protectedSentence,
].join(' ');
const book = { chapters: Array.from({length:12}, (_,index)=>({
  title:'Capitolo '+(index+1),
  paragraphs:Array.from({length:8}, (_,n)=>({
    original:original.replace('materia della disciplina', 'materia della disciplina '+(index+1)+'-'+(n+1)),
    summary:'VECCHIO RIASSUNTO DA NON RIUTILIZZARE',
  })),
})) };
const outputs = [0,10,20,30,40,50,'summary'].map(level=>buildPrecisionEdition(book,level));
const measures = outputs.map(output=>output.precisionEdition);
const at30 = measures[3], at50 = measures[5];
assert.ok(at50.achievedLettersPercent >= at30.achievedLettersPercent + 8,
  'The selected 50% must truly shorten a previously plateaued 30% book when safe');
assert.ok(at50.resultingLetters < at30.resultingLetters,
  'Never show different levels for the same output on compressible legal text');
assert.equal(at50.achievedPercent,at50.achievedLettersPercent,
  'User-facing reduction percentage must be actual LETTER reduction, not WORD reduction');
assert.equal(at30.achievedPercent,at30.achievedLettersPercent);
assert.ok(at50.achievedPercent > 40 && at50.achievedPercent <= 100,
  'Representative multi-sentence book must be compressed substantially at 50%');
for(const edition of outputs) {
  const meta=edition.precisionEdition;
  assert.equal(meta.achievedPercent,Math.round((1-meta.resultingLetters/meta.originalLetters)*1000)/10);
  assert.ok(meta.achievedPercent>=0);
  assert.ok(meta.qualityGuard.semanticCertification===false);
  for(const chapter of edition.chapters) {
    for(const paragraph of chapter.paragraphs) {
      assert.ok(paragraph.original.includes(protectedSentence));
      assert.ok(paragraph.summary.includes(protectedSentence),
        'Preserve late exception and legal deadline without forcing every preceding sentence');
      assert.ok(!paragraph.summary.includes('VECCHIO RIASSUNTO'));
      assert.ok(paragraph.summary.length>0);
    }
  }
}
assert.equal(measures[0].achievedPercent,0);
for(let i=1;i<measures.length;i++) {
  assert.ok(measures[i].resultingLetters<=measures[i-1].resultingLetters,
    'A higher reduction must not have more letters ('+i+')');
}

const statistics=buildReductionStatistics(book);
assert.equal(statistics.length,7);
for(let i=0;i<statistics.length;i++) {
  assert.equal(statistics[i].wholeBook.lettersReduced,measures[i].achievedLettersPercent,
    'Detailed and main reduction totals must agree in LETTERS');
  assert.equal(statistics[i].targetReached,
    measures[i].targetPercent===null || measures[i].achievedLettersPercent+0.5>=measures[i].targetPercent);
}
const footer=readFileSync(new URL('../src/components/AppScreens.jsx',import.meta.url),'utf8');
assert.ok(footer.includes('Riduzione effettiva (lettere):'));
assert.ok(footer.includes('achievedLettersPercent'));
const app=readFileSync(new URL('../src/AppV15.jsx',import.meta.url),'utf8');
assert.ok(app.includes('buildPrecisionEdition(studyBook, reduction)'));
assert.ok(app.includes('book={precisionBook}'));
const path=readFileSync(new URL('../src/lib/precisionCore.js',import.meta.url),'utf8');
assert.ok(path.includes('allowSafeGaps: true'));
assert.ok(path.includes('computeSelection(items, level)') && path.includes('chapterLevelTarget(level,chapterSourceLetters)'),
  'LAB33 replaces the global letter budget with explicit per-chapter budgets');

const screenshot = "dell’efficacia (essere) delle norme. delle norme. muove nell’ambito dei fatti fenomenologici. fenomenologici. diritto, cioè la condizione del diritto.";
const dangerous=buildPrecisionEdition({chapters:[{title:'Fonte danneggiata',paragraphs:[{original:screenshot}]}]},50);
assert.equal(dangerous.chapters[0].paragraphs[0].summary,screenshot,
  'Never repair or silently remove genuine damaged OCR fragments');
assert.equal(dangerous.precisionEdition.qualityGuard.status,'needs-review');
const cleanContinuation = 'perché il principio richiede una verifica completa della norma. L’ordinamento riconosce fattispecie differenti per le diverse condizioni. La disposizione giuridica prevede conseguenze specifiche in materia di validità. Il controllo dei requisiti implica un adeguato esame della situazione. Salvo le eccezioni previste, i diritti sono attribuiti ai soggetti.';
const benign = buildPrecisionEdition({chapters:[{title:'Continuazione',paragraphs:[{original:cleanContinuation}]}]},50);
assert.deepEqual(auditNarrativeSource(cleanContinuation).problems,['starts-mid-sentence']);
assert.ok(benign.precisionEdition.achievedPercent>25,
  'A harmless source chunk boundary cannot force every later sentence back to 0%');
assert.ok(benign.chapters[0].paragraphs[0].summary.startsWith('perché il principio richiede una verifica completa della norma.'),
  'Keep the suspicious first source sentence verbatim; do not invent its beginning');
assert.equal(benign.chapters[0].paragraphs[0].precisionAudit.sourceNeedsReview,true);

const one='È importante sottolineare che la norma giuridica è una regola che disciplina i comportamenti.';
const brief=buildPrecisionEdition({chapters:[{paragraphs:[{original:one}]}]},50);
assert.ok(brief.precisionEdition.achievedPercent>0,
  'Single sentences should still receive safe lexical compaction when possible');
console.log('LAB32_REAL_COMPRESSION_PASS '+JSON.stringify({
  requested30:at30.targetPercent,achieved30:at30.achievedPercent,
  requested50:at50.targetPercent,achieved50:at50.achievedPercent,
  originalLetters:at50.originalLetters,measured50Letters:at50.resultingLetters,
  sourceQualityGuard:'preserved',parallelAndroidSignature:'unchanged',
}));
