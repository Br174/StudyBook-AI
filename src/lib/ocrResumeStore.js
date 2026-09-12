const DB_NAME = 'studybook-ai-ocr';
const DB_VERSION = 1;
const STORE = 'pages';
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

function hashText(value) {
  let hash = 2166136261;
  const text = String(value || '');
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function makeOcrSignature(file, pageCount = 0) {
  const source = [
    file?.name || 'documento',
    Number(file?.size || 0),
    Number(file?.lastModified || 0),
    file?.type || '',
    Number(pageCount || 0),
  ].join('|');
  return `ocr-v1:${hashText(source)}:${Number(pageCount || 0)}`;
}

function openDb() {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) {
      reject(new Error('Checkpoint OCR non supportati da questo browser.'));
      return;
    }

    const request = globalThis.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'key' });
        store.createIndex('signature', 'signature', { unique: false });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Impossibile aprire i checkpoint OCR.'));
  });
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Errore checkpoint OCR.'));
  });
}

export async function loadOcrPages(signature) {
  if (!signature) return [];
  let db;
  try {
    db = await openDb();
    const tx = db.transaction(STORE, 'readonly');
    const index = tx.objectStore(STORE).index('signature');
    const records = await requestResult(index.getAll(signature));
    const cutoff = Date.now() - MAX_AGE_MS;
    return (records || []).filter((record) => {
      const timestamp = new Date(record.updatedAt || 0).getTime();
      return timestamp && timestamp >= cutoff && Number.isFinite(record.pageNumber) && record.text;
    });
  } catch {
    return [];
  } finally {
    db?.close();
  }
}

export async function saveOcrPage(signature, pageNumber, text) {
  const cleanText = String(text || '').trim();
  if (!signature || !Number.isFinite(pageNumber) || !cleanText) return false;
  let db;
  try {
    db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put({
        key: `${signature}:${pageNumber}`,
        signature,
        pageNumber,
        text: cleanText,
        updatedAt: new Date().toISOString(),
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('Salvataggio checkpoint OCR non riuscito.'));
      tx.onabort = () => reject(tx.error || new Error('Salvataggio checkpoint OCR annullato.'));
    });
    return true;
  } catch {
    return false;
  } finally {
    db?.close();
  }
}

export async function purgeOldOcrPages() {
  let db;
  try {
    db = await openDb();
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const records = await requestResult(store.getAll());
    const cutoff = Date.now() - MAX_AGE_MS;
    records.forEach((record) => {
      const timestamp = new Date(record.updatedAt || 0).getTime();
      if (!timestamp || timestamp < cutoff) store.delete(record.key);
    });
  } catch {
    // Pulizia best-effort: un errore non deve interrompere l'import del libro.
  } finally {
    db?.close();
  }
}

export function applyOcrCache(inputPages = [], records = [], candidateNumbers = null) {
  const pages = inputPages.map((page) => ({ ...page }));
  const candidates = candidateNumbers ? new Set(candidateNumbers) : null;
  const byPage = new Map((records || []).map((record) => [Number(record.pageNumber), String(record.text || '').trim()]));
  const resumedPages = [];

  pages.forEach((page) => {
    const pageNumber = Number(page.pageNumber);
    if (!Number.isFinite(pageNumber) || (candidates && !candidates.has(pageNumber))) return;
    const cached = byPage.get(pageNumber);
    if (!cached) return;
    const current = String(page.text || '').trim();
    if (cached.length <= current.length) return;
    page.text = cached;
    page.source = 'ocr-resume';
    resumedPages.push(pageNumber);
  });

  return { pages, resumedPages };
}
