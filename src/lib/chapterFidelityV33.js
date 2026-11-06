// LAB33: diagnostic-only source boundary review and conservative chapter budgets.
// Never alter the retained original, invent OCR content, or certify semantics.
const normalize = text => String(text || '').replace(/\s+/g, ' ').trim();
const canonical = text => normalize(text).toLocaleLowerCase('it-IT')
  .replace(/^(?:cap(?:itolo)?\.?\s*)?(?:\d+|[ivxlcdm]+)\s*[-–—:.)]?\s*/iu, '')
  .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const SOURCE_CONNECTIVE_END = /\b(?:mediante|perché|poiché|attraverso|nonché|ovvero|ossia|quindi|inoltre|rispetto|dunque|che|di|del|della|a|da|in|con|su|per|tra|fra|mediante il|mediante la)\s*$/iu;
const SOURCE_BAD_START = /^[,;:.!?)]/u;
const NEXT_TITLE_MARK = /(?:^|[.!?]\s+)((?:cap(?:itolo)?\s*\.?\s*\d+)\s*[:. -]\s*[^.!?]{5,100})\s*$/iu;

export function inspectChapterBoundaries(chapters = []) {
  const findings = [];
  for (let index = 0; index < chapters.length; index += 1) {
    const chapter = chapters[index] || {};
    const prior = chapters[index-1] || null, next = chapters[index+1] || null;
    const paragraphs = (chapter.paragraphs || []).map(p =>
      normalize(typeof p === 'string' ? p : p?.original || p?.text || p?.summary));
    const first = paragraphs.find(Boolean) || '', last = [...paragraphs].reverse().find(Boolean) || '';
    if (!first) findings.push({ chapterIndex:index, type:'empty-chapter', severity:'block' });
    if (SOURCE_BAD_START.test(first)) {
      findings.push({ chapterIndex:index, type:'orphan-leading-punctuation', severity:'block',
        page:chapter.pageStart ?? null });
    } else if (/^[a-zà-öø-ÿ]/u.test(first)) {
      findings.push({ chapterIndex:index, type:'possible-continuation-at-chapter-start',
        severity:prior ? 'review' : 'review', page:chapter.pageStart ?? null });
    }
    if (SOURCE_CONNECTIVE_END.test(last)) {
      findings.push({ chapterIndex:index, type:'dangling-end-of-chapter', severity:'block',
        page:chapter.pageEnd ?? null });
    }
    const stray=last.match(NEXT_TITLE_MARK)?.[1] || '';
    if (stray && next && canonical(stray) && canonical(stray) === canonical(next.title)) {
      findings.push({chapterIndex:index,type:'next-chapter-heading-in-body',severity:'review',
        page:chapter.pageEnd ?? null, nextChapterIndex:index+1, heading:stray});
    }
    if (Number.isFinite(chapter.pageStart) && Number.isFinite(prior?.pageEnd)
      && chapter.pageStart < prior.pageStart) {
      findings.push({chapterIndex:index,type:'chapter-order',severity:'block'});
    }
    if (Number.isFinite(chapter.pageEnd) && Number.isFinite(chapter.pageStart)
      && chapter.pageEnd < chapter.pageStart) {
      findings.push({chapterIndex:index,type:'chapter-range',severity:'block'});
    }
  }
  const byChapter = chapters.map((_,chapterIndex) =>
    findings.filter(f => f.chapterIndex === chapterIndex));
  return { findings, byChapter,
    blockedChapters: byChapter.filter(list => list.some(f => f.severity === 'block')).length,
    chaptersToReview: byChapter.filter(list => list.length).length,
    semanticCertified:false };
}
export function chapterLevelTarget(level, sourceLetters) {
  const requested = level === 'summary' ? 70 : Math.max(0, Math.min(50, Number(level) || 0));
  const original = Math.max(0, Number(sourceLetters) || 0);
  return { requested, minRetained:Math.ceil(original * (1 - requested / 100)),
    maxReduction:requested };
}
export function chapterMeasuredStats(originalLetters, outputLetters, target) {
  const original=Math.max(0,Number(originalLetters)||0);
  const actual=Math.max(0,Number(outputLetters)||0);
  const achieved=original?Math.round((1-actual/original)*1000)/10:0;
  const requested=target === 'summary'?null:Math.max(0, Number(target)||0);
  return { originalLetters:original, resultingLetters:actual, achievedPercent:achieved,
    targetPercent:requested, targetReached:requested===null || Math.abs(achieved-requested)<=3,
    overReduced:requested!==null && achieved>requested+3,
    insufficientlyReduced:requested!==null && achieved<requested-3 };
}


/** A heading printed at the end of the PREVIOUS chapter is not study prose
 * if (and only if) its normalized identity exactly equals the next chapter
 * heading. The original remains untouched in paragraph.original.
 */
export function stripConfirmedNextHeading(text, nextChapterTitle) {
  const value=String(text||'');
  const match=value.match(NEXT_TITLE_MARK);
  if (!match || !nextChapterTitle) return {text:value,moved:false};
  const next=canonical(nextChapterTitle);
  if (!next || canonical(match[1])!==next) return {text:value,moved:false};
  const headIndex=value.lastIndexOf(match[1]);
  if (headIndex<0) return {text:value,moved:false};
  const before=value.slice(0,headIndex).trimEnd();
  if (!before || !/[.!?]$/u.test(before)) return {text:value,moved:false};
  return {text:before,moved:true,heading:match[1],reason:'matched-next-chapter-title'};
}


export function auditChapterOutput(paragraphs = [], nextTitle = '') {
  const texts=paragraphs.map(p=>normalize(typeof p==='string'?p:p?.summary||p?.text||'')).filter(Boolean);
  const first=texts[0]||'', last=texts.at(-1)||'';
  const issues=[];
  if (!texts.length) issues.push('empty-generated-chapter');
  if (SOURCE_BAD_START.test(first)) issues.push('generated-orphan-start');
  if (SOURCE_CONNECTIVE_END.test(last)) issues.push('generated-dangling-end');
  // Mathematical expressions and references need not end with a full stop.
  const mathEnding = /(?:^|\s)[\p{L}][\p{L}\p{N}²³]*\s*[=≈≠≤≥]\s*[\p{L}\p{N}²³]+$/u.test(last);
  if (last.length>=40 && !mathEnding && !/[.!?;:»”"')\]]$/u.test(last))
    issues.push('generated-incomplete-ending');
  const match=last.match(NEXT_TITLE_MARK)?.[1]||'';
  if (match && nextTitle && canonical(match)===canonical(nextTitle))
    issues.push('next-heading-still-in-text');
  return {ready:issues.length===0,issues,semanticCertified:false};
}
