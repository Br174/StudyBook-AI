export { exportDocx, exportHtml, exportPdf, printStudyBook } from './exportersV11.js';

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
      if (item.glossary?.length) {
        lines.push('Glossario:', ...item.glossary.map((entry) => `- ${entry.term}: ${entry.definition}`), '');
      }
      if (item.remember?.length) lines.push('Da ricordare:', ...item.remember.map((value) => `- ${value}`), '');
    });
  });
  downloadBlob(new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' }), `${safeName(fileName)}_studybook.txt`);
}

export function exportJson(book, fileName) {
  downloadBlob(new Blob([JSON.stringify(book, null, 2)], { type: 'application/json' }), `${safeName(fileName)}_studybook.json`);
}
