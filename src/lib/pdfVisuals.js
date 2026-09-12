import * as pdfjsLib from 'pdfjs-dist';

const DEFAULT_MAX_VISUAL_PAGES = 18;
const MAX_SNAPSHOT_DATA_URL = 2_800_000;

function isVisualOperator(fn) {
  const visualOps = [
    pdfjsLib.OPS?.paintImageXObject,
    pdfjsLib.OPS?.paintInlineImageXObject,
    pdfjsLib.OPS?.paintJpegXObject,
    pdfjsLib.OPS?.paintImageMaskXObject,
  ].filter(Number.isFinite);
  return visualOps.includes(fn);
}

function isVectorOperator(fn) {
  const vectorOps = [
    pdfjsLib.OPS?.constructPath,
    pdfjsLib.OPS?.rectangle,
    pdfjsLib.OPS?.stroke,
    pdfjsLib.OPS?.fill,
    pdfjsLib.OPS?.eoFill,
    pdfjsLib.OPS?.fillStroke,
    pdfjsLib.OPS?.eoFillStroke,
  ].filter(Number.isFinite);
  return vectorOps.includes(fn);
}

function visualSignals(operatorList) {
  let imageOps = 0;
  let vectorOps = 0;
  for (const fn of operatorList?.fnArray || []) {
    if (isVisualOperator(fn)) imageOps += 1;
    else if (isVectorOperator(fn)) vectorOps += 1;
  }
  return {
    imageOps,
    vectorOps,
    relevant: imageOps > 0 || vectorOps >= 18,
  };
}

async function renderSnapshot(page) {
  const viewport = page.getViewport({ scale: 1.15 });
  const maxWidth = 1280;
  const ratio = viewport.width > maxWidth ? maxWidth / viewport.width : 1;
  const targetViewport = page.getViewport({ scale: 1.15 * ratio });
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(targetViewport.width));
  canvas.height = Math.max(1, Math.ceil(targetViewport.height));
  const context = canvas.getContext('2d', { alpha: false });
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: context, viewport: targetViewport }).promise;
  const dataUrl = canvas.toDataURL('image/jpeg', 0.78);
  canvas.width = 1;
  canvas.height = 1;
  return dataUrl;
}

export async function extractPdfVisualAssets(file, {
  onProgress,
  maxPages = DEFAULT_MAX_VISUAL_PAGES,
} = {}) {
  const data = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const assets = [];
  let detected = 0;

  onProgress?.({ phase: 'rich-assets', format: 'PDF', done: 0, total: pdf.numPages });

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    if (assets.length >= maxPages) break;
    try {
      const page = await pdf.getPage(pageNumber);
      const operatorList = await page.getOperatorList();
      const signals = visualSignals(operatorList);
      if (!signals.relevant) {
        onProgress?.({ phase: 'rich-assets', format: 'PDF', done: pageNumber, total: pdf.numPages });
        continue;
      }
      detected += 1;
      const dataUrl = await renderSnapshot(page);
      if (dataUrl && dataUrl.length <= MAX_SNAPSHOT_DATA_URL) {
        assets.push({
          type: 'image',
          kind: 'pdf-page-snapshot',
          name: `Pagina ${pageNumber} · riferimento visivo`,
          mime: 'image/jpeg',
          dataUrl,
          sourcePage: pageNumber,
          sourcePart: `pdf:page:${pageNumber}`,
          sourcePath: file.name,
          alt: `Riferimento visivo conservato dalla pagina ${pageNumber} del PDF`,
          visualSignals: {
            images: signals.imageOps,
            vectors: signals.vectorOps,
          },
        });
      }
    } catch {
      // Un elemento grafico non leggibile non deve bloccare l'import del libro.
    }
    onProgress?.({ phase: 'rich-assets', format: 'PDF', done: pageNumber, total: pdf.numPages });
  }

  return {
    assets,
    detected,
    truncated: Math.max(0, detected - assets.length) + (detected > maxPages ? detected - maxPages : 0),
  };
}
