// StudyBook Precision Core LAB26: cohesive meaning units, global length target,
// source traceability and non-destructive quality gates.
import {
  countWords, countText, countLetters, buildMeaningUnits, checkReducedParagraph,
  auditChapterContinuity, auditNarrativeSource, hasLexicalSupport, canSafelyBridgeAfterGap,
} from './studyQualityGuard.js';
import { explainInSimpleWords } from './simpleLanguage.js';
import { buildGeminiEditionViewV36 } from './editionViewV36.js';
import { inspectChapterBoundaries, chapterMeasuredStats, chapterLevelTarget, stripConfirmedNextHeading, auditChapterOutput } from './chapterFidelityV33.js';

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
function joinUnits(units) {
  // The 50% edition remains prose. An automatically inserted bullet on every
  // sentence is not the original book's paragraph structure.
  return units.map((unit) => unit.value).join(' ');
}
function sourceText(paragraph) {
  return String(paragraph?.original || paragraph?.summary || '');
}
function buildRequests(book, level) {
  const items = [], chapters = Array.isArray(book?.chapters) ? book.chapters : [];
  let sourceWords = 0;
  let sourceLetters = 0;
  chapters.forEach((chapter, chapterIndex) => (chapter.paragraphs || []).forEach((paragraph, paragraphIndex) => {
    const source = sourceText(paragraph);
    sourceWords += countWords(source);
    sourceLetters += countLetters(source);
    const units = buildMeaningUnits(source, level);
    const sourceAudit = auditNarrativeSource(source);
    // A single lowercase beginning can be a truthful continuation of an OCR
    // chunk. Preserve that exact first sentence and keep its warning visible;
    // do not force every other complete sentence back to the original.
    if (sourceAudit.problems.length === 1 && sourceAudit.problems[0] === 'starts-mid-sentence' && units[0]) {
      units[0] = { ...units[0], value: units[0].source };
    }
    items.push({
      chapterIndex, paragraphIndex, source, units, sourceAudit,
      selected: new Set(), fallback: false,
    });
  }));
  return { items, sourceWords, sourceLetters };
}
// Source-first chapter and paragraph quotas. The former whole-book budget
// could reduce one 1,491-letter chapter to 85 letters while compensating with
// a much longer chapter; that outcome must never pass LAB33.
function computeSelection(items, level) {
  if (level === 0) return;
  const target = level === 'summary' ? 70 : level;
  const byChapter = new Map();
  for (const item of items) {
    if (!byChapter.has(item.chapterIndex)) byChapter.set(item.chapterIndex, []);
    byChapter.get(item.chapterIndex).push(item);
  }
  const keep = (item, unit) => {
    if (!unit || item.selected.has(unit.index)) return 0;
    item.selected.add(unit.index);
    return countLetters(unit.value);
  };
  const nextUnit = item => item.units.find(unit =>
    !item.selected.has(unit.index)
    && (unit.index===0 || item.selected.has(unit.index-1)));
  for (const chapterItems of byChapter.values()) {
    const chapterSourceLetters = chapterItems.reduce((n,item)=>n+countLetters(item.source),0);
    const minChapter = chapterLevelTarget(level,chapterSourceLetters).minRetained;
    let totalKept = 0;
    for (const item of chapterItems) {
      item.keptLetters = 0;
      // OCR defects are not a license to discard content: keep exact source
      // and mark for review, rather than producing text that ends mid-sentence.
      const sourceUnsafe = item.sourceAudit.problems.some(issue =>
        issue !== 'starts-mid-sentence');
      const brokenEnding = item.units.some(unit => unit.problematic && unit.index === item.units.length-1);
      if (sourceUnsafe || brokenEnding) {
        item.keepOriginal = true;
        item.units.forEach(unit => {item.keptLetters+=keep(item,unit)});
      } else {
        if (item.units.length) item.keptLetters+=keep(item,item.units[0]);
        // A protected sentence is independent only if it contains a complete
        // assertion without dangling antecedents. Otherwise keep its exact
        // source prefix. Never emit a condition torn from its assertion.
        for (const unit of item.units.filter(unit=>unit.mandatory)) {
          if (item.selected.has(unit.index)) continue;
          if (canSafelyBridgeAfterGap(unit.source) && !unit.dependent) {
            item.keptLetters += keep(item,unit);
          } else {
            for (let index=1;index<=unit.index;index++) {
              item.keptLetters+=keep(item,item.units[index]);
            }
          }
        }
      }
      totalKept += item.keptLetters;
    }

    // Each paragraph gets a fair share of its own original content, not just
    // the first sentence. +/-2% leeway for indivisible complete sentences.
    for (const item of chapterItems) {
      const minRetained = Math.ceil(countLetters(item.source)*(1-Math.min(72,target+2)/100));
      while (item.keptLetters < minRetained) {
        const next = nextUnit(item);
        if (!next || next.problematic) break;
        const cost=keep(item,next);
        item.keptLetters+=cost; totalKept+=cost;
      }
    }
    // After paragraph protection, fill the chapter to its real target.
    // Never stop while the chapter remains massively over-compressed.
    let rounds=0;
    while (totalKept < minChapter && rounds++<chapterItems.reduce((n,item)=>n+item.units.length,0)+1) {
      const candidates=chapterItems.map(item=>{
        const unit=nextUnit(item);
        return unit && !unit.problematic ? {item,unit} : null;
      }).filter(Boolean);
      candidates.sort((a,b)=>b.unit.score-a.unit.score || a.item.paragraphIndex-b.item.paragraphIndex);
      if (!candidates.length) break;
      const chosen=candidates[0];
      const cost=keep(chosen.item,chosen.unit);
      chosen.item.keptLetters+=cost; totalKept+=cost;
    }
  }
}

export function buildPrecisionEdition(book, reduction = 10) {
  if (!book) return null;
  const level = normalizeReduction(reduction);
  const generated = level!==0 ? buildGeminiEditionViewV36(book,level):null;
  if(generated)return generated;
  const originalChapters = Array.isArray(book.chapters) ? book.chapters : [];
  const { items, sourceWords, sourceLetters } = buildRequests(book, level);
  const targetPercent = level === 'summary' ? null : level;
  // The user's reduction control and per-paragraph statistics are in LETTERS.
  // Select sentences to a real letter budget, not an unrelated word target.
  computeSelection(items, level);
  const sourceBoundaryAudit = inspectChapterBoundaries(originalChapters);

  const lookup = new Map(items.map((item) => [item.chapterIndex + ':' + item.paragraphIndex, item]));
  let outputWords = 0;
  let outputLetters = 0;
  let fallbackCount = 0;
  const issues = [];
  const chapterMetrics = [];
  const chapters = originalChapters.map((chapter, chapterIndex) => {
    const paragraphs = (chapter.paragraphs || []).map((paragraph, paragraphIndex) => {
      const item = lookup.get(chapterIndex + ':' + paragraphIndex);
      const units = item.units.filter((unit) => item.selected.has(unit.index));
      const candidate = level === 0 || item.keepOriginal ? item.source : joinUnits(units, level);
      const audit = checkReducedParagraph(item.source, candidate, { selectedUnits: units, allowSafeGaps: true });
      const sourceAudit = item.sourceAudit;
      // Only the already-preserved lowercase beginning may proceed with a
      // visible warning. More serious OCR defects remain hard stop conditions.
      const harmlessBoundary = sourceAudit.problems.length === 1
        && sourceAudit.problems[0] === 'starts-mid-sentence'
        && units[0]?.index === 0 && units[0].value === units[0].source;
      const fallback = !audit.ok || (!sourceAudit.ok && !harmlessBoundary);
      const severeBoundaryIssues = sourceBoundaryAudit.byChapter[chapterIndex] || [];
      const auditReasons = [...audit.issues,...sourceAudit.problems.map(problem=>'source-'+problem)];
      const rawResult = fallback ? item.source : candidate;
      const followingTitle = originalChapters[chapterIndex + 1]?.title || '';
      const isLastParagraph = paragraphIndex === (chapter.paragraphs || []).length - 1;
      const repaired = isLastParagraph
        ? stripConfirmedNextHeading(rawResult, followingTitle) : { text:rawResult, moved:false };
      const finalText = repaired.text;
      if (fallback) fallbackCount += 1;
      if (auditReasons.length) {
        issues.push({ chapterIndex, paragraphIndex, problems: auditReasons,
          action: fallback ? 'source-retained' : 'source-boundary-review' });
      }
      outputWords += countWords(finalText);
      outputLetters += countLetters(finalText);
      // Accessible reading is a linguistic transformation of the CURRENT edition.
      // Never reuse an older independent summary or reselect facts.
      const simpleText = explainInSimpleWords(finalText);
      return {
        ...paragraph,
        original: paragraph.original || item.source,
        summary: finalText,
        dsaSummary: finalText,
        simpleSummary: simpleText,
        precisionAudit: {
          coherent: audit.ok && sourceAudit.ok,
          fallbackOriginal: fallback,
          sourceNeedsReview: !sourceAudit.ok || severeBoundaryIssues.some(x=>x.severity==='block'),
          sourceBoundaryIssues: severeBoundaryIssues.map(x=>x.type),
          confirmedHeadingMoved: repaired.moved,
          reasons: auditReasons,
          sourceWords: countWords(item.source),
          outputWords: countWords(finalText),
          selectedUnits: units.length,
        },
      };
    });
    const candidateOutputAudit = auditChapterOutput(
      paragraphs, originalChapters[chapterIndex + 1]?.title || '');
    const blockedSource = (sourceBoundaryAudit.byChapter[chapterIndex] || [])
      .some(issue => issue.severity === 'block');
    // A broken derived chapter must not masquerade as university-grade study
    // prose. Restore the complete available source, mark it unverified and
    // retain the original per-paragraph identity.
    const restoreChapter = !candidateOutputAudit.ready || blockedSource;
    if (restoreChapter) paragraphs.forEach(p => {
      outputWords += countWords(p.original) - countWords(p.summary);
      outputLetters += countLetters(p.original) - countLetters(p.summary);
      p.summary = p.original;
      p.dsaSummary = p.original;
      p.simpleSummary = explainInSimpleWords(p.original);
      p.precisionAudit = {
        ...p.precisionAudit, coherent:false, sourceNeedsReview:true,
        chapterRestored:true,
        reasons:[...new Set([...(p.precisionAudit?.reasons||[]),
          ...candidateOutputAudit.issues,
          ...(blockedSource?['source-chapter-boundary-not-verified']:[])])],
      };
    });
    const result = { ...chapter, paragraphs };
    const originalChapterLetters = (chapter.paragraphs || []).reduce((n,p)=>n+countLetters(sourceText(p)),0);
    const actualChapterLetters = paragraphs.reduce((n,p)=>n+countLetters(p.summary),0);
    const chapterMetric = chapterMeasuredStats(originalChapterLetters,actualChapterLetters,level);
    const boundaryIssues = sourceBoundaryAudit.byChapter[chapterIndex] || [];
    result.precisionChapter = {
      ...chapterMetric,
      sourceReady:!restoreChapter && !boundaryIssues.some(x=>x.severity==='block'),
      boundaryIssues,
      outputAudit:candidateOutputAudit,
      sourceRestored:restoreChapter,
    };
    chapterMetrics.push(result.precisionChapter);
    if (chapterMetric.overReduced || restoreChapter || boundaryIssues.length) {
      issues.push({chapterIndex, problems:[
        ...(chapterMetric.overReduced?['chapter-over-reduced']:[]),
        ...boundaryIssues.map(x=>x.type),
        ...candidateOutputAudit.issues,
      ],action:restoreChapter?'chapter-restored-source-not-ready':'review-chapter-source'});
    }
    const continuity = auditChapterContinuity(chapter, result);
    if (!continuity.ok) issues.push({ chapterIndex, problems: continuity.issues });
    return { ...result, precisionContinuity: continuity };
  });
  const achievedWordsPercent = sourceWords ? Math.round((1 - outputWords / sourceWords) * 1000) / 10 : 0;
  const achievedLettersPercent = sourceLetters
    ? Math.round((1 - outputLetters / sourceLetters) * 1000) / 10 : 0;
  const targetShortfall = targetPercent === null ? 0 : Math.max(0, Math.round((targetPercent-achievedLettersPercent)*10)/10);
  const metadata = {
    level, label: REDUCTION_LABELS[level], targetPercent,
    achievedPercent: achievedLettersPercent, achievedWordsPercent,
    achievedLettersPercent, originalLetters:sourceLetters, resultingLetters:outputLetters,
    chapterMetrics,
    sourceBoundaryAudit,
    originalWords: sourceWords, resultingWords: outputWords,
    targetReached: targetPercent === null || achievedLettersPercent + 0.5 >= targetPercent,
    qualityGuard: {
      status: issues.length || targetShortfall > 3 ? 'needs-review' : 'rule-checked',
      targetShortfall,
      issues: issues.slice(0, 160), issueCount: issues.length,
      originalFallbackParagraphs: fallbackCount,
      chaptersWithUnmetTarget:chapterMetrics.filter(x=>!x.targetReached).length,
      chaptersOverReduced:chapterMetrics.filter(x=>x.overReduced).length,
      sourceBlockedChapters:sourceBoundaryAudit.blockedChapters,
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
      targetReached: profile.level === 'summary' || lettersReduced + .5 >= profile.level,
    };
  });
}
