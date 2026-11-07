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
import { loadPdfMirrorOutline } from './visualMirrorV35.js';
import { buildCanonicalBookMap } from './libroSpecchioV35.js';
import { auditSourceAgainstOriginal } from './sourceShieldV34.js';

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

async function readNativePage(pdf, pageNumber, {textOnly=false}={}) {
  const page = await pdf.getPage(pageNumber);
  try {
  const textContent = await page.getTextContent();
  // PDF page metadata only: getViewport does not render or decode any pictures.
  const physicalSize = page.getViewport({scale:1});
  const rawText = pdfText(textContent.items);
  // LAB47: textual PDF imports never inspect graphical operators.
  let imageCount = 0;
  let inkCount = 0;
  if (!textOnly && (rawText.replace(/\s/g, '').length < 90 || suspectText(rawText))) {
    const operators = await page.getOperatorList();
    imageCount = (operators?.fnArray || []).filter(op => IMAGE_OPERATORS.has(op)).length;
    inkCount = (operators?.fnArray || []).filter(op => INK_OPERATORS.has(op)).length;
  }
  const requiresOcr = !textOnly && isOcrCandidate(rawText, imageCount, inkCount);
  const noText = textOnly && !rawText.trim();
  return {
    pageNumber, text: rawText, rawText, source: 'embedded',
    widthPt:physicalSize.width,heightPt:physicalSize.height,
    status: noText ? 'text-unavailable' : requiresOcr ? 'ocr-pending' : 'verified',
    imageCount, inkCount, issue: noText ? 'no-selectable-text-image-skipped' :
      requiresOcr ? 'page-visual-requires-ocr' : '',
  };
  } finally { try { page.cleanup?.(); } catch { /* best effort */ } }
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

export async function readPdfIntegrity360(file, { onProgress, autoOcr = true, textOnly = false, onVerifiedChapter, retryPages = [], forceReextractAll = false } = {}) {
  const started = performance.now();
  onProgress?.({phase:'turbo-file-read', done:0,total:1,bytes:Number(file?.size||0)});
  const data = new Uint8Array(await file.arrayBuffer());
  // Strong identity: even equal names/sizes/mtime cannot reuse the wrong book.
  onProgress?.({phase:'turbo-file-hash',done:0,total:1,bytes:data.byteLength});
  const fingerprint = toHex(await crypto.subtle.digest('SHA-256', data));
  onProgress?.({phase:'turbo-file-hash',done:1,total:1,bytes:data.byteLength});
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const pageCount = pdf.numPages;
  const signature = 'i360:mirror-v35:' + INTEGRITY_ENGINE_VERSION + ':' + fingerprint + ':' + (textOnly ? 'text-only-v47' : autoOcr ? 'ocr' : 'native');
  const blocks = makeLogicalBlocks(pageCount, 10);
  const retrySet = new Set((retryPages || []).filter(page =>
    Number.isInteger(page) && page >= 1 && page <= pageCount));
  if (retrySet.size) onProgress?.({
    phase:'turbo-source-recheck', done:0,total:retrySet.size,
  });
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
      if (!forceReextractAll && row.pageNumber <= pageCount
        && !retrySet.has(row.pageNumber) && !pages[row.pageNumber - 1]) {
        pages[row.pageNumber - 1] = {
          pageNumber: row.pageNumber, text: row.text, rawText: row.rawText || row.text,
          widthPt:row.widthPt||null,heightPt:row.heightPt||null,
          status: 'verified', source: row.source || 'resume', imageCount: row.imageCount || 0,
          inkCount:row.inkCount||0,visualAnchors:row.visualAnchors||[],visualReview:row.visualReview||[],
          issue: '',
        };
        restored += 1;
      }
    }
    extracted = restored;
    onProgress?.({ phase: 'turbo-resume', done: restored, total: pageCount, resumed: restored });


    // One OCR consumer overlaps independent text extraction only on capable devices.
    // This is the existing PDF parser's work queue, never a second MotorLab scheduler.
    const ocrQueue = [];
    let nativeFinished = false, wakeOcr = null, ocrTotal = 0, ocrDone = 0;
    let ocrInitializationFailed = false;
    const enqueueOcr = row => {
      ocrQueue.push(row);
      ocrTotal += 1;
      if (wakeOcr) { const wake = wakeOcr; wakeOcr = null; wake(); }
    };
    const runOcrConsumer = async () => {
      while (!nativeFinished || ocrQueue.length) {
        if (!ocrQueue.length) {
          await new Promise(resolve => { wakeOcr = resolve; });
          continue;
        }
        const row = ocrQueue.shift();
        ocrPageNumber = row.pageNumber;
        if (!ocrWorker && !ocrInitializationFailed) {
          onProgress?.({ phase: 'ocr-loading', done: ocrDone, total: ocrTotal, resumed: restored });
          try { ocrWorker = await createLocalOcrWorker(onProgress, () => ocrPageNumber); }
          catch (err) {
            ocrInitializationFailed = true;
            onProgress?.({ phase: 'turbo-ocr-unavailable', error: String(err?.message || err) });
          }
        }
        let canvas = null;
        let pdfPage = null;
        try {
          if (!ocrWorker) throw new Error('OCR non disponibile');
          pdfPage = await pdf.getPage(row.pageNumber);
          canvas = await renderForOcr(pdfPage, pageCount);
          const output = await ocrWorker.recognize(canvas);
          const recognized = clean(output?.data?.text);
          const confidence = Number(output?.data?.confidence || 0);
          if (!recognized || confidence < 40 || suspectText(recognized)) {
            row.status = 'failed';
            row.issue = 'ocr-low-confidence:' + Math.round(confidence);
          } else {
            row.text = recognized;
            row.source = 'ocr';
            row.status = 'verified';
            row.issue = '';
            const saved = await saveIntegrity360Page(signature, row);
            if (saved) savedCount += 1;
            else checkpointFailures += 1;
            announceVerifiedChapters();
          }
        } catch (err) {
          row.status = 'failed';
          row.issue = 'ocr-failed:' + String(err?.message || err).slice(0, 80);
        } finally {
          if (canvas) { canvas.width = 1; canvas.height = 1; }
          try { pdfPage?.cleanup?.(); } catch { /* render cache best effort */ }
        }
        ocrDone += 1;
        onProgress?.({ phase: 'ocr-page', done: ocrDone, total: ocrTotal, pageNumber: row.pageNumber });
      }
    };
    const overlapOcr = autoOcr && deviceMemory >= 4 && cores >= 4;
    const ocrTask = overlapOcr ? runOcrConsumer() : null;


    // A chapter is announced only after seeing the following chapter boundary.
    // Source verification is distinct from finished didactic processing.
    const announced = new Set();
    let lastCheckedPrefix = 0;
    const announceVerifiedChapters = () => {
      let prefix = 0;
      while (prefix < pageCount && pages[prefix]?.status === 'verified') prefix += 1;
      const interval = pageCount >= 500 ? 100 : 35;
      if (prefix < pageCount && prefix - lastCheckedPrefix < interval) return;
      if (prefix <= lastCheckedPrefix || prefix < 2) return;
      lastCheckedPrefix = prefix;
      const known = detectChaptersFromPages(pages.slice(0, prefix));
      // The final observed chapter may continue onto as-yet unread pages.
      const candidates = prefix === pageCount ? known : known.slice(0, -1);
      const states = verifiedChapterStates(candidates, pages, pageCount);
      states.forEach((state, index) => {
        if (state.status !== 'verified') return;
        const key = state.pageStart + ':' + state.pageEnd + ':' + state.title;
        if (announced.has(key)) return;
        announced.add(key);
        onProgress?.({ phase: 'turbo-chapter-verified', done: announced.size, total: null,
          title: state.title, pageStart: state.pageStart, pageEnd: state.pageEnd });
        onVerifiedChapter?.({ ...state, chapter: candidates[index] });
      });
    };

    const textLane = async laneId => {
      while (nextBlock < blocks.length && laneId < targetLanes) {
        const block = blocks[nextBlock++];
        const timeStart = performance.now();
        let blockErrors = 0;
        for (let pageNumber = block.start; pageNumber <= block.end; pageNumber += 1) {
          if (pages[pageNumber - 1]) continue;
          try {
            const row = await readNativePage(pdf, pageNumber, {textOnly});
            pages[pageNumber - 1] = row;
            if (row.status === 'ocr-pending' && autoOcr) enqueueOcr(row);
            if (row.status === 'verified') {
              const saved = await saveIntegrity360Page(signature, row);
              if (saved) savedCount += 1;
              else checkpointFailures += 1;
              announceVerifiedChapters();
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
        const heap = performance.memory;
        const heapFraction = heap?.jsHeapSizeLimit
          ? Number(heap.usedJSHeapSize || 0) / Number(heap.jsHeapSizeLimit) : 0;
        if (shouldThrottlePdfLanes({ durationMs: perPageMs, baselineMs, errorCount: blockErrors, deviceMemory, heapFraction })) {
          targetLanes = 1;
          onProgress?.({ phase: 'turbo-throttle', concurrency: 1, heapFraction });
        }
      }
    };
    await Promise.all(Array.from({ length: plannedLanes }, (_, i) => textLane(i)));

    nativeFinished = true;
    if (wakeOcr) { const wake = wakeOcr; wakeOcr = null; wake(); }
    if (ocrTask) await ocrTask;
    else if (autoOcr && ocrQueue.length) await runOcrConsumer();
    announceVerifiedChapters();

    const originalPages = pages.map((row, index) => row || ({
      pageNumber: index + 1, text: '', rawText: '', source: 'error',
      status: 'failed', issue: 'page-not-acquired',
    }));
    onProgress?.({ phase: 'turbo-merge', done: 0, total: pageCount });
    // Keep the exact extracted text and source page separately from reconstructed prose.
    // LAB47: no JPEG snapshots, no bitmap decoding, no PDF image extraction.
    // We keep only text and the PDF's textual bookmark / page-label metadata.
    const visualResult = { assets: [], detected: 0, truncated: 0 };
    const pdfMetadata = textOnly
      ? await loadPdfMirrorOutline(pdf).catch(()=>({outline:[],pageLabels:[]}))
      : {outline:[],pageLabels:[]};
    const textPages = originalPages.map(page => ({
      ...page, pageNumber: page.pageNumber, text: page.text,
    }));
    const chapters = mergePageBoundaryParagraphs(detectChaptersFromPages(textPages));
    const integrity = auditIntegrityPages(originalPages, pageCount, blocks);
    const sourceShield = auditSourceAgainstOriginal({
      pages:originalPages,pdfPageCount:pageCount,fingerprint,
    });
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
      pdfOutline:pdfMetadata.outline,pdfPageLabels:pdfMetadata.pageLabels,
      sourceShield,
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
        hierarchyEngine: 'integrity360-turbo-v1', ocrCheckpoint: textOnly?'text-only-v47':'indexeddb-per-page',
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
        sourceReviewPageCount:sourceShield.reviewPages.length,
        sourceReviewPages:sourceShield.reviewPages,
        structuralWarnings: structural.warnings,
        visualReferencePages: textOnly?[]:originalPages.filter(page => page.imageCount > 0).map(page => page.pageNumber),
        textOnlyBookImport:textOnly,imagesExtracted:0,
        runtime: { elapsedMs, textLanesInitial: plannedLanes, textLanesFinal: targetLanes, ocrLanes: textOnly?0:1, errors },
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
