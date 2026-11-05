function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function splitSentences(value) {
  const text = cleanText(value).replace(/\b(art|co|n)\.(?=\s*\d)/gi, '$1§');
  if (!text) return [];
  return (text.match(/[^.!?]+(?:[.!?]+|$)/g) || [text])
    .map((sentence) => cleanText(sentence.replace(/§/g, '.')))
    .filter((sentence) => sentence.length >= 18);
}

function paragraphText(paragraph = {}) {
  return cleanText(paragraph.original || paragraph.summary || paragraph.dsaSummary || '');
}

function pushUnique(target, seen, item, key = '') {
  const signature = cleanText(key || JSON.stringify(item)).toLocaleLowerCase('it-IT');
  if (!signature || seen.has(signature)) return;
  seen.add(signature);
  target.push(item);
}

function glossaryEntries(chapter = {}) {
  const entries = [];
  const seen = new Set();
  for (const [paragraphIndex, paragraph] of (chapter.paragraphs || []).entries()) {
    for (const entry of paragraph.glossary || []) {
      const term = cleanText(entry?.term);
      const definition = cleanText(entry?.definition);
      if (!term || !definition) continue;
      const original = cleanText(paragraph.original || '');
      if (original && !original.toLowerCase().includes(term.toLowerCase())) continue;
      if (original) {
        const sourceWords = new Set(original.toLowerCase().split(/[^a-zà-ÿ0-9]+/).filter((w) => w.length >= 4));
        const definitionWords = [...new Set(definition.toLowerCase().split(/[^a-zà-ÿ0-9]+/).filter((w) => w.length >= 4))];
        if (definitionWords.length >= 2 && definitionWords.filter((w) => sourceWords.has(w)).length < 2) continue;
      }
      pushUnique(entries, seen, { term, definition, paragraphIndex, sourceChapterIndex: paragraph.sourceChapterIndex ?? 0 }, term);
    }
  }
  return entries;
}

function paragraphPoints(paragraph = {}, limit = 5) {
  const original = cleanText(paragraph.original || '');
  const values = (original ? splitSentences(original).filter((item) => factQuestion(item)) : [...(paragraph.remember || []), ...(paragraph.keyPoints || [])]).map(cleanText).filter((value) => value.length >= 18);

  const seen = new Set();
  const output = [];
  for (const value of values) {
    const key = value.toLocaleLowerCase('it-IT');
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(value);
    if (output.length >= limit) break;
  }
  return output;
}

function paragraphLabel(paragraph = {}, paragraphIndex = 0) {
  const section = cleanText(paragraph.sourceSection);
  return section ? `la sezione “${section}”` : `il passaggio ${paragraphIndex + 1}`;
}


function factQuestion(point, oral = false) {
  const text = cleanText(point);
  const article = text.match(/^(art(?:icolo)?\.?\s*\d+(?:-?(?:bis|ter))?)[\s,:.]+/i);
  if (article) return 'Che cosa prevede ' + article[1] + ' secondo il testo?';
  const match = text.match(/^(.{4,85}?)\s+(è|sono|si definisce|consiste in|indica|prevede|stabilisce|richiede|comporta|determina|costituisce|disciplina|orienta|deriva da|si applica)\b/i);
  if (!match) return null;
  const subject = cleanText(match[1]);
  if (subject.split(/\s+/).length > 12 || /^(?:questa?|ciò|esso|essa|in|nel|nella)\b/i.test(subject) || /(?:indice|bibliografia|studybook ai)/i.test(subject)) return null;
  if (/richiede/i.test(match[2])) return 'Quali requisiti richiede «' + subject + '» secondo il testo?';
  if (/prevede|stabilisce|disciplina/i.test(match[2])) return 'Che cosa stabilisce il testo riguardo a «' + subject + '»?';
  if (/comporta|determina|deriva da/i.test(match[2])) return 'Quali conseguenze o relazioni indica il testo per «' + subject + '»?';
  return (oral ? 'Spiega che cosa afferma il testo riguardo a «' : 'Come viene descritto «') + subject + '»' + (oral ? '.' : ' nel testo?');
}
function balancedSelect(items, limit) {
  const groups = new Map(), output = [];
  for (const item of items) {
    const id = item.sourceChapterIndex ?? 0;
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push(item);
  }
  while (output.length < limit && [...groups.values()].some((group) => group.length)) {
    for (const group of groups.values()) if (group.length && output.length < limit) output.push(group.shift());
  }
  return output;
}

export function buildFlashcards(chapter = {}, limit = 36) {
  const cards = [];
  const seen = new Set();

  for (const entry of glossaryEntries(chapter)) {
    pushUnique(cards, seen, {
      front: `Che cosa significa “${entry.term}”?`,
      back: entry.definition,
      paragraphIndex: entry.paragraphIndex,
      sourceChapterIndex: entry.sourceChapterIndex,
      kind: 'term',
    }, `term::${entry.term}::${entry.definition}`);
    if (cards.length >= limit * 5) break;
  }

  for (const [paragraphIndex, paragraph] of (chapter.paragraphs || []).entries()) {
    const points = paragraphPoints(paragraph, 3);
    points.forEach((point) => {
      const front = factQuestion(point);
      if (!front) return;
      pushUnique(cards, seen, {
        front, back: point, paragraphIndex, kind: 'point',
        sourceChapterIndex: paragraph.sourceChapterIndex ?? 0,
        sourcePageStart: paragraph.sourcePageStart ?? null,
        sourceText: cleanText(paragraph.original || ''),
      }, 'point::' + front + '::' + point);
    });
    if (cards.length >= limit * 5) break;
  }

  return balancedSelect(cards, limit);
}

function rotateOptions(values, offset) {
  if (!values.length) return [];
  const shift = ((offset % values.length) + values.length) % values.length;
  return [...values.slice(shift), ...values.slice(0, shift)];
}

function distinctOtherFacts(pools, currentIndex, correct, limit = 3) {
  const out = [];
  const seen = new Set([cleanText(correct).toLocaleLowerCase('it-IT')]);
  for (let step = 1; step < pools.length && out.length < limit; step += 1) {
    const pool = pools[(currentIndex + step) % pools.length];
    if (!pool || pool.paragraphIndex === pools[currentIndex]?.paragraphIndex) continue;
    for (const fact of pool.points || []) {
      const clean = cleanText(fact);
      const key = clean.toLocaleLowerCase('it-IT');
      if (!clean || seen.has(key)) continue;
      seen.add(key);
      out.push(clean);
      break;
    }
  }
  return out;
}

export function buildQuiz(chapter = {}, limit = 18) {
  const questions = [];
  const glossary = glossaryEntries(chapter);

  if (glossary.length >= 3) {
    for (let index = 0; index < glossary.length && questions.length < limit; index += 1) {
      const current = glossary[index];
      const distractors = [];
      const seen = new Set([current.definition.toLocaleLowerCase('it-IT')]);
      for (let step = 1; step < glossary.length && distractors.length < 3; step += 1) {
        const candidate = cleanText(glossary[(index + step) % glossary.length]?.definition);
        const key = candidate.toLocaleLowerCase('it-IT');
        if (candidate && !seen.has(key)) {
          seen.add(key);
          distractors.push(candidate);
        }
      }
      if (distractors.length < 2) continue;
      const options = rotateOptions([current.definition, ...distractors].slice(0, 4), index + current.term.length);
      questions.push({
        question: `Quale definizione corrisponde a “${current.term}”?`,
        options,
        correctIndex: options.indexOf(current.definition),
        explanation: current.definition,
        paragraphIndex: current.paragraphIndex,
      });
    }
  }

  const pools = (chapter.paragraphs || []).map((paragraph, paragraphIndex) => ({
    paragraphIndex,
    paragraph,
    points: paragraphPoints(paragraph, 3),
  })).filter((item) => item.points.length);

  for (let index = 0; index < pools.length && questions.length < limit; index += 1) {
    const current = pools[index];
    const correct = current.points[0];
    const distractors = distinctOtherFacts(pools, index, correct, 3);
    const question = factQuestion(correct);
    if (distractors.length < 2 || !question) continue;
    const options = rotateOptions([correct, ...distractors].slice(0, 4), index + 1);
    questions.push({
      question,
      options,
      correctIndex: options.indexOf(correct),
      explanation: correct,
      paragraphIndex: current.paragraphIndex,
      sourceChapterIndex: current.paragraph.sourceChapterIndex ?? 0,
      sourcePageStart: current.paragraph.sourcePageStart ?? null,
    });
  }

  return balancedSelect(questions, limit);
}

export function buildOralQuestions(chapter = {}, limit = 24) {
  const questions = [];
  const seen = new Set();

  for (const entry of glossaryEntries(chapter)) {
    pushUnique(questions, seen, {
      question: `Definisci “${entry.term}” e spiegalo nel contesto del capitolo.`,
      answer: entry.definition,
      paragraphIndex: entry.paragraphIndex,
    }, `term::${entry.term}`);
    if (questions.length >= limit * 5) break;
  }

  for (const [paragraphIndex, paragraph] of (chapter.paragraphs || []).entries()) {
    const points = paragraphPoints(paragraph, 3);
    if (!points.length) continue;
    const question = factQuestion(points[0], true);
    if (!question) continue;
    pushUnique(questions, seen, { question, answer: points.join(' '), paragraphIndex,
      sourceChapterIndex: paragraph.sourceChapterIndex ?? 0, sourcePageStart: paragraph.sourcePageStart ?? null,
    }, 'paragraph::' + paragraphIndex + '::' + points[0]);
    if (questions.length >= limit * 5) break;
  }

  return balancedSelect(questions, limit);
}

function fallbackKeywords(paragraph = {}, limit = 6) {
  const explicit = (paragraph.keywords || []).map(cleanText).filter(Boolean);
  const glossary = (paragraph.glossary || []).map((entry) => cleanText(entry?.term)).filter(Boolean);
  const values = [...explicit, ...glossary];
  const seen = new Set();
  const output = [];
  for (const value of values) {
    const key = value.toLocaleLowerCase('it-IT');
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(value);
    if (output.length >= limit) break;
  }
  return output;
}

export function buildConceptMap(chapter = {}, limit = 24) {
  return balancedSelect((chapter.paragraphs || []).map((paragraph, paragraphIndex) => {
    const keywords = fallbackKeywords(paragraph, 6);
    const points = paragraphPoints(paragraph, 3);
    return {
      title: ((paragraphPoints(paragraph, 1)[0] || '').match(/^(.{4,60}?)\s+(?:è|sono|si definisce|prevede|richiede|disciplina)\b/i)?.[1]) || fallbackKeywords(paragraph, 1)[0] || cleanText(paragraph.sourceSection) || `Passaggio ${paragraphIndex + 1}`,
      paragraphIndex,
      sourceChapterIndex: paragraph.sourceChapterIndex ?? 0,
      sourcePageStart: paragraph.sourcePageStart ?? null,
      keywords,
      points,
    };
  }).filter((node) => node.keywords.length || node.points.length), limit);
}
