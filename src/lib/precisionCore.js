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
  return (String(value || '').trim().match(/\S+/g) || []).length;
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
function reduceParagraph(original, level) {
  const source = String(original || '').trim();
  if (!source || level === 0) return source;
  const targetRatio = level === 'summary' ? .30 : 1 - level / 100;
  const budget = Math.max(1, Math.round(countWords(source) * targetRatio));
  const units = splitUnits(source).map((unit, index) => ({
    ...unit, index, value: compactUnit(unit, level === 'summary' ? 50 : level),
    score: importance(unit.text, index),
  })).filter((unit) => unit.value);
  if (!units.length) return source;

  if (level === 10) return units.map((unit) => unit.value).join(' ');

  const selected = new Set(units.filter((unit) => unit.immutable).map((unit) => unit.index));
  let words = units.filter((unit) => unit.immutable).reduce((sum, unit) => sum + countWords(unit.value), 0);
  const ranked = units.filter((unit) => !unit.immutable).sort((a, b) => b.score - a.score || a.index - b.index);
  // Reserve at least one informative unit from every nonempty paragraph.
  for (const unit of ranked) {
    const additional = countWords(unit.value);
    if (!selected.size || words + additional <= budget) {
      selected.add(unit.index);
      words += additional;
    }
  }
  // Never invent content to artificially fill a numerical quota.
  const kept = units.filter((unit) => selected.has(unit.index));
  const result = kept.map((unit) => unit.value).join(level === 50 ? '\n' : ' ');
  return result || ranked[0]?.value || source;
}

export function buildPrecisionEdition(book, reduction = 10) {
  if (!book) return null;
  const level = normalizeReduction(reduction);
  let originalWords = 0, resultingWords = 0, protectedUnits = 0;
  const chapters = (book.chapters || []).map((chapter) => ({
    ...chapter,
    paragraphs: (chapter.paragraphs || []).map((paragraph) => {
      const source = String(paragraph.original || paragraph.summary || '');
      originalWords += countWords(source);
      protectedUnits += splitUnits(source).filter((unit) => unit.immutable).length;
      const text = reduceParagraph(source, level);
      resultingWords += countWords(text);
      return {
        ...paragraph,
        original: paragraph.original || source,
        summary: text,
        dsaSummary: text,
        // The original book's accessible-language rendering remains independent.
        simpleSummary: level === 'summary' ? text : (paragraph.simpleSummary || text),
      };
    }),
  }));
  const achievedPercent = originalWords ? Math.round((1 - resultingWords / originalWords) * 1000) / 10 : 0;
  const targetPercent = level === 'summary' ? null : level;
  return {
    ...book,
    chapters,
    precisionEdition: {
      level,
      label: REDUCTION_LABELS[level],
      targetPercent,
      achievedPercent,
      originalWords,
      resultingWords,
      protectedUnits,
      // A missed target is reported, never masked by changing the original.
      targetReached: targetPercent === null || achievedPercent + .5 >= targetPercent,
      origin: 'original-source',
    },
  };
}
