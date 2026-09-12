import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

const OCR_TEXT_THRESHOLD = 80;

function cleanText(text) {
  return String(text || '')
    .replace(/\u00ad/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function looksLikeHeading(line) {
  const value = line.trim();
  if (!value || value.length > 120) return false;
  return /^(capitolo|chapter)\s+[\divxlcdm]+\b/i.test(value)
    || /^(parte|sezione|unità|unita)\s+[\divxlcdm]+\b/i.test(value)
    || /^\d+(?:\.\d+)*[.)]?\s+\S+/.test(value)
    || (/^[A-ZÀ-ÖØ-Ý0-9][A-ZÀ-ÖØ-Ý0-9 '\-–—,:]{4,}$/.test(value) && value.length < 80);
}

function textFromPdfItems(items) {
  const lines = [];
  let current = '';
  let previousY = null;

  for (const item of items) {
    const value = String(item?.str || '').trim();
    if (!value) continue;
    const y = Array.isArray(item.transform) ? item.transform[5] : null;
    const startsNewLine = item.hasEOL
      || (previousY !== null && y !== null && Math.abs(y - previousY) > 2.5);

    if (startsNewLine && current.trim()) {
      lines.push(current.trim());
      current = value;
    } else {
      current = `${current} ${value}`.trim();
    }
    if (y !== null) previousY = y;
  }

  if (current.trim()) lines.push(current.trim());
  return cleanText(lines.join('\n'));
}

function needsOcr(text) {
  return cleanText(text).replace(/\s/g, '').length < OCR_TEXT_THRESHOLD;
}

export function splitIntoParagraphs(text) {
  const cleaned = cleanText(text);
  if (!cleaned) return [];

  let raw = cleaned.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  if (raw.length <= 1) {
    raw = cleaned
      .split(/(?<=[.!?])\s+(?=[A-ZÀ-ÖØ-Ý])/)
      .reduce((blocks, sentence) => {
        const last = blocks[blocks.length - 1] || '';
        if (!last || last.length > 700) blocks.push(sentence.trim());
        else blocks[blocks.length - 1] = `${last} ${sentence}`.trim();
        return blocks;
      }, []);
  }

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
  const preface = lines.slice(0, headings[0].index).join('\n').trim();
  if (preface && preface.length > 180) {
    chapters.push({ title: 'Introduzione', paragraphs: splitIntoParagraphs(preface) });
  }

  headings.forEach((heading, i) => {
    const start = heading.index + 1;
    const end = headings[i + 1]?.index ?? lines.length;
    const body = lines.slice(start, end).join('\n').trim();
    const paragraphs = splitIntoParagraphs(body);
    if (paragraphs.length) chapters.push({ title: heading.title, paragraphs });
  });

  return chapters.length ? chapters : [{ title: 'Documento', paragraphs: splitIntoParagraphs(text) }];
}

async function createOcrWorker(onProgress) {
  const { createWorker } = await import('tesseract.js');
  return createWorker('ita+eng', undefined, {
    logger(message) {
      if (message?.status === 'recognizing text') {
        onProgress?.({
          phase: 'ocr-recognize',
          fraction: Number(message.progress || 0),
        });
      }
    },
  });
}

async function renderPdfPage(page) {
  const viewport = page.getViewport({ scale: 1.8 });
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { alpha: false });
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  await page.render({ canvasContext: context, viewport }).promise;
  return canvas;
}

async function runPdfOcr(pdf, pages, candidateNumbers, onProgress) {
  if (!candidateNumbers.length) return { pages, applied: [], failures: [] };

  let worker;
  const applied = [];
  const failures = [];
  try {
    onProgress?.({ phase: 'ocr-loading', done: 0, total: candidateNumbers.length });
    worker = await createOcrWorker(onProgress);

    for (let index = 0; index < candidateNumbers.length; index += 1) {
      const pageNumber = candidateNumbers[index];
      onProgress?.({ phase: 'ocr-page', done: index, total: candidateNumbers.length, pageNumber });
      try {
        const page = await pdf.getPage(pageNumber);
        const canvas = await renderPdfPage(page);
        const result = await worker.recognize(canvas);
        const ocrText = cleanText(result?.data?.text);
        const pageEntry = pages.find((entry) => entry.pageNumber === pageNumber);
        if (pageEntry && ocrText.length > pageEntry.text.length) {
          pageEntry.text = ocrText;
          pageEntry.source = 'ocr';
          applied.push(pageNumber);
        } else if (needsOcr(pageEntry?.text)) {
          failures.push(pageNumber);
        }
        canvas.width = 1;
        canvas.height = 1;
      } catch {
        failures.push(pageNumber);
      }
      onProgress?.({ phase: 'ocr-page', done: index + 1, total: candidateNumbers.length, pageNumber });
    }
  } catch {
    return { pages, applied, failures: [...new Set([...failures, ...candidateNumbers])] };
  } finally {
    if (worker) await worker.terminate();
  }

  return { pages, applied, failures: [...new Set(failures)] };
}

export async function extractPdf(file, { onProgress, autoOcr = true } = {}) {
  const data = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const pages = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    onProgress?.({ phase: 'extract', done: pageNumber - 1, total: pdf.numPages, pageNumber });
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = textFromPdfItems(content.items);
    pages.push({ pageNumber, text, source: 'embedded' });
    onProgress?.({ phase: 'extract', done: pageNumber, total: pdf.numPages, pageNumber });
  }

  const candidates = pages.filter((page) => needsOcr(page.text)).map((page) => page.pageNumber);
  let ocrApplied = [];
  let ocrFailures = candidates;

  if (autoOcr && candidates.length) {
    const ocrResult = await runPdfOcr(pdf, pages, candidates, onProgress);
    ocrApplied = ocrResult.applied;
    ocrFailures = candidates.filter((pageNumber) => {
      const page = pages.find((entry) => entry.pageNumber === pageNumber);
      return needsOcr(page?.text);
    });
  }

  const fullText = pages.map((page) => page.text).filter(Boolean).join('\n\n');
  onProgress?.({ phase: 'complete', done: pdf.numPages, total: pdf.numPages });
  return {
    fullText,
    pages,
    chapters: detectChapters(fullText),
    needsOcr: ocrFailures,
    ocrApplied,
  };
}

async function extractImage(file, { onProgress } = {}) {
  let worker;
  try {
    onProgress?.({ phase: 'ocr-loading', done: 0, total: 1 });
    worker = await createOcrWorker(onProgress);
    onProgress?.({ phase: 'ocr-page', done: 0, total: 1, pageNumber: 1 });
    const result = await worker.recognize(file);
    const fullText = cleanText(result?.data?.text);
    if (!fullText) throw new Error('Non è stato possibile riconoscere testo nell’immagine.');
    onProgress?.({ phase: 'complete', done: 1, total: 1 });
    return {
      fullText,
      pages: [{ pageNumber: 1, text: fullText, source: 'ocr' }],
      chapters: detectChapters(fullText),
      needsOcr: [],
      ocrApplied: [1],
    };
  } finally {
    if (worker) await worker.terminate();
  }
}

export async function readSourceFile(file, options = {}) {
  const name = file.name.toLowerCase();
  if (name.endsWith('.pdf')) return extractPdf(file, options);
  if (name.endsWith('.txt')) {
    const fullText = cleanText(await file.text());
    return { fullText, pages: [], chapters: detectChapters(fullText), needsOcr: [], ocrApplied: [] };
  }
  if (/\.(png|jpe?g|webp)$/i.test(name)) return extractImage(file, options);
  throw new Error('Formato non ancora supportato. Usa PDF, TXT, PNG, JPG o WEBP.');
}
