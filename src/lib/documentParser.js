import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

const OCR_TEXT_THRESHOLD = 80;

function cleanText(text) {
  return String(text || '')
    .replace(/\u00ad/g, '')
    .replace(/([A-Za-zÀ-ÖØ-öø-ÿ])\-\n([A-Za-zÀ-ÖØ-öø-ÿ])/g, '$1$2')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizeRunningLine(value) {
  return String(value || '')
    .toLocaleLowerCase('it-IT')
    .replace(/\b\d+\b/g, '#')
    .replace(/\s+/g, ' ')
    .trim();
}

function classifyHeading(line) {
  const value = String(line || '').trim();
  if (!value || value.length > 120) return null;
  if (/^(?:pag(?:ina)?\.?\s*)?\d{1,4}$/i.test(value)) return null;
  if (/^[•·\-–—_]+$/.test(value)) return null;

  if (/^(parte|libro|unità|unita)\s+[\divxlcdm]+\b/i.test(value)) {
    return { level: 1, title: value, kind: 'part' };
  }
  if (/^(capitolo|chapter)\s+[\divxlcdm]+\b/i.test(value)) {
    return { level: 1, title: value, kind: 'chapter' };
  }
  if (/^(sezione|section|paragrafo)\s+[\divxlcdm]+\b/i.test(value)) {
    return { level: 2, title: value, kind: 'section' };
  }

  const numbered = value.match(/^(\d+(?:\.\d+){0,4})[.)]?\s+(.+)$/);
  if (numbered) {
    const depth = numbered[1].split('.').length;
    return { level: Math.min(3, depth), title: value, kind: 'numbered' };
  }

  const roman = value.match(/^([IVXLCDM]{1,8})[.)]\s+(.+)$/i);
  if (roman) return { level: 1, title: value, kind: 'roman' };

  const words = value.split(/\s+/).filter(Boolean);
  const upper = /^[A-ZÀ-ÖØ-Ý0-9][A-ZÀ-ÖØ-Ý0-9 '\-–—,:()]+$/.test(value);
  if (upper && value.length <= 76 && words.length <= 10 && !/[.!?]$/.test(value)) {
    return { level: 1, title: value, kind: 'uppercase' };
  }

  return null;
}

function looksLikeHeading(line) {
  return Boolean(classifyHeading(line));
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

function stripRepeatedRunningLines(pages) {
  if (!Array.isArray(pages) || pages.length < 3) {
    return { pages: pages || [], removedRunningLines: [] };
  }

  const counts = new Map();
  const threshold = Math.max(3, Math.ceil(pages.length * 0.3));

  pages.forEach((page) => {
    const lines = cleanText(page.text).split('\n').map((line) => line.trim()).filter(Boolean);
    const edge = [...lines.slice(0, 2), ...lines.slice(-2)];
    const seen = new Set();
    edge.forEach((line) => {
      const key = normalizeRunningLine(line);
      if (!key || key.length > 100 || seen.has(key)) return;
      seen.add(key);
      counts.set(key, (counts.get(key) || 0) + 1);
    });
  });

  const repeated = new Set(
    [...counts.entries()]
      .filter(([key, count]) => count >= threshold && (key.length >= 3 || key === '#'))
      .map(([key]) => key),
  );

  const cleanedPages = pages.map((page) => {
    const lines = cleanText(page.text).split('\n');
    const lastIndex = lines.length - 1;
    const filtered = lines.filter((line, index) => {
      const atEdge = index <= 1 || index >= lastIndex - 1;
      if (!atEdge) return true;
      const key = normalizeRunningLine(line);
      if (/^(?:pag(?:ina)?\.?\s*)?\d{1,4}$/i.test(line.trim())) return false;
      return !repeated.has(key);
    });
    return { ...page, text: cleanText(filtered.join('\n')) };
  });

  return {
    pages: cleanedPages,
    removedRunningLines: [...repeated].filter((line) => line !== '#'),
  };
}

function addParagraphs(chapter, text, pageNumber, section) {
  const paragraphs = splitIntoParagraphs(text);
  paragraphs.forEach((paragraph) => {
    chapter.paragraphs.push(paragraph);
    chapter.paragraphMeta.push({
      pageStart: Number.isFinite(pageNumber) ? pageNumber : null,
      pageEnd: Number.isFinite(pageNumber) ? pageNumber : null,
      sectionTitle: section?.title || null,
      sectionLevel: section?.level || null,
    });
  });
}

function finalizeStructure(chapters) {
  chapters.forEach((chapter, chapterIndex) => {
    const pages = chapter.paragraphMeta
      .flatMap((meta) => [meta.pageStart, meta.pageEnd])
      .filter(Number.isFinite);

    if (pages.length) {
      chapter.pageStart = chapter.pageStart ?? Math.min(...pages);
      chapter.pageEnd = Math.max(...pages);
    } else if (chapter.pageStart == null) {
      chapter.pageStart = null;
      chapter.pageEnd = null;
    }

    chapter.sections.forEach((section, sectionIndex) => {
      const nextSection = chapter.sections[sectionIndex + 1];
      section.pageEnd = nextSection?.pageStart
        ? Math.max(section.pageStart, nextSection.pageStart - 1)
        : chapter.pageEnd;
    });

    if (chapterIndex < chapters.length - 1 && chapter.pageEnd == null) {
      const nextStart = chapters[chapterIndex + 1].pageStart;
      if (Number.isFinite(nextStart)) chapter.pageEnd = Math.max(chapter.pageStart || 1, nextStart - 1);
    }
  });

  return chapters.filter((chapter) => chapter.paragraphs.length || chapter.sections.length);
}

function buildStructureFromPages(pages, { trackPages = true } = {}) {
  const normalizedPages = (pages || []).map((page, index) => ({
    pageNumber: trackPages ? (page.pageNumber || index + 1) : null,
    text: cleanText(page.text),
    source: page.source || 'text',
  }));

  const headingLevels = [];
  normalizedPages.forEach((page) => {
    page.text.split('\n').forEach((line) => {
      const heading = classifyHeading(line);
      if (heading) headingLevels.push(heading.level);
    });
  });
  const rootLevel = headingLevels.length ? Math.min(...headingLevels) : null;

  if (rootLevel == null) {
    const fullText = normalizedPages.map((page) => page.text).filter(Boolean).join('\n\n');
    return [{
      title: 'Documento',
      pageStart: trackPages && normalizedPages.length ? normalizedPages[0].pageNumber : null,
      pageEnd: trackPages && normalizedPages.length ? normalizedPages.at(-1).pageNumber : null,
      sections: [],
      paragraphs: splitIntoParagraphs(fullText),
      paragraphMeta: splitIntoParagraphs(fullText).map(() => ({
        pageStart: null,
        pageEnd: null,
        sectionTitle: null,
        sectionLevel: null,
      })),
    }];
  }

  const chapters = [];
  let currentChapter = null;
  let currentSection = null;

  const ensureChapter = (pageNumber, title = 'Introduzione') => {
    if (!currentChapter) {
      currentChapter = {
        title,
        pageStart: Number.isFinite(pageNumber) ? pageNumber : null,
        pageEnd: Number.isFinite(pageNumber) ? pageNumber : null,
        sections: [],
        paragraphs: [],
        paragraphMeta: [],
      };
      chapters.push(currentChapter);
    }
    return currentChapter;
  };

  normalizedPages.forEach((page) => {
    const lines = page.text.split('\n');
    let buffer = [];

    const flush = () => {
      const body = cleanText(buffer.join('\n'));
      buffer = [];
      if (!body) return;
      const chapter = ensureChapter(page.pageNumber, chapters.length ? 'Documento' : 'Introduzione');
      addParagraphs(chapter, body, page.pageNumber, currentSection);
      if (Number.isFinite(page.pageNumber)) chapter.pageEnd = page.pageNumber;
    };

    lines.forEach((line) => {
      const heading = classifyHeading(line);
      if (!heading) {
        buffer.push(line);
        return;
      }

      flush();

      if (heading.level === rootLevel) {
        currentChapter = {
          title: heading.title,
          pageStart: Number.isFinite(page.pageNumber) ? page.pageNumber : null,
          pageEnd: Number.isFinite(page.pageNumber) ? page.pageNumber : null,
          sections: [],
          paragraphs: [],
          paragraphMeta: [],
        };
        chapters.push(currentChapter);
        currentSection = null;
      } else {
        const chapter = ensureChapter(page.pageNumber, 'Documento');
        currentSection = {
          title: heading.title,
          level: Math.max(2, heading.level - rootLevel + 1),
          pageStart: Number.isFinite(page.pageNumber) ? page.pageNumber : null,
          pageEnd: Number.isFinite(page.pageNumber) ? page.pageNumber : null,
        };
        chapter.sections.push(currentSection);
      }
    });

    flush();
  });

  const finalized = finalizeStructure(chapters);
  if (finalized.length) return finalized;

  const fullText = normalizedPages.map((page) => page.text).filter(Boolean).join('\n\n');
  return [{
    title: 'Documento',
    pageStart: trackPages && normalizedPages.length ? normalizedPages[0].pageNumber : null,
    pageEnd: trackPages && normalizedPages.length ? normalizedPages.at(-1).pageNumber : null,
    sections: [],
    paragraphs: splitIntoParagraphs(fullText),
    paragraphMeta: [],
  }];
}

export function detectChapters(text) {
  return buildStructureFromPages([{ pageNumber: null, text }], { trackPages: false });
}

export function detectChaptersFromPages(pages) {
  return buildStructureFromPages(pages, { trackPages: true });
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

function structureStats(chapters, pageCount) {
  return {
    pageCount,
    chapterCount: chapters.length,
    sectionCount: chapters.reduce((total, chapter) => total + (chapter.sections?.length || 0), 0),
    paragraphCount: chapters.reduce((total, chapter) => total + chapter.paragraphs.length, 0),
  };
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

  const cleaned = stripRepeatedRunningLines(pages);
  const cleanedPages = cleaned.pages;
  const fullText = cleanedPages.map((page) => page.text).filter(Boolean).join('\n\n');
  const chapters = detectChaptersFromPages(cleanedPages);
  onProgress?.({ phase: 'complete', done: pdf.numPages, total: pdf.numPages });

  return {
    fullText,
    pages: cleanedPages,
    chapters,
    needsOcr: ocrFailures,
    ocrApplied,
    removedRunningLines: cleaned.removedRunningLines,
    structure: structureStats(chapters, pdf.numPages),
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
    const pages = [{ pageNumber: 1, text: fullText, source: 'ocr' }];
    const chapters = detectChaptersFromPages(pages);
    return {
      fullText,
      pages,
      chapters,
      needsOcr: [],
      ocrApplied: [1],
      removedRunningLines: [],
      structure: structureStats(chapters, 1),
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
    const chapters = detectChapters(fullText);
    return {
      fullText,
      pages: [],
      chapters,
      needsOcr: [],
      ocrApplied: [],
      removedRunningLines: [],
      structure: structureStats(chapters, 0),
    };
  }
  if (/\.(png|jpe?g|webp)$/i.test(name)) return extractImage(file, options);
  throw new Error('Formato non ancora supportato. Usa PDF, TXT, PNG, JPG o WEBP.');
}
