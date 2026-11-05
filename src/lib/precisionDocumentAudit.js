// Non-destructive precision audit for imported books and OCR output.
// Warnings are evidence for review, never a reason to remove source content.
function clean(value) { return String(value || '').replace(/\s+/g, ' ').trim(); }
export function auditDocumentStructure(document = {}) {
  const pages = Array.isArray(document.pages) ? document.pages : [];
  const chapters = Array.isArray(document.chapters) ? document.chapters : [];
  const warnings = [];
  let previousPage = 0;
  let scannedPages = 0;
  for (const [index, page] of pages.entries()) {
    const number = Number(page.pageNumber || index + 1);
    const text = clean(page.text);
    if (number <= previousPage) warnings.push({ type: 'page-order', page: number, message: 'Sequenza delle pagine da verificare.' });
    if (previousPage && number > previousPage + 1) warnings.push({ type: 'page-gap', page: number, message: 'Mancano pagine nella sequenza numerica.' });
    if (text.includes('\uFFFD') || /(?:[|•_]\s*){6,}/.test(text)) warnings.push({ type: 'ocr-symbols', page: number, message: 'Possibili caratteri non riconosciuti.' });
    if (text.length > 0 && text.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ]/g, '').length < Math.max(6, text.length * .12))
      warnings.push({ type: 'ocr-noise', page: number, message: 'Testo con proporzione anomala di simboli o numeri.' });
    if (page.source === 'ocr') scannedPages += 1;
    previousPage = number;
  }
  let previousEnd = 0;
  for (const [chapterIndex, chapter] of chapters.entries()) {
    const title = clean(chapter.title);
    const paragraphs = chapter.paragraphs || [];
    if (!title || /^(?:capitolo|sezione|paragrafo)\s*\d+\s*$/i.test(title))
      warnings.push({ type: 'generic-heading', chapterIndex, message: 'Titolo generico: verificare il contesto del capitolo.' });
    if (!paragraphs.length && !(chapter.sections || []).length)
      warnings.push({ type: 'empty-chapter', chapterIndex, message: 'Capitolo senza testo rilevato.' });
    const start = Number(chapter.pageStart || 0);
    const end = Number(chapter.pageEnd || start || 0);
    if (start && previousEnd && start < previousEnd)
      warnings.push({ type: 'chapter-overlap', chapterIndex, message: 'Intervalli di pagina dei capitoli sovrapposti.' });
    if (start && end && end < start)
      warnings.push({ type: 'chapter-range', chapterIndex, message: 'Intervallo di pagine invertito.' });
    previousEnd = Math.max(previousEnd, end);
    for (const [paragraphIndex, paragraph] of paragraphs.entries()) {
      const original = typeof paragraph === 'string' ? paragraph : (paragraph.original || paragraph.text || '');
      if (clean(original).includes('\uFFFD'))
        warnings.push({ type: 'paragraph-ocr', chapterIndex, paragraphIndex, message: 'Possibili errori nel paragrafo acquisito.' });
    }
  }
  return {
    pagesChecked: pages.length, chaptersChecked: chapters.length, scannedPages,
    warningCount: warnings.length, warnings: warnings.slice(0, 120),
    state: warnings.length ? 'needs-review' : 'no-anomalies-detected',
    // Lack of detected anomalies is NOT a semantic correctness certificate.
    certifiedCorrect: false,
  };
}
