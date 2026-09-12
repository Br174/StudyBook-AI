import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import { jsPDF } from 'jspdf';
import { exportJson, exportTxt } from './exporters.js';

export { exportJson, exportTxt };

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

function paragraphText(item, dsaMode) {
  return dsaMode ? (item.dsaSummary || item.summary) : item.summary;
}

function glossaryEntries(item, placement) {
  return (Array.isArray(item?.glossary) ? item.glossary : [])
    .filter((entry) => entry?.term && entry?.definition && (!placement || entry.placement === placement));
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

function withInlineGlossary(text, item) {
  let output = String(text || '');
  glossaryEntries(item, 'inline').forEach((entry) => {
    const index = locateTerm(output, entry.term);
    if (index < 0) return;
    const insertAt = index + entry.term.length;
    const tail = output.slice(insertAt, insertAt + entry.definition.length + 8).toLocaleLowerCase('it-IT');
    if (tail.includes(entry.definition.toLocaleLowerCase('it-IT'))) return;
    output = `${output.slice(0, insertAt)} (${entry.definition})${output.slice(insertAt)}`;
  });
  return output;
}

function semanticTerms(item) {
  const values = [
    ...(Array.isArray(item?.keywords) ? item.keywords : []),
    ...glossaryEntries(item).map((entry) => entry.term),
  ];
  const seen = new Set();
  return values
    .map((value) => String(value || '').trim())
    .filter((value) => value.length >= 3)
    .filter((value) => {
      const key = value.toLocaleLowerCase('it-IT');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => b.length - a.length)
    .slice(0, 24);
}

function semanticSegments(text, item) {
  const source = String(text || '');
  const ranges = [];
  semanticTerms(item).forEach((term) => {
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
    if (selected.some((itemRange) => range.start < itemRange.end && range.end > itemRange.start)) continue;
    selected.push(range);
  }
  selected.sort((a, b) => a.start - b.start);

  if (!selected.length) return [{ text: source, bold: false }];
  const result = [];
  let cursor = 0;
  selected.forEach((range) => {
    if (range.start > cursor) result.push({ text: source.slice(cursor, range.start), bold: false });
    result.push({ text: source.slice(range.start, range.end), bold: true });
    cursor = range.end;
  });
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
      ? `<strong class="semantic-bold">${escapeHtml(segment.text)}</strong>`
      : escapeHtml(segment.text))
    .join('')
    .replace(/\n/g, '<br>');
}

function glossaryHtml(item) {
  const entries = glossaryEntries(item, 'side');
  if (!entries.length) return '';
  return `<aside class="glossary-side"><div class="glossary-title">GLOSSARIO</div>${entries.map((entry) => `
    <div class="glossary-entry"><strong>${escapeHtml(entry.term)}</strong><p>${escapeHtml(entry.definition)}</p></div>`).join('')}</aside>`;
}

function printableHtml(book, fileName, dsaMode = false) {
  const chapters = book.chapters.map((chapter, chapterIndex) => `
    <section class="chapter">
      <div class="chapter-kicker">CAPITOLO ${chapterIndex + 1}</div>
      <h2>${escapeHtml(chapter.title)}</h2>
      ${chapter.paragraphs.map((item, index) => {
        const sideGlossary = glossaryHtml(item);
        return `
        <article class="${sideGlossary ? 'with-glossary' : ''}">
          <div class="paragraph-main">
            <div class="paragraph-label">PARAGRAFO ${index + 1}</div>
            <p class="summary ${dsaMode ? 'dsa' : ''}">${semanticHtml(withInlineGlossary(paragraphText(item, dsaMode), item), item)}</p>
            ${item.keywords?.length ? `<p class="keywords"><strong>Parole chiave:</strong> ${item.keywords.map(escapeHtml).join(' · ')}</p>` : ''}
            ${item.keyPoints?.length ? `<div class="box"><strong>Punti chiave</strong><ul>${item.keyPoints.map((value) => `<li>${semanticHtml(value, item)}</li>`).join('')}</ul></div>` : ''}
            ${item.remember?.length ? `<div class="remember"><strong>Da ricordare</strong><ul>${item.remember.map((value) => `<li>${semanticHtml(value, item)}</li>`).join('')}</ul></div>` : ''}
          </div>
          ${sideGlossary}
        </article>`;
      }).join('')}
    </section>`).join('');

  const index = book.chapters.map((chapter, chapterIndex) => `<li>${chapterIndex + 1}. ${escapeHtml(chapter.title)}</li>`).join('');
  const title = escapeHtml(displayName(fileName));
  const mode = dsaMode ? 'Modalità DSA' : 'Studio';

  return `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} · StudyBook AI</title>
<style>
  @page { size: A4; margin: 17mm; }
  * { box-sizing: border-box; }
  body { margin: 0; color: #1f2937; font-family: Arial, Helvetica, sans-serif; line-height: 1.65; background: #fff; }
  .cover { min-height: 245mm; display: flex; flex-direction: column; justify-content: center; page-break-after: always; }
  .brand { font-weight: 800; letter-spacing: .14em; color: #2563eb; font-size: 12px; }
  .cover h1 { font-size: 34px; line-height: 1.08; margin: 16px 0 10px; color: #111827; }
  .cover p { color: #64748b; font-size: 16px; }
  .pill { display: inline-block; width: fit-content; margin-top: 22px; padding: 7px 12px; border-radius: 999px; background: #eff6ff; color: #1d4ed8; font-weight: 700; }
  .index { page-break-after: always; }
  .index h2 { font-size: 26px; margin-bottom: 18px; }
  .index li { margin: 8px 0; color: #475569; }
  .chapter { page-break-before: always; }
  .chapter-kicker, .paragraph-label { color: #2563eb; font-weight: 800; font-size: 11px; letter-spacing: .08em; }
  h2 { font-size: 25px; color: #111827; margin: 7px 0 20px; }
  article { break-inside: avoid; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid #e5e7eb; }
  article.with-glossary { display: grid; grid-template-columns: minmax(0, 1fr) 52mm; gap: 8mm; align-items: start; }
  .summary { margin: 9px 0 10px; }
  .summary.dsa { font-size: 17px; line-height: 1.9; letter-spacing: .01em; }
  .semantic-bold { font-weight: 800; color: #111827; }
  .keywords { color: #1d4ed8; font-size: 13px; }
  .box, .remember { border-radius: 10px; padding: 12px 14px; margin-top: 12px; }
  .box { background: #f8fafc; border: 1px solid #e2e8f0; }
  .remember { background: #fff7ed; border: 1px solid #fed7aa; }
  .box ul, .remember ul { margin: 7px 0 0; padding-left: 20px; }
  .glossary-side { padding: 10px 11px; border: 1px solid #c7d2fe; border-radius: 12px; background: #f8faff; break-inside: avoid; }
  .glossary-title { margin-bottom: 8px; color: #4338ca; font-size: 10px; font-weight: 900; letter-spacing: .11em; }
  .glossary-entry + .glossary-entry { margin-top: 10px; padding-top: 9px; border-top: 1px solid #e0e7ff; }
  .glossary-entry strong { color: #1e293b; font-size: 12px; }
  .glossary-entry p { margin: 3px 0 0; color: #475569; font-size: 11px; line-height: 1.45; }
  @media (max-width: 720px) {
    article.with-glossary { grid-template-columns: 1fr; gap: 12px; }
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
    <p>Libro di studio ricostruito dal contenuto sorgente.</p>
    <span class="pill">${mode}</span>
  </section>
  <section class="index">
    <h2>Indice</h2>
    <ol>${index}</ol>
  </section>
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
    try { printWindow.print(); } catch { /* Il documento resta aperto. */ }
  }, 450);
  return true;
}

function pdfGlossaryHeight(pdf, entries, width) {
  let height = 11;
  entries.forEach((entry) => {
    pdf.setFontSize(8.4);
    const termLines = pdf.splitTextToSize(entry.term, width - 8);
    pdf.setFontSize(7.9);
    const definitionLines = pdf.splitTextToSize(entry.definition, width - 8);
    height += termLines.length * 4.1 + definitionLines.length * 3.9 + 4;
  });
  return height + 3;
}

export async function exportPdf(book, fileName, dsaMode = false) {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;
  const bottomLimit = 276;
  let y = 24;

  const currentPage = () => pdf.getCurrentPageInfo().pageNumber;
  const ensureSpace = (needed = 18) => {
    if (y + needed > bottomLimit) {
      pdf.addPage();
      y = 24;
    }
  };

  const writeLines = (text, {
    size = 11,
    lineHeight = 5.7,
    bold = false,
    color = [31, 41, 55],
    indent = 0,
    width = contentWidth,
    gapAfter = 0,
  } = {}) => {
    pdf.setFontSize(size);
    pdf.setFont('helvetica', bold ? 'bold' : 'normal');
    pdf.setTextColor(...color);
    const lines = pdf.splitTextToSize(String(text || ''), width - indent);
    lines.forEach((line) => {
      ensureSpace(lineHeight + 2);
      pdf.text(line, margin + indent, y);
      y += lineHeight;
    });
    y += gapAfter;
  };

  const writeSemanticText = (text, item, {
    size = 10.8,
    lineHeight = 5.9,
    width = contentWidth,
    x = margin,
    gapAfter = 0,
  } = {}) => {
    pdf.setFontSize(size);
    const lines = pdf.splitTextToSize(String(text || ''), width);
    lines.forEach((line) => {
      ensureSpace(lineHeight + 2);
      let cursorX = x;
      semanticSegments(line, item).forEach((segment) => {
        pdf.setFont('helvetica', segment.bold ? 'bold' : 'normal');
        pdf.setTextColor(31, 41, 55);
        pdf.text(segment.text, cursorX, y);
        cursorX += pdf.getTextWidth(segment.text);
      });
      y += lineHeight;
    });
    y += gapAfter;
  };

  const drawGlossaryBox = (entries, x, boxY, width) => {
    const height = pdfGlossaryHeight(pdf, entries, width);
    pdf.setFillColor(248, 250, 255);
    pdf.setDrawColor(199, 210, 254);
    pdf.roundedRect(x, boxY, width, height, 3.5, 3.5, 'FD');
    let gy = boxY + 6;
    pdf.setTextColor(67, 56, 202);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7.5);
    pdf.text('GLOSSARIO', x + 4, gy);
    gy += 5;
    entries.forEach((entry) => {
      pdf.setTextColor(30, 41, 59);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8.4);
      const termLines = pdf.splitTextToSize(entry.term, width - 8);
      pdf.text(termLines, x + 4, gy);
      gy += termLines.length * 4.1;
      pdf.setTextColor(71, 85, 105);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7.9);
      const definitionLines = pdf.splitTextToSize(entry.definition, width - 8);
      pdf.text(definitionLines, x + 4, gy);
      gy += definitionLines.length * 3.9 + 4;
    });
    return height;
  };

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
  pdf.setFontSize(13);
  pdf.setTextColor(203, 213, 225);
  pdf.text('Libro di studio ricostruito dal contenuto sorgente', margin, coverY + 7);
  pdf.setFillColor(37, 99, 235);
  pdf.roundedRect(margin, coverY + 25, dsaMode ? 54 : 45, 13, 4, 4, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.text(dsaMode ? 'MODALITA DSA' : 'STUDIO', margin + 7, coverY + 33.5);

  pdf.addPage();
  y = 28;
  writeLines('Indice', { size: 21, bold: true, color: [17, 24, 39], lineHeight: 8, gapAfter: 4 });
  book.chapters.forEach((chapter, index) => writeLines(`${index + 1}. ${chapter.title}`, {
    size: 11,
    color: [71, 84, 103],
    lineHeight: 6,
    indent: 2,
  }));

  for (let chapterIndex = 0; chapterIndex < book.chapters.length; chapterIndex += 1) {
    const chapter = book.chapters[chapterIndex];
    pdf.addPage();
    y = 27;
    pdf.setFillColor(239, 246, 255);
    pdf.roundedRect(margin, 18, contentWidth, 24, 5, 5, 'F');
    pdf.setTextColor(37, 99, 235);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.text(`CAPITOLO ${chapterIndex + 1}`, margin + 7, 27);
    pdf.setTextColor(17, 24, 39);
    pdf.setFontSize(16);
    const chapterTitleLines = pdf.splitTextToSize(chapter.title, contentWidth - 14);
    pdf.text(chapterTitleLines, margin + 7, 35);
    y = 50 + Math.max(0, chapterTitleLines.length - 1) * 6;

    chapter.paragraphs.forEach((item, index) => {
      ensureSpace(24);
      pdf.setFillColor(17, 24, 39);
      pdf.roundedRect(margin, y - 5.5, 9, 9, 2.5, 2.5, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8.5);
      pdf.text(String(index + 1), margin + 4.5, y + .5, { align: 'center' });
      pdf.setTextColor(71, 84, 103);
      pdf.setFontSize(9);
      pdf.text('PARAGRAFO', margin + 13, y);
      y += 8;

      const summary = withInlineGlossary(paragraphText(item, dsaMode), item);
      const sideGlossary = glossaryEntries(item, 'side');
      const glossaryWidth = sideGlossary.length ? 54 : 0;
      const gap = sideGlossary.length ? 7 : 0;
      const leftWidth = contentWidth - glossaryWidth - gap;
      const startY = y;
      const startPage = currentPage();
      let boxHeight = 0;
      let useSide = false;

      if (sideGlossary.length) {
        boxHeight = pdfGlossaryHeight(pdf, sideGlossary, glossaryWidth);
        useSide = boxHeight <= 122;
        if (useSide) ensureSpace(Math.min(125, Math.max(20, boxHeight + 2)));
      }

      if (useSide) {
        drawGlossaryBox(sideGlossary, margin + leftWidth + gap, y - 2, glossaryWidth);
      }

      writeSemanticText(summary, item, {
        size: dsaMode ? 11.4 : 10.8,
        lineHeight: dsaMode ? 6.6 : 5.9,
        width: useSide ? leftWidth : contentWidth,
        gapAfter: 2,
      });

      if (useSide && currentPage() === startPage) y = Math.max(y, startY + boxHeight + 3);
      if (!useSide && sideGlossary.length) {
        ensureSpace(Math.min(110, pdfGlossaryHeight(pdf, sideGlossary, contentWidth)) + 5);
        boxHeight = drawGlossaryBox(sideGlossary, margin, y, contentWidth);
        y += boxHeight + 5;
      }

      if (item.keywords?.length) {
        writeLines(`Parole chiave: ${item.keywords.join(' · ')}`, {
          size: 9.3,
          lineHeight: 5.2,
          bold: true,
          color: [37, 99, 235],
          gapAfter: 2,
        });
      }

      if (item.keyPoints?.length) {
        ensureSpace(16);
        writeLines('Punti chiave', { size: 9.7, bold: true, color: [17, 24, 39], lineHeight: 5.2 });
        item.keyPoints.forEach((value) => writeSemanticText(`- ${value}`, item, {
          size: 9.7,
          lineHeight: 5.2,
          width: contentWidth - 3,
          x: margin + 3,
        }));
      }

      if (item.remember?.length) {
        ensureSpace(16);
        writeLines('Da ricordare', { size: 9.7, bold: true, color: [154, 52, 18], lineHeight: 5.2 });
        item.remember.forEach((value) => writeSemanticText(`- ${value}`, item, {
          size: 9.7,
          lineHeight: 5.2,
          width: contentWidth - 3,
          x: margin + 3,
        }));
      }
      y += 6;
    });
  }

  const pages = pdf.getNumberOfPages();
  for (let pageNumber = 2; pageNumber <= pages; pageNumber += 1) {
    pdf.setPage(pageNumber);
    pdf.setDrawColor(226, 232, 240);
    pdf.line(margin, 286, pageWidth - margin, 286);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8.5);
    pdf.setTextColor(148, 163, 184);
    pdf.text('StudyBook AI', margin, 291.5);
    pdf.text(`${pageNumber - 1}`, pageWidth - margin, 291.5, { align: 'right' });
  }

  pdf.save(`${safeName(fileName)}_studybook.pdf`);
}

function docxSemanticRuns(text, item) {
  const lines = String(text || '').split('\n');
  const runs = [];
  lines.forEach((line, lineIndex) => {
    const segments = semanticSegments(line, item);
    segments.forEach((segment, segmentIndex) => {
      runs.push(new TextRun({
        text: segment.text,
        bold: segment.bold,
        break: lineIndex > 0 && segmentIndex === 0 ? 1 : 0,
      }));
    });
  });
  return runs.length ? runs : [new TextRun('')];
}

function docxGlossaryCell(item) {
  const entries = glossaryEntries(item, 'side');
  if (!entries.length) return null;
  const children = [new Paragraph({ children: [new TextRun({ text: 'GLOSSARIO', bold: true })] })];
  entries.forEach((entry) => {
    children.push(new Paragraph({
      children: [
        new TextRun({ text: `${entry.term}: `, bold: true }),
        new TextRun(entry.definition),
      ],
      spacing: { after: 80 },
    }));
  });
  return new TableCell({
    width: { size: 30, type: WidthType.PERCENTAGE },
    shading: { fill: 'F8FAFF' },
    children,
  });
}

export async function exportDocx(book, fileName, dsaMode = false) {
  const children = [new Paragraph({ text: 'StudyBook AI', heading: HeadingLevel.TITLE })];

  book.chapters.forEach((chapter) => {
    children.push(new Paragraph({ text: chapter.title, heading: HeadingLevel.HEADING_1 }));
    chapter.paragraphs.forEach((item, index) => {
      children.push(new Paragraph({
        children: [new TextRun({ text: `Paragrafo ${index + 1}`, bold: true })],
      }));

      const summaryParagraph = new Paragraph({
        children: docxSemanticRuns(withInlineGlossary(paragraphText(item, dsaMode), item), item),
        spacing: { after: 100 },
      });
      const glossaryCell = docxGlossaryCell(item);
      if (glossaryCell) {
        children.push(new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [new TableRow({
            children: [
              new TableCell({ width: { size: 70, type: WidthType.PERCENTAGE }, children: [summaryParagraph] }),
              glossaryCell,
            ],
          })],
        }));
      } else {
        children.push(summaryParagraph);
      }

      if (item.keywords?.length) {
        children.push(new Paragraph({
          children: [
            new TextRun({ text: 'Parole chiave: ', bold: true }),
            ...docxSemanticRuns(item.keywords.join(' · '), item),
          ],
        }));
      }
      if (item.keyPoints?.length) {
        children.push(new Paragraph({ children: [new TextRun({ text: 'Punti chiave', bold: true })] }));
        item.keyPoints.forEach((value) => children.push(new Paragraph({
          children: docxSemanticRuns(value, item),
          bullet: { level: 0 },
        })));
      }
      if (item.remember?.length) {
        children.push(new Paragraph({ children: [new TextRun({ text: 'Da ricordare', bold: true })] }));
        item.remember.forEach((value) => children.push(new Paragraph({
          children: docxSemanticRuns(value, item),
          bullet: { level: 0 },
        })));
      }
    });
  });

  const doc = new Document({ sections: [{ children }] });
  const blob = await Packer.toBlob(doc);
  downloadBlob(blob, `${safeName(fileName)}_studybook.docx`);
}
