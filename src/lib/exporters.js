export { exportDocx } from './exportersV11.js';
export { exportHtml, exportPdf, printStudyBook } from './exportersV12.js';

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
  const value = dsaMode ? (item.dsaSummary || item.summary) : (item.summary || item.dsaSummary);
  return String(value || item.original || '').replace(/\s+/g, ' ').trim();
}

export function exportTxt(book, fileName, dsaMode = false) {
  const lines = ['STUDYBOOK AI', ''];
  book.chapters.forEach((chapter) => {
    lines.push(chapter.title.toUpperCase(), '');
    chapter.paragraphs.forEach((item) => {
      lines.push(paragraphText(item, dsaMode), '');
    });
    const glossary = [];
    const seen = new Set();
    chapter.paragraphs.forEach((item) => {
      (item.glossary || []).forEach((entry) => {
        const term = String(entry?.term || '').trim();
        const definition = String(entry?.definition || '').trim();
        const key = term.toLocaleLowerCase('it-IT');
        if (!term || !definition || seen.has(key)) return;
        seen.add(key);
        glossary.push(`- ${term}: ${definition}`);
      });
    });
    if (glossary.length) lines.push('TERMINOLOGIA', ...glossary, '');
  });
  downloadBlob(new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' }), `${safeName(fileName)}_studybook.txt`);
}

export function exportJson(book, fileName) {
  downloadBlob(new Blob([JSON.stringify(book, null, 2)], { type: 'application/json' }), `${safeName(fileName)}_studybook.json`);
}
