const DB_NAME = 'studybook-ai';
const DB_VERSION = 1;
const STORE = 'books';

function openDb() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in globalThis)) {
      reject(new Error('Archivio locale non supportato da questo browser.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Impossibile aprire la Libreria.'));
  });
}

function runTransaction(mode, action) {
  return openDb().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    let result;

    try {
      result = action(store);
    } catch (error) {
      db.close();
      reject(error);
      return;
    }

    tx.oncomplete = () => {
      db.close();
      resolve(result?.result ?? result);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error || new Error('Errore nella Libreria.'));
    };
    tx.onabort = () => {
      db.close();
      reject(tx.error || new Error('Operazione Libreria annullata.'));
    };
  }));
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Errore di lettura Libreria.'));
  });
}

export function createLibraryId() {
  return globalThis.crypto?.randomUUID?.() || `book-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export async function saveLibraryBook({ id, fileName, sourceData, studyBook, dsaMode = true }) {
  const now = new Date().toISOString();
  const record = {
    id: id || createLibraryId(),
    fileName: String(fileName || 'StudyBook').trim() || 'StudyBook',
    createdAt: studyBook?.generatedAt || now,
    updatedAt: now,
    dsaMode: Boolean(dsaMode),
    sourceData,
    studyBook,
    metadata: {
      chapters: studyBook?.chapters?.length || sourceData?.chapters?.length || 0,
      paragraphs: (studyBook?.chapters || sourceData?.chapters || []).reduce(
        (total, chapter) => total + (chapter.paragraphs?.length || 0),
        0,
      ),
      pages: sourceData?.structure?.pageCount || sourceData?.pages?.length || 0,
      level: studyBook?.level || 'studio',
      engine: studyBook?.engine || 'locale',
    },
  };

  await runTransaction('readwrite', (store) => store.put(record));
  return record;
}

export async function listLibraryBooks() {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, 'readonly');
    const records = await requestResult(tx.objectStore(STORE).getAll());
    return records
      .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
      .map(({ sourceData, studyBook, ...summary }) => summary);
  } finally {
    db.close();
  }
}

export async function getLibraryBook(id) {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, 'readonly');
    return await requestResult(tx.objectStore(STORE).get(id));
  } finally {
    db.close();
  }
}

export async function deleteLibraryBook(id) {
  await runTransaction('readwrite', (store) => store.delete(id));
}
