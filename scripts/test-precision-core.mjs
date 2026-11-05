import assert from 'node:assert/strict';
import { REDUCTION_STEPS, buildPrecisionEdition, countWords } from '../src/lib/precisionCore.js';
import { buildFlashcards, buildQuiz, buildOralQuestions } from '../src/lib/studyTools.js';
import { auditFidelity } from '../src/lib/fidelityEngine.js';
import { auditDocumentStructure } from '../src/lib/precisionDocumentAudit.js';
import { readFileSync } from 'node:fs';

const discursive = [
  'È importante sottolineare che il diritto soggettivo è una posizione giuridica riconosciuta dalla legge.',
  'In questo contesto la disciplina prevede determinate condizioni per il suo esercizio.',
  'La responsabilità civile richiede la verifica del fatto, del danno e del nesso causale.',
  'La presenza del solo danno non costituisce automaticamente prova della responsabilità.',
  'In considerazione del fatto che esistono numerosi casi differenti, occorre esaminare le eccezioni previste.',
  'Il requisito temporale è stabilito dall’ordinamento applicabile.',
  'Il principio di legalità disciplina le conseguenze giuridiche di una condotta.',
  'Il riferimento normativo indica la disposizione che regola la situazione.',
  'Inoltre il testo descrive conseguenze collegate alla condotta.',
  'L’interpretazione letterale costituisce uno dei criteri adottati.'
].join(' ');
const law = 'Art. 12. Il soggetto può proporre il ricorso entro 30 giorni dalla notifica, salvo le eccezioni previste dalla legge.';
const formula = 'E = mc²';
const book = {
  level: 'studio',
  chapters: [
    { title: 'Principi', paragraphs: [
      { original: discursive, summary: 'Riassunto vecchio e diverso.', keyPoints: ['Dato inventato.'], glossary: [] },
      { original: law + '\n' + formula, summary: 'Vecchia spiegazione senza articolo.', glossary: [] },
    ] },
    { title: 'Applicazioni', paragraphs: [
      { original: 'La norma disciplina il comportamento. Il termine legale indica il periodo previsto.', summary: 'Vecchio.', glossary: [] },
    ] },
  ],
};
const originalSnapshot = JSON.stringify(book);
assert.deepEqual(REDUCTION_STEPS, [0, 10, 20, 30, 40, 50, 'summary']);
const editions = REDUCTION_STEPS.map((step) => buildPrecisionEdition(book, step));
assert.equal(editions[0].chapters[0].paragraphs[0].summary, discursive);
assert.equal(editions[0].precisionEdition.achievedPercent, 0);
assert.ok(editions[5].precisionEdition.achievedPercent > 0, '50% deve produrre una riduzione effettiva');
assert.ok(editions[5].precisionEdition.achievedPercent >= editions[1].precisionEdition.achievedPercent, '50% non può essere più verboso di 10%');
assert.ok(editions[5].chapters[0].paragraphs[1].summary.includes(law), 'Articolo integrale da preservare');
assert.ok(editions[5].chapters[0].paragraphs[1].summary.includes(formula), 'Formula integrale da preservare');
assert.equal(editions[6].precisionEdition.label, 'Riassunto');
assert.ok(countWords(editions[6].chapters[0].paragraphs[0].summary) < countWords(discursive), 'Riassunto realmente breve');
assert.equal(JSON.stringify(book), originalSnapshot, 'Il testo originale non può essere modificato');
const flashcards = buildFlashcards(editions[5].chapters[0]);
assert.ok(flashcards.length >= 2, 'Il motore deve estrarre concetti da originale');
assert.ok(flashcards.every((f) => !/concetto principale di|passaggio \d+/i.test(f.front)), 'Domande non basate sui titoli');
assert.ok(flashcards.every((f) => f.kind === 'term' || book.chapters[0].paragraphs.some(p => p.original.includes(f.back))), 'Le risposte alle flashcard devono comparire nella fonte');
const empty = { paragraphs: [{ original: 'Questo testo serve solo come introduzione. Non contiene definizioni.', summary: 'Sintesi.', glossary: [] }] };
assert.equal(buildQuiz(empty).length, 0, 'Nessun quiz inventato per contenuti inadeguati');
assert.equal(buildOralQuestions(empty).length, 0, 'Nessuna interrogazione generica');
const oppositeSource = 'Il debitore non può esercitare il diritto. Il creditore può esercitare il diritto.';
const oppositeWrong = 'Il debitore può esercitare il diritto. Il creditore non può esercitare il diritto.';
const oppositeAudit = auditFidelity(oppositeSource, oppositeWrong);
assert.equal(oppositeAudit.passed, false, 'Negazione spostata tra le frasi = errore semantico');
assert.ok(oppositeAudit.qualifierMismatches.length >= 1);
const structural = auditDocumentStructure({
  pages: [{ pageNumber: 1, text: 'Capitolo introduttivo' }, { pageNumber: 3, text: '�testo danneggiato' }],
  chapters: [{ title: 'Capitolo 1', paragraphs: ['Testo.'] }],
});
assert.ok(structural.warningCount >= 2, 'Segnalare salti di pagina e OCR sospetto');
assert.equal(structural.certifiedCorrect, false, 'Nessun falso certificato di correttezza');

const appSource = readFileSync(new URL('../src/AppV15.jsx', import.meta.url), 'utf8');
assert.ok(appSource.indexOf("const [libraryId, setLibraryId]") < appSource.indexOf('const precisionBook = useMemo'), 'La preferenza non deve provocare un accesso prima della dichiarazione di libraryId');
console.log('Precision Core: OK', { reduction: editions[5].precisionEdition, questions: flashcards.length });
