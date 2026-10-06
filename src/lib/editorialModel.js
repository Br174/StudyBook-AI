export const EDITORIAL_MODEL_VERSION = 1;

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
  const seen = new Set();
  const entries = [];
  for (const paragraph of paragraphs) {
    for (const entry of Array.isArray(paragraph?.glossary) ? paragraph.glossary : []) {
      const term = clean(entry?.term);
      const definition = clean(entry?.definition);
      const key = term.toLocaleLowerCase('it-IT');
      if (!term || !definition || seen.has(key)) continue;
      seen.add(key);
      entries.push({ term, definition, basis: entry?.basis || 'source' });
    }
  }
  return entries;
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
