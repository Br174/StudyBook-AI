import {
  detectChaptersFromPages as detectV09ChaptersFromPages,
  readSourceFile as readV09SourceFile,
} from './documentParserV09.js';

function clean(value) {
  return String(value || '').replace(/\u00ad/g, '').replace(/[ \t]+/g, ' ').trim();
}

function looksLikeIndexPage(text, pageNumber) {
  const lines = String(text || '').split('\n').map(clean).filter(Boolean);
  if (lines.length < 5) return false;
  const heading = lines.slice(0, 5).join(' ').toLocaleLowerCase('it-IT');
  const named = /\b(indice|sommario|contents)\b/.test(heading);
  const pageTailCount = lines.filter((line) => /(?:\.{2,}|\s{2,}|\t)\s*\d{1,4}$/.test(line) || /^\d+(?:\.\d+)*\s+.+\s+\d{1,4}$/.test(line)).length;
  const dense = pageTailCount >= Math.max(4, Math.ceil(lines.length * 0.35));
  return named || (Number(pageNumber || 0) <= 30 && dense);
}

function filterIndexPages(inputPages = []) {
  return inputPages.filter((page, index) => !looksLikeIndexPage(page?.text, page?.pageNumber || index + 1));
}

function stats(chapters, pageCount, skippedIndexPages = 0, previous = {}) {
  const sections = chapters.flatMap((chapter) => chapter.sections || []);
  return {
    ...previous,
    pageCount,
    chapterCount: chapters.length,
    sectionCount: sections.length,
    paragraphCount: chapters.reduce((total, chapter) => total + (chapter.paragraphs?.length || 0), 0),
    maxSectionDepth: sections.reduce((max, section) => Math.max(max, Number(section.level || 0)), 0),
    hierarchyEngine: 'v10',
    indexPagesSkipped: skippedIndexPages,
    textFirst: true,
  };
}

export function detectChaptersFromPages(inputPages = []) {
  const contentPages = filterIndexPages(inputPages);
  return detectV09ChaptersFromPages(contentPages);
}

export function detectChapters(text = '') {
  return detectChaptersFromPages([{ pageNumber: 1, text }]);
}

export async function readSourceFile(file, options = {}) {
  const parsed = await readV09SourceFile(file, options);
  const pages = Array.isArray(parsed?.pages) ? parsed.pages : [];

  if (!pages.length) {
    return {
      ...parsed,
      structure: {
        ...(parsed?.structure || {}),
        hierarchyEngine: 'v10',
        indexPagesSkipped: 0,
        textFirst: true,
      },
    };
  }

  const contentPages = filterIndexPages(pages);
  const chapters = detectV09ChaptersFromPages(contentPages);
  const skippedIndexPages = pages.length - contentPages.length;

  return {
    ...parsed,
    chapters,
    structure: stats(chapters, pages.length, skippedIndexPages, parsed?.structure || {}),
  };
}
