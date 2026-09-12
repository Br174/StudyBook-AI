const DB_NAME = 'studybook-ai-scanner';
const DB_VERSION = 1;
const META_STORE = 'meta';
const PAGE_STORE = 'pages';
const ACTIVE_SESSION = 'active';
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function openDb() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in globalThis)) {
      reject(new Error('Archivio scanner locale non supportato da questo browser.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(PAGE_STORE)) {
        db.createObjectStore(PAGE_STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Impossibile aprire l’archivio scanner.'));
  });
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Errore archivio scanner.'));
  });
}

function transactionDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Salvataggio scanner non riuscito.'));
    tx.onabort = () => reject(tx.error || new Error('Salvataggio scanner annullato.'));
  });
}

function cleanName(value) {
  return String(value || 'Appunti fotografati').trim().slice(0, 80) || 'Appunti fotografati';
}

export function scannerPageToRecord(page = {}) {
  const source = page.file instanceof Blob ? page.file : page.blob instanceof Blob ? page.blob : null;
  return {
    id: String(page.id || ''),
    blob: source,
    fileName: page.file?.name || page.fileName || 'pagina.jpg',
    fileType: page.file?.type || page.fileType || source?.type || 'image/jpeg',
    lastModified: Number(page.file?.lastModified || page.lastModified || Date.now()),
    text: String(page.text || ''),
    status: page.status === 'ready' || page.status === 'error' || page.status === 'processing'
      ? page.status
      : 'error',
    error: String(page.error || ''),
    updatedAt: new Date().toISOString(),
  };
}

export function scannerPageFromRecord(record = {}) {
  const blob = record.blob instanceof Blob ? record.blob : null;
  let file = blob;
  if (blob && typeof File !== 'undefined') {
    file = new File([blob], record.fileName || 'pagina.jpg', {
      type: record.fileType || blob.type || 'image/jpeg',
      lastModified: Number(record.lastModified || Date.now()),
    });
  }

  const interrupted = record.status === 'processing';
  return {
    id: String(record.id || ''),
    file,
    parsed: null,
    text: String(record.text || ''),
    status: interrupted ? 'error' : (record.status || 'error'),
    error: interrupted
      ? 'L’OCR è stato interrotto dalla chiusura dell’app. Premi “Riprova OCR” per continuare.'
      : String(record.error || ''),
  };
}

export function scannerMetaRecord(name, pages = []) {
  return {
    id: ACTIVE_SESSION,
    name: cleanName(name),
    order: pages.map((page) => String(page.id || '')).filter(Boolean),
    updatedAt: new Date().toISOString(),
  };
}

export async function saveScannerMeta(name, pages = []) {
  let db;
  try {
    db = await openDb();
    const tx = db.transaction(META_STORE, 'readwrite');
    tx.objectStore(META_STORE).put(scannerMetaRecord(name, pages));
    await transactionDone(tx);
    return true;
  } catch {
    return false;
  } finally {
    db?.close();
  }
}

export async function saveScannerPage(page) {
  const record = scannerPageToRecord(page);
  if (!record.id || !record.blob) return false;
  let db;
  try {
    db = await openDb();
    const tx = db.transaction(PAGE_STORE, 'readwrite');
    tx.objectStore(PAGE_STORE).put(record);
    await transactionDone(tx);
    return true;
  } catch {
    return false;
  } finally {
    db?.close();
  }
}

export async function deleteScannerPage(id) {
  if (!id) return false;
  let db;
  try {
    db = await openDb();
    const tx = db.transaction(PAGE_STORE, 'readwrite');
    tx.objectStore(PAGE_STORE).delete(String(id));
    await transactionDone(tx);
    return true;
  } catch {
    return false;
  } finally {
    db?.close();
  }
}

export async function clearScannerSessionStore() {
  let db;
  try {
    db = await openDb();
    const tx = db.transaction([META_STORE, PAGE_STORE], 'readwrite');
    tx.objectStore(META_STORE).delete(ACTIVE_SESSION);
    tx.objectStore(PAGE_STORE).clear();
    await transactionDone(tx);
    return true;
  } catch {
    return false;
  } finally {
    db?.close();
  }
}

export async function loadScannerSession() {
  let db;
  try {
    db = await openDb();
    const tx = db.transaction([META_STORE, PAGE_STORE], 'readonly');
    const meta = await requestResult(tx.objectStore(META_STORE).get(ACTIVE_SESSION));
    if (!meta) return null;

    const age = Date.now() - new Date(meta.updatedAt || 0).getTime();
    if (!Number.isFinite(age) || age > MAX_AGE_MS) {
      db.close();
      db = null;
      await clearScannerSessionStore();
      return null;
    }

    const records = await requestResult(tx.objectStore(PAGE_STORE).getAll());
    const byId = new Map(records.map((record) => [String(record.id), record]));
    const ordered = (meta.order || [])
      .map((id) => byId.get(String(id)))
      .filter(Boolean);
    const missingFromOrder = records.filter((record) => !(meta.order || []).includes(String(record.id)));
    const pages = [...ordered, ...missingFromOrder].map(scannerPageFromRecord).filter((page) => page.id && page.file);

    return {
      name: cleanName(meta.name),
      updatedAt: meta.updatedAt,
      pages,
    };
  } catch {
    return null;
  } finally {
    db?.close();
  }
}
