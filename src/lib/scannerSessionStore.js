const DB_NAME = 'studybook-ai-scanner';
const DB_VERSION = 1; // Rimane compatibile con LAB10 e con eventuale rollback
const ARCHIVE_DB_NAME = 'studybook-ai-scanned-archive';
const ARCHIVE_STORE = 'archive'; // fotografie persistenti in database separato
import { sanitizeTitle, suggestPageTitle } from './smartTitles.js';
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

function openArchiveDb() {
  return new Promise((resolve,reject) => {
    if (!('indexedDB' in globalThis)) { reject(new Error('Archivio locale non disponibile.')); return; }
    const req = indexedDB.open(ARCHIVE_DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(ARCHIVE_STORE)) {
        const store = db.createObjectStore(ARCHIVE_STORE, { keyPath:'id' });
        store.createIndex('createdAt','createdAt');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Impossibile aprire Scannerizzati.'));
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
  const storedBytes = Number(page.storedBytes || source?.size || 0);
  const originalBytes = Number(page.originalBytes || storedBytes || 0);
  return {
    id: String(page.id || ''),
    archiveId: page.archiveId ? String(page.archiveId) : null,
    blob: source,
    fileName: page.file?.name || page.fileName || 'pagina.jpg',
    fileType: page.file?.type || page.fileType || source?.type || 'image/jpeg',
    lastModified: Number(page.file?.lastModified || page.lastModified || Date.now()),
    originalBytes,
    storedBytes,
    optimized: Boolean(page.optimized || (originalBytes > 0 && storedBytes > 0 && storedBytes < originalBytes * 0.98)),
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
  const storedBytes = Number(record.storedBytes || blob?.size || 0);
  const originalBytes = Number(record.originalBytes || storedBytes || 0);
  return {
    id: String(record.id || ''),
    archiveId: record.archiveId || null,
    file,
    parsed: null,
    originalBytes,
    storedBytes,
    optimized: Boolean(record.optimized || (originalBytes > 0 && storedBytes > 0 && storedBytes < originalBytes * 0.98)),
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
    const metaRequest = tx.objectStore(META_STORE).get(ACTIVE_SESSION);
    const pagesRequest = tx.objectStore(PAGE_STORE).getAll();
    const [meta, records] = await Promise.all([
      requestResult(metaRequest),
      requestResult(pagesRequest),
    ]);
    if (!meta) return null;

    const age = Date.now() - new Date(meta.updatedAt || 0).getTime();
    if (!Number.isFinite(age) || age > MAX_AGE_MS) {
      db.close();
      db = null;
      await clearScannerSessionStore();
      return null;
    }

    const byId = new Map(records.map((record) => [String(record.id), record]));
    const order = (meta.order || []).map(String);
    const orderSet = new Set(order);
    const ordered = order.map((id) => byId.get(id)).filter(Boolean);
    const missingFromOrder = records.filter((record) => !orderSet.has(String(record.id)));
    const pages = [...ordered, ...missingFromOrder]
      .map(scannerPageFromRecord)
      .filter((page) => page.id && page.file);

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

/* LAB11 — Archivio permanente Scannerizzati.
   Ogni acquisizione viene salvata ATOMICAMENTE sia nella sessione sia nell'archivio.
   Il precedente schema v1 è migrato senza cancellare le raccolte esistenti. */

export function archiveScannerPageRecord(page, collectionName = 'Appunti fotografati', existing = null) {
  const record = scannerPageToRecord(page);
  return {
    ...record,
    id: String(page.archiveId || page.id || ''),
    collection: cleanName(collectionName),
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    pageTitle: existing?.pageTitle || page.pageTitle || '',
    pageTitleManual: Boolean(existing?.pageTitleManual || page.pageTitleManual),
    collectionManual: Boolean(existing?.collectionManual || page.collectionManual),
    // Il nome della pagina originale è conservato per la rielaborazione.
  };
}

async function saveScannerArchiveCopy(page, collectionName) {
  const record = archiveScannerPageRecord(page, collectionName);
  if (!record.id || !record.blob) return false;
  let db;
  try {
    db = await openArchiveDb();
    const tx = db.transaction(ARCHIVE_STORE,'readwrite');
    tx.objectStore(ARCHIVE_STORE).put(record);
    await transactionDone(tx);
    return true;
  } catch { return false; }
  finally { db?.close(); }
}

export async function saveCapturedScannerPage(page, collectionName = 'Appunti fotografati', {archive = true} = {}) {
  // La fotografia viene conservata PRIMA nella raccolta permanente.
  // Se fallisce il salvataggio temporaneo, l'immagine resta recuperabile.
  if (archive && !(await saveScannerArchiveCopy(page, collectionName))) return false;
  return saveScannerPage(page);
}

export async function updateArchivedScannerText(page, collectionName = 'Appunti fotografati') {
  if (!page?.id) return false;
  let db;
  try {
    db = await openArchiveDb();
    const key = String(page.archiveId || page.id);
    const tx = db.transaction(ARCHIVE_STORE, 'readwrite');
    const store = tx.objectStore(ARCHIVE_STORE);
    const existing = await requestResult(store.get(key));
    if (!existing) return false; // una foto eliminata non deve essere ricreata dall'OCR
    store.put({
      ...existing,
      collection: existing.collection || cleanName(collectionName),
      text: String(page.text || ''),
      pageTitle: existing.pageTitleManual ? existing.pageTitle : (suggestPageTitle(page.text)?.title || existing.pageTitle || ''),
      status: page.status === 'ready' ? 'ready' : page.status === 'error' ? 'error' : 'processing',
      updatedAt: new Date().toISOString(),
    });
    await transactionDone(tx);
    return true;
  } catch {
    return false;
  } finally {
    db?.close();
  }
}

export async function archiveScannerSessionPages(pages = [], collectionName = 'Appunti fotografati') {
  const candidates = pages.filter(page => page?.id && page?.file instanceof Blob);
  if (!candidates.length) return true;
  let db;
  try {
    db = await openArchiveDb();
    // Non sovrascrive una fotografia eliminata intenzionalmente nel frattempo.
    // Le sessioni pre-LAB11, senza origin archiviata, vengono migrate.
    const tx = db.transaction(ARCHIVE_STORE, 'readwrite');
    const store = tx.objectStore(ARCHIVE_STORE);
    for (const page of candidates) {
      if (page.archiveId) continue;
      const key = String(page.id);
      const old = await requestResult(store.get(key));
      if (old) {
        store.put({...old, text:String(page.text || old.text || ''), status:page.status, updatedAt:new Date().toISOString()});
      } else {
        store.put(archiveScannerPageRecord(page, collectionName));
      }
    }
    await transactionDone(tx);
    return true;
  } catch {
    return false;
  } finally {
    db?.close();
  }
}

export async function listArchivedScannerPages() {
  let db;
  try {
    db = await openArchiveDb();
    const tx = db.transaction(ARCHIVE_STORE, 'readonly');
    const entries = await requestResult(tx.objectStore(ARCHIVE_STORE).getAll());
    await transactionDone(tx);
    return entries.filter(page => page.id && page.blob instanceof Blob)
      .sort((a,b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  } catch { return []; }
  finally { db?.close(); }
}

export async function getArchivedScannerPages(ids = []) {
  const ordered = Array.from(new Set(ids.map(String).filter(Boolean)));
  if (!ordered.length) return [];
  let db;
  try {
    db = await openArchiveDb();
    const tx = db.transaction(ARCHIVE_STORE,'readonly');
    const requests = ordered.map(id => requestResult(tx.objectStore(ARCHIVE_STORE).get(id)));
    const records = await Promise.all(requests);
    await transactionDone(tx);
    return records.filter(p => p && p.blob instanceof Blob);
  } catch { return []; }
  finally { db?.close(); }
}

export async function deleteArchivedScannerPages(ids = []) {
  const keys = Array.from(new Set(ids.map(String).filter(Boolean)));
  if (!keys.length) return true;
  let db;
  try {
    db = await openArchiveDb();
    const tx = db.transaction(ARCHIVE_STORE,'readwrite');
    for (const key of keys) tx.objectStore(ARCHIVE_STORE).delete(key);
    await transactionDone(tx);
    return true;
  } catch { return false; }
  finally { db?.close(); }
}

/* LAB12: rinomina non distruttiva. Metadati aggiornati senza riscrivere immagini e OCR. */
export async function renameArchivedCollection(ids = [], title, {manual = true} = {}) {
  const name=sanitizeTitle(title,90);
  if (!name || !ids.length) return false;
  const keys=Array.from(new Set(ids.map(String).filter(Boolean)));
  let db;
  try {
    db=await openArchiveDb();
    const tx=db.transaction(ARCHIVE_STORE,'readwrite');
    const store=tx.objectStore(ARCHIVE_STORE);
    for(const id of keys) {
      const current=await requestResult(store.get(id));
      if (!current) continue; // non riportare in vita fotografie eliminate
      if (current.collectionManual && !manual) continue; // nomi scelti dall'utente prioritari
      store.put({...current,collection:name,collectionManual:Boolean(manual||current.collectionManual),updatedAt:new Date().toISOString()});
    }
    await transactionDone(tx);
    return true;
  } catch { return false; }
  finally { db?.close(); }
}

export async function renameArchivedPhoto(id,title) {
  const name=sanitizeTitle(title,90);
  if(!id || !name) return false;
  let db;
  try {
    db=await openArchiveDb();
    const tx=db.transaction(ARCHIVE_STORE,'readwrite');
    const store=tx.objectStore(ARCHIVE_STORE);
    const current=await requestResult(store.get(String(id)));
    if(!current) { await transactionDone(tx); return false; }
    store.put({...current,pageTitle:name,pageTitleManual:true,updatedAt:new Date().toISOString()});
    await transactionDone(tx);
    return true;
  } catch { return false; }
  finally { db?.close(); }
}
