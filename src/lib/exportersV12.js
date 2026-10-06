import { Capacitor } from '@capacitor/core';
import { deliverBlob } from './fileDelivery.js';
import { jsPDF } from 'jspdf';
import { buildEditorialDocument, editorialVariantLabel } from './editorialModel.js';

function safeName(name = 'studybook') {
  return name.replace(/\.[^.]+$/, '').replace(/[^a-z0-9-_]+/gi, '_') || 'studybook';
}

function displayName(name = 'StudyBook') {
  return name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() || 'StudyBook';
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function downloadBlob(blob, fileName) {
  void deliverBlob(blob, fileName);
}

function normalizeOptions(value = false) {
  if (typeof value === 'boolean') return { dsaMode: value, variant: 'study', accessibility: null };
  return {
    dsaMode: Boolean(value?.dsaMode),
    variant: ['study', 'simple', 'both'].includes(value?.variant) ? value.variant : 'study',
    accessibility: value?.accessibility || null,
  };
}

function printSettings(options) {
  const print = options?.accessibility?.enabled
    ? (options.accessibility.print || {})
    : {};
  const backgrounds = {
    white: '#ffffff',
    cream: '#fffdf2',
    blue: '#f4f8ff',
    gray: '#f5f5f7',
  };
  return {
    fontScale: Math.min(1.5, Math.max(.85, Number(print.fontScale || 1))),
    lineHeight: Math.min(2.2, Math.max(1.3, Number(print.lineHeight || 1.58))),
    marginScale: Math.min(1.4, Math.max(.85, Number(print.marginScale || 1))),
    letterSpacing: Number(print.letterSpacing || 0),
    wordSpacing: Number(print.wordSpacing || 0),
    background: backgrounds[print.background] || backgrounds.white,
  };
}

function glossaryHtml(entries = []) {
  if (!entries.length) return '<div class="term-empty">Nessun termine specialistico da spiegare.</div>';
  return entries.map((entry) => `
    <div class="term-entry">
      <strong>${escapeHtml(entry.term)}</strong>
      <span>${escapeHtml(entry.definition)}</span>
    </div>`).join('');
}

function printableHtml(book, fileName, rawOptions = false) {
  const options = normalizeOptions(rawOptions);
  const settings = printSettings(options);
  const doc = buildEditorialDocument(book, options);
  const title = escapeHtml(displayName(fileName));
  const index = (book?.chapters || []).map((chapter, index) => `<li>${index + 1}. ${escapeHtml(chapter.title)}</li>`).join('');

  const variants = doc.variants.map((variant, variantIndex) => {
    const chapters = variant.chapters.map((chapter) => {
      const blocks = chapter.blocks.map((block) => `
        <section class="flow-block">
          ${block.sectionTitle ? `<h3>${escapeHtml(block.sectionTitle)}</h3>` : ''}
          <p>${escapeHtml(block.text)}</p>
        </section>`).join('');
      return `
        <section class="chapter">
          <header class="chapter-head">
            <small>CAPITOLO ${chapter.chapterIndex + 1}</small>
            <h2>${escapeHtml(chapter.title)}</h2>
          </header>
          <div class="chapter-layout">
            <div class="chapter-text">${blocks}</div>
            <aside class="terminology">
              <div class="terminology-title">TERMINOLOGIA</div>
              ${glossaryHtml(chapter.glossary)}
            </aside>
          </div>
        </section>`;
    }).join('');

    return `
      ${doc.variants.length > 1 ? `<section class="variant-cover"><small>VERSIONE ${variantIndex + 1}</small><h2>${escapeHtml(variant.label)}</h2></section>` : ''}
      ${chapters}`;
  }).join('');

  const marginMm = 17 * settings.marginScale;
  const bodyPt = 11.2 * settings.fontScale;
  return `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} · StudyBook AI</title>
<style>
  @page { size: A4; margin: ${marginMm.toFixed(1)}mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0; color: #1f2937; font-family: Arial, Helvetica, sans-serif;
    line-height: ${settings.lineHeight}; letter-spacing: ${settings.letterSpacing}em;
    word-spacing: ${settings.wordSpacing}em; background: ${settings.background};
  }
  .cover,.variant-cover { min-height: 245mm; display:flex; flex-direction:column; justify-content:center; page-break-after:always; }
  .brand { font-weight:850; letter-spacing:.14em; color:#1677ea; font-size:12px; }
  .cover h1 { font-size:34px; line-height:1.08; margin:16px 0 10px; color:#111827; }
  .cover p,.variant-cover p { color:#64748b; font-size:15px; }
  .cover .edition { margin-top:20px; color:#1677ea; font-weight:800; }
  .index { page-break-after:always; }
  .index h2 { font-size:26px; margin-bottom:18px; }
  .index li { margin:8px 0; color:#475569; }
  .variant-cover small,.chapter-head small { color:#1677ea; font-weight:850; font-size:10px; letter-spacing:.1em; }
  .variant-cover h2 { margin:8px 0 0; font-size:30px; color:#111827; }
  .chapter { page-break-before:always; }
  .chapter-head { margin-bottom:16px; break-after:avoid; page-break-after:avoid; }
  .chapter-head h2 { margin:4px 0 0; color:#111827; font-size:25px; line-height:1.18; }
  .chapter-layout { display:grid; grid-template-columns:minmax(0,1fr) 42mm; gap:7mm; align-items:start; }
  .chapter-text { min-width:0; }
  .flow-block { margin:0 0 1.05em; orphans:3; widows:3; }
  .flow-block h3 { margin:1.05em 0 .35em; color:#475569; font-size:11px; line-height:1.3; break-after:avoid; page-break-after:avoid; }
  .flow-block p { margin:0; font-size:${bodyPt.toFixed(2)}pt; text-align:left; }
  .terminology { border-left:1.5px solid #dbeafe; padding-left:5mm; min-height:210mm; }
  .terminology-title { margin-bottom:10px; color:#1677ea; font-size:8.5px; font-weight:900; letter-spacing:.11em; }
  .term-entry { margin-bottom:10px; padding-bottom:8px; border-bottom:1px solid #eef2f7; break-inside:avoid; }
  .term-entry strong,.term-entry span { display:block; }
  .term-entry strong { color:#1f2937; font-size:9px; line-height:1.25; }
  .term-entry span,.term-empty { margin-top:2px; color:#64748b; font-size:8.2px; line-height:1.35; }
  @media(max-width:720px){.chapter-layout{grid-template-columns:minmax(0,1fr) 112px;gap:12px}.terminology{padding-left:10px}}
  @media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}
</style>
</head>
<body>
<section class="cover">
  <div class="brand">STUDYBOOK AI</div>
  <h1>${title}</h1>
  <p>Libro di studio continuo, ricostruito nell’ordine della fonte.</p>
  <div class="edition">${escapeHtml(editorialVariantLabel(options.variant))}</div>
</section>
<section class="index"><h2>Indice</h2><ol>${index}</ol></section>
${variants}
</body>
</html>`;
}

export function exportHtml(book, fileName, options = false) {
  const normalized = normalizeOptions(options);
  const html = printableHtml(book, fileName, normalized);
  const suffix = normalized.variant === 'simple' ? '_semplice' : normalized.variant === 'both' ? '_completo' : '_studio';
  downloadBlob(new Blob([html], { type: 'text/html;charset=utf-8' }), `${safeName(fileName)}${suffix}.html`);
}

export function printStudyBook(book, fileName, options = false) {
  const normalized = normalizeOptions(options);
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    void exportPdf(book, fileName, normalized);
    return false;
  }
  try { printWindow.opener = null; } catch { /* noop */ }
  printWindow.document.open();
  printWindow.document.write(printableHtml(book, fileName, normalized));
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    try { printWindow.print(); } catch { /* noop */ }
  }, 450);
  return true;
}

export async function exportPdf(book, fileName, rawOptions = false) {
  const options = normalizeOptions(rawOptions);
  const settings = printSettings(options);
  const editorial = buildEditorialDocument(book, options);
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = Math.min(24, Math.max(14, 18 * settings.marginScale));
  const contentWidth = pageWidth - margin * 2;
  const sideWidth = Math.min(43, Math.max(34, 40 * settings.marginScale));
  const gap = 7;
  const mainWidth = contentWidth - sideWidth - gap;
  const sideX = margin + mainWidth + gap;
  const dividerX = sideX - gap / 2;
  const bottomLimit = 279 - margin * .15;
  const bodySize = 10.9 * settings.fontScale;
  const lineHeight = 6.05 * (settings.lineHeight / 1.58) * Math.max(.94, settings.fontScale);
  let y = 24;

  function drawReadingFrame() {
    pdf.setDrawColor(219, 234, 254);
    pdf.setLineWidth(0.4);
    pdf.line(dividerX, 20, dividerX, 280);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7.2);
    pdf.setTextColor(22, 119, 234);
    pdf.text('TERMINOLOGIA', sideX, 25);
  }

  function addReadingPage() {
    pdf.addPage();
    y = 28;
    drawReadingFrame();
  }

  function ensureSpace(needed = 18) {
    if (y + needed > bottomLimit) addReadingPage();
  }

  function drawGlossary(entries = [], startY) {
    let gy = Math.max(31, startY);
    for (const entry of entries.slice(0, 4)) {
      if (gy > bottomLimit - 18) break;
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8.1);
      pdf.setTextColor(31, 41, 55);
      const term = pdf.splitTextToSize(entry.term, sideWidth);
      pdf.text(term, sideX, gy);
      gy += term.length * 4;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7.6);
      pdf.setTextColor(100, 116, 139);
      const definition = pdf.splitTextToSize(entry.definition, sideWidth);
      pdf.text(definition, sideX, gy);
      gy += definition.length * 3.7 + 5;
    }
  }

  function writeBlock(block) {
    const lines = pdf.splitTextToSize(block.text, mainWidth);
    const firstChunk = Math.min(lines.length, 3) * lineHeight;
    ensureSpace((block.sectionTitle ? 8 : 0) + firstChunk + 5);

    if (block.sectionTitle) {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8.5);
      pdf.setTextColor(100, 116, 139);
      const heading = pdf.splitTextToSize(block.sectionTitle.toUpperCase(), mainWidth);
      pdf.text(heading, margin, y);
      y += heading.length * 4.3 + 3;
    }

    drawGlossary(block.glossary, y);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(bodySize);
    pdf.setTextColor(31, 41, 55);
    for (const line of lines) {
      ensureSpace(lineHeight + 2);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(bodySize);
      pdf.setTextColor(31, 41, 55);
      pdf.text(line, margin, y);
      y += lineHeight;
    }
    y += Math.max(3.8, lineHeight * .55);
  }

  // Copertina
  pdf.setFillColor(248, 250, 253);
  pdf.rect(0, 0, pageWidth, pageHeight, 'F');
  pdf.setTextColor(22, 119, 234);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.text('STUDYBOOK AI', margin, 38);
  pdf.setTextColor(17, 24, 39);
  pdf.setFontSize(28);
  const coverTitle = pdf.splitTextToSize(displayName(fileName), 165);
  let coverY = 68;
  for (const line of coverTitle) {
    pdf.text(line, margin, coverY);
    coverY += 12;
  }
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(12.5);
  pdf.setTextColor(100, 116, 139);
  pdf.text(editorialVariantLabel(options.variant), margin, coverY + 9);

  // Indice
  pdf.addPage();
  y = 28;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(21);
  pdf.setTextColor(17, 24, 39);
  pdf.text('Indice', margin, y);
  y += 12;
  for (let index = 0; index < (book?.chapters || []).length; index += 1) {
    const chapter = book.chapters[index];
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(11);
    pdf.setTextColor(71, 85, 105);
    const lines = pdf.splitTextToSize(`${index + 1}. ${chapter.title}`, contentWidth);
    for (const line of lines) {
      if (y > 278) { pdf.addPage(); y = 28; }
      pdf.text(line, margin, y);
      y += 6;
    }
    y += 2;
  }

  for (let variantIndex = 0; variantIndex < editorial.variants.length; variantIndex += 1) {
    const variant = editorial.variants[variantIndex];
    if (editorial.variants.length > 1) {
      pdf.addPage();
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      pdf.setTextColor(22,119,234);
      pdf.text(`VERSIONE ${variantIndex + 1}`, margin, 45);
      pdf.setFontSize(25);
      pdf.setTextColor(17,24,39);
      pdf.text(variant.label, margin, 60);
    }

    for (const chapter of variant.chapters) {
      addReadingPage();
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8.8);
      pdf.setTextColor(22, 119, 234);
      pdf.text(`CAPITOLO ${chapter.chapterIndex + 1}`, margin, y);
      y += 7;
      pdf.setFontSize(16.5);
      pdf.setTextColor(17, 24, 39);
      const titleLines = pdf.splitTextToSize(chapter.title, mainWidth);
      pdf.text(titleLines, margin, y);
      y += titleLines.length * 6.6 + 7;
      for (const block of chapter.blocks) writeBlock(block);
    }
  }

  const pages = pdf.getNumberOfPages();
  for (let pageNumber = 2; pageNumber <= pages; pageNumber += 1) {
    pdf.setPage(pageNumber);
    pdf.setDrawColor(226, 232, 240);
    pdf.setLineWidth(.2);
    pdf.line(margin, 286, pageWidth - margin, 286);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8.2);
    pdf.setTextColor(148, 163, 184);
    pdf.text('StudyBook AI', margin, 291.5);
    pdf.text(String(pageNumber - 1), pageWidth - margin, 291.5, { align: 'right' });
  }

  const suffix = options.variant === 'simple' ? '_semplice' : options.variant === 'both' ? '_completo' : '_studio';
  if (Capacitor.isNativePlatform?.()) {
    const blob = pdf.output('blob');
    await deliverBlob(blob, `${safeName(fileName)}${suffix}.pdf`, 'Apri PDF StudyBook', { preferOpen: true });
  } else {
    pdf.save(`${safeName(fileName)}${suffix}.pdf`);
  }
}
