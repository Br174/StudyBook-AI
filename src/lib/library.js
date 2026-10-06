const DB_NAME = 'studybook-ai';
const DB_VERSION = 2;
const BOOKS_STORE = 'books';
const PROFILES_STORE = 'profiles';

function openDb() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in globalThis)) {
      reject(new Error('Archivio locale non supportato da questo dispositivo.'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      const tx = request.transaction;
      let books;
      if (!db.objectStoreNames.contains(BOOKS_STORE)) books = db.createObjectStore(BOOKS_STORE, { keyPath: 'id' });
      else books = tx.objectStore(BOOKS_STORE);
      if (!books.indexNames.contains('updatedAt')) books.createIndex('updatedAt', 'updatedAt');
      if (!books.indexNames.contains('profileId')) books.createIndex('profileId', 'profileId');
      if (!books.indexNames.contains('subject')) books.createIndex('subject', 'subject');
      if (!db.objectStoreNames.contains(PROFILES_STORE)) {
        const profiles = db.createObjectStore(PROFILES_STORE, { keyPath: 'id' });
        profiles.createIndex('updatedAt', 'updatedAt');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Impossibile aprire la Libreria.'));
  });
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Errore di lettura Libreria.'));
  });
}

async function withStore(storeName, mode, action) {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);
      let request;
      try { request = action(store); } catch (error) { reject(error); return; }
      tx.oncomplete = () => resolve(request?.result ?? request);
      tx.onerror = () => reject(tx.error || new Error('Errore nella Libreria.'));
      tx.onabort = () => reject(tx.error || new Error('Operazione Libreria annullata.'));
    });
  } finally {
    db.close();
  }
}

function clean(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

export function inferSubject(fileName = '', sourceData = null) {
  const text = clean([
    fileName,
    ...(sourceData?.chapters || []).slice(0, 14).map((chapter) => chapter.title),
  ].join(' ')).toLocaleLowerCase('it-IT');
  const rules = [
    ['Diritto civile', /\b(?:diritto civile|obbligazioni|contratti|successioni|diritti reali)\b/],
    ['Diritto penale', /\b(?:diritto penale|reato|delitti|contravvenzioni|pena)\b/],
    ['Diritto costituzionale', /\b(?:diritto costituzionale|costituzione|corte costituzionale)\b/],
    ['Diritto amministrativo', /\b(?:diritto amministrativo|pubblica amministrazione|procedimento amministrativo)\b/],
    ['Procedura civile', /\b(?:procedura civile|processo civile)\b/],
    ['Procedura penale', /\b(?:procedura penale|processo penale)\b/],
    ['Economia', /\b(?:economia|microeconomia|macroeconomia)\b/],
    ['Biologia', /\b(?:biologia|cellula|genetica)\b/],
    ['Storia', /\b(?:storia|storico|storica)\b/],
    ['Letteratura', /\b(?:letteratura|poesia|narrativa)\b/],
    ['Psicologia', /\b(?:psicologia|cognitiv|comportamento)\b/],
    ['Fisica', /\b(?:fisica|meccanica|termodinamica)\b/],
    ['Chimica', /\b(?:chimica|molecola|reazione chimica)\b/],
  ];
  return rules.find(([, pattern]) => pattern.test(text))?.[0] || 'Altro';
}

export function createLibraryId() {
  return globalThis.crypto?.randomUUID?.() || `book-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export async function ensureDefaultProfile() {
  const existing = await getProfile('default').catch(() => null);
  if (existing) return existing;
  const now = new Date().toISOString();
  const profile = { id: 'default', name: 'Bruno', createdAt: now, updatedAt: now };
  await withStore(PROFILES_STORE, 'readwrite', (store) => store.put(profile));
  return profile;
}

export async function saveProfile(profile) {
  const now = new Date().toISOString();
  const record = {
    id: clean(profile?.id) || createLibraryId(),
    name: clean(profile?.name) || 'Profilo',
    createdAt: profile?.createdAt || now,
    updatedAt: now,
  };
  await withStore(PROFILES_STORE, 'readwrite', (store) => store.put(record));
  return record;
}

export async function listProfiles() {
  const db = await openDb();
  try {
    const profiles = await requestResult(db.transaction(PROFILES_STORE, 'readonly').objectStore(PROFILES_STORE).getAll());
    return profiles.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  } finally {
    db.close();
  }
}

export async function getProfile(id = 'default') {
  const db = await openDb();
  try {
    return await requestResult(db.transaction(PROFILES_STORE, 'readonly').objectStore(PROFILES_STORE).get(id));
  } finally {
    db.close();
  }
}

export async function saveLibraryBook({
  id, fileName, sourceData, studyBook, dsaMode = true, profileId = 'default',
  originalFile = null, subject, collections, favorite, readingProgress,
}) {
  const previous = id ? await getLibraryBook(id).catch(() => null) : null;
  const now = new Date().toISOString();
  const resolvedSubject = clean(subject || previous?.subject || inferSubject(fileName, sourceData));
  const record = {
    ...(previous || {}),
    id: id || createLibraryId(),
    profileId: clean(profileId || previous?.profileId) || 'default',
    fileName: clean(fileName) || 'StudyBook',
    createdAt: previous?.createdAt || studyBook?.generatedAt || now,
    updatedAt: now,
    dsaMode: Boolean(dsaMode),
    sourceData: sourceData || previous?.sourceData || null,
    studyBook: studyBook || previous?.studyBook || null,
    originalFile: originalFile || previous?.originalFile || null,
    original: {
      name: clean(originalFile?.name || previous?.original?.name || fileName) || 'Originale',
      type: originalFile?.type || previous?.original?.type || sourceData?.sourceFormat || '',
      size: Number(originalFile?.size || previous?.original?.size || 0),
      lastModified: Number(originalFile?.lastModified || previous?.original?.lastModified || 0),
      available: Boolean(originalFile || previous?.originalFile || sourceData),
    },
    subject: resolvedSubject,
    collections: Array.isArray(collections) ? collections : (previous?.collections || []),
    favorite: typeof favorite === 'boolean' ? favorite : Boolean(previous?.favorite),
    readingProgress: readingProgress || previous?.readingProgress || { chapter: 0, percent: 0 },
    metadata: {
      chapters: studyBook?.chapters?.length || sourceData?.chapters?.length || 0,
      paragraphs: (studyBook?.chapters || sourceData?.chapters || []).reduce(
        (total, chapter) => total + (chapter.paragraphs?.length || 0), 0,
      ),
      pages: sourceData?.structure?.pageCount || sourceData?.pages?.length || 0,
      level: studyBook?.level || 'studio',
      engine: studyBook?.engine || 'locale',
      hasOriginal: Boolean(originalFile || previous?.originalFile || sourceData),
      hasProcessed: Boolean(studyBook || previous?.studyBook),
      fidelityPassed: Boolean(studyBook?.quality?.fidelityGate?.passed),
      compressionPercent: Number(studyBook?.quality?.fidelityGate?.compressionPercent || 0),
    },
  };
  await withStore(BOOKS_STORE, 'readwrite', (store) => store.put(record));
  return record;
}

export async function updateLibraryMetadata(id, patch = {}) {
  const record = await getLibraryBook(id);
  if (!record) throw new Error('Libro non disponibile.');
  const next = {
    ...record,
    ...patch,
    collections: Array.isArray(patch.collections) ? patch.collections : record.collections,
    updatedAt: new Date().toISOString(),
  };
  await withStore(BOOKS_STORE, 'readwrite', (store) => store.put(next));
  return next;
}

export async function listLibraryBooks({ profileId = null } = {}) {
  const db = await openDb();
  try {
    const records = await requestResult(db.transaction(BOOKS_STORE, 'readonly').objectStore(BOOKS_STORE).getAll());
    return records
      .filter((item) => !profileId || (item.profileId || 'default') === profileId)
      .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
      .map(({ sourceData, studyBook, originalFile, ...summary }) => ({
        ...summary,
        profileId: summary.profileId || 'default',
        subject: summary.subject || inferSubject(summary.fileName),
        collections: summary.collections || [],
        favorite: Boolean(summary.favorite),
        original: summary.original || { name: summary.fileName, available: true },
      }));
  } finally {
    db.close();
  }
}

export async function getLibraryBook(id) {
  const db = await openDb();
  try {
    return await requestResult(db.transaction(BOOKS_STORE, 'readonly').objectStore(BOOKS_STORE).get(id));
  } finally {
    db.close();
  }
}

export async function deleteLibraryBook(id) {
  await withStore(BOOKS_STORE, 'readwrite', (store) => store.delete(id));
}
