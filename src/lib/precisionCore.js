// StudyBook Precision Core LAB26: cohesive meaning units, global length target,
// source traceability and non-destructive quality gates.
import {
  countWords, countText, buildMeaningUnits, checkReducedParagraph,
  auditChapterContinuity, hasLexicalSupport,
} from './studyQualityGuard.js';

export const REDUCTION_STEPS = [0, 10, 20, 30, 40, 50, 'summary'];
export const REDUCTION_LABELS = {
  0: 'Originale', 10: 'Pulizia leggera', 20: 'Testo diretto',
  30: 'Studio sintetico', 40: 'Studio essenziale', 50: 'Studio schematico',
  summary: 'Riassunto',
};
export { countWords };

export function normalizeReduction(value) {
  if (value === 'summary') return value;
  const number = Number(value);
  return [0, 10, 20, 30, 40, 50].includes(number) ? number : 10;
}
function joinUnits(units, level) {
  const text = units.map((unit) => unit.value);
  if (level === 50) return text.join('\n• ');
  return text.join(' ');
}
function sourceText(paragraph) {
  return String(paragraph?.original || paragraph?.summary || '');
}
function buildRequests(book, level) {
  const items = [], chapters = Array.isArray(book?.chapters) ? book.chapters : [];
  let sourceWords = 0;
  chapters.forEach((chapter, chapterIndex) => (chapter.paragraphs || []).forEach((paragraph, paragraphIndex) => {
    const source = sourceText(paragraph);
    sourceWords += countWords(source);
    items.push({
      chapterIndex, paragraphIndex, source,
      units: buildMeaningUnits(source, level),
      selected: new Set(), fallback: false,
    });
  }));
  return { items, sourceWords };
}
function reserveItem(item, unit) {
  if (!unit || item.selected.has(unit.index)) return 0;
  item.selected.add(unit.index);
  return countWords(unit.value);
}
function selectWithDependencies(item, unit) {
  const needed = [unit];
  // Follow the complete antecedent chain, rather than including a single orphaned connector.
  let current = unit;
  while (current.dependent) {
    const previous = item.units[current.index - 1];
    if (!previous) return null;
    needed.unshift(previous);
    current = previous;
  }
  return needed.filter((part) => !item.selected.has(part.index));
}
function computeSelection(items, budget, level) {
  if (level === 0) return;
  let used = 0;
  // Essential laws, formulas and legal qualifiers remain complete.
  for (const item of items) for (const unit of item.units) {
    if (!unit.mandatory) continue;
    const required = selectWithDependencies(item, unit);
    if (!required) continue;
    for (const selected of required) used += reserveItem(item, selected);
  }
  // Do not create empty paragraphs or strip the only statement of a chapter.
  for (const item of items) {
    if (item.selected.size || !item.units.length) continue;
    const available = item.units.filter((unit) => !unit.problematic && (!unit.dependent || unit.index > 0));
    const best = [...(available.length ? available : item.units)].sort((a, b) => b.score - a.score)[0];
    const required = selectWithDependencies(item, best);
    if (!required) {
      used += reserveItem(item, item.units[0]); // The original is flagged if unsafe.
    } else for (const selected of required) used += reserveItem(item, selected);
  }

  const candidates = items.flatMap((item) => item.units
    .filter((unit) => !item.selected.has(unit.index) && !unit.problematic)
    .map((unit) => ({ item, unit })));
  candidates.sort((a, b) => b.unit.score - a.unit.score ||
    a.item.chapterIndex - b.item.chapterIndex || a.unit.index - b.unit.index);
  for (const { item, unit } of candidates) {
    const necessary = selectWithDependencies(item, unit);
    if (!necessary) continue;
    const cost = necessary.reduce((sum, selected) => sum + countWords(selected.value), 0);
    if (used + cost <= budget) {
      for (const selected of necessary) used += reserveItem(item, selected);
    }
  }
}

export function buildPrecisionEdition(book, reduction = 10) {
  if (!book) return null;
  const level = normalizeReduction(reduction);
  const originalChapters = Array.isArray(book.chapters) ? book.chapters : [];
  const { items, sourceWords } = buildRequests(book, level);
  const targetPercent = level === 'summary' ? null : level;
  const wordBudget = Math.max(1, Math.round(sourceWords * (level === 'summary' ? 0.30 : 1 - level / 100)));
  computeSelection(items, wordBudget, level);

  const lookup = new Map(items.map((item) => [item.chapterIndex + ':' + item.paragraphIndex, item]));
  let outputWords = 0;
  let fallbackCount = 0;
  const issues = [];
  const chapters = originalChapters.map((chapter, chapterIndex) => {
    const paragraphs = (chapter.paragraphs || []).map((paragraph, paragraphIndex) => {
      const item = lookup.get(chapterIndex + ':' + paragraphIndex);
      const units = item.units.filter((unit) => item.selected.has(unit.index));
      const candidate = level === 0 ? item.source : joinUnits(units, level);
      const audit = checkReducedParagraph(item.source, candidate, { selectedUnits: units });
      const fallback = !audit.ok;
      const finalText = fallback ? item.source : candidate;
      if (fallback) {
        fallbackCount += 1;
        issues.push({ chapterIndex, paragraphIndex, problems: audit.issues });
      }
      outputWords += countWords(finalText);
      const simple = String(paragraph.simpleSummary || '');
      const simpleSafe = simple && checkReducedParagraph(item.source, simple).ok && hasLexicalSupport(item.source, simple);
      return {
        ...paragraph,
        original: paragraph.original || item.source,
        summary: finalText,
        dsaSummary: finalText,
        simpleSummary: level === 'summary' ? finalText : (simpleSafe ? simple : finalText),
        precisionAudit: {
          coherent: audit.ok,
          fallbackOriginal: fallback,
          reasons: audit.issues,
          sourceWords: countWords(item.source),
          outputWords: countWords(finalText),
          selectedUnits: units.length,
        },
      };
    });
    const result = { ...chapter, paragraphs };
    const continuity = auditChapterContinuity(chapter, result);
    if (!continuity.ok) issues.push({ chapterIndex, problems: continuity.issues });
    return { ...result, precisionContinuity: continuity };
  });
  const achievedPercent = sourceWords ? Math.round((1 - outputWords / sourceWords) * 1000) / 10 : 0;
  const metadata = {
    level, label: REDUCTION_LABELS[level], targetPercent, achievedPercent,
    originalWords: sourceWords, resultingWords: outputWords,
    targetReached: targetPercent === null || achievedPercent + 0.5 >= targetPercent,
    qualityGuard: {
      status: issues.length ? 'needs-review' : 'rule-checked',
      issues: issues.slice(0, 160), issueCount: issues.length,
      originalFallbackParagraphs: fallbackCount,
      semanticCertification: false,
    },
  };
  return {
    ...book, chapters, precisionEdition: metadata,
    quality: {
      ...(book.quality || {}),
      sourceFidelityGate: book.quality?.sourceFidelityGate || book.quality?.fidelityGate || null,
      fidelityGate: level === 0 ? (book.quality?.sourceFidelityGate || book.quality?.fidelityGate || null) : null,
    },
  };
}

/** Measured stats are cached by the ORIGINAL immutable book, not by slider position.
 *  Only tiny counters are retained: seven full edition objects are discarded.
 */
const statisticsCache = new WeakMap();
function createStatisticsCache(book) {
  const profileRows = [];
  for(const level of REDUCTION_STEPS) {
    const edition = buildPrecisionEdition(book, level);
    const byChapter = edition.chapters.map((chapter) => {
      const original = (chapter.paragraphs || []).map((p) => p.original || '').join('\n');
      const actual = (chapter.paragraphs || []).map((p) => p.summary || '').join('\n');
      return { original: countText(original), actual: countText(actual) };
    });
    const sum = (field, part) => byChapter.reduce((total, ch) => total + ch[part][field], 0);
    const wholeBook = {
      original: {letters:sum('letters','original'), words:sum('words','original'), sentences:sum('sentences','original')},
      actual: {letters:sum('letters','actual'), words:sum('words','actual'), sentences:sum('sentences','actual')},
    };
    profileRows.push({level, label:REDUCTION_LABELS[level], byChapter, wholeBook,
      qualityStatus:edition.precisionEdition?.qualityGuard?.status || 'unknown'});
  }
  return profileRows;
}
function reductionRate(original, actual) {
  return original ? Math.round((1 - actual / original) * 1000) / 10 : 0;
}
export function buildReductionStatistics(book, chapterIndex = null) {
  if (!book || typeof book !== 'object') return [];
  let cached = statisticsCache.get(book);
  if (!cached) {
    cached = createStatisticsCache(book);
    statisticsCache.set(book, cached);
  }
  return cached.map((profile) => {
    const section = chapterIndex === null ? profile.wholeBook :
      profile.byChapter[chapterIndex] || {original:countText(''),actual:countText('')};
    const {original, actual} = section;
    const wordsReduced = reductionRate(original.words, actual.words);
    const lettersReduced = reductionRate(original.letters, actual.letters);
    const wholeBook = {
      ...profile.wholeBook,
      wordsReduced: reductionRate(profile.wholeBook.original.words, profile.wholeBook.actual.words),
      lettersReduced: reductionRate(profile.wholeBook.original.letters, profile.wholeBook.actual.letters),
    };
    return {
      level:profile.level,label:profile.label,original,actual,wordsReduced,lettersReduced,
      wholeBook,qualityStatus:profile.qualityStatus,
      targetReached: profile.level === 'summary' || wordsReduced + .5 >= profile.level,
    };
  });
}
