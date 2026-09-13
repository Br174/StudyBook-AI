import assert from 'node:assert/strict';
import { buildConceptMap, buildFlashcards, buildOralQuestions, buildQuiz } from '../src/lib/studyTools.js';

const chapter = {
  title: 'Capitolo di prova',
  paragraphs: [
    {
      sourceSection: 'Definizioni',
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
      glossary: [
        { term: 'Principio', definition: 'Criterio generale che orienta più regole.' },
      ],
      keyPoints: ['I principi orientano l’interpretazione.'],
      remember: ['Un principio ha portata generale.'],
      keywords: ['principio', 'interpretazione'],
    },
    {
      sourceSection: 'Eccezioni',
      glossary: [
        { term: 'Eccezione', definition: 'Caso che deroga alla regola generale.' },
      ],
      keyPoints: ['L’eccezione va distinta dalla regola generale.'],
      remember: ['Le eccezioni richiedono attenzione.'],
      keywords: ['eccezione', 'regola'],
    },
    {
      sourceSection: 'Applicazione',
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
  assert.equal(question.options[question.correctIndex], question.explanation);
}

assert.match(flashcards[0].front, /significa/i);
assert.ok(map.some((node) => node.keywords.includes('principio')));

console.log(`Study tools: OK · flashcards=${flashcards.length} · quiz=${quiz.length} · oral=${oral.length} · map=${map.length}`);
