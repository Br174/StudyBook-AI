import * as pdfjsLib from 'pdfjs-dist';
import {
  detectChapters as detectV10Chapters,
  detectChaptersFromPages as detectV10ChaptersFromPages,
  readSourceFile as readV10SourceFile,
} from './documentParserV10.js';
import {
  applyOcrCache,
  loadOcrPages,
  makeOcrSignature,
  purgeOldOcrPages,
  saveOcrPage,
} from './ocrResumeStore.js';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

const OCR_TEXT_THRESHOLD = 80;

function cleanText(value) {
  return String(value || '')
    .replace(/\u00ad/g, '')
    .replace(/([A-Za-zÀ-ÖØ-öø-ÿ])-\n([A-Za-zÀ-ÖØ-öø-ÿ])/g, '$1$2')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function needsOcr(text) {
  return cleanText(text).replace(/\s/g, '').length < OCR_TEXT_THRESHOLD;
}

function isPdf(file) {
  return file?.type === 'application/pdf' || /\.pdf$/i.test(file?.name || '');
}

function normalizeRunningLine(value) {
  return String(value || '')
    .toLocaleLowerCase('it-IT')
    .replace(/\b\d+\b/g, '#')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripRepeatedEdges(inputPages = []) {
  if (inputPages.length < 3) return inputPages;
  const counts = new Map();
  const threshold = Math.max(3, Math.ceil(inputPages.length * 0.3));

  inputPages.forEach((page) => {
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

  return inputPages.map((page) => {
    const lines = cleanText(page.text).split('\n');
    const lastIndex = lines.length - 1;
    const filtered = lines.filter((line, index) => {
      const atEdge = index <= 1 || index >= lastIndex - 1;
      if (!atEdge) return true;
      if (/^(?:pag(?:ina)?\.?\s*)?\d{1,4}$/i.test(line.trim())) return false;
      return !repeated.has(normalizeRunningLine(line));
    });
    return { ...page, text: cleanText(filtered.join('\n')) };
  });
}

async function createOcrWorker(onProgress, getPageNumber) {
  const { createWorker } = await import('tesseract.js');
  return createWorker('ita+eng', undefined, {
    logger(message) {
      if (message?.status === 'recognizing text') {
        onProgress?.({
          phase: 'ocr-recognize',
          fraction: Number(message.progress || 0),
          pageNumber: getPageNumber?.() || null,
        });
      }
    },
  });
}

async function renderPdfPage(page, pageCount) {
  const scale = pageCount >= 400 ? 1.45 : pageCount >= 200 ? 1.55 : 1.7;
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { alpha: false });
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  await page.render({ canvasContext: context, viewport }).promise;
  return canvas;
}

async function applyResumablePdfOcr(file, parsed, { onProgress } = {}) {
  const originalPages = Array.isArray(parsed?.pages) ? parsed.pages : [];
  if (!originalPages.length) return parsed;

  const originalCandidates = originalPages.filter((page) => needsOcr(page.text)).map((page) => Number(page.pageNumber));
  if (!originalCandidates.length) {
    return {
      ...parsed,
      ocrResumed: [],
      structure: {
        ...(parsed.structure || {}),
        hierarchyEngine: 'v11',
        ocrCheckpoint: 'indexeddb-per-page',
        ocrResumedPages: 0,
        ocrNewPages: 0,
        ocrPendingPages: 0,
      },
    };
  }

  const signature = makeOcrSignature(file, originalPages.length);
  void purgeOldOcrPages();
  const cachedRecords = await loadOcrPages(signature);
  const resumed = applyOcrCache(originalPages, cachedRecords, originalCandidates);
  let pages = resumed.pages;
  const resumedPages = resumed.resumedPages;

  if (resumedPages.length) {
    onProgress?.({
      phase: 'ocr-resume',
      done: resumedPages.length,
      total: originalCandidates.length,
      resumed: resumedPages.length,
      resumedPages,
    });
  }

  const remaining = originalCandidates.filter((pageNumber) => {
    const page = pages.find((entry) => Number(entry.pageNumber) === pageNumber);
    return needsOcr(page?.text);
  });

  const applied = [];
  const failures = [];
  let pdf;
  let worker;
  let activePageNumber = null;

  try {
    if (remaining.length) {
      onProgress?.({ phase: 'ocr-loading', done: 0, total: remaining.length, resumed: resumedPages.length });
      const data = await file.arrayBuffer();
      pdf = await pdfjsLib.getDocument({ data }).promise;
      worker = await createOcrWorker(onProgress, () => activePageNumber);

      for (let index = 0; index < remaining.length; index += 1) {
        const pageNumber = remaining[index];
        activePageNumber = pageNumber;
        onProgress?.({
          phase: 'ocr-page',
          done: index,
          total: remaining.length,
          pageNumber,
          resumed: resumedPages.length,
        });

        let canvas;
        try {
          const pdfPage = await pdf.getPage(pageNumber);
          canvas = await renderPdfPage(pdfPage, pdf.numPages);
          const result = await worker.recognize(canvas);
          const ocrText = cleanText(result?.data?.text);
          const pageEntry = pages.find((entry) => Number(entry.pageNumber) === pageNumber);

          if (pageEntry && ocrText.length > cleanText(pageEntry.text).length) {
            pageEntry.text = ocrText;
            pageEntry.source = 'ocr';
            applied.push(pageNumber);
            await saveOcrPage(signature, pageNumber, ocrText);
          } else if (needsOcr(pageEntry?.text)) {
            failures.push(pageNumber);
          }
        } catch {
          failures.push(pageNumber);
        } finally {
          if (canvas) {
            canvas.width = 1;
            canvas.height = 1;
          }
        }

        onProgress?.({
          phase: 'ocr-page',
          done: index + 1,
          total: remaining.length,
          pageNumber,
          resumed: resumedPages.length,
        });
      }
    }
  } catch {
    remaining.forEach((pageNumber) => {
      const page = pages.find((entry) => Number(entry.pageNumber) === pageNumber);
      if (needsOcr(page?.text)) failures.push(pageNumber);
    });
  } finally {
    activePageNumber = null;
    if (worker) await worker.terminate().catch(() => {});
    try { pdf?.cleanup?.(); } catch { /* best effort */ }
    try { await pdf?.destroy?.(); } catch { /* best effort */ }
  }

  pages = stripRepeatedEdges(pages);
  const chapters = detectV10ChaptersFromPages(pages);
  const fullText = pages.map((page) => page.text).filter(Boolean).join('\n\n');
  const pending = originalCandidates.filter((pageNumber) => {
    const page = pages.find((entry) => Number(entry.pageNumber) === pageNumber);
    return needsOcr(page?.text);
  });
  const allApplied = [...new Set([...(parsed.ocrApplied || []), ...resumedPages, ...applied])].sort((a, b) => a - b);

  return {
    ...parsed,
    fullText,
    pages,
    chapters,
    needsOcr: pending,
    ocrApplied: allApplied,
    ocrResumed: resumedPages,
    ocrCheckpointSignature: signature,
    structure: {
      ...(parsed.structure || {}),
      pageCount: pages.length,
      chapterCount: chapters.length,
      sectionCount: chapters.reduce((total, chapter) => total + (chapter.sections?.length || 0), 0),
      paragraphCount: chapters.reduce((total, chapter) => total + (chapter.paragraphs?.length || 0), 0),
      hierarchyEngine: 'v11',
      ocrCheckpoint: 'indexeddb-per-page',
      ocrCandidatePages: originalCandidates.length,
      ocrResumedPages: resumedPages.length,
      ocrNewPages: applied.length,
      ocrPendingPages: pending.length,
      ocrFailures: [...new Set(failures)].length,
    },
  };
}

export function detectChaptersFromPages(inputPages = []) {
  return detectV10ChaptersFromPages(inputPages);
}

export function detectChapters(text = '') {
  return detectV10Chapters(text);
}

export async function readSourceFile(file, options = {}) {
  const { onProgress, autoOcr = true } = options;
  const pdfFile = isPdf(file);
  const base = await readV10SourceFile(file, {
    ...options,
    autoOcr: pdfFile ? false : autoOcr,
    onProgress(update) {
      if (pdfFile && autoOcr && update?.phase === 'complete') return;
      onProgress?.(update);
    },
  });

  if (!pdfFile || !autoOcr) return base;
  const parsed = await applyResumablePdfOcr(file, base, { onProgress });
  onProgress?.({ phase: 'complete', done: parsed.pages?.length || 0, total: parsed.pages?.length || 0 });
  return parsed;
}
