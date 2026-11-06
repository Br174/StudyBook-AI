// LAB31A-F: isolated PDF acquisition route. No second app/domain scheduler.
import * as pdfjsLib from 'pdfjs-dist';
import {
  INTEGRITY_ENGINE_VERSION, makeLogicalBlocks, choosePdfLanes,
  shouldThrottlePdfLanes, suspectText, auditIntegrityPages,
  joinOrderedPageText, mergePageBoundaryParagraphs, verifiedChapterStates,
} from './integrity360Core.js';
import { loadIntegrity360Pages, saveIntegrity360Page } from './ocrResumeStore.js';
import { detectChaptersFromPages } from './documentParserV10.js';
import { auditDocumentStructure } from './precisionDocumentAudit.js';
import { extractPdfVisualAssetsFromDocument } from './pdfVisuals.js';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

const INK_OPERATORS = new Set([
  pdfjsLib.OPS.constructPath, pdfjsLib.OPS.stroke, pdfjsLib.OPS.fill,
  pdfjsLib.OPS.eoFill, pdfjsLib.OPS.fillStroke,
].filter(Number.isFinite));

const IMAGE_OPERATORS = new Set([
  pdfjsLib.OPS.paintImageXObject,
  pdfjsLib.OPS.paintInlineImageXObject,
  pdfjsLib.OPS.paintJpegXObject,
  pdfjsLib.OPS.paintImageMaskXObject,
].filter(Number.isFinite));

function clean(value) {
  return String(value || '').replace(/\u00ad/g, '')
    .replace(/([A-Za-zÀ-ÖØ-öø-ÿ])-\n([A-Za-zÀ-ÖØ-öø-ÿ])/g, '$1$2')
    .replace(/[ \t]+\n/g, '\n').replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n').trim();
}

function pdfText(items = []) {
  const lines = [];
  let current = '';
  let lastY = null;
  for (const item of items) {
    const chunk = String(item?.str || '').trim();
    if (!chunk) continue;
    const y = Array.isArray(item.transform) ? item.transform[5] : null;
    const isNewLine = item.hasEOL || (lastY !== null && y !== null && Math.abs(y - lastY) > 2.5);
    if (isNewLine && current) { lines.push(current); current = chunk; }
    else current = (current + ' ' + chunk).trim();
    if (y !== null) lastY = y;
  }
  if (current) lines.push(current);
  return clean(lines.join('\n'));
}

function isOcrCandidate(text, imageCount, inkCount) {
  return (imageCount > 0 || (!text.trim() && inkCount > 3))
    && (text.replace(/\s/g, '').length < 90 || suspectText(text));
}

async function readNativePage(pdf, pageNumber) {
  const page = await pdf.getPage(pageNumber);
  const textContent = await page.getTextContent();
  const rawText = pdfText(textContent.items);
  // Inspect graphics only on suspicious / short native pages, not on every 1,000-page PDF.
  let imageCount = 0;
  let inkCount = 0;
  if (rawText.replace(/\s/g, '').length < 90 || suspectText(rawText)) {
    const operators = await page.getOperatorList();
    imageCount = (operators?.fnArray || []).filter(op => IMAGE_OPERATORS.has(op)).length;
    inkCount = (operators?.fnArray || []).filter(op => INK_OPERATORS.has(op)).length;
  }
  const requiresOcr = isOcrCandidate(rawText, imageCount, inkCount);
  return {
    pageNumber, text: rawText, rawText, source: 'embedded',
    status: requiresOcr ? 'ocr-pending' : 'verified',
    imageCount, inkCount, issue: requiresOcr ? 'page-visual-requires-ocr' : '',
  };
}

async function renderForOcr(page, pageCount) {
  const base = pageCount >= 400 ? 1.45 : 1.65;
  const viewport = page.getViewport({ scale: base });
  const cap = 3_800_000;
  const ratio = Math.min(1, Math.sqrt(cap / Math.max(1, viewport.width * viewport.height)));
  const target = page.getViewport({ scale: base * ratio });
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(target.width));
  canvas.height = Math.max(1, Math.ceil(target.height));
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) throw new Error('Canvas OCR non disponibile');
  await page.render({ canvasContext: context, viewport: target }).promise;
  return canvas;
}

async function createLocalOcrWorker(progress, getPageNumber) {
  const { createWorker } = await import('tesseract.js');
  return createWorker('ita+eng', undefined, {
    logger(message) {
      if (message?.status === 'recognizing text') {
        progress?.({
          phase: 'ocr-recognize',
          fraction: Number(message.progress || 0),
          pageNumber: getPageNumber(),
        });
      }
    },
  });
}

function toHex(bytes) {
  return [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function readPdfIntegrity360(file, { onProgress, autoOcr = true } = {}) {
  const started = performance.now();
  const data = new Uint8Array(await file.arrayBuffer());
  // Strong identity: even equal names/sizes/mtime cannot reuse the wrong book.
  const fingerprint = toHex(await crypto.subtle.digest('SHA-256', data));
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const pageCount = pdf.numPages;
  const signature = 'i360:' + INTEGRITY_ENGINE_VERSION + ':' + fingerprint + ':' + (autoOcr ? 'ocr' : 'native');
  const blocks = makeLogicalBlocks(pageCount, 10);
  const deviceMemory = typeof navigator !== 'undefined' ? Number(navigator.deviceMemory || 4) : 4;
  const cores = typeof navigator !== 'undefined' ? Number(navigator.hardwareConcurrency || 2) : 2;
  const plannedLanes = choosePdfLanes({ hardwareConcurrency: cores, deviceMemory, pageCount });
  const pages = Array(pageCount).fill(null);
  let savedCount = 0, checkpointFailures = 0, restored = 0, extracted = 0, errors = 0;
  let targetLanes = plannedLanes, nextBlock = 0, baselineMs = 0;
  let ocrWorker, ocrPageNumber = null;
  onProgress?.({ phase: 'turbo-inventory', done: 0, total: pageCount, blocks: blocks.length, concurrency: plannedLanes });

  try {
    const cache = await loadIntegrity360Pages(signature);
    for (const row of cache) {
      if (row.pageNumber <= pageCount && !pages[row.pageNumber - 1]) {
        pages[row.pageNumber - 1] = {
          pageNumber: row.pageNumber, text: row.text, rawText: row.rawText || row.text,
          status: 'verified', source: row.source || 'resume', imageCount: row.imageCount || 0,
          issue: '',
        };
        restored += 1;
      }
    }
    extracted = restored;
    onProgress?.({ phase: 'turbo-resume', done: restored, total: pageCount, resumed: restored });

    const textLane = async laneId => {
      while (nextBlock < blocks.length && laneId < targetLanes) {
        const block = blocks[nextBlock++];
        const timeStart = performance.now();
        let blockErrors = 0;
        for (let pageNumber = block.start; pageNumber <= block.end; pageNumber += 1) {
          if (pages[pageNumber - 1]) continue;
          try {
            const row = await readNativePage(pdf, pageNumber);
            pages[pageNumber - 1] = row;
            if (row.status === 'verified') {
              const saved = await saveIntegrity360Page(signature, row);
              if (saved) savedCount += 1;
              else checkpointFailures += 1;
            }
          } catch (err) {
            blockErrors += 1;
            errors += 1;
            pages[pageNumber - 1] = {
              pageNumber, text: '', rawText: '', source: 'error', status: 'failed',
              issue: 'pdf-extract-failed:' + String(err?.message || 'unknown').slice(0, 80),
            };
          }
          extracted += 1;
          onProgress?.({ phase: 'extract', done: extracted, total: pageCount, pageNumber, block: block.id, concurrency: targetLanes });
        }
        const durationMs = performance.now() - timeStart;
        const perPageMs = durationMs / Math.max(1, block.end - block.start + 1);
        if (!baselineMs && !blockErrors) baselineMs = perPageMs;
        else baselineMs = baselineMs ? baselineMs * 0.8 + perPageMs * 0.2 : perPageMs;
        if (shouldThrottlePdfLanes({ durationMs: perPageMs, baselineMs, errorCount: blockErrors, deviceMemory })) {
          targetLanes = 1;
        }
      }
    };
    await Promise.all(Array.from({ length: plannedLanes }, (_, i) => textLane(i)));

    const pending = pages.filter(page => page?.status === 'ocr-pending');
    if (autoOcr && pending.length) {
      let ocrDone = 0;
      onProgress?.({ phase: 'ocr-loading', done: 0, total: pending.length, resumed: restored });
      try {
        ocrWorker = await createLocalOcrWorker(onProgress, () => ocrPageNumber);
      } catch (err) {
        onProgress?.({ phase: 'turbo-ocr-unavailable', error: String(err?.message || err) });
      }
      for (const row of pending) {
        ocrPageNumber = row.pageNumber;
        let canvas = null;
        try {
          if (!ocrWorker) throw new Error('OCR non disponibile');
          const page = await pdf.getPage(row.pageNumber);
          canvas = await renderForOcr(page, pageCount);
          const output = await ocrWorker.recognize(canvas);
          const ocrText = clean(output?.data?.text);
          const confidence = Number(output?.data?.confidence || 0);
          // Never treat a longer, less accurate OCR result as necessarily better.
          if (!ocrText || confidence < 40 || suspectText(ocrText)) {
            row.status = 'failed';
            row.issue = 'ocr-low-confidence:' + Math.round(confidence);
          } else {
            row.text = ocrText;
            row.source = 'ocr';
            row.status = 'verified';
            row.issue = '';
            const saved = await saveIntegrity360Page(signature, row);
            if (saved) savedCount += 1;
            else checkpointFailures += 1;
          }
        } catch (err) {
          row.status = 'failed';
          row.issue = 'ocr-failed:' + String(err?.message || err).slice(0, 80);
        } finally {
          if (canvas) { canvas.width = 1; canvas.height = 1; }
        }
        ocrDone += 1;
        onProgress?.({ phase: 'ocr-page', done: ocrDone, total: pending.length, pageNumber: row.pageNumber });
      }
    }

    const originalPages = pages.map((row, index) => row || ({
      pageNumber: index + 1, text: '', rawText: '', source: 'error',
      status: 'failed', issue: 'page-not-acquired',
    }));
    onProgress?.({ phase: 'turbo-merge', done: 0, total: pageCount });
    // Keep the exact extracted text and source page separately from reconstructed prose.
    let visualResult = { assets: [], detected: 0, truncated: 0 };
    try {
      visualResult = await extractPdfVisualAssetsFromDocument(pdf, { onProgress, maxPages: 18 });
    } catch { /* visual snapshots are advisory: source PDF stays immutable */ }
    const textPages = originalPages.map(page => ({
      ...page, pageNumber: page.pageNumber, text: page.text,
    }));
    const chapters = mergePageBoundaryParagraphs(detectChaptersFromPages(textPages));
    const integrity = auditIntegrityPages(originalPages, pageCount, blocks);
    const chapterStates = verifiedChapterStates(chapters, originalPages, pageCount);
    const structural = auditDocumentStructure({ pages: textPages, chapters });
    const unresolved = originalPages.filter(page => page.status !== 'verified').map(page => page.pageNumber);
    const elapsedMs = Math.round(performance.now() - started);
    const result = {
      fullText: joinOrderedPageText(originalPages),
      pages: originalPages,
      chapters,
      sourceFormat: 'pdf',
      originalFingerprint: fingerprint,
      ocrApplied: originalPages.filter(page => page.source === 'ocr').map(page => page.pageNumber),
      needsOcr: unresolved,
      removedRunningLines: [], // No destructive deletion of headings, notes or page text.
      assets: visualResult.assets,
      assetsTruncated: visualResult.truncated,
      visualPagesDetected: visualResult.detected,
      ocrCheckpointSignature: signature,
      structure: {
        pageCount, chapterCount: chapters.length,
        sectionCount: chapters.reduce((n, chapter) => n + (chapter.sections?.length || 0), 0),
        paragraphCount: chapters.reduce((n, chapter) => n + (chapter.paragraphs?.length || 0), 0),
        hierarchyEngine: 'integrity360-turbo-v1', ocrCheckpoint: 'indexeddb-per-page',
        ocrResumedPages: restored, ocrNewPages: originalPages.filter(page => page.source === 'ocr').length,
        ocrPendingPages: unresolved.length, ocrFailures: unresolved.length,
        assetCount: visualResult.assets.length,
        imageCount: visualResult.assets.filter(asset => asset.type === 'image').length,
        tableCount: visualResult.assets.filter(asset => asset.type === 'table').length,
        turboBlocks: blocks.length, turboTextLanesInitial: plannedLanes,
        turboTextLanesFinal: targetLanes, turboElapsedMs: elapsedMs,
      },
      integrity360: {
        ...integrity, ready: integrity.ready, fingerprint, engine: INTEGRITY_ENGINE_VERSION,
        blocks, chapterStates, verifiedChapters: chapterStates.filter(chapter => chapter.status === 'verified').length,
        checkpointSavedPages: savedCount, checkpointResumedPages: restored,
        checkpointFailures, checkpointDurable: checkpointFailures === 0,
        semanticCertified: false,
        structuralWarningCount: structural.warningCount,
        structuralWarnings: structural.warnings,
        visualReferencePages: originalPages.filter(page => page.imageCount > 0).map(page => page.pageNumber),
        runtime: { elapsedMs, textLanesInitial: plannedLanes, textLanesFinal: targetLanes, ocrLanes: 1, errors },
      },
      precisionAudit: structural,
    };
    onProgress?.({ phase: 'turbo-verify', done: integrity.verifiedPages, total: pageCount,
      warnings: integrity.issueCount, verifiedChapters: result.integrity360.verifiedChapters });
    onProgress?.({ phase: 'complete', done: integrity.verifiedPages, total: pageCount });
    return result;
  } finally {
    try { if (ocrWorker) await ocrWorker.terminate(); } catch { /* best effort */ }
    try { pdf.cleanup(); } catch { /* best effort */ }
    try { await pdf.destroy(); } catch { /* best effort */ }
  }
}
