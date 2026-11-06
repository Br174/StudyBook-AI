import { requireIntegrityForStudy } from './integrity360Core.js';
// Rebuild only the derived study edition from the stored source, in one safe commit.
// All original bytes, scan assets, covers, names and library organization survive.
import { getLibraryBook, saveLibraryBook } from './library.js';
import { auditBookSourceCoverage } from './studyQualityGuard.js';
import { inspectChapterBoundaries } from './chapterFidelityV33.js';


// LAB33: re-evaluate *existing stored pages* before rebuilding the study edition.
// Never redownload, mutate original PDF bytes or invent page text. Switch to
// recovered chapter boundaries only when measured coverage and order improve.
export async function recoverSavedPageStructure(sourceData) {
  const pages = (sourceData?.pages || []).filter(page =>
    Number.isInteger(page?.pageNumber) && String(page?.text || '').trim()
    && !['failed','ocr-pending'].includes(page.status));
  if (pages.length < 2 || !Array.isArray(sourceData?.chapters)) {
    return {sourceData,recovered:false,reason:'no-complete-stored-pages'};
  }
  try {
    const [{detectChaptersFromPages},{mergePageBoundaryParagraphs}]=await Promise.all([
      import('./documentParserV10.js'),import('./integrity360Core.js'),
    ]);
    const reconstructed=mergePageBoundaryParagraphs(detectChaptersFromPages(pages));
    const letters=chapters=>(chapters||[]).reduce((total,ch)=>
      total+(ch.paragraphs||[]).reduce((n,p)=>n+
        (String(typeof p==='string'?p:p?.original||p?.text||'')
          .match(/\p{L}/gu)||[]).length,0),0);
    const before=sourceData.chapters, previousLetters=letters(before);
    const rebuildLetters=letters(reconstructed);
    const priorAudit=inspectChapterBoundaries(before);
    const afterAudit=inspectChapterBoundaries(reconstructed);
    const similarChapterCount=reconstructed.length>=Math.max(1,Math.floor(before.length*0.75));
    const noLostContent=previousLetters===0 || rebuildLetters>=Math.floor(previousLetters*0.98);
    const improves=afterAudit.blockedChapters<priorAudit.blockedChapters
      || (reconstructed.length>before.length && afterAudit.blockedChapters<=priorAudit.blockedChapters);
    if (!similarChapterCount || !noLostContent || !improves) {
      return {sourceData,recovered:false,reason:'no-verified-better-structure',
        oldChapters:before.length,newChapters:reconstructed.length,
        previousLetters,rebuildLetters};
    }
    return {
      sourceData:{
        ...sourceData,chapters:reconstructed,
        structure:{...(sourceData.structure||{}),
          lab33RecoveredFromSavedPages:true,
          lab33PreviousChapterCount:before.length,
          lab33RebuiltChapterCount:reconstructed.length},
      },
      recovered:true,oldChapters:before.length,newChapters:reconstructed.length,
      previousLetters,rebuildLetters,
    };
  } catch(error) {
    return {sourceData,recovered:false,reason:'source-rebuild-unavailable',
      detail:String(error?.message||error).slice(0,120)};
  }
}

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

  requireIntegrityForStudy(record.sourceData);
  const structureRecovery=await recoverSavedPageStructure(record.sourceData);
  const verifiedSource=structureRecovery.sourceData;
  requireIntegrityForStudy(verifiedSource);

  // The source, not the former output, is the sole input to the new generation.
  // Load the heavy engine only when actually running; isolated regression tests
  // can inject their own builder without loading Android/Capacitor packages.
  const builder = build || (await import('./studyEngineV10.js')).buildStudyBook;
  const generated = await builder(verifiedSource, {
    level: record.studyBook.level || 'studio',
    preferAi: true,
    forceFresh: true,
    onProgress,
  });
  if (!(generated?.chapters || []).length) throw new Error('Rielaborazione incompleta: nessun capitolo generato.');
  const integrity = audit(verifiedSource, generated);
  // A pre-existing OCR ending warning can be retained, but missing/mutated
  // source paragraphs must never overwrite a valid installed edition.
  const hardIssues = (integrity?.issues || []).filter((issue) => issue.type !== 'source-ending');
  if (hardIssues.length) {
    throw new Error('Rielaborazione non salvata: il controllo ha rilevato possibili capitoli o paragrafi mancanti.');
  }

  const next = {
    ...generated,
    reprocessedAt: new Date().toISOString(),
    quality: { ...(generated.quality || {}), sourceIntegrity: integrity,
      sourceBoundaryRecovery:structureRecovery },
  };

  // Exactly ONE storage write after generation and validation. A thrown
  // generation/audit error cannot delete or replace the existing book.
  const saved = await saveBook({
    id: record.id,
    fileName: record.fileName,
    sourceData: verifiedSource,
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
