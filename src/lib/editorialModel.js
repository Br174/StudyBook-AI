import { filterGlossaryEntries } from './glossaryQuality.js';

export const EDITORIAL_MODEL_VERSION = 2;

function clean(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

export function editorialVariantLabel(variant = 'study') {
  if (variant === 'simple') return 'In parole semplici';
  if (variant === 'both') return 'Testo di studio + In parole semplici';
  return 'Testo di studio';
}

export function editorialParagraphText(paragraph, { variant = 'study', dsaMode = false } = {}) {
  if (!paragraph) return '';
  if (variant === 'simple') {
    return clean(paragraph.simpleSummary || paragraph.summary || paragraph.dsaSummary || paragraph.original);
  }
  const value = dsaMode
    ? (paragraph.dsaSummary || paragraph.summary)
    : (paragraph.summary || paragraph.dsaSummary);
  return clean(value || paragraph.original);
}

export function editorialGlossary(paragraphs = []) {
  const entries = paragraphs.flatMap((paragraph) => Array.isArray(paragraph?.glossary) ? paragraph.glossary : []);
  return filterGlossaryEntries(entries, { limit: 24 }).map((entry) => ({
    term: entry.term,
    definition: entry.definition,
    basis: entry?.basis || 'source',
    confidence: entry?.confidence ?? null,
  }));
}

export function buildEditorialDocument(book, options = {}) {
  const variant = options.variant || 'study';
  const dsaMode = Boolean(options.dsaMode);
  const variants = variant === 'both' ? ['study', 'simple'] : [variant];
  return {
    version: 1,
    variants: variants.map((variantId) => ({
      id: variantId,
      label: editorialVariantLabel(variantId),
      chapters: (book?.chapters || []).map((chapter, chapterIndex) => {
        let previousSection = '';
        const blocks = [];
        (chapter.paragraphs || []).forEach((paragraph, paragraphIndex) => {
          const section = clean(paragraph?.sourceSection);
          const sectionTitle = section && section !== previousSection ? section : '';
          if (sectionTitle) previousSection = sectionTitle;
          const text = editorialParagraphText(paragraph, { variant: variantId, dsaMode });
          if (!text) return;
          blocks.push({
            paragraphIndex,
            sectionTitle,
            text,
            glossary: editorialGlossary([paragraph]),
            sourcePageStart: paragraph?.sourcePageStart ?? null,
            sourcePageEnd: paragraph?.sourcePageEnd ?? null,
          });
        });
        return {
          chapterIndex,
          title: clean(chapter?.title) || `Capitolo ${chapterIndex + 1}`,
          blocks,
          glossary: editorialGlossary(chapter?.paragraphs || []),
        };
      }),
    })),
  };
}
