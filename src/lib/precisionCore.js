// StudyBook Precision Core V1. Source-first, zero external services.
// No text is fabricated: each output clause is extracted from the original.
export const REDUCTION_STEPS = [0, 10, 20, 30, 40, 50, 'summary'];
export const REDUCTION_LABELS = {
  0: 'Originale', 10: 'Pulizia leggera', 20: 'Testo diretto',
  30: 'Studio sintetico', 40: 'Studio essenziale',
  50: 'Studio schematico', summary: 'Riassunto',
};

export function normalizeReduction(value) {
  if (value === 'summary') return value;
  const number = Number(value);
  return [0, 10, 20, 30, 40, 50].includes(number) ? number : 10;
}

const IMPORTANT = /\b(?:definizion|si definisce|consiste|prevede|richiede|obblig|diritto|divieto|salvo|eccett|non |solo se|qualora|a condizione|presuppost|requisit|conseguenz|determina|comporta|causa|effetto|termine|scadenza|teorema|formula|articolo|comma|legge|decreto|sentenza)\b/i;
const PROTECTED_REFERENCE = /\b(?:art(?:icolo)?\.?\s*\d+|comma\s*\d+|legge\s+n?\.?\s*\d+|decreto\s+\d+|\d+\s*(?:giorni|mesi|anni)|\d+(?:[.,]\d+)?%)\b/i;
const QUALIFIER = /\b(?:non|salvo|eccetto|tranne|purché|purche|a condizione che|solo se|esclusivamente)\b/i;
const FILLER = [
  [/\b(?:è importante (?:sottolineare|evidenziare|ricordare) che)\s*/gi, ''],
  [/\b(?:occorre innanzitutto osservare che)\s*/gi, ''],
  [/\b(?:si deve tenere presente che)\s*/gi, ''],
  [/\b(?:in considerazione del fatto che)\b/gi, 'poiché'],
  [/\b(?:al fine di)\b/gi, 'per'],
  [/\b(?:per quanto riguarda)\b/gi, 'su'],
  [/\b(?:in altre parole)\b/gi, ''],
  [/\b(?:a questo punto è possibile)\b/gi, 'si può'],
];

export function countWords(value) {
  return (String(value || '').match(/[^\s•]+/g) || []).length;
}
function clean(value) {
  return String(value || '').replace(/\u00ad/g, '').replace(/\s+/g, ' ').trim();
}
function splitUnits(text) {
  // Preserve a statute quoted as a paragraph and every stand-alone formula.
  const raw = String(text || '');
  if (!raw.trim()) return [];
  const lines = raw.split(/\n+/).map(clean).filter(Boolean);
  return lines.flatMap((line) => {
    if (/^(?:art(?:icolo)?\.?\s*\d+|legge\s+n?\.?\s*\d+)\b/i.test(line)
        || /(?:^|\s)[A-Za-zΑ-ω][\w²³]*\s*[=≈≠≤≥]\s*\S/.test(line)) {
      return [{ text: line, immutable: true }];
    }
    // Do not split numbers or abbreviations such as art. 3, comma 2.
    const protectedLine = line.replace(/\b(art|co|n)\.(?=\s*\d)/gi, '$1§');
    return (protectedLine.match(/[^.!?;]+(?:[.!?;]+|$)/g) || [protectedLine])
      .map((part) => clean(part.replace(/§/g, '.')))
      .filter(Boolean)
      .map((text) => ({ text, immutable: false }));
  });
}
function simplifyFiller(text) {
  let output = clean(text);
  for (const [pattern, replacement] of FILLER) output = output.replace(pattern, replacement);
  return clean(output).replace(/^[,;:\s]+/, '');
}
function importance(text, index) {
  let score = 1 / (1 + index * .09);
  if (IMPORTANT.test(text)) score += 5;
  if (PROTECTED_REFERENCE.test(text)) score += 5;
  if (QUALIFIER.test(text)) score += 4;
  if (/[0-9]/.test(text)) score += 1;
  if (/(?:\bè\b|\bsono\b|si definisce|consiste in)/i.test(text)) score += 2;
  return score;
}
function compactUnit(unit, depth) {
  if (unit.immutable) return unit.text;
  let result = simplifyFiller(unit.text);
  if (depth < 30) return result;
  // At stronger reductions remove only explicitly introductory clauses;
  // never truncate formulas, negations, qualifiers or normative quotations.
  result = result.replace(/^(?:in questo (?:quadro|contesto)|a tale riguardo|sotto questo profilo)[,\s]+/i, '');
  result = result.replace(/\b(?:come già (?:detto|evidenziato)|come abbiamo visto)\b[,\s]*/gi, '');
  return clean(result);
}
function prepareParagraph(original, level) {
  const source = String(original || '').trim();
  if (!source) return [];
  const units = splitUnits(source);
  const expanded = [];
  for (const unit of units) {
    // Split long explanations into usable schematic clauses at strong reduction.
    // A complete normative quotation or a formula is never split.
    if (!unit.immutable && (level === 'summary' || level >= 40)
        && countWords(unit.text) > 38 && unit.text.includes(',')) {
      const clauses = unit.text.split(/,\s+/).map(clean).filter(Boolean);
      if (clauses.length >= 2 && clauses.every((part) => countWords(part) >= 5)) {
        expanded.push(...clauses.map((text) => ({ text, immutable: false })));
        continue;
      }
    }
    expanded.push(unit);
  }
  return expanded.map((unit, index) => ({
    ...unit, index,
    value: compactUnit(unit, level === 'summary' ? 50 : level),
    priority: importance(unit.text, index),
    // A condition or negation must remain in the study versions.
    mandatory: unit.immutable || (level !== 'summary' && QUALIFIER.test(unit.text)),
  })).filter((unit) => unit.value);
}


export function buildPrecisionEdition(book, reduction = 10) {
  if (!book) return null;
  const level = normalizeReduction(reduction);
  const chaptersIn = Array.isArray(book.chapters) ? book.chapters : [];
  const paragraphs = [];
  let originalWords = 0, protectedUnits = 0;
  chaptersIn.forEach((chapter, chapterIndex) => {
    (chapter.paragraphs || []).forEach((paragraph, paragraphIndex) => {
      const source = String(paragraph.original || paragraph.summary || '');
      originalWords += countWords(source);
      const units = prepareParagraph(source, level);
      protectedUnits += units.filter((unit) => unit.immutable).length;
      paragraphs.push({ chapterIndex, paragraphIndex, source, units, selected: new Set() });
    });
  });

  const ratio = level === 'summary' ? .30 : 1 - level / 100;
  const wordBudget = Math.max(1, Math.round(originalWords * ratio));
  let used = 0;
  if (level !== 0) {
    // Stage 1: original law/formula segments, conditions and negations.
    for (const p of paragraphs) {
      for (const unit of p.units) if (unit.mandatory) {
        p.selected.add(unit.index);
        used += countWords(unit.value);
      }
      // Stage 2: every paragraph keeps its most informative statement.
      if (!p.selected.size && p.units.length) {
        const best = [...p.units].sort((x, y) => y.priority - x.priority)[0];
        p.selected.add(best.index);
        used += countWords(best.value);
      }
    }
    // Stage 3: spend remaining *global* book budget on the most useful facts.
    const remaining = paragraphs.flatMap((p) => p.units
      .filter((unit) => !p.selected.has(unit.index))
      .map((unit) => ({ p, unit })));
    remaining.sort((x, y) => y.unit.priority - x.unit.priority ||
      x.p.chapterIndex - y.p.chapterIndex || x.unit.index - y.unit.index);
    for (const { p, unit } of remaining) {
      const cost = countWords(unit.value);
      if (used + cost <= wordBudget) {
        p.selected.add(unit.index);
        used += cost;
      }
    }
  }

  let resultingWords = 0;
  const paragraphLookup = new Map(paragraphs.map((p) => [p.chapterIndex + ':' + p.paragraphIndex, p]));
  const chapters = chaptersIn.map((chapter, chapterIndex) => ({
    ...chapter,
    paragraphs: (chapter.paragraphs || []).map((paragraph, paragraphIndex) => {
      const p = paragraphLookup.get(chapterIndex + ':' + paragraphIndex);
      const selected = (p?.units || []).filter((unit) => p.selected.has(unit.index));
      const text = level === 0 ? p.source
        : selected.map((unit) => unit.value).join(level === 50 ? '\n• ' : ' ');
      resultingWords += countWords(text);
      return {
        ...paragraph,
        original: paragraph.original || p.source,
        summary: text,
        dsaSummary: text,
        simpleSummary: level === 'summary' ? text : (paragraph.simpleSummary || text),
      };
    }),
  }));
  const achievedPercent = originalWords ? Math.round((1 - resultingWords / originalWords) * 1000) / 10 : 0;
  const targetPercent = level === 'summary' ? null : level;
  const metadata = {
    level, label: REDUCTION_LABELS[level], targetPercent, achievedPercent,
    originalWords, resultingWords, protectedUnits,
    targetReached: targetPercent === null || achievedPercent + .5 >= targetPercent,
    origin: 'original-source',
  };
  return {
    ...book, chapters, precisionEdition: metadata,
    quality: {
      ...(book.quality || {}),
      sourceFidelityGate: book.quality?.fidelityGate || null,
      // The original pre-reduction fidelity metric must NOT be shown
      // as if it audited a deliberately abbreviated edition.
      fidelityGate: level === 0 ? (book.quality?.fidelityGate || null) : null,
    },
  };
}
