// LAB26: only ask about facts whose answer is explicitly supported by the source.
// Conservative structured extraction. No generic questions about paragraph labels.
import { splitCompleteSentences, checkSentence } from './studyQualityGuard.js';

const clean = (v) => String(v || '').replace(/\s+/g, ' ').trim();
const WORD = "[\\p{L}][\\p{L}'’\\-]*";
const STRAY = /\b(?:si dice|si afferma|è importante|questa|questo|ciò|esso|essa|invece|in questo capitolo|in questa sede)\b/i;
const ENDING = /[.,;:]$/;
const VERB = '(è|sono|si definisce|si intende|consiste in|indica|prevede|stabilisce|richiede|comporta|determina|costituisce|disciplina|produce|ha|hanno|si basa su|si fonda su|si distingue da|si applica a|deriva da)';
function capitalizedName(value) {
  return /^[A-ZÀ-Ö][\p{L}'’-]{2,25}$/u.test(value);
}
function hasBadSubject(subject) {
  return !subject || subject.length > 72 || subject.split(/\s+/).length > 8 ||
    STRAY.test(subject) || /[,;:!?]/.test(subject) ||
    /\b(?:afferma|sostiene|dice|secondo|che|quali|perché|come|per cui)\b/i.test(subject) ||
    !/[\p{L}]{4}/u.test(subject);
}
function trimSentence(sentence) {
  return clean(sentence).replace(/[.!?]+$/, '').trim();
}
function buildFact(sentence, paragraph, paragraphIndex, sentenceIndex) {
  if (!checkSentence(sentence).valid || sentence.length > 380 || sentence.length < 32) return null;
  const statement = trimSentence(sentence);
  if (STRAY.test(statement.slice(0, 21)) && !/^Si dice:\s*(?:la|il|le|gli|un)\b/i.test(statement)) return null;
  let base = statement.replace(/^Si dice:\s*/i, '');
  let subject = '', question = '', predicate = '', kind = '';
  const law = base.match(/^(art(?:icolo)?\.?\s*\d+(?:\s*(?:bis|ter))?)[\s:.,-]+([\s\S]{15,})$/i);
  if (law) {
    subject = law[1]; predicate = law[2]; kind = 'law';
    question = 'Che cosa stabilisce ' + subject + ' secondo il libro?';
  } else {
    const attribution = base.match(/^([A-ZÀ-Ö][\p{L}'’-]{2,25})\s+(?:afferma|sostiene|spiega|ritiene)\s+che\s+(.+)$/u);
    if (attribution && capitalizedName(attribution[1])) {
      const author = attribution[1];
      const assertion = attribution[2];
      const inner = assertion.match(/^(.{5,76}?)\s+(è|sono|si definisce|prevede|richiede|comporta|si basa su|si fonda su)\s+(.{12,})$/i);
      if (!inner || hasBadSubject(inner[1])) return null;
      subject = inner[1]; predicate = inner[3]; kind = 'author';
      question = 'Secondo ' + author + ', che cosa si afferma riguardo a «' + subject + '»?';
    } else {
      const def = base.match(new RegExp('^(.{4,78}?)\\s+' + VERB + '\\s+(.{12,})$', 'iu'));
      if (!def) return null;
      subject = clean(def[1]);
      predicate = clean(def[3]);
      if (hasBadSubject(subject) || /^che\b/i.test(predicate)) return null;
      kind = 'concept';
      const relation = def[2].toLocaleLowerCase('it-IT');
      if (/richiede/.test(relation)) question = 'Quali requisiti sono richiesti per «' + subject + '»?';
      else if (/prevede|stabilisce|disciplina/.test(relation)) question = 'Che cosa prevede il testo per «' + subject + '»?';
      else if (/comporta|determina|produce/.test(relation)) question = 'Quali conseguenze sono associate a «' + subject + '»?';
      else if (/si distingue da/.test(relation)) question = 'Da che cosa si distingue «' + subject + '» e perché?';
      else if (/si applica a/.test(relation)) question = 'A che cosa si applica «' + subject + '»?';
      else if (/si basa su|si fonda su|deriva da/.test(relation)) question = 'Su quale fondamento si basa «' + subject + '»?';
      else question = 'Che cosa si intende per «' + subject + '» secondo il libro?';
    }
  }
  if (predicate.length < 14 || /\b(?:e|che|di|a|per|non|con|il|la|in|salvo|mentre)$/i.test(predicate)) return null;
  return {
    question, answer: sentence, subject, predicate, kind,
    paragraphIndex, sentenceIndex,
    sourcePageStart: paragraph.sourcePageStart ?? null,
    sourcePageEnd: paragraph.sourcePageEnd ?? null,
    sourceChapterIndex: paragraph.sourceChapterIndex ?? 0,
    sourceText: clean(paragraph.original || ''),
  };
}
function groundedGlossary(chapter) {
  const found = [];
  for(const [paragraphIndex, paragraph] of (chapter.paragraphs || []).entries()) {
    const source = clean(paragraph.original || '');
    if (!source) continue;
    for (const entry of paragraph.glossary || []) {
      const term = clean(entry?.term), answer = clean(entry?.definition);
      if (!term || !answer || answer.length > 300 || term.length > 76) continue;
      // A generated definition can only be accepted when its key terms occur in the source.
      const words = answer.toLowerCase().split(/[^\p{L}\d]+/u).filter((v) => v.length > 4);
      const hits = words.filter((v) => source.toLowerCase().includes(v)).length;
      if (!source.toLowerCase().includes(term.toLowerCase()) || !words.length ||
          hits / words.length < .85) continue;
      found.push({ subject: term, question: 'Che cosa significa «' + term + '»?',
        answer, kind: 'glossary', paragraphIndex,
        sourceText: source, sourceChapterIndex: paragraph.sourceChapterIndex ?? 0,
        sourcePageStart: paragraph.sourcePageStart ?? null });
    }
  }
  return found;
}
function sourceFacts(chapter) {
  const facts = [];
  for (const [paragraphIndex, paragraph] of (chapter.paragraphs || []).entries()) {
    if (!paragraph.original) continue; // No ungrounded claims from an AI-generated summary.
    splitCompleteSentences(paragraph.original).forEach((sentence, sentenceIndex) => {
      const fact = buildFact(sentence, paragraph, paragraphIndex, sentenceIndex);
      if (fact) facts.push(fact);
    });
  }
  return facts;
}
function unique(items, max, keyOf) {
  const seen = new Set(), result = [];
  for(const item of items) {
    const key = clean(keyOf(item)).toLocaleLowerCase('it-IT');
    if (!key || seen.has(key)) continue;
    seen.add(key); result.push(item);
    if (result.length >= max) break;
  }
  return result;
}
function balanced(items, max) {
  const groups = new Map(), results = [];
  for(const item of items) {
    const key = item.sourceChapterIndex ?? 0;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  while(results.length < max && [...groups.values()].some((v) => v.length)) {
    for(const group of groups.values()) if (group.length && results.length < max) results.push(group.shift());
  }
  return results;
}
export function buildFlashcards(chapter = {}, limit = 36) {
  const all = [
    ...groundedGlossary(chapter).map((fact) => ({ ...fact, front: fact.question, back: fact.answer })),
    ...sourceFacts(chapter).map((fact) => ({ ...fact, front: fact.question, back: fact.answer })),
  ];
  return balanced(unique(all, limit * 8, (item) => item.front + '\n' + item.back), limit);
}
function rotateOptions(values, n) {
  const shift = n % values.length;
  return [...values.slice(shift), ...values.slice(0, shift)];
}
function factualNegation(sentence) {
  // A logically opposite assertion is only safe for a simple positive copula.
  const m = trimSentence(sentence).match(/^(.{5,70}?)\s+(è|sono)\s+(.{12,})$/i);
  if (!m || hasBadSubject(m[1]) || /\b(?:non|salvo|eccett|tranne|può|possono|talvolta|di regola)\b/i.test(sentence)) return null;
  return m[1] + ' non ' + m[2] + ' ' + m[3] + '.';
}
export function buildQuiz(chapter = {}, limit = 18) {
  const facts = unique([...groundedGlossary(chapter), ...sourceFacts(chapter)], limit * 8,
    (fact) => fact.question + '\n' + fact.answer);
  const quizzes = [];
  const definitions = facts.filter((f) => f.kind === 'glossary');
  // Multiple-choice only when alternatives are related definitions, not random long passages.
  for (const [i, fact] of definitions.entries()) {
    const alternatives = definitions.filter((v) => v !== fact &&
      v.subject !== fact.subject && v.answer !== fact.answer &&
      v.answer.length < 220).slice(0, 3);
    if (alternatives.length < 2) continue;
    const options = rotateOptions([fact.answer, ...alternatives.map((v) => v.answer)], i + 1);
    quizzes.push({ question: 'Quale definizione corrisponde a «' + fact.subject + '»?',
      options, correctIndex: options.indexOf(fact.answer), explanation: fact.answer,
      sourceChapterIndex: fact.sourceChapterIndex, sourcePageStart: fact.sourcePageStart });
  }
  // A chapter with one solid claim still gets a valid, source-grounded Vero/Falso quiz.
  for (const [i, fact] of facts.entries()) {
    if (quizzes.length >= limit * 3) break;
    const flipped = i % 2 === 1 ? factualNegation(fact.answer) : null;
    const actual = flipped || fact.answer;
    quizzes.push({
      question: 'Secondo il libro, questa affermazione è corretta? «' + actual + '»',
      options: ['Vero', 'Falso'], correctIndex: flipped ? 1 : 0,
      explanation: fact.answer,
      sourceChapterIndex: fact.sourceChapterIndex, sourcePageStart: fact.sourcePageStart,
      paragraphIndex: fact.paragraphIndex, sourceText: fact.sourceText,
    });
  }
  return balanced(unique(quizzes, limit * 8, (q) => q.question), limit);
}
export function buildOralQuestions(chapter = {}, limit = 24) {
  const questions = [...groundedGlossary(chapter), ...sourceFacts(chapter)].map((fact) => ({
    question: fact.question.replace(/^Che cosa significa /, 'Definisci '),
    answer: fact.answer,
    sourceChapterIndex: fact.sourceChapterIndex,
    sourcePageStart: fact.sourcePageStart,
    paragraphIndex: fact.paragraphIndex,
  }));
  return balanced(unique(questions, limit * 8, (q) => q.question), limit);
}
export function buildConceptMap(chapter = {}, limit = 24) {
  const paragraphs = (chapter.paragraphs || []).map((paragraph, paragraphIndex) => {
    const subsection = { paragraphs: [{ ...paragraph, sourceChapterIndex: paragraph.sourceChapterIndex ?? 0 }] };
    const facts = sourceFacts(subsection);
    const keywordSources = [
      ...facts.map((f) => f.subject),
      ...(paragraph.glossary || []).map((entry) => clean(entry?.term)),
    ].filter((word) => word && clean(paragraph.original).toLowerCase().includes(word.toLowerCase()));
    if (!facts.length && !keywordSources.length) return null;
    const keywords = unique(keywordSources.map((v) => ({ value: clean(v).replace(/^(?:il|lo|la|le|i|gli|l['’]|un|una)\s*/i, '').toLocaleLowerCase('it-IT') })), 6, (v) => v.value).map((v) => v.value);
    const points = facts.map((f) => f.answer).slice(0, 3);
    return {
      title: keywords[0] || facts[0].subject, keywords, points, paragraphIndex,
      sourceChapterIndex: paragraph.sourceChapterIndex ?? 0,
      sourcePageStart: paragraph.sourcePageStart ?? null,
    };
  }).filter(Boolean);
  return balanced(paragraphs, limit);
}
