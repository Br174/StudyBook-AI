const DB_NAME = 'studybook-ai-processing';
const DB_VERSION = 1;
const STORE = 'checkpoints';
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

function openDb() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in globalThis)) {
      reject(new Error('Checkpoint locali non supportati da questo browser.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'signature' });
        store.createIndex('updatedAt', 'updatedAt');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Impossibile aprire i checkpoint.'));
  });
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Errore checkpoint.'));
  });
}

export async function loadResumeState(signature) {
  if (!signature) return null;
  let db;
  try {
    db = await openDb();
    const tx = db.transaction(STORE, 'readonly');
    const record = await requestResult(tx.objectStore(STORE).get(signature));
    if (!record) return null;
    const age = Date.now() - new Date(record.updatedAt || 0).getTime();
    if (!Number.isFinite(age) || age > MAX_AGE_MS) return null;
    return record.state || null;
  } catch {
    return null;
  } finally {
    db?.close();
  }
}

export async function saveResumeState(signature, state) {
  if (!signature || !state) return false;
  let db;
  try {
    db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put({
        signature,
        updatedAt: new Date().toISOString(),
        state,
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('Salvataggio checkpoint non riuscito.'));
      tx.onabort = () => reject(tx.error || new Error('Salvataggio checkpoint annullato.'));
    });
    return true;
  } catch {
    return false;
  } finally {
    db?.close();
  }
}

export async function deleteResumeState(signature) {
  if (!signature) return;
  let db;
  try {
    db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(signature);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('Eliminazione checkpoint non riuscita.'));
    });
  } catch {
    // I checkpoint sono un aiuto: un errore qui non deve bloccare il libro.
  } finally {
    db?.close();
  }
}

export async function purgeOldResumeStates() {
  let db;
  try {
    db = await openDb();
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const records = await requestResult(store.getAll());
    const cutoff = Date.now() - MAX_AGE_MS;
    records.forEach((record) => {
      const timestamp = new Date(record.updatedAt || 0).getTime();
      if (!timestamp || timestamp < cutoff) store.delete(record.signature);
    });
  } catch {
    // Pulizia best-effort.
  } finally {
    db?.close();
  }
}
