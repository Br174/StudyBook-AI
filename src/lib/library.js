import {deleteSimplePagesForBookV50} from './simplePagesStoreV50.js';
const DB_NAME = 'studybook-ai';
const DB_VERSION = 3;
const SUMMARIES_STORE = 'bookSummaries';
const CHECKPOINTS_STORE = 'bookStudyCheckpoints';
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
      // Index old books once; full PDF/source stay entirely in BOOKS_STORE.
      if (!db.objectStoreNames.contains(SUMMARIES_STORE)) {
        const summaries=db.createObjectStore(SUMMARIES_STORE,{keyPath:'id'});
        const cursorRequest=books.openCursor();
        cursorRequest.onsuccess=()=>{
          const cursor=cursorRequest.result;
          if(!cursor)return;
          summaries.put(libraryBookSummary(cursor.value));
          cursor.continue();
        };
      }
      if (!db.objectStoreNames.contains(CHECKPOINTS_STORE))
        db.createObjectStore(CHECKPOINTS_STORE,{keyPath:'id'});
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
      const names=Array.isArray(storeName)?storeName:[storeName];
      const tx=db.transaction(names,mode);
      const store=tx.objectStore(names[0]);
      let request;
      try { request=action(store,tx); } catch(error){reject(error);return;}
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

// Lightweight navigation index: never clone the original PDF, parsed source
// or generated 2,000-page edition just to display a title and thumbnail.
export function libraryBookSummary(record={}){
  const {sourceData,studyBook,originalFile,...summary}=record;
  return {...summary,
    profileId:summary.profileId||'default',
    subject:summary.subject||inferSubject(summary.fileName),
    collections:summary.collections||[],
    favorite:Boolean(summary.favorite),
    original:{...(summary.original||{name:summary.fileName}),
      available:Boolean(originalFile)},
    metadata:{...(summary.metadata||{}),
      hasOriginal:Boolean(originalFile),
      hasProcessed:Boolean(studyBook||summary.metadata?.hasProcessed)}
  };
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
      available: Boolean(originalFile || previous?.originalFile),
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
      // A stored original PDF and its parsed pages are distinct from AI chunks.
      pages: sourceData?.structure?.pageCount || sourceData?.pages?.length
        || previous?.metadata?.pages || 0,
      pagesAcquired: (sourceData?.structure?.pageCount || sourceData?.pages?.length)
        || previous?.metadata?.pagesAcquired || 0,
      level: studyBook?.level || 'studio',
      engine: studyBook?.engine || 'locale',
      hasOriginal: Boolean(originalFile || previous?.originalFile),
      hasProcessed: Boolean(studyBook || previous?.studyBook),
      fidelityPassed: Boolean(studyBook?.quality?.fidelityGate?.passed),
      compressionPercent: Number(studyBook?.quality?.fidelityGate?.compressionPercent || 0),
      geminiEditionIncomplete: Boolean(studyBook?.editionsV36 && studyBook.editionsV36.complete !== true),
      sourceFingerprint:String(studyBook?.canonicalBookMap?.originalFingerprint||
        previous?.metadata?.sourceFingerprint||''),
      geminiEditionDrafted: Number(studyBook?.editionsV36?.draftUnitsSaved || 0),
      geminiEditionVerified: Number(studyBook?.editionsV36?.verifiedChunkVariants || 0),
      geminiEditionTotal: Number(studyBook?.editionsV36?.totalChunkVariants || 0),
    },
  };
  await withStore([BOOKS_STORE,SUMMARIES_STORE,CHECKPOINTS_STORE],
    'readwrite',(store,tx)=>{
      tx.objectStore(SUMMARIES_STORE).put(libraryBookSummary(record));
      // A full Book save is the authoritative final checkpoint.
      tx.objectStore(CHECKPOINTS_STORE).delete(record.id);
      return store.put(record);
    });
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
  await withStore([BOOKS_STORE,SUMMARIES_STORE], 'readwrite',(store,tx)=>{
    tx.objectStore(SUMMARIES_STORE).put(libraryBookSummary(next));
    return store.put(next);
  });
  return next;
}

export async function listLibraryBooks({profileId=null}={}){
  const db=await openDb();
  try{
    const summaries=await requestResult(db.transaction(SUMMARIES_STORE,'readonly')
      .objectStore(SUMMARIES_STORE).getAll());
    return summaries.filter(x=>!profileId||(x.profileId||'default')===profileId)
      .sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)));
  }finally{db.close()}
}

// LAB138: a reimport of the exact same book must not silently start at zero
// when a richer immutable checkpoint is still in the user's Library. Search
// the tiny summary index first, then read at most eight likely matches. The
// source fingerprint MUST be equal; titles or page counts alone never suffice.
export async function findBestExplainedCheckpointV138({
  sourceFingerprint,pageCount,fileName='',profileId='default',excludeId=null
}={}){
 const fingerprint=String(sourceFingerprint||'');
 if(fingerprint.length<16||!Number.isInteger(pageCount)||pageCount<1)return null;
 const expectedName=String(fileName||'').trim().toLocaleLowerCase('it-IT');
 const listing=await listLibraryBooks({profileId});
 const eligible=listing.filter(item=>{
  if(item.id===excludeId)return false;
  const meta=item.metadata||{};
  if(Number(meta.pages||0)!==pageCount)return false;
  if(!meta.geminiEditionIncomplete&&!meta.geminiEditionVerified&&!meta.geminiEditionDrafted)
   return false;
  const metaFingerprint=String(meta.sourceFingerprint||'');
  return metaFingerprint?metaFingerprint===fingerprint:
   String(item.fileName||'').trim().toLocaleLowerCase('it-IT')===expectedName;
 }).sort((a,b)=>Number(b.metadata?.geminiEditionVerified||0)-
   Number(a.metadata?.geminiEditionVerified||0));
 let best=null,score=-1;
 for(const item of eligible.slice(0,8)){
  const record=await getLibraryBook(item.id).catch(()=>null);
  const edition=record?.studyBook?.editionsV36;
  if(record?.studyBook?.canonicalBookMap?.originalFingerprint!==fingerprint||
     edition?.sourceFingerprint!==fingerprint||
     edition?.version!=='lab126-whole-book-comprehension-v1'||
     Number(edition.originalPages||0)!==pageCount)continue;
  const verified=Math.max(0,Number(edition.verifiedChunkVariants||0));
  const drafts=Math.max(0,Number(edition.draftUnitsSaved||0));
  const importance=verified*(pageCount+1)+drafts;
  if(importance>score&&(verified>0||drafts>0)){
   best={edition,sourceId:item.id,verifiedPages:verified,draftedPages:drafts};
   score=importance;
  }
 }
 return best;
}

export async function getLibraryBook(id){
  const db=await openDb();
  try{
    const tx=db.transaction([BOOKS_STORE,CHECKPOINTS_STORE],'readonly');
    const original=tx.objectStore(BOOKS_STORE).get(id);
    const checkpoint=tx.objectStore(CHECKPOINTS_STORE).get(id);
    const [book,latest]=await Promise.all([requestResult(original),requestResult(checkpoint)]);
    if(!book)return null;
    // LAB136: new checkpoints contain only the changing AI edition. Retain
    // compatibility with legacy checkpoints that contained an entire book.
    if(latest?.editionV36)return {...book,
      studyBook:{...(book.studyBook||{}),editionsV36:latest.editionV36,
        engine:latest.editionV36.complete?'ai':'misto'},
      updatedAt:latest.updatedAt||book.updatedAt};
    return latest?.studyBook?{...book,studyBook:latest.studyBook,
      updatedAt:latest.updatedAt||book.updatedAt}:book;
  }finally{db.close()}
}
// LAB135: save only the generated study edition, NEVER copy the original PDF
// and parsed source at every successful Gemini block. Single atomic writer.
export async function saveExplainedCheckpoint(id,studyBook){
  if(!id||!studyBook?.editionsV36)throw Error('Checkpoint libro non valido.');
  const now=new Date().toISOString();
  await withStore([CHECKPOINTS_STORE,SUMMARIES_STORE],'readwrite',(store,tx)=>{
    const summaryStore=tx.objectStore(SUMMARIES_STORE);
    const lookup=summaryStore.get(id);
    lookup.onsuccess=()=>{
      const prior=lookup.result;
      if(!prior)return;
      const snapshot=studyBook.editionsV36;
      summaryStore.put({...prior,updatedAt:now,
        metadata:{...(prior.metadata||{}),hasProcessed:true,
          geminiEditionIncomplete:snapshot.complete!==true,
          sourceFingerprint:String(studyBook?.canonicalBookMap?.originalFingerprint||
            prior.metadata?.sourceFingerprint||''),
          geminiEditionDrafted:Number(snapshot.draftUnitsSaved||0),
          geminiEditionVerified:Number(snapshot.verifiedChunkVariants||0),
          geminiEditionTotal:Number(snapshot.totalChunkVariants||0)}});
    };
    // Never store parsed 2,000-page source or book metadata on every AI block.
    // The authoritative original lives unchanged in BOOKS_STORE.
    return store.put({id,editionV36:studyBook.editionsV36,updatedAt:now});
  });
  return true;
}

export async function deleteLibraryBook(id) {
  await withStore([BOOKS_STORE,SUMMARIES_STORE,CHECKPOINTS_STORE],
    'readwrite',(store,tx)=>{
      tx.objectStore(SUMMARIES_STORE).delete(id);
      tx.objectStore(CHECKPOINTS_STORE).delete(id);
      return store.delete(id);
    });
  await deleteSimplePagesForBookV50(id).catch(()=>null);
}


/* LAB13: cancella una singola versione, mantenendo l'altra e i dati di
   lettura. L'eliminazione integrale resta un'azione esplicita separata. */
export async function deleteLibraryVersion(id, version) {
  if (version !== 'original' && version !== 'processed') throw new Error('Versione non riconosciuta.');
  const record = await getLibraryBook(id);
  if (!record) return false;
  const next = {
    ...record,
    updatedAt: new Date().toISOString(),
    metadata: { ...(record.metadata || {}) },
  };
  if (version === 'original') {
    next.originalFile = null;
    next.original = { ...(record.original || {}), available: false };
    next.metadata.hasOriginal = false;
  } else {
    next.studyBook = null;
    next.metadata.hasProcessed = false;
  }
  if (!next.metadata.hasOriginal && !next.metadata.hasProcessed) {
    await deleteLibraryBook(id);
  } else {
    await withStore([BOOKS_STORE,SUMMARIES_STORE,CHECKPOINTS_STORE],
      'readwrite',(store,tx)=>{
        tx.objectStore(SUMMARIES_STORE).put(libraryBookSummary(next));
        tx.objectStore(CHECKPOINTS_STORE).delete(id);
        return store.put(next);
      });
  }
  return true;
}
