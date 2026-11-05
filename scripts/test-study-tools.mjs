import assert from 'node:assert/strict';
import { buildConceptMap, buildFlashcards, buildOralQuestions, buildQuiz } from '../src/lib/studyTools.js';

const chapter = {
  title: 'Capitolo di prova',
  paragraphs: [
    {
      sourceSection: 'Definizioni',
      original: 'La norma è una regola che disciplina un comportamento. La sanzione è la conseguenza prevista per una violazione.',
      glossary: [
        { term: 'Norma', definition: 'Regola che disciplina un comportamento.' },
        { term: 'Sanzione', definition: 'Conseguenza prevista per una violazione.' },
      ],
      keyPoints: ['La norma disciplina un comportamento.'],
      remember: ['La sanzione segue una violazione.'],
      keywords: ['norma', 'sanzione'],
    },
    {
      sourceSection: 'Principi',
      original: 'Il principio costituisce un criterio generale che orienta più regole. I principi sono criteri che guidano l’interpretazione.',
      glossary: [
        { term: 'Principio', definition: 'Criterio generale che orienta più regole.' },
      ],
      keyPoints: ['I principi orientano l’interpretazione.'],
      remember: ['Un principio ha portata generale.'],
      keywords: ['principio', 'interpretazione'],
    },
    {
      sourceSection: 'Eccezioni',
      original: 'L’eccezione è un caso che deroga alla regola generale. La deroga si applica alle condizioni previste.',
      glossary: [
        { term: 'Eccezione', definition: 'Caso che deroga alla regola generale.' },
      ],
      keyPoints: ['L’eccezione va distinta dalla regola generale.'],
      remember: ['Le eccezioni richiedono attenzione.'],
      keywords: ['eccezione', 'regola'],
    },
    {
      sourceSection: 'Applicazione',
      original: 'L’applicazione è il collegamento fra una regola e il caso concreto. Il procedimento richiede la verifica delle condizioni previste.',
      glossary: [],
      keyPoints: ['L’applicazione collega regola e caso concreto.'],
      remember: ['Verificare sempre condizioni e conseguenze.'],
      keywords: ['applicazione', 'condizioni', 'conseguenze'],
    },
  ],
};

const flashcards = buildFlashcards(chapter);
const quiz = buildQuiz(chapter);
const oral = buildOralQuestions(chapter);
const map = buildConceptMap(chapter);

assert.ok(flashcards.length >= 4, 'Le flashcard devono usare glossario e punti chiave.');
assert.ok(quiz.length >= 1, 'Il quiz deve contenere almeno una domanda.');
assert.ok(oral.length >= 4, 'L’interrogazione deve contenere domande source-grounded.');
assert.equal(map.length, 4, 'La mappa deve rappresentare i paragrafi utili.');

for (const question of quiz) {
  assert.ok(question.correctIndex >= 0 && question.correctIndex < question.options.length);
  if (question.options.length === 2 && question.options.includes('Vero')) {
    assert.ok(['Vero', 'Falso'].includes(question.options[question.correctIndex]));
    assert.ok(question.explanation.length >= 20);
  } else assert.equal(question.options[question.correctIndex], question.explanation);
}

assert.ok(flashcards.every((card) => /\?$/.test(card.front)), 'Ogni flashcard deve avere una vera domanda.');
assert.ok(flashcards.every((card) => !/concetto principale|Come viene descritto/i.test(card.front)));
assert.ok(flashcards.every((card) => chapter.paragraphs.some((paragraph) => paragraph.original.includes(card.back)) || card.kind === 'glossary'));
assert.ok(map.some((node) => node.keywords.includes('principio')));

console.log(`Study tools: OK · flashcards=${flashcards.length} · quiz=${quiz.length} · oral=${oral.length} · map=${map.length}`);


const ungrounded = {
  title: 'Sezione senza elementi didattici affidabili',
  paragraphs: [
    { sourceSection: 'Solo prosa', summary: 'Una frase generica. Una seconda frase generica senza punti chiave verificati.', glossary: [], keyPoints: [], remember: [] },
  ],
};
assert.equal(buildFlashcards(ungrounded).length, 0, 'Nessuna flashcard deve essere inventata da prosa generica.');
assert.equal(buildQuiz(ungrounded).length, 0, 'Nessun quiz deve essere inventato se la sezione non offre materiale affidabile.');
