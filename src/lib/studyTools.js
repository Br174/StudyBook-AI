function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function splitSentences(value) {
  const text = cleanText(value);
  if (!text) return [];
  return (text.match(/[^.!?]+(?:[.!?]+|$)/g) || [text])
    .map(cleanText)
    .filter((sentence) => sentence.length >= 18);
}

function paragraphText(paragraph = {}) {
  return cleanText(paragraph.summary || paragraph.dsaSummary || paragraph.original || '');
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
      pushUnique(entries, seen, { term, definition, paragraphIndex }, term);
    }
  }
  return entries;
}

function paragraphPoints(paragraph = {}, limit = 5) {
  const values = [
    ...(paragraph.remember || []),
    ...(paragraph.keyPoints || []),
    ...splitSentences(paragraphText(paragraph)),
  ].map(cleanText).filter((value) => value.length >= 18);

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

export function buildFlashcards(chapter = {}, limit = 36) {
  const cards = [];
  const seen = new Set();

  for (const entry of glossaryEntries(chapter)) {
    pushUnique(cards, seen, {
      front: `Che cosa significa “${entry.term}”?`,
      back: entry.definition,
      paragraphIndex: entry.paragraphIndex,
      kind: 'term',
    }, `term::${entry.term}::${entry.definition}`);
    if (cards.length >= limit) return cards;
  }

  for (const [paragraphIndex, paragraph] of (chapter.paragraphs || []).entries()) {
    const points = paragraphPoints(paragraph, 3);
    points.forEach((point, pointIndex) => {
      pushUnique(cards, seen, {
        front: pointIndex === 0
          ? `Qual è il concetto principale di ${paragraphLabel(paragraph, paragraphIndex)}?`
          : `Quale altro elemento importante va ricordato di ${paragraphLabel(paragraph, paragraphIndex)}?`,
        back: point,
        paragraphIndex,
        kind: 'point',
      }, `point::${paragraphIndex}::${point}`);
    });
    if (cards.length >= limit) return cards.slice(0, limit);
  }

  return cards.slice(0, limit);
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
    if (distractors.length < 2) continue;
    const options = rotateOptions([correct, ...distractors].slice(0, 4), index + 1);
    questions.push({
      question: `Quale affermazione appartiene a ${paragraphLabel(current.paragraph, current.paragraphIndex)}?`,
      options,
      correctIndex: options.indexOf(correct),
      explanation: correct,
      paragraphIndex: current.paragraphIndex,
    });
  }

  return questions.slice(0, limit);
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
    if (questions.length >= limit) return questions;
  }

  for (const [paragraphIndex, paragraph] of (chapter.paragraphs || []).entries()) {
    const points = paragraphPoints(paragraph, 3);
    if (!points.length) continue;
    pushUnique(questions, seen, {
      question: `Spiega i concetti fondamentali di ${paragraphLabel(paragraph, paragraphIndex)}.`,
      answer: points.join(' '),
      paragraphIndex,
    }, `paragraph::${paragraphIndex}::${points[0]}`);
    if (questions.length >= limit) return questions;
  }

  return questions;
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
  return (chapter.paragraphs || []).slice(0, limit).map((paragraph, paragraphIndex) => {
    const keywords = fallbackKeywords(paragraph, 6);
    const points = paragraphPoints(paragraph, 3);
    return {
      title: cleanText(paragraph.sourceSection) || `Passaggio ${paragraphIndex + 1}`,
      paragraphIndex,
      keywords,
      points,
    };
  }).filter((node) => node.keywords.length || node.points.length);
}
