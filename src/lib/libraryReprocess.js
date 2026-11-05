// Rebuild only the derived study edition from the stored source, in one safe commit.
// All original bytes, scan assets, covers, names and library organization survive.
import { getLibraryBook, saveLibraryBook } from './library.js';
import { auditBookSourceCoverage } from './studyQualityGuard.js';

export function hasReprocessSource(record) {
  return Boolean(record?.sourceData?.chapters?.some((chapter) =>
    (chapter.paragraphs || []).some((part) =>
      String(typeof part === 'string' ? part : part?.original || part?.text || '').trim())));
}
export async function reprocessStoredBook(id, {
  loadBook = getLibraryBook,
  saveBook = saveLibraryBook,
  build = null,
  audit = auditBookSourceCoverage,
  onProgress,
} = {}) {
  if (!id) throw new Error('Selezionare un libro dalla Libreria.');
  const record = await loadBook(id);
  if (!record) throw new Error('Libro non presente nella Libreria.');
  if (!record.studyBook) throw new Error('Questo libro non ha ancora una versione elaborata.');
  if (!hasReprocessSource(record)) {
    throw new Error('Il testo di origine non è disponibile: importare nuovamente il documento originale.');
  }

  // The source, not the former output, is the sole input to the new generation.
  // Load the heavy engine only when actually running; isolated regression tests
  // can inject their own builder without loading Android/Capacitor packages.
  const builder = build || (await import('./studyEngineV10.js')).buildStudyBook;
  const generated = await builder(record.sourceData, {
    level: record.studyBook.level || 'studio',
    preferAi: true,
    forceFresh: true,
    onProgress,
  });
  if (!(generated?.chapters || []).length) throw new Error('Rielaborazione incompleta: nessun capitolo generato.');
  const integrity = audit(record.sourceData, generated);
  // A pre-existing OCR ending warning can be retained, but missing/mutated
  // source paragraphs must never overwrite a valid installed edition.
  const hardIssues = (integrity?.issues || []).filter((issue) => issue.type !== 'source-ending');
  if (hardIssues.length) {
    throw new Error('Rielaborazione non salvata: il controllo ha rilevato possibili capitoli o paragrafi mancanti.');
  }

  const next = {
    ...generated,
    reprocessedAt: new Date().toISOString(),
    quality: { ...(generated.quality || {}), sourceIntegrity: integrity },
  };

  // Exactly ONE storage write after generation and validation. A thrown
  // generation/audit error cannot delete or replace the existing book.
  const saved = await saveBook({
    id: record.id,
    fileName: record.fileName,
    sourceData: record.sourceData,
    studyBook: next,
    originalFile: record.originalFile || null,
    profileId: record.profileId || 'default',
    dsaMode: record.dsaMode !== false,
    subject: record.subject,
    collections: record.collections,
    favorite: record.favorite,
    readingProgress: record.readingProgress,
  });
  if (!saved?.studyBook) throw new Error('Impossibile confermare il salvataggio del libro rielaborato.');
  return saved;
}
