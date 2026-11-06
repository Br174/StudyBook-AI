// LAB31A-F: pure, testable integrity decisions for the existing StudyBook parser.
export const INTEGRITY_ENGINE_VERSION = 'integrity360-turbo-31.1';

export function makeLogicalBlocks(pageCount, targetBlocks = 10) {
  const count = Math.max(0, Math.trunc(Number(pageCount) || 0));
  if (!count) return [];
  const size = Math.ceil(count / Math.min(count, Math.max(1, Math.trunc(targetBlocks))));
  const blocks = [];
  for (let start = 1; start <= count; start += size) {
    blocks.push({ id: blocks.length + 1, start, end: Math.min(count, start + size - 1) });
  }
  return blocks;
}

export function choosePdfLanes({ hardwareConcurrency = 2, deviceMemory = 2, pageCount = 0 } = {}) {
  // Two concurrent text reads at most. OCR remains single-lane until real device proof.
  if (Number(deviceMemory) < 3 || Number(hardwareConcurrency) < 4 || Number(pageCount) < 30) return 1;
  return 2;
}

export function shouldThrottlePdfLanes({ durationMs = 0, baselineMs = 0, errorCount = 0, deviceMemory = 4, heapFraction = 0 } = {}) {
  return errorCount > 0 || Number(deviceMemory) < 3 || heapFraction >= 0.80
    || (baselineMs > 0 && durationMs > Math.max(250, baselineMs * 1.8));
}

export function suspectText(text = '') {
  const value = String(text || '');
  if (!value.trim()) return true;
  const invalid = (value.match(/\uFFFD/g) || []).length;
  const symbols = (value.match(/[|_¤�]/g) || []).length;
  return invalid > 0 || symbols > Math.max(8, value.length * 0.12);
}

export function joinOrderedPageText(pages = []) {
  let result = '';
  let previous = '';
  for (const page of pages) {
    const text = String(page?.text || '').trim();
    if (!text) continue;
    if (!result) { result = text; previous = text; continue; }
    // A physical page break must not create an artificial sentence break.
    const priorEnding = previous.slice(-2);
    const nextBeginning = text.slice(0, 2);
    const hyphen = /[A-Za-zÀ-ÖØ-öø-ÿ]-$/.test(priorEnding);
    const startsHeading = /^(?:capitolo|chapter|parte|sezione|section|appendice|bibliografia|\d+(?:\.\d+)*[.)]\s)/i.test(text);
    const continues = !startsHeading && (hyphen || !/[.!?]$/.test(previous)
      || /^[a-zà-öø-ÿ,;:]/.test(nextBeginning));
    if (hyphen && /^[a-zà-öø-ÿ]/.test(text)) result = result.slice(0, -1) + text;
    else result += (continues ? ' ' : '\n\n') + text;
    previous = text;
  }
  return result;
}

export function auditIntegrityPages(pages = [], pageCount = 0, blocks = []) {
  const expected = Math.max(0, Math.trunc(Number(pageCount) || 0));
  const seen = new Set();
  const issues = [];
  for (const page of pages) {
    const number = Number(page?.pageNumber);
    if (!Number.isInteger(number) || number < 1 || number > expected) {
      issues.push({ type: 'page-out-of-range', page: number, severity: 'block' });
      continue;
    }
    if (seen.has(number)) issues.push({ type: 'page-duplicate', page: number, severity: 'block' });
    seen.add(number);
    if (page?.status !== 'verified') {
      issues.push({ type: 'page-unverified', page: number, severity: 'block', detail: page?.issue || '' });
    }
  }
  for (let page = 1; page <= expected; page += 1) {
    if (!seen.has(page)) issues.push({ type: 'page-missing', page, severity: 'block' });
  }
  for (let index = 0; index + 1 < blocks.length; index += 1) {
    if (blocks[index].end + 1 !== blocks[index + 1].start) {
      issues.push({ type: 'block-gap', page: blocks[index].end, severity: 'block' });
    }
  }
  const ordered = pages.length === expected && pages.every((page, i) => page?.pageNumber === i + 1);
  if (!ordered) issues.push({ type: 'page-order', severity: 'block' });
  return {
    pageCount: expected,
    capturedPages: seen.size,
    verifiedPages: pages.filter(page => page?.status === 'verified').length,
    missingPages: Math.max(0, expected - seen.size),
    issueCount: issues.length,
    issues,
    ready: expected > 0 && issues.length === 0,
  };
}

export function mergePageBoundaryParagraphs(chapters = []) {
  // Only merge unambiguous continuations; keep page provenance for each paragraph.
  return chapters.map(chapter => {
    const paragraphs = [];
    const paragraphMeta = [];
    for (let index = 0; index < (chapter.paragraphs || []).length; index += 1) {
      const value = String(chapter.paragraphs[index] || '');
      const meta = { ...(chapter.paragraphMeta?.[index] || {}) };
      const previous = paragraphs.at(-1) || '';
      const previousMeta = paragraphMeta.at(-1);
      const consecutivePages = Number.isInteger(previousMeta?.pageEnd)
        && Number.isInteger(meta.pageStart) && meta.pageStart === previousMeta.pageEnd + 1;
      const sameSection = (previousMeta?.sectionTitle || '') === (meta.sectionTitle || '');
      const join = consecutivePages && sameSection
        && !/[.!?]$/.test(previous)
        && /^[A-Za-zÀ-ÖØ-öø-ÿ,(]/.test(value)
        && !/^(?:capitolo|chapter|parte|sezione|section)\b/i.test(value);
      if (join) {
        paragraphs[paragraphs.length - 1] = /-$/.test(previous)
          ? previous.slice(0, -1) + value : previous + ' ' + value;
        previousMeta.pageEnd = meta.pageEnd ?? meta.pageStart;
      } else { paragraphs.push(value); paragraphMeta.push(meta); }
    }
    return { ...chapter, paragraphs, paragraphMeta };
  });
}

export function verifiedChapterStates(chapters = [], pages = [], totalPages = 0) {
  const byNumber = new Map(pages.filter(page => page && Number.isInteger(page.pageNumber)).map(page => [page.pageNumber, page]));
  return chapters.map((chapter, index) => {
    const start = Number(chapter.pageStart);
    const end = Number(chapter.pageEnd);
    let complete = Number.isInteger(start) && start >= 1
      && Number.isInteger(end) && end >= start && end <= totalPages;
    if (complete) for (let page = start; page <= end; page += 1) {
      if (byNumber.get(page)?.status !== 'verified') { complete = false; break; }
    }
    return { index, title: chapter.title, pageStart: start, pageEnd: end, status: complete ? 'verified' : 'pending' };
  });
}

export function requireIntegrityForStudy(source = {}) {
  const report = source?.integrity360;
  if (!report) return true; // Historic imported books retain their original behavior.
  if (!report.ready || report.issues?.some(issue => issue.severity === 'block')) {
    throw new Error('Libro non ancora verificato: completare o correggere le pagine segnalate prima di creare lo studio.');
  }
  return true;
}
