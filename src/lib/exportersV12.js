import { jsPDF } from 'jspdf';

function safeName(name = 'studybook') {
  return name.replace(/\.[^.]+$/, '').replace(/[^a-z0-9-_]+/gi, '_') || 'studybook';
}

function displayName(name = 'StudyBook') {
  return name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() || 'StudyBook';
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function flowText(item, dsaMode = false) {
  const value = dsaMode ? (item?.dsaSummary || item?.summary) : (item?.summary || item?.dsaSummary);
  return String(value || item?.original || '').replace(/\s+/g, ' ').trim();
}

function glossaryEntries(item) {
  const seen = new Set();
  const output = [];
  for (const entry of Array.isArray(item?.glossary) ? item.glossary : []) {
    const term = String(entry?.term || '').trim();
    const definition = String(entry?.definition || '').replace(/\s+/g, ' ').trim();
    if (!term || !definition) continue;
    const key = term.toLocaleLowerCase('it-IT');
    if (seen.has(key)) continue;
    seen.add(key);
    output.push({ term, definition });
  }
  return output;
}

function chapterGlossary(chapter = {}) {
  const seen = new Set();
  const output = [];
  for (const item of chapter.paragraphs || []) {
    for (const entry of glossaryEntries(item)) {
      const key = entry.term.toLocaleLowerCase('it-IT');
      if (seen.has(key)) continue;
      seen.add(key);
      output.push(entry);
    }
  }
  return output.slice(0, 40);
}

function isWordChar(value) {
  return Boolean(value && /[\p{L}\p{N}]/u.test(value));
}

function locateTerm(text, term, start = 0) {
  const source = String(text || '');
  const needle = String(term || '').trim();
  if (!needle) return -1;
  const lower = source.toLocaleLowerCase('it-IT');
  const wanted = needle.toLocaleLowerCase('it-IT');
  let index = lower.indexOf(wanted, start);
  while (index >= 0) {
    const before = source[index - 1] || '';
    const after = source[index + needle.length] || '';
    if (!isWordChar(before) && !isWordChar(after)) return index;
    index = lower.indexOf(wanted, index + 1);
  }
  return -1;
}

function semanticSegments(text, item) {
  const source = String(text || '');
  const terms = glossaryEntries(item).map((entry) => entry.term).sort((a, b) => b.length - a.length);
  if (!terms.length) return [{ text: source, bold: false }];

  const ranges = [];
  terms.forEach((term) => {
    let cursor = 0;
    while (cursor < source.length) {
      const index = locateTerm(source, term, cursor);
      if (index < 0) break;
      ranges.push({ start: index, end: index + term.length });
      cursor = index + term.length;
    }
  });
  ranges.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));

  const selected = [];
  for (const range of ranges) {
    if (selected.some((existing) => range.start < existing.end && range.end > existing.start)) continue;
    selected.push(range);
  }
  selected.sort((a, b) => a.start - b.start);
  if (!selected.length) return [{ text: source, bold: false }];

  const result = [];
  let cursor = 0;
  for (const range of selected) {
    if (range.start > cursor) result.push({ text: source.slice(cursor, range.start), bold: false });
    result.push({ text: source.slice(range.start, range.end), bold: true });
    cursor = range.end;
  }
  if (cursor < source.length) result.push({ text: source.slice(cursor), bold: false });
  return result;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function semanticHtml(text, item) {
  return semanticSegments(text, item)
    .map((segment) => segment.bold
      ? `<strong class="technical-term">${escapeHtml(segment.text)}</strong>`
      : escapeHtml(segment.text))
    .join('');
}

function sectionTitle(item, previous) {
  const current = String(item?.sourceSection || '').replace(/\s+/g, ' ').trim();
  if (!current || current === previous) return '';
  return current;
}

function printableHtml(book, fileName, dsaMode = false) {
  const chapters = (book?.chapters || []).map((chapter, chapterIndex) => {
    let previousSection = '';
    const body = (chapter.paragraphs || []).map((item) => {
      const heading = sectionTitle(item, previousSection);
      if (heading) previousSection = heading;
      return `
        <section class="flow-block">
          ${heading ? `<h3>${escapeHtml(heading)}</h3>` : ''}
          <p>${semanticHtml(flowText(item, dsaMode), item)}</p>
        </section>`;
    }).join('');

    const glossary = chapterGlossary(chapter);
    const glossaryHtml = glossary.length
      ? glossary.map((entry) => `<div class="term-entry"><strong>${escapeHtml(entry.term)}</strong><span>${escapeHtml(entry.definition)}</span></div>`).join('')
      : '<div class="term-empty">Nessun termine specialistico da spiegare.</div>';

    return `
      <section class="chapter">
        <header class="chapter-head">
          <small>CAPITOLO ${chapterIndex + 1}</small>
          <h2>${escapeHtml(chapter.title)}</h2>
        </header>
        <div class="chapter-layout">
          <div class="chapter-text">${body}</div>
          <aside class="terminology"><div class="terminology-title">TERMINOLOGIA</div>${glossaryHtml}</aside>
        </div>
      </section>`;
  }).join('');

  const index = (book?.chapters || []).map((chapter, index) => `<li>${index + 1}. ${escapeHtml(chapter.title)}</li>`).join('');
  const title = escapeHtml(displayName(fileName));

  return `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} · StudyBook AI</title>
<style>
  @page { size: A4; margin: 17mm; }
  * { box-sizing: border-box; }
  body { margin: 0; color: #1f2937; font-family: Arial, Helvetica, sans-serif; line-height: 1.72; background: #fff; }
  .cover { min-height: 245mm; display: flex; flex-direction: column; justify-content: center; page-break-after: always; }
  .brand { font-weight: 800; letter-spacing: .14em; color: #2563eb; font-size: 12px; }
  .cover h1 { font-size: 34px; line-height: 1.08; margin: 16px 0 10px; color: #111827; }
  .cover p { color: #64748b; font-size: 16px; }
  .index { page-break-after: always; }
  .index h2 { font-size: 26px; margin-bottom: 18px; }
  .index li { margin: 8px 0; color: #475569; }
  .chapter { page-break-before: always; }
  .chapter-head { margin-bottom: 16px; }
  .chapter-head small { color: #2563eb; font-weight: 800; font-size: 10px; letter-spacing: .08em; }
  .chapter-head h2 { margin: 4px 0 0; color: #111827; font-size: 25px; line-height: 1.18; }
  .chapter-layout { display: grid; grid-template-columns: minmax(0, 1fr) 42mm; gap: 7mm; align-items: start; }
  .chapter-text { min-width: 0; }
  .flow-block { margin: 0 0 1.05em; break-inside: auto; }
  .flow-block h3 { margin: 1.05em 0 .35em; color: #475569; font-size: 11px; line-height: 1.3; letter-spacing: .03em; text-transform: uppercase; }
  .flow-block p { margin: 0; font-size: 11.2pt; text-align: left; }
  .technical-term { color: #111827; font-weight: 800; }
  .terminology { border-left: 1.5px solid #dbeafe; padding-left: 5mm; min-height: 210mm; }
  .terminology-title { margin-bottom: 10px; color: #2563eb; font-size: 8.5px; font-weight: 900; letter-spacing: .11em; }
  .term-entry { margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px solid #eef2f7; }
  .term-entry:last-child { border-bottom: 0; }
  .term-entry strong, .term-entry span { display: block; }
  .term-entry strong { color: #1f2937; font-size: 9px; line-height: 1.25; }
  .term-entry span, .term-empty { margin-top: 2px; color: #64748b; font-size: 8.2px; line-height: 1.35; }
  @media (max-width: 720px) {
    .chapter-layout { grid-template-columns: minmax(0, 1fr) 112px; gap: 12px; }
    .terminology { padding-left: 10px; }
  }
  @media print {
    body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
  }
</style>
</head>
<body>
  <section class="cover">
    <div class="brand">STUDYBOOK AI</div>
    <h1>${title}</h1>
    <p>Versione di studio continua e alleggerita, ricostruita nell’ordine del libro.</p>
  </section>
  <section class="index"><h2>Indice</h2><ol>${index}</ol></section>
  ${chapters}
</body>
</html>`;
}

export function exportHtml(book, fileName, dsaMode = false) {
  const html = printableHtml(book, fileName, dsaMode);
  downloadBlob(new Blob([html], { type: 'text/html;charset=utf-8' }), `${safeName(fileName)}_studybook.html`);
}

export function printStudyBook(book, fileName, dsaMode = false) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    void exportPdf(book, fileName, dsaMode);
    return false;
  }
  try { printWindow.opener = null; } catch { /* noop */ }
  printWindow.document.open();
  printWindow.document.write(printableHtml(book, fileName, dsaMode));
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    try { printWindow.print(); } catch { /* noop */ }
  }, 450);
  return true;
}

export async function exportPdf(book, fileName, dsaMode = false) {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;
  const sideWidth = 42;
  const gap = 7;
  const mainWidth = contentWidth - sideWidth - gap;
  const sideX = margin + mainWidth + gap;
  const dividerX = sideX - gap / 2;
  const bottomLimit = 277;
  let y = 24;
  let readingPage = false;

  function drawReadingFrame() {
    pdf.setDrawColor(219, 234, 254);
    pdf.setLineWidth(0.45);
    pdf.line(dividerX, 20, dividerX, 279);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7.2);
    pdf.setTextColor(37, 99, 235);
    pdf.text('TERMINOLOGIA', sideX, 25);
  }

  function addReadingPage() {
    pdf.addPage();
    y = 28;
    readingPage = true;
    drawReadingFrame();
  }

  function ensureSpace(needed = 18) {
    if (y + needed <= bottomLimit) return;
    addReadingPage();
  }

  function writeSimple(text, { size = 11, bold = false, color = [31, 41, 55], lineHeight = 5.7, width = mainWidth, gapAfter = 0 } = {}) {
    pdf.setFontSize(size);
    pdf.setFont('helvetica', bold ? 'bold' : 'normal');
    pdf.setTextColor(...color);
    const lines = pdf.splitTextToSize(String(text || ''), width);
    for (const line of lines) {
      ensureSpace(lineHeight + 2);
      pdf.text(line, margin, y);
      y += lineHeight;
    }
    y += gapAfter;
  }

  function writeSemanticLines(lines, item, { size = 10.9, lineHeight = 6.1, gapAfter = 0 } = {}) {
    pdf.setFontSize(size);
    for (const line of lines) {
      ensureSpace(lineHeight + 2);
      let cursorX = margin;
      for (const segment of semanticSegments(line, item)) {
        pdf.setFont('helvetica', segment.bold ? 'bold' : 'normal');
        pdf.setTextColor(31, 41, 55);
        pdf.text(segment.text, cursorX, y);
        cursorX += pdf.getTextWidth(segment.text);
      }
      y += lineHeight;
    }
    y += gapAfter;
  }

  function glossaryHeight(entries) {
    let height = 0;
    entries.forEach((entry) => {
      pdf.setFontSize(8.1);
      const termLines = pdf.splitTextToSize(entry.term, sideWidth);
      pdf.setFontSize(7.6);
      const defLines = pdf.splitTextToSize(entry.definition, sideWidth);
      height += termLines.length * 4 + defLines.length * 3.7 + 5;
    });
    return height;
  }

  function drawGlossary(entries, startY) {
    let gy = Math.max(31, startY);
    for (const entry of entries) {
      if (gy > bottomLimit - 14) break;
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8.1);
      pdf.setTextColor(31, 41, 55);
      const termLines = pdf.splitTextToSize(entry.term, sideWidth);
      pdf.text(termLines, sideX, gy);
      gy += termLines.length * 4;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7.6);
      pdf.setTextColor(100, 116, 139);
      const defLines = pdf.splitTextToSize(entry.definition, sideWidth);
      pdf.text(defLines, sideX, gy);
      gy += defLines.length * 3.7 + 5;
    }
    return gy;
  }

  // Copertina
  pdf.setFillColor(17, 24, 39);
  pdf.rect(0, 0, pageWidth, pageHeight, 'F');
  pdf.setTextColor(143, 182, 255);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.text('STUDYBOOK AI', margin, 34);
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(28);
  const coverTitle = pdf.splitTextToSize(displayName(fileName), 165);
  let coverY = 62;
  coverTitle.forEach((line) => {
    pdf.text(line, margin, coverY);
    coverY += 12;
  });
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(12.5);
  pdf.setTextColor(203, 213, 225);
  pdf.text('Testo di studio continuo · glossario laterale', margin, coverY + 8);

  // Indice
  pdf.addPage();
  readingPage = false;
  y = 28;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(21);
  pdf.setTextColor(17, 24, 39);
  pdf.text('Indice', margin, y);
  y += 12;
  (book?.chapters || []).forEach((chapter, index) => {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(11);
    pdf.setTextColor(71, 85, 105);
    const lines = pdf.splitTextToSize(`${index + 1}. ${chapter.title}`, contentWidth);
    lines.forEach((line) => {
      if (y > 278) {
        pdf.addPage();
        y = 28;
      }
      pdf.text(line, margin, y);
      y += 6;
    });
    y += 2;
  });

  for (let chapterIndex = 0; chapterIndex < (book?.chapters || []).length; chapterIndex += 1) {
    const chapter = book.chapters[chapterIndex];
    addReadingPage();

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8.8);
    pdf.setTextColor(37, 99, 235);
    pdf.text(`CAPITOLO ${chapterIndex + 1}`, margin, y);
    y += 7;
    pdf.setFontSize(16.5);
    pdf.setTextColor(17, 24, 39);
    const titleLines = pdf.splitTextToSize(chapter.title, mainWidth);
    pdf.text(titleLines, margin, y);
    y += titleLines.length * 6.6 + 7;

    let previousSection = '';
    for (const item of chapter.paragraphs || []) {
      const heading = sectionTitle(item, previousSection);
      if (heading) previousSection = heading;
      const text = flowText(item, dsaMode);
      if (!text) continue;
      const entries = glossaryEntries(item);

      pdf.setFontSize(10.9);
      const lines = pdf.splitTextToSize(text, mainWidth);
      const textHeight = lines.length * 6.1;
      const sideHeight = glossaryHeight(entries);
      const blockHeight = Math.max(Math.min(textHeight, 90), Math.min(sideHeight, 90)) + (heading ? 8 : 0) + 7;
      ensureSpace(Math.min(blockHeight, 105));

      if (heading) {
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(8.5);
        pdf.setTextColor(100, 116, 139);
        const headingLines = pdf.splitTextToSize(heading.toUpperCase(), mainWidth);
        pdf.text(headingLines, margin, y);
        y += headingLines.length * 4.3 + 3;
      }

      const startY = y;
      if (entries.length) drawGlossary(entries, startY);
      writeSemanticLines(lines, item, { size: 10.9, lineHeight: 6.1, gapAfter: 4.5 });
    }
  }

  const pages = pdf.getNumberOfPages();
  for (let pageNumber = 2; pageNumber <= pages; pageNumber += 1) {
    pdf.setPage(pageNumber);
    pdf.setDrawColor(226, 232, 240);
    pdf.setLineWidth(0.2);
    pdf.line(margin, 286, pageWidth - margin, 286);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8.2);
    pdf.setTextColor(148, 163, 184);
    pdf.text('StudyBook AI', margin, 291.5);
    pdf.text(`${pageNumber - 1}`, pageWidth - margin, 291.5, { align: 'right' });
  }

  // Evita warning per variabile usata solo come stato di layout durante il rendering.
  void readingPage;
  pdf.save(`${safeName(fileName)}_studybook.pdf`);
}
