import {
  Document,
  HeadingLevel,
  ImageRun,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
} from 'docx';
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

function paragraphText(item, dsaMode) {
  return dsaMode ? (item.dsaSummary || item.summary) : item.summary;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function assetSourceLabel(asset) {
  if (Number.isFinite(asset?.sourcePage)) return `Fonte: pagina ${asset.sourcePage}`;
  if (asset?.sourcePart) return `Fonte: ${asset.sourcePart}`;
  return '';
}

function arrangeAssets(book) {
  const assets = Array.isArray(book?.sourceAssets) ? book.sourceAssets : [];
  const chapters = Array.isArray(book?.chapters) ? book.chapters : [];
  const partOwners = new Map();

  chapters.forEach((chapter, chapterIndex) => {
    const parts = new Set((chapter.paragraphs || []).map((item) => item.sourcePart).filter(Boolean));
    parts.forEach((part) => {
      const owners = partOwners.get(part) || new Set();
      owners.add(chapterIndex);
      partOwners.set(part, owners);
    });
  });

  const used = new Set();
  const perChapter = chapters.map((chapter, chapterIndex) => {
    const matched = [];
    assets.forEach((asset, assetIndex) => {
      if (used.has(assetIndex)) return;
      let belongs = false;
      if (Number.isFinite(asset?.sourcePage) && Number.isFinite(chapter?.pageStart)) {
        const end = Number.isFinite(chapter.pageEnd) ? chapter.pageEnd : chapter.pageStart;
        belongs = asset.sourcePage >= chapter.pageStart && asset.sourcePage <= end;
      }
      if (!belongs && asset?.sourcePart) {
        const owners = partOwners.get(asset.sourcePart);
        belongs = owners?.size === 1 && owners.has(chapterIndex);
      }
      if (belongs) {
        used.add(assetIndex);
        matched.push(asset);
      }
    });
    return matched;
  });

  const unmatched = assets.filter((_, index) => !used.has(index));
  return { perChapter, unmatched };
}

function assetHtml(asset, index) {
  const caption = escapeHtml(asset.name || (asset.type === 'table' ? `Tabella ${index + 1}` : `Immagine ${index + 1}`));
  const source = escapeHtml(assetSourceLabel(asset));
  if (asset.type === 'image' && asset.dataUrl) {
    return `<figure class="visual-asset"><img src="${asset.dataUrl}" alt="${escapeHtml(asset.alt || caption)}"><figcaption><strong>${caption}</strong>${source ? `<span>${source}</span>` : ''}</figcaption></figure>`;
  }
  if (asset.type === 'table' && asset.rows?.length) {
    const rows = asset.rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('');
    return `<figure class="visual-asset table-asset"><figcaption><strong>${caption}</strong>${source ? `<span>${source}</span>` : ''}</figcaption><div class="table-scroll"><table><tbody>${rows}</tbody></table></div></figure>`;
  }
  return '';
}

function visualSectionHtml(assets, title = 'Materiale visivo') {
  if (!assets?.length) return '';
  return `<section class="visual-section"><h3>${escapeHtml(title)}</h3><div class="visual-grid">${assets.map(assetHtml).join('')}</div></section>`;
}

function printableHtml(book, fileName, dsaMode = false) {
  const arranged = arrangeAssets(book);
  const chapters = book.chapters.map((chapter, chapterIndex) => `
    <section class="chapter">
      <div class="chapter-kicker">CAPITOLO ${chapterIndex + 1}</div>
      <h2>${escapeHtml(chapter.title)}</h2>
      ${chapter.paragraphs.map((item, index) => `
        <article>
          <div class="paragraph-label">PARAGRAFO ${index + 1}</div>
          <p class="summary ${dsaMode ? 'dsa' : ''}">${escapeHtml(paragraphText(item, dsaMode)).replace(/\n/g, '<br>')}</p>
          ${item.keywords?.length ? `<p class="keywords"><strong>Parole chiave:</strong> ${item.keywords.map(escapeHtml).join(' · ')}</p>` : ''}
          ${item.keyPoints?.length ? `<div class="box"><strong>Punti chiave</strong><ul>${item.keyPoints.map((v) => `<li>${escapeHtml(v)}</li>`).join('')}</ul></div>` : ''}
          ${item.remember?.length ? `<div class="remember"><strong>Da ricordare</strong><ul>${item.remember.map((v) => `<li>${escapeHtml(v)}</li>`).join('')}</ul></div>` : ''}
        </article>`).join('')}
      ${visualSectionHtml(arranged.perChapter[chapterIndex], 'Materiale visivo collegato')}
    </section>`).join('');

  const index = book.chapters.map((chapter, indexValue) => `<li>${indexValue + 1}. ${escapeHtml(chapter.title)}</li>`).join('');
  const title = escapeHtml(displayName(fileName));
  const mode = dsaMode ? 'Modalità DSA' : 'Studio';
  const unmatched = visualSectionHtml(arranged.unmatched, 'Materiale visivo aggiuntivo');

  return `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} · StudyBook AI</title>
<style>
  @page { size: A4; margin: 18mm; }
  * { box-sizing: border-box; }
  body { margin: 0; color: #1f2937; font-family: Arial, Helvetica, sans-serif; line-height: 1.65; background: #fff; }
  .cover { min-height: 245mm; display: flex; flex-direction: column; justify-content: center; page-break-after: always; }
  .brand { font-weight: 800; letter-spacing: .14em; color: #2563eb; font-size: 12px; }
  .cover h1 { font-size: 34px; line-height: 1.08; margin: 16px 0 10px; color: #111827; }
  .cover p { color: #64748b; font-size: 16px; }
  .pill { display: inline-block; width: fit-content; margin-top: 22px; padding: 7px 12px; border-radius: 999px; background: #eff6ff; color: #1d4ed8; font-weight: 700; }
  .index { page-break-after: always; }
  .index h2 { font-size: 26px; margin-bottom: 18px; }
  .index ol { padding-left: 22px; }
  .index li { margin: 8px 0; color: #475569; }
  .chapter { page-break-before: always; }
  .chapter-kicker, .paragraph-label { color: #2563eb; font-weight: 800; font-size: 11px; letter-spacing: .08em; }
  h2 { font-size: 25px; color: #111827; margin: 7px 0 20px; }
  article { break-inside: avoid; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid #e5e7eb; }
  .summary { margin: 9px 0 10px; }
  .summary.dsa { font-size: 17px; line-height: 1.9; letter-spacing: .01em; }
  .keywords { color: #1d4ed8; font-size: 13px; }
  .box, .remember { border-radius: 10px; padding: 12px 14px; margin-top: 12px; }
  .box { background: #f8fafc; border: 1px solid #e2e8f0; }
  .remember { background: #fff7ed; border: 1px solid #fed7aa; }
  .box ul, .remember ul { margin: 7px 0 0; padding-left: 20px; }
  .visual-section { margin-top: 28px; break-inside: auto; }
  .visual-section h3 { font-size: 18px; margin-bottom: 14px; }
  .visual-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .visual-asset { margin: 0; padding: 10px; border: 1px solid #e2e8f0; border-radius: 12px; break-inside: avoid; background: #fff; }
  .visual-asset img { display: block; width: 100%; height: auto; max-height: 118mm; object-fit: contain; background: #f8fafc; border-radius: 8px; }
  .visual-asset figcaption { display: flex; flex-direction: column; gap: 2px; margin-top: 8px; font-size: 11px; color: #64748b; }
  .visual-asset figcaption strong { color: #111827; }
  .table-scroll { overflow-x: auto; }
  .visual-asset table { width: 100%; border-collapse: collapse; font-size: 10px; }
  .visual-asset td { border: 1px solid #cbd5e1; padding: 5px; vertical-align: top; }
  @media print {
    body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    .visual-grid { grid-template-columns: 1fr; }
  }
</style>
</head>
<body>
  <section class="cover">
    <div class="brand">STUDYBOOK AI</div>
    <h1>${title}</h1>
    <p>Libro di studio ricostruito da testo, PDF, DOCX, EPUB o fotografie.</p>
    <span class="pill">${mode}</span>
  </section>
  <section class="index">
    <h2>Indice</h2>
    <ol>${index}</ol>
  </section>
  ${chapters}
  ${unmatched}
</body>
</html>`;
}

export function exportTxt(book, fileName, dsaMode = false) {
  const lines = ['STUDYBOOK AI', ''];
  book.chapters.forEach((chapter) => {
    lines.push(chapter.title.toUpperCase(), '');
    chapter.paragraphs.forEach((item, index) => {
      lines.push(`${index + 1}. ${paragraphText(item, dsaMode)}`, '');
      if (item.remember?.length) lines.push('Da ricordare:', ...item.remember.map((value) => `- ${value}`), '');
    });
  });
  if (book.sourceAssets?.length) {
    lines.push('MATERIALE VISIVO', '');
    book.sourceAssets.forEach((asset, index) => {
      lines.push(`${index + 1}. ${asset.name || asset.type || 'Elemento'}${assetSourceLabel(asset) ? ` · ${assetSourceLabel(asset)}` : ''}`);
    });
  }
  downloadBlob(new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' }), `${safeName(fileName)}_studybook.txt`);
}

export function exportJson(book, fileName) {
  downloadBlob(new Blob([JSON.stringify(book, null, 2)], { type: 'application/json' }), `${safeName(fileName)}_studybook.json`);
}

export function exportHtml(book, fileName, dsaMode = false) {
  const html = printableHtml(book, fileName, dsaMode);
  downloadBlob(new Blob([html], { type: 'text/html;charset=utf-8' }), `${safeName(fileName)}_studybook.html`);
}

export function printStudyBook(book, fileName, dsaMode = false) {
  const printWindow = window.open('', '_blank', 'noopener,noreferrer');
  if (!printWindow) {
    void exportPdf(book, fileName, dsaMode);
    return false;
  }

  printWindow.document.open();
  printWindow.document.write(printableHtml(book, fileName, dsaMode));
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    try {
      printWindow.print();
    } catch {
      // Il documento resta aperto e può essere stampato/condiviso dal browser.
    }
  }, 450);
  return true;
}

function loadImageSize(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth || image.width || 1, height: image.naturalHeight || image.height || 1 });
    image.onerror = () => reject(new Error('Immagine non leggibile'));
    image.src = dataUrl;
  });
}

function pdfImageFormat(asset) {
  const mime = String(asset?.mime || '').toLowerCase();
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'JPEG';
  if (mime.includes('png')) return 'PNG';
  if (mime.includes('webp')) return 'WEBP';
  return null;
}

function dataUrlToBytes(dataUrl) {
  const base64 = String(dataUrl || '').split(',')[1] || '';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function docxImageType(asset) {
  const mime = String(asset?.mime || '').toLowerCase();
  if (mime.includes('png')) return 'png';
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';
  if (mime.includes('gif')) return 'gif';
  if (mime.includes('bmp')) return 'bmp';
  if (mime.includes('svg')) return 'svg';
  return null;
}

export async function exportPdf(book, fileName, dsaMode = false) {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;
  const bottomLimit = 276;
  let y = 24;

  const ensureSpace = (needed = 18) => {
    if (y + needed > bottomLimit) {
      pdf.addPage();
      y = 24;
    }
  };

  const textLines = (text, size, width = contentWidth) => {
    pdf.setFontSize(size);
    return pdf.splitTextToSize(String(text || ''), width);
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

  const writeTable = (asset) => {
    const rows = (asset.rows || []).slice(0, 30);
    if (!rows.length) return;
    const columns = Math.max(1, Math.min(5, ...rows.map((row) => row.length)));
    const cellWidth = contentWidth / columns;
    rows.forEach((row) => {
      const cells = Array.from({ length: columns }, (_, index) => String(row[index] || ''));
      const wrapped = cells.map((cell) => pdf.splitTextToSize(cell, cellWidth - 4));
      const rowHeight = Math.max(8, Math.max(...wrapped.map((lines) => lines.length)) * 4.4 + 4);
      ensureSpace(rowHeight + 2);
      wrapped.forEach((lines, columnIndex) => {
        const x = margin + columnIndex * cellWidth;
        pdf.setDrawColor(203, 213, 225);
        pdf.rect(x, y, cellWidth, rowHeight);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8.3);
        pdf.setTextColor(51, 65, 85);
        pdf.text(lines, x + 2, y + 4.7);
      });
      y += rowHeight;
    });
    y += 5;
  };

  const writeAssets = async (assets, title = 'Materiale visivo') => {
    if (!assets?.length) return;
    ensureSpace(24);
    writeLines(title, { size: 14, bold: true, color: [17, 24, 39], lineHeight: 7, gapAfter: 2 });
    for (const asset of assets) {
      if (asset.type === 'table' && asset.rows?.length) {
        writeLines(asset.name || 'Tabella', { size: 10, bold: true, color: [37, 99, 235], lineHeight: 5.4 });
        if (assetSourceLabel(asset)) writeLines(assetSourceLabel(asset), { size: 8.5, color: [100, 116, 139], lineHeight: 4.6, gapAfter: 2 });
        writeTable(asset);
        continue;
      }
      if (asset.type === 'image' && asset.dataUrl) {
        const format = pdfImageFormat(asset);
        if (!format) continue;
        try {
          const size = await loadImageSize(asset.dataUrl);
          const maxWidth = contentWidth;
          const maxHeight = 150;
          const scale = Math.min(maxWidth / size.width, maxHeight / size.height, 1);
          const width = Math.max(28, size.width * scale);
          const height = Math.max(20, size.height * scale);
          ensureSpace(height + 20);
          pdf.addImage(asset.dataUrl, format, margin + (contentWidth - width) / 2, y, width, height, undefined, 'FAST');
          y += height + 5;
          writeLines(asset.name || 'Immagine', { size: 9.5, bold: true, color: [17, 24, 39], lineHeight: 5.2 });
          if (assetSourceLabel(asset)) writeLines(assetSourceLabel(asset), { size: 8.3, color: [100, 116, 139], lineHeight: 4.6, gapAfter: 4 });
        } catch {
          // Un'immagine non esportabile non deve interrompere il PDF.
        }
      }
    }
  };

  pdf.setFillColor(17, 24, 39);
  pdf.rect(0, 0, pageWidth, pageHeight, 'F');
  pdf.setTextColor(143, 182, 255);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.text('STUDYBOOK AI', margin, 34);

  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(28);
  const coverTitle = textLines(displayName(fileName), 28, 165);
  let coverY = 62;
  coverTitle.forEach((line) => {
    pdf.text(line, margin, coverY);
    coverY += 12;
  });

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(13);
  pdf.setTextColor(203, 213, 225);
  pdf.text('Libro di studio ricostruito', margin, coverY + 6);
  pdf.text('da testo, PDF, DOCX, EPUB o fotografia', margin, coverY + 14);

  pdf.setFillColor(37, 99, 235);
  pdf.roundedRect(margin, coverY + 30, dsaMode ? 54 : 45, 13, 4, 4, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.text(dsaMode ? 'MODALITA DSA' : 'STUDIO', margin + 7, coverY + 38.5);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9.5);
  pdf.setTextColor(148, 163, 184);
  const today = new Intl.DateTimeFormat('it-IT', { dateStyle: 'long' }).format(new Date());
  pdf.text(`Creato il ${today}`, margin, 268);
  pdf.text('Sintesi costruita dal contenuto sorgente del documento.', margin, 276);

  pdf.addPage();
  y = 28;
  writeLines('Indice', { size: 21, bold: true, color: [17, 24, 39], lineHeight: 8, gapAfter: 4 });
  book.chapters.forEach((chapter, index) => {
    writeLines(`${index + 1}. ${chapter.title}`, { size: 11, color: [71, 84, 103], lineHeight: 6, indent: 2 });
  });

  const arranged = arrangeAssets(book);

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

      writeLines(paragraphText(item, dsaMode), {
        size: dsaMode ? 11.4 : 10.8,
        lineHeight: dsaMode ? 6.6 : 5.9,
        color: [31, 41, 55],
        gapAfter: 2,
      });

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
        item.keyPoints.forEach((value) => writeLines(`- ${value}`, {
          size: 9.7,
          lineHeight: 5.2,
          color: [71, 84, 103],
          indent: 3,
          width: contentWidth - 3,
        }));
      }

      if (item.remember?.length) {
        ensureSpace(18);
        const rememberLines = item.remember.flatMap((value) => pdf.splitTextToSize(`- ${value}`, contentWidth - 14));
        const boxHeight = Math.min(54, 12 + rememberLines.length * 4.8);
        if (y + boxHeight > bottomLimit) {
          pdf.addPage();
          y = 24;
        }
        pdf.setFillColor(255, 247, 237);
        pdf.setDrawColor(254, 215, 170);
        pdf.roundedRect(margin, y - 2, contentWidth, boxHeight, 4, 4, 'FD');
        pdf.setTextColor(154, 52, 18);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(9.5);
        pdf.text('DA RICORDARE', margin + 7, y + 6);
        let boxY = y + 13;
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(124, 45, 18);
        item.remember.forEach((value) => {
          const lines = pdf.splitTextToSize(`- ${value}`, contentWidth - 14);
          lines.forEach((line) => {
            if (boxY < y + boxHeight - 3) pdf.text(line, margin + 7, boxY);
            boxY += 4.8;
          });
        });
        y += boxHeight + 5;
      } else {
        y += 5;
      }
    });

    await writeAssets(arranged.perChapter[chapterIndex], 'Materiale visivo collegato');
  }

  if (arranged.unmatched.length) {
    pdf.addPage();
    y = 28;
    await writeAssets(arranged.unmatched, 'Materiale visivo aggiuntivo');
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

async function docxAssetNodes(asset) {
  if (asset.type === 'table' && asset.rows?.length) {
    const rows = asset.rows.slice(0, 40).map((row) => new TableRow({
      children: row.slice(0, 8).map((cell) => new TableCell({
        children: [new Paragraph({ text: String(cell || '') })],
      })),
    }));
    return [
      new Paragraph({ children: [new TextRun({ text: asset.name || 'Tabella', bold: true })] }),
      new Table({ rows }),
      new Paragraph({ text: assetSourceLabel(asset) }),
    ];
  }

  if (asset.type === 'image' && asset.dataUrl) {
    const type = docxImageType(asset);
    if (!type) return [];
    try {
      const size = await loadImageSize(asset.dataUrl);
      const maxWidth = 560;
      const maxHeight = 420;
      const scale = Math.min(maxWidth / size.width, maxHeight / size.height, 1);
      const width = Math.max(120, Math.round(size.width * scale));
      const height = Math.max(80, Math.round(size.height * scale));
      return [
        new Paragraph({ children: [new TextRun({ text: asset.name || 'Immagine', bold: true })] }),
        new Paragraph({
          children: [new ImageRun({
            type,
            data: dataUrlToBytes(asset.dataUrl),
            transformation: { width, height },
          })],
        }),
        new Paragraph({ text: assetSourceLabel(asset) }),
      ];
    } catch {
      return [];
    }
  }
  return [];
}

export async function exportDocx(book, fileName, dsaMode = false) {
  const children = [
    new Paragraph({ text: 'StudyBook AI', heading: HeadingLevel.TITLE }),
  ];
  const arranged = arrangeAssets(book);

  for (let chapterIndex = 0; chapterIndex < book.chapters.length; chapterIndex += 1) {
    const chapter = book.chapters[chapterIndex];
    children.push(new Paragraph({ text: chapter.title, heading: HeadingLevel.HEADING_1 }));
    chapter.paragraphs.forEach((item, index) => {
      children.push(new Paragraph({
        children: [new TextRun({ text: `Paragrafo ${index + 1}`, bold: true })],
      }));
      children.push(new Paragraph({ text: paragraphText(item, dsaMode) }));
      if (item.keywords?.length) {
        children.push(new Paragraph({
          children: [
            new TextRun({ text: 'Parole chiave: ', bold: true }),
            new TextRun(item.keywords.join(', ')),
          ],
        }));
      }
      item.remember?.forEach((value) => children.push(new Paragraph({ text: value, bullet: { level: 0 } })));
    });

    if (arranged.perChapter[chapterIndex]?.length) {
      children.push(new Paragraph({ text: 'Materiale visivo collegato', heading: HeadingLevel.HEADING_2 }));
      for (const asset of arranged.perChapter[chapterIndex]) children.push(...await docxAssetNodes(asset));
    }
  }

  if (arranged.unmatched.length) {
    children.push(new Paragraph({ text: 'Materiale visivo aggiuntivo', heading: HeadingLevel.HEADING_1 }));
    for (const asset of arranged.unmatched) children.push(...await docxAssetNodes(asset));
  }

  const doc = new Document({ sections: [{ children }] });
  const blob = await Packer.toBlob(doc);
  downloadBlob(blob, `${safeName(fileName)}_studybook.docx`);
}
