const DB_NAME = 'studybook-ai-processing';
const DB_VERSION = 3;
const STORE = 'checkpoints';
const RUNTIME_STORE = 'runtime-unit-results';
const PARAGRAPH_STORE = 'study-paragraphs-v34';
const RUNTIME_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000;

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
      if (!db.objectStoreNames.contains(RUNTIME_STORE)) {
        const runtimeStore = db.createObjectStore(RUNTIME_STORE, { keyPath: 'key' });
        runtimeStore.createIndex('updatedAt', 'updatedAt');
      }
      if (!db.objectStoreNames.contains(PARAGRAPH_STORE)) {
        const partStore = db.createObjectStore(PARAGRAPH_STORE, { keyPath: 'key' });
        partStore.createIndex('runKey', 'runKey');
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
    // Never silently expire a crash-recovery checkpoint in progress.
    if (!Number.isFinite(age) || (age > MAX_AGE_MS && record.state?.published)) return null;
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
      if ((!timestamp || timestamp < cutoff) && record.state?.published) store.delete(record.signature);
    });
  } catch {
    // Pulizia best-effort.
  } finally {
    db?.close();
  }
}


export async function loadRuntimeUnitResults(keys = []) {
  const wanted = [...new Set((keys || []).filter(Boolean))];
  if (!wanted.length) return new Map();
  let db;
  try {
    db = await openDb();
    const store = db.transaction(RUNTIME_STORE, 'readonly').objectStore(RUNTIME_STORE);
    const rows = await Promise.all(wanted.map((key) => requestResult(store.get(key))));
    const now = Date.now();
    const output = new Map();
    rows.forEach((row) => {
      if (!row?.key || !row?.result) return;
      const age = now - new Date(row.updatedAt || 0).getTime();
      if (!Number.isFinite(age) || age > RUNTIME_MAX_AGE_MS) return;
      output.set(row.key, row.result);
    });
    return output;
  } catch {
    return new Map();
  } finally {
    db?.close();
  }
}

export async function saveRuntimeUnitResults(entries = []) {
  const valid = (entries || []).filter((entry) => entry?.key && entry?.result);
  if (!valid.length) return false;
  let db;
  try {
    db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(RUNTIME_STORE, 'readwrite');
      const store = tx.objectStore(RUNTIME_STORE);
      const updatedAt = new Date().toISOString();
      valid.forEach((entry) => store.put({ key: entry.key, result: entry.result, updatedAt }));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('Salvataggio cache MotorLab Runtime non riuscito.'));
      tx.onabort = () => reject(tx.error || new Error('Salvataggio cache MotorLab Runtime annullato.'));
    });
    return true;
  } catch {
    return false;
  } finally {
    db?.close();
  }
}

export async function purgeOldRuntimeUnitResults() {
  let db;
  try {
    db = await openDb();
    const tx = db.transaction(RUNTIME_STORE, 'readwrite');
    const store = tx.objectStore(RUNTIME_STORE);
    const records = await requestResult(store.getAll());
    const cutoff = Date.now() - RUNTIME_MAX_AGE_MS;
    records.forEach((record) => {
      const timestamp = new Date(record.updatedAt || 0).getTime();
      if (!timestamp || timestamp < cutoff) store.delete(record.key);
    });
  } catch {
    // Cache runtime best-effort: non deve mai bloccare la creazione del libro.
  } finally {
    db?.close();
  }
}

export async function markResumeStatePublished(signature) {
  if (!signature) return false;
  const state = await loadResumeState(signature);
  if (!state?.complete || state.signature !== signature) return false;
  return saveResumeState(signature, {
    ...state, published:true, unitPieces:[],
    publishedAt:new Date().toISOString(),
  });
}

export async function loadStudyParagraphs(signature, generation) {
  if (!signature || !generation) return new Map();
  let db;
  try {
    db = await openDb();
    const runKey = signature + ':' + generation;
    const rows = await requestResult(db.transaction(PARAGRAPH_STORE, 'readonly')
      .objectStore(PARAGRAPH_STORE).index('runKey').getAll(runKey));
    return new Map((rows || []).filter(row => Number.isInteger(row.index) && row.index >= 0)
      .map(row => [row.index, {result:row.result || null, pieces:row.pieces || []}]));
  } catch { return new Map(); }
  finally { db?.close(); }
}

// Atomic per-wave DELTA writes: only changed paragraphs, never recopy the
// entire university textbook in IndexedDB for each finished batch.
export async function saveStudyParagraphs(signature, generation, changes = []) {
  if (!signature || !generation) return false;
  const valid = changes.filter(entry => Number.isInteger(entry?.index)
    && entry.index >= 0 && (entry.result || entry.pieces?.length));
  if (!valid.length) return true;
  let db;
  try {
    db = await openDb();
    const runKey = signature + ':' + generation;
    await new Promise((resolve,reject)=>{
      const tx = db.transaction(PARAGRAPH_STORE,'readwrite');
      const store = tx.objectStore(PARAGRAPH_STORE);
      for (const entry of valid) store.put({
        key:runKey + ':' + entry.index, runKey,
        index:entry.index, result:entry.result || null,
        pieces:entry.result ? [] : (entry.pieces || []),
        updatedAt:new Date().toISOString(),
      });
      tx.oncomplete=resolve;
      tx.onerror=()=>reject(tx.error || new Error('Checkpoint paragrafi non salvato'));
      tx.onabort=()=>reject(tx.error || new Error('Checkpoint paragrafi annullato'));
    });
    return true;
  } catch { return false; }
  finally { db?.close(); }
}

export async function clearStudyParagraphs(signature) {
  if (!signature) return false;
  let db;
  try {
    db=await openDb();
    const tx=db.transaction(PARAGRAPH_STORE,'readwrite');
    const store=tx.objectStore(PARAGRAPH_STORE);
    const rows=await requestResult(store.getAll());
    rows.filter(row=>String(row.runKey||'').startsWith(signature+':'))
      .forEach(row=>store.delete(row.key));
    await new Promise((resolve,reject)=>{
      tx.oncomplete=resolve;
      tx.onerror=()=>reject(tx.error || new Error('Eliminazione checkpoint non riuscita'));
      tx.onabort=()=>reject(tx.error || new Error('Eliminazione checkpoint annullata'));
    });
    return true;
  } catch { return false; }
  finally { db?.close(); }
}
