import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

function cleanText(text) {
  return text
    .replace(/\u00ad/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function looksLikeHeading(line) {
  const value = line.trim();
  if (!value || value.length > 120) return false;
  return /^(capitolo|chapter)\s+[\divxlcdm]+\b/i.test(value)
    || /^\d+(?:\.\d+)*[.)]?\s+\S+/.test(value)
    || (/^[A-ZÀ-ÖØ-Ý0-9][A-ZÀ-ÖØ-Ý0-9 '\-–—,:]{4,}$/.test(value) && value.length < 80);
}

export function splitIntoParagraphs(text) {
  const cleaned = cleanText(text);
  const raw = cleaned.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const out = [];

  for (const block of raw) {
    if (block.length <= 1400) {
      out.push(block);
      continue;
    }
    const sentences = block.split(/(?<=[.!?])\s+(?=[A-ZÀ-ÖØ-Ý])/);
    let current = '';
    for (const sentence of sentences) {
      if ((current + ' ' + sentence).trim().length > 1200 && current) {
        out.push(current.trim());
        current = sentence;
      } else {
        current = `${current} ${sentence}`.trim();
      }
    }
    if (current) out.push(current.trim());
  }
  return out;
}

export function detectChapters(text) {
  const lines = cleanText(text).split('\n');
  const headings = [];
  lines.forEach((line, index) => {
    if (looksLikeHeading(line)) headings.push({ index, title: line.trim() });
  });

  if (!headings.length) {
    return [{ title: 'Documento', paragraphs: splitIntoParagraphs(text) }];
  }

  const chapters = [];
  headings.forEach((heading, i) => {
    const start = heading.index + 1;
    const end = headings[i + 1]?.index ?? lines.length;
    const body = lines.slice(start, end).join('\n').trim();
    chapters.push({
      title: heading.title,
      paragraphs: splitIntoParagraphs(body),
    });
  });
  return chapters.filter((chapter) => chapter.paragraphs.length > 0);
}

export async function extractPdf(file) {
  const data = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const pages = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items.map((item) => item.str).join(' ');
    pages.push({ pageNumber, text: cleanText(text) });
  }

  const fullText = pages.map((page) => page.text).join('\n\n');
  return {
    fullText,
    pages,
    chapters: detectChapters(fullText),
    needsOcr: pages.filter((page) => page.text.replace(/\s/g, '').length < 80).map((page) => page.pageNumber),
  };
}

export async function readSourceFile(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith('.pdf')) return extractPdf(file);
  if (name.endsWith('.txt')) {
    const fullText = cleanText(await file.text());
    return { fullText, pages: [], chapters: detectChapters(fullText), needsOcr: [] };
  }
  throw new Error('Formato non ancora supportato. Usa PDF o TXT in questa prima versione.');
}
