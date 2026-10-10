/* LAB11 Scanner Turbo: un unico worker Tesseract (ita+eng), OCR seriale e riuso.
   Non aumenta la concorrenza della CPU Android e non modifica il riconoscimento. */
let workerPromise = null;
let worker = null;
let onProgressNow = null;
let idleTimer = null;
let initializationCount = 0;
const IDLE_MS = 5 * 60 * 1000;

function stopTimer() {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = null;
}

async function ensureWorker() {
  stopTimer();
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import('tesseract.js');
      const created = await createWorker('ita+eng', undefined, {
        logger(event) {
          if (event?.status === 'recognizing text') {
            onProgressNow?.(Math.min(1,Math.max(0,Number(event.progress || 0))));
          }
        },
      });
      initializationCount += 1;
      worker = created;
      return created;
    })().catch(err => {
      workerPromise = null;
      worker = null;
      throw err;
    });
  }
  return workerPromise;
}

function scheduleRelease() {
  stopTimer();
  idleTimer = setTimeout(() => { void releaseScannerOcr(); }, IDLE_MS);
}
export async function recognizeScannerImage(file, onProgress) {
  const runningWorker = await ensureWorker();
  onProgressNow = typeof onProgress === 'function' ? onProgress : null;
  try {
    const result = await runningWorker.recognize(file);
    const text = String(result?.data?.text || '')
      .replace(/\u00ad/g,'')
      .replace(/([A-Za-zÀ-ÖØ-öø-ÿ])-\n([A-Za-zÀ-ÖØ-öø-ÿ])/g,'$1$2')
      .replace(/[ \t]{2,}/g,' ')
      .replace(/\n{3,}/g,'\n\n').trim();
    if (!text) throw new Error('Non è stato riconosciuto testo nella pagina. Riprova lo scatto.');
    return text;
  } catch(err) {
    // Un worker corrotto viene ricreato al prossimo tentativo.
    await releaseScannerOcr();
    throw err;
  } finally {
    onProgressNow = null;
    if (workerPromise) scheduleRelease();
  }
}
export async function releaseScannerOcr() {
  stopTimer();
  const previous = workerPromise;
  workerPromise = null;
  worker = null;
  onProgressNow = null;
  try { await (await previous)?.terminate?.(); } catch { /* best effort */ }
}
export function scannerOcrStats() { return { initializationCount, loaded: Boolean(workerPromise) }; }
