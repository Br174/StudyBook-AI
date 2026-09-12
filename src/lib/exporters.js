import { Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';
import { jsPDF } from 'jspdf';

function safeName(name = 'studybook') {
  return name.replace(/\.[^.]+$/, '').replace(/[^a-z0-9-_]+/gi, '_') || 'studybook';
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

export function exportTxt(book, fileName, dsaMode = false) {
  const lines = ['STUDYBOOK AI', ''];
  book.chapters.forEach((chapter) => {
    lines.push(chapter.title.toUpperCase(), '');
    chapter.paragraphs.forEach((item, index) => {
      lines.push(`${index + 1}. ${paragraphText(item, dsaMode)}`, '');
      if (item.remember?.length) lines.push('Da ricordare:', ...item.remember.map((value) => `- ${value}`), '');
    });
  });
  downloadBlob(new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' }), `${safeName(fileName)}_studybook.txt`);
}

export function exportJson(book, fileName) {
  downloadBlob(new Blob([JSON.stringify(book, null, 2)], { type: 'application/json' }), `${safeName(fileName)}_studybook.json`);
}

export function exportHtml(book, fileName, dsaMode = false) {
  const escapeHtml = (value) => String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  const chapters = book.chapters.map((chapter) => `
    <section>
      <h2>${escapeHtml(chapter.title)}</h2>
      ${chapter.paragraphs.map((item, index) => `
        <article>
          <h3>Paragrafo ${index + 1}</h3>
          <p>${escapeHtml(paragraphText(item, dsaMode)).replace(/\n/g, '<br>')}</p>
          ${item.keywords?.length ? `<p><strong>Parole chiave:</strong> ${item.keywords.map(escapeHtml).join(', ')}</p>` : ''}
          ${item.remember?.length ? `<ul>${item.remember.map((v) => `<li>${escapeHtml(v)}</li>`).join('')}</ul>` : ''}
        </article>`).join('')}
    </section>`).join('');

  const html = `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>StudyBook AI</title><style>body{font-family:Arial,sans-serif;max-width:900px;margin:40px auto;padding:0 20px;line-height:1.65;color:#18202a}h1,h2{color:#111827}article{border-top:1px solid #ddd;padding:18px 0}ul{padding-left:22px}</style></head><body><h1>StudyBook AI</h1>${chapters}</body></html>`;
  downloadBlob(new Blob([html], { type: 'text/html;charset=utf-8' }), `${safeName(fileName)}_studybook.html`);
}

export function exportPdf(book, fileName, dsaMode = false) {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const margin = 16;
  const width = 210 - margin * 2;
  let y = 18;

  const addLines = (text, fontSize = 11, gap = 5.6, bold = false) => {
    pdf.setFontSize(fontSize);
    pdf.setFont('helvetica', bold ? 'bold' : 'normal');
    const lines = pdf.splitTextToSize(String(text || ''), width);
    lines.forEach((line) => {
      if (y > 280) { pdf.addPage(); y = 18; }
      pdf.text(line, margin, y);
      y += gap;
    });
  };

  addLines('StudyBook AI', 20, 8, true);
  y += 2;
  book.chapters.forEach((chapter) => {
    if (y > 260) { pdf.addPage(); y = 18; }
    addLines(chapter.title, 15, 7, true);
    y += 1;
    chapter.paragraphs.forEach((item, index) => {
      addLines(`Paragrafo ${index + 1}`, 10, 5, true);
      addLines(paragraphText(item, dsaMode), 10.5, 5.3, false);
      if (item.remember?.length) {
        addLines('Da ricordare', 9.5, 5, true);
        item.remember.forEach((value) => addLines(`• ${value}`, 9.5, 4.8, false));
      }
      y += 3;
    });
  });
  pdf.save(`${safeName(fileName)}_studybook.pdf`);
}

export async function exportDocx(book, fileName, dsaMode = false) {
  const children = [
    new Paragraph({ text: 'StudyBook AI', heading: HeadingLevel.TITLE }),
  ];

  book.chapters.forEach((chapter) => {
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
  });

  const doc = new Document({ sections: [{ children }] });
  const blob = await Packer.toBlob(doc);
  downloadBlob(blob, `${safeName(fileName)}_studybook.docx`);
}
