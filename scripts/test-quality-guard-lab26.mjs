import assert from 'node:assert/strict';
import { buildPrecisionEdition, buildReductionStatistics, REDUCTION_STEPS } from '../src/lib/precisionCore.js';
import { buildMeaningUnits, checkSentence, checkReducedParagraph, auditBookSourceCoverage, countText } from '../src/lib/studyQualityGuard.js';
import { buildFlashcards, buildQuiz, buildConceptMap, buildOralQuestions } from '../src/lib/studyTools.js';

const chapter1 = {
  title: 'Teoria generale dell’ordinamento', paragraphs: [
    { original: 'Il sistema statico è un ordinamento in cui la validità delle norme dipende dal loro contenuto. Il sistema dinamico è un ordinamento nel quale la validità dipende dalla produzione delle norme. Kelsen afferma che il sistema statico è fondato sul contenuto delle norme.',
      summary: 'Versione precedente da non usare.' },
    { original: 'Si dice: la norma primaria è la disposizione che disciplina un determinato comportamento. La norma secondaria è la disposizione che prevede una sanzione. Il diritto soggettivo è una posizione tutelata dall’ordinamento.',
      summary: 'Prima sintesi errata.' },
  ],
};
const chapter2 = { title: 'Norme e responsabilità', paragraphs: [
  { original: 'La responsabilità civile richiede la verifica del fatto, del danno e del nesso causale. La presenza del solo danno non costituisce automaticamente prova della responsabilità. Una regola generale ammette eccezioni soltanto quando la legge le prevede espressamente.',
    summary: 'Non è un fatto.' },
  { original: 'Art. 12. Il ricorso è proponibile entro 30 giorni dalla notificazione, salvo le eccezioni espressamente previste.\nE = mc²',
    summary: 'Il testo base omette la legge.' },
]};
const fixture = { chapters: [chapter1, chapter2], quality: {} };
const snapshot = JSON.stringify(fixture);
const editions = REDUCTION_STEPS.map((level) => buildPrecisionEdition(fixture, level));
assert.equal(editions[0].chapters[0].paragraphs[0].summary, chapter1.paragraphs[0].original);
assert.equal(JSON.stringify(fixture), snapshot, 'Il documento originale rimane identico.');
assert.ok(editions[5].chapters[1].paragraphs[1].summary.includes('Art. 12.'), 'Legge integrale');
assert.ok(editions[5].chapters[1].paragraphs[1].summary.includes('E = mc²'), 'Formula integrale');
assert.ok(editions[5].precisionEdition.achievedPercent > 0, 'Deve accorciare davvero.');
assert.ok(editions[5].precisionEdition.qualityGuard.semanticCertification === false, 'Mai dichiarare certificazione semantica assoluta.');
for (const ed of editions) {
  for (const chapter of ed.chapters) for(const paragraph of chapter.paragraphs) {
    assert.ok(paragraph.summary.trim(), 'Nessun paragrafo svuotato');
    assert.ok(paragraph.original.trim(), 'Originale conservato');
    const check = checkReducedParagraph(paragraph.original, paragraph.summary);
    assert.ok(check.ok || paragraph.precisionAudit?.fallbackOriginal, 'Niente frammenti pubblicati');
  }
}
const commaSource = 'La norma applicabile richiede alcune condizioni, fra cui la notifica e il deposito entro il termine previsto. La competenza è attribuita al giudice individuato dalla legge.';
const commaUnits = buildMeaningUnits(commaSource, 50);
assert.equal(commaUnits.length, 2, 'Le virgole non spezzano le unità logiche');
assert.ok(!commaUnits.some((v) => /,\s*$/.test(v.value)), 'Le frasi non finiscono su una virgola');
const dangling = checkSentence('La teoria interpretativa nasce dalla necessità di stabilire quali');
assert.ok(dangling.issues.includes('dangling-word'), 'Frase interrotta identificata');
const screenshotExample = {
  paragraphs: [
    { original: 'Si dice: la norma primaria è la disposizione che disciplina un determinato comportamento.', sourceChapterIndex: 0 },
    { original: 'Kelsen afferma che il sistema statico è fondato sul contenuto delle norme.', sourceChapterIndex: 0 },
    { original: 'È una metodologia interpretativa che nasce dall’esigenza di stabilire quali', sourceChapterIndex: 0 },
  ],
};
const cards = buildFlashcards(screenshotExample);
assert.ok(cards.length >= 2, 'Casi delle schermate: definizione e Kelsen');
assert.ok(cards.every((card) => !/come viene descritto|si dice:|concetto principale/i.test(card.front)), 'Niente domande spezzate');
assert.ok(cards.every((card) => screenshotExample.paragraphs.some((p) => p.original.includes(card.back))), 'Risposta letterale verificabile nella fonte');
const oneChapter = { paragraphs: [screenshotExample.paragraphs[0]] };
const quiz = buildQuiz(oneChapter);
assert.ok(quiz.length >= 1, 'Quiz anche su un capitolo con una sola definizione');
assert.ok(quiz.every((q) => q.correctIndex >= 0 && q.correctIndex < q.options.length));
assert.ok(quiz.every((q) => q.options.length >= 2), 'Quiz selezionabile');
assert.ok(buildOralQuestions(screenshotExample).length >= 1);
assert.ok(buildConceptMap(screenshotExample).length >= 1);
const stats = buildReductionStatistics(fixture, 0);
assert.equal(stats.length, 7);
assert.ok(stats.every((item) => Number.isFinite(item.actual.letters) && Number.isFinite(item.wholeBook.actual.words)));
assert.equal(stats[0].actual.letters, countText(chapter1.paragraphs.map((p) => p.original).join('\n')).letters);
assert.equal(stats[0].wordsReduced, 0);
const matched = auditBookSourceCoverage({
  chapters: fixture.chapters.map((c) => ({ ...c, paragraphs: c.paragraphs.map((p) => p.original) })),
}, editions[5]);
assert.equal(matched.passed, true, 'Versione ridotta deve conservare tutti gli originali');
const damaged = { ...editions[5], chapters: [editions[5].chapters[0]] };
assert.equal(auditBookSourceCoverage({ chapters: fixture.chapters }, damaged).passed, false);
console.log('Quality Guard LAB26 OK', {
  flashcards: cards.length, chapterQuiz: quiz.length,
  originalWords: editions[5].precisionEdition.originalWords,
  reducedWords: editions[5].precisionEdition.resultingWords,
  reducedPercent: editions[5].precisionEdition.achievedPercent,
  statsRows: stats.length,
});
