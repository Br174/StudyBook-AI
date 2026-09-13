const DB_NAME = 'studybook-ai-study-help';
const DB_VERSION = 1;
const STORE = 'answers';
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function openDb() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in globalThis)) {
      reject(new Error('IndexedDB non disponibile.'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Archivio spiegazioni non disponibile.'));
  });
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Errore archivio spiegazioni.'));
  });
}

function transactionDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Salvataggio spiegazione non riuscito.'));
    tx.onabort = () => reject(tx.error || new Error('Salvataggio spiegazione annullato.'));
  });
}

export function isFreshStudyHelpRecord(record, now = Date.now()) {
  const savedAt = new Date(record?.savedAt || 0).getTime();
  return Boolean(record?.key && record?.value?.answer && Number.isFinite(savedAt) && now - savedAt <= MAX_AGE_MS);
}

export async function readStudyHelpCache(key) {
  if (!key) return null;
  let db;
  try {
    db = await openDb();
    const tx = db.transaction(STORE, 'readonly');
    const record = await requestResult(tx.objectStore(STORE).get(String(key)));
    if (!isFreshStudyHelpRecord(record)) return null;
    return { ...record.value, cached: true, persisted: true };
  } catch {
    return null;
  } finally {
    db?.close();
  }
}

export async function writeStudyHelpCache(key, value) {
  if (!key || !value?.answer) return false;
  let db;
  try {
    db = await openDb();
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({
      key: String(key),
      value: { ...value, cached: false, persisted: true },
      savedAt: new Date().toISOString(),
    });
    await transactionDone(tx);
    return true;
  } catch {
    return false;
  } finally {
    db?.close();
  }
}

export async function purgeExpiredStudyHelpCache() {
  let db;
  try {
    db = await openDb();
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const records = await requestResult(store.getAll());
    for (const record of records || []) {
      if (!isFreshStudyHelpRecord(record)) store.delete(record.key);
    }
    await transactionDone(tx);
    return true;
  } catch {
    return false;
  } finally {
    db?.close();
  }
}
