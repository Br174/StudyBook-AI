function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
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

function paragraphPoints(paragraph = {}) {
  const values = [
    ...(paragraph.remember || []),
    ...(paragraph.keyPoints || []),
  ].map(cleanText).filter(Boolean);
  return [...new Set(values)];
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
    }, `${entry.term}::${entry.definition}`);
    if (cards.length >= limit) return cards;
  }

  for (const [paragraphIndex, paragraph] of (chapter.paragraphs || []).entries()) {
    for (const point of paragraphPoints(paragraph)) {
      const section = cleanText(paragraph.sourceSection);
      pushUnique(cards, seen, {
        front: section
          ? `Qual è un punto da ricordare della sezione “${section}”?`
          : `Qual è un punto da ricordare del paragrafo ${paragraphIndex + 1}?`,
        back: point,
        paragraphIndex,
        kind: 'point',
      }, `${paragraphIndex}::${point}`);
      if (cards.length >= limit) return cards;
    }
  }

  return cards;
}

function rotateOptions(values, offset) {
  if (!values.length) return [];
  const shift = ((offset % values.length) + values.length) % values.length;
  return [...values.slice(shift), ...values.slice(0, shift)];
}

export function buildQuiz(chapter = {}, limit = 18) {
  const questions = [];
  const glossary = glossaryEntries(chapter);

  if (glossary.length >= 3) {
    for (let index = 0; index < glossary.length && questions.length < limit; index += 1) {
      const current = glossary[index];
      const distractors = [];
      for (let step = 1; step < glossary.length && distractors.length < 3; step += 1) {
        const candidate = glossary[(index + step) % glossary.length]?.definition;
        if (candidate && candidate !== current.definition && !distractors.includes(candidate)) distractors.push(candidate);
      }
      if (distractors.length < 2) continue;
      const options = rotateOptions([current.definition, ...distractors], index + current.term.length);
      questions.push({
        question: `Quale definizione corrisponde a “${current.term}”?`,
        options,
        correctIndex: options.indexOf(current.definition),
        explanation: current.definition,
        paragraphIndex: current.paragraphIndex,
      });
    }
  }

  if (questions.length < Math.min(8, limit)) {
    const pools = (chapter.paragraphs || []).map((paragraph, paragraphIndex) => ({
      paragraphIndex,
      points: paragraphPoints(paragraph),
      section: cleanText(paragraph.sourceSection),
    })).filter((item) => item.points.length);

    for (let index = 0; index < pools.length && questions.length < limit; index += 1) {
      const current = pools[index];
      const correct = current.points[0];
      const distractors = pools
        .filter((item) => item.paragraphIndex !== current.paragraphIndex)
        .flatMap((item) => item.points.slice(0, 1))
        .filter((item) => item && item !== correct)
        .slice(0, 3);
      if (distractors.length < 2) continue;
      const options = rotateOptions([correct, ...distractors], index + 1);
      questions.push({
        question: current.section
          ? `Quale idea appartiene alla sezione “${current.section}”?`
          : `Quale idea appartiene al paragrafo ${current.paragraphIndex + 1}?`,
        options,
        correctIndex: options.indexOf(correct),
        explanation: correct,
        paragraphIndex: current.paragraphIndex,
      });
    }
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
    const points = paragraphPoints(paragraph).slice(0, 3);
    if (!points.length) continue;
    const section = cleanText(paragraph.sourceSection);
    pushUnique(questions, seen, {
      question: section
        ? `Quali sono i concetti fondamentali della sezione “${section}”?`
        : `Quali sono i concetti fondamentali del paragrafo ${paragraphIndex + 1}?`,
      answer: points.join(' · '),
      paragraphIndex,
    }, `paragraph::${paragraphIndex}::${section}`);
    if (questions.length >= limit) return questions;
  }

  return questions;
}

export function buildConceptMap(chapter = {}, limit = 24) {
  return (chapter.paragraphs || []).slice(0, limit).map((paragraph, paragraphIndex) => {
    const keywords = (paragraph.keywords || []).map(cleanText).filter(Boolean).slice(0, 6);
    const points = paragraphPoints(paragraph).slice(0, 3);
    return {
      title: cleanText(paragraph.sourceSection) || `Paragrafo ${paragraphIndex + 1}`,
      paragraphIndex,
      keywords,
      points,
    };
  }).filter((node) => node.keywords.length || node.points.length);
}
