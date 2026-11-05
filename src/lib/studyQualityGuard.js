// StudyBook Quality Guard LAB26: conservative, source-anchored checks.
// A rule-based audit is NOT a semantic or university-grade certification.
const FIXED_ABBREVIATIONS = /\b(art|artt|co|comma|n|nr|dott|prof|pag|pagg|lett|cfr|ecc)\.(?=\s*(?:\d|[A-ZÀ-Ö]))/gi;
const RESTORE_DOT = /∯/g;
const CONJUNCTION_END = /\b(?:che|di|da|del|della|delle|dei|degli|il|lo|la|i|gli|le|un|una|per|con|su|in|a|tra|fra|quando|mentre|poiché|perché|se|ma|oppure|e|o|quale|quali|come|non|salvo|qualora|quindi|secondo|ovvero|invece)\s*[,;:]?$/i;
const CONTEXT_START = /^(?:quest[oaie]|ciò|esso|essa|essi|esse|tale|tali|infatti|pertanto|inoltre|tuttavia|perciò|dunque|invece|in questo caso|in questo contesto|in tale contesto|di conseguenza|a tal riguardo|in tal senso|d'altra parte|per contro|viceversa)\b/i;
const SOURCE_GAP = /(?:\uFFFD|\.{3,}|…|\[\s*(?:omissis|testo mancante)\s*\])/i;
const PROTECTED = /\b(?:art(?:icolo)?\.?\s*\d+|comma\s+\d+|legge\s+n?\.?\s*\d+|decreto|regolamento|sentenza|non|salvo|eccetto|tranne|purché|solo se|a condizione|obblig|divieto|termine|entro\s+\d+)\b/i;
const FORMULA = /(?:^|\s)[\p{L}][\w²³]*(?:\s*[=≈≠≤≥]\s*)\S/u;
const FINITE_CLAIM = /\b(?:è|sono|si|ha|hanno|può|possono|deve|devono|prevede|richiede|stabilisce|costituisce|comporta|determina|disciplina|indica|afferma|consiste|deriva|risulta|esiste|esistono|si applica|si definisce|si distingue)\b/i;
const FILLERS = [
  [/\bè importante (?:sottolineare|evidenziare|ricordare) che\s*/gi, ''],
  [/\boccorre innanzitutto osservare che\s*/gi, ''],
  [/\bsi deve tenere presente che\s*/gi, ''],
  [/\bin considerazione del fatto che\b/gi, 'poiché'],
  [/\bal fine di\b/gi, 'per'],
  [/\bper quanto riguarda\b/gi, 'su'],
  [/\bin altre parole[,:\s]*/gi, ''],
];
const ws = (value) => String(value || '').replace(/\s+/g, ' ').trim();
export function countLetters(text) {
  return (String(text || '').match(/\p{L}/gu) || []).length;
}
export function countWords(text) {
  return (ws(text).match(/\S+/g) || []).length;
}
export function countSentences(text) {
  return splitCompleteSentences(text).length;
}
export function countText(text) {
  const value = String(text || '');
  return { letters: countLetters(value), words: countWords(value),
    characters: [...value].length, sentences: countSentences(value) };
}
export function splitCompleteSentences(value) {
  const lines = String(value || '').replace(/\r/g, '').split(/\n+/).map(ws).filter(Boolean);
  const units = [];
  for (const line of lines) {
    if (/^(?:art(?:icolo)?\.?\s*\d+|legge\s+n?\.?\s*\d+)/i.test(line) || FORMULA.test(line)) {
      units.push(line);
      continue;
    }
    const escaped = line.replace(FIXED_ABBREVIATIONS, (word) => word.slice(0, -1) + '∯');
    const chunks = escaped.split(/(?<=[.!?])\s+(?=(?:[«"“'(]*[A-ZÀ-Ö0-9]))/u)
      .map((part) => ws(part.replace(RESTORE_DOT, '.'))).filter(Boolean);
    units.push(...chunks);
  }
  return units;
}
export function checkSentence(text) {
  const source = ws(text);
  const issues = [];
  if (!source) issues.push('empty');
  if (SOURCE_GAP.test(source)) issues.push('source-gap');
  const last = source.replace(/[.!?;:»”"')\]]+$/g, '').trim();
  if (CONJUNCTION_END.test(last)) issues.push('dangling-word');
  if (/[,:;\-–—]$/.test(source)) issues.push('dangling-punctuation');
  if ((source.match(/\(/g) || []).length !== (source.match(/\)/g) || []).length) issues.push('parentheses');
  if ((source.match(/«/g) || []).length !== (source.match(/»/g) || []).length) issues.push('quotation');
  // Missing a full stop is not always truncation (headings, enumerations). It is a warning.
  if (source.length >= 35 && !/[.!?;:»”"')\]]$/.test(source)) issues.push('unterminated');
  return { valid: issues.length === 0, issues };
}
function removeIntroductoryFiller(text) {
  let result = ws(text);
  for (const [pattern, replacement] of FILLERS) result = result.replace(pattern, replacement);
  return ws(result).replace(/^[,;:\s]+/, '');
}
function meaningScore(text, index) {
  let score = 1 / (1 + index * .05);
  if (FINITE_CLAIM.test(text)) score += 4;
  if (PROTECTED.test(text)) score += 6;
  if (FORMULA.test(text)) score += 8;
  if (/\d/.test(text)) score += 2;
  if (/^(?:in questo capitolo|vedremo|in conclusione si parlerà)/i.test(text)) score -= 5;
  if (CONTEXT_START.test(text)) score -= 1;
  return score;
}
export function buildMeaningUnits(text, level = 10) {
  const sentences = splitCompleteSentences(text);
  return sentences.map((source, index) => {
    const immutable = /^(?:art(?:icolo)?\.?\s*\d+|legge\s+n?\.?\s*\d+)/i.test(source) || FORMULA.test(source);
    const wording = immutable || level === 0 ? source : removeIntroductoryFiller(source);
    const sourceCheck = checkSentence(source);
    const rewrittenCheck = checkSentence(wording);
    // If a rewrite makes an already-complete sentence invalid, restore it verbatim.
    const value = sourceCheck.valid && !rewrittenCheck.valid ? source : wording;
    return {
      index, source, value, immutable, score: meaningScore(source, index),
      mandatory: immutable || (level !== 'summary' && PROTECTED.test(source)),
      dependent: CONTEXT_START.test(source),
      problematic: !checkSentence(value).valid,
    };
  });
}
export function checkReducedParagraph(original, text, { selectedUnits = [] } = {}) {
  const issues = [];
  if (ws(original) && !ws(text)) issues.push('missing-paragraph');
  const sections = splitCompleteSentences(text);
  if (ws(text) && !sections.length) issues.push('no-sentences');
  for (const sentence of sections) {
    for (const issue of checkSentence(sentence).issues) issues.push(issue);
  }
  if (selectedUnits.some((unit) => !ws(original).includes(ws(unit.source)))) issues.push('untraceable-source');
  const selectedIndexes = new Set(selectedUnits.map((unit) => unit.index));
  if (selectedUnits.some((unit) => unit.dependent && !selectedIndexes.has(unit.index - 1))) issues.push('missing-antecedent');
  const protectedSource = splitCompleteSentences(original)
    .filter((sentence) => /^(?:art(?:icolo)?\.?\s*\d+|legge\s+n?\.?\s*\d+)/i.test(sentence) || FORMULA.test(sentence));
  for (const item of protectedSource) if (!ws(text).includes(ws(item))) issues.push('protected-text-lost');
  return { ok: issues.length === 0, issues: [...new Set(issues)] };
}
export function auditChapterContinuity(sourceChapter = {}, reducedChapter = {}) {
  const original = sourceChapter.paragraphs || [];
  const reduced = reducedChapter.paragraphs || [];
  const issues = [];
  if (original.length !== reduced.length) issues.push('paragraph-count-mismatch');
  for (let index = 0; index < original.length; index++) {
    const source = typeof original[index] === 'string' ? original[index] : (original[index]?.original || original[index]?.text || '');
    const actual = reduced[index]?.original || '';
    if (ws(source) !== ws(actual)) issues.push('original-not-preserved:' + index);
    if (ws(source) && !ws(reduced[index]?.summary)) issues.push('paragraph-removed:' + index);
  }
  const tailOriginal = original.at(-1);
  const tailText = typeof tailOriginal === 'string' ? tailOriginal : tailOriginal?.original || '';
  if (tailText && !checkSentence(splitCompleteSentences(tailText).at(-1) || '').valid)
    issues.push('source-chapter-ending-suspicious');
  const tailGenerated = reduced.at(-1)?.summary || '';
  if (tailGenerated && !checkSentence(splitCompleteSentences(tailGenerated).at(-1) || '').valid)
    issues.push('reduced-chapter-ending-suspicious');
  return { ok: !issues.length, issues };
}

/** Compare the source chapters to the rebuilt study book before persistence.
 * Missing/mismatched source text is a HARD warning, not a synonym for a normal reduction.
 */
export function auditBookSourceCoverage(sourceDocument = {}, rebuilt = {}) {
  const sourceChapters = sourceDocument.chapters || [];
  const actualChapters = rebuilt.chapters || [];
  const issues = [];
  let sourceParagraphs = 0, outputParagraphs = 0, originalLetters = 0, keptLetters = 0;
  sourceChapters.forEach((chapter, chapterIndex) => {
    const actual = actualChapters[chapterIndex];
    if (!actual) {
      issues.push({ type: 'chapter-missing', chapterIndex });
      return;
    }
    const original = chapter.paragraphs || [];
    const output = actual.paragraphs || [];
    sourceParagraphs += original.length;
    outputParagraphs += output.length;
    if (original.length !== output.length) issues.push({ type: 'paragraph-count', chapterIndex, source: original.length, built: output.length });
    original.forEach((value, paragraphIndex) => {
      const base = typeof value === 'string' ? value : (value?.original || value?.text || '');
      const current = output[paragraphIndex]?.original || '';
      originalLetters += countLetters(base);
      keptLetters += countLetters(current);
      if (ws(base) !== ws(current)) issues.push({ type: 'paragraph-source-diff', chapterIndex, paragraphIndex });
    });
    const sourceEnd = original.at(-1);
    const sourceLast = typeof sourceEnd === 'string' ? sourceEnd : sourceEnd?.original || '';
    if (sourceLast && checkSentence(splitCompleteSentences(sourceLast).at(-1) || '').issues.length)
      issues.push({ type: 'source-ending', chapterIndex });
  });
  if (sourceChapters.length !== actualChapters.length)
    issues.push({ type: 'chapter-count', source: sourceChapters.length, built: actualChapters.length });
  return {
    passed: !issues.length,
    status: !issues.length ? 'structurally-matched' : 'needs-source-review',
    sourceChapters: sourceChapters.length, rebuiltChapters: actualChapters.length,
    sourceParagraphs, rebuiltParagraphs: outputParagraphs,
    originalLetters, preservedOriginalLetters: keptLetters,
    issues: issues.slice(0, 150), issueCount: issues.length,
    // This confirms original reconstruction, not external legal truth.
    semanticCertification: false,
  };
}

/** Guard for optional AI-generated "In parole semplici" text.
 * A strong lexical mismatch requires reverting to the extractive study edition.
 * Synonyms remain an unresolved limitation, not proof of falsehood.
 */
export function hasLexicalSupport(source, proposed) {
  const keyWords = (v) => ws(v).toLocaleLowerCase('it-IT')
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length >= 5);
  const a = new Set(keyWords(source));
  const b = [...new Set(keyWords(proposed))];
  if (!b.length) return false;
  const supported = b.filter((word) => a.has(word)).length;
  return supported / b.length >= 0.75;
}
