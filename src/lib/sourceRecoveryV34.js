// LAB34 "Riesamina PDF originale": reacquire only suspicious pages, never
// mutate the archived Blob, prior source or prior processed study book in place.
import { getLibraryBook, saveLibraryBook } from './library.js';
import { requireIntegrityForStudy } from './integrity360Core.js';
import { compareAcquisitions, auditSourceAgainstOriginal } from './sourceShieldV34.js';
import { auditBookSourceCoverage } from './studyQualityGuard.js';
import { markResumeStatePublished } from './resumeStore.js';

export async function reacquireFromSavedPdf(id,{
  loadBook=getLibraryBook,saveBook=saveLibraryBook,read=null,build=null,
  audit=auditBookSourceCoverage,onProgress,
}={}) {
  const record=await loadBook(id);
  if (!record?.originalFile) throw new Error('PDF originale non conservato: non posso ricostruire le parti mancanti.');
  const file=record.originalFile;
  if (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name||record.fileName||'')) {
    throw new Error('Recupero sorgente supportato per PDF: il file originale non è un PDF.');
  }
  const old=record.sourceData||null;
  const sourcePages=old?.pages || [];
  const previouslyAudited=Boolean(old?.sourceShield?.sourceSha256
    && old?.sourceShield?.pdfPageCount === sourcePages.length);
  const legacyAudit=previouslyAudited ? null : auditSourceAgainstOriginal({
    pages:sourcePages,
    pdfPageCount:old?.integrity360?.pageCount || sourcePages.length,
    fingerprint:old?.originalFingerprint || '',
  });
  const suspiciousFromAudit=old?.sourceShield?.reviewPages
    || old?.integrity360?.sourceReviewPages || legacyAudit?.reviewPages || [];
  // Older LAB imports could have cached text even when no source-level
  // verification was ever performed. In an explicit user-triggered recheck
  // re-extract all pages once; NEVER accept a stale "verified" cache blindly.
  const suspicious=(!previouslyAudited || !suspiciousFromAudit.length)
    ? Array.from({length:sourcePages.length},(_,i)=>i+1)
    : suspiciousFromAudit;
  const retriever=read || (await import('./documentParserV11.js')).readSourceFile;
  onProgress?.({phase:'source-recovery-start',done:0,total:1,reviewPages:suspicious.length});
  const fresh=await retriever(file,{
    autoOcr:false,textOnly:true,retryPages:suspicious,
    forceReextractAll:!previouslyAudited || !suspiciousFromAudit.length,
    onProgress,
  });
  if (!fresh?.pages?.length || !fresh?.chapters?.length)
    throw new Error('Riesame interrotto: originale e precedente versione sono conservati.');
  if (old?.originalFingerprint && old.originalFingerprint !== fresh.originalFingerprint)
    throw new Error('L’impronta del PDF non coincide con il documento precedente: nessun dato sostituito.');
  requireIntegrityForStudy(fresh);
  const compare=compareAcquisitions(old,fresh);
  if (old?.pages?.length && !compare.publishable)
    throw new Error('Il nuovo testo presenta pagine più corte o meno complete del precedente. Originale e precedente libro conservati.');
  let generated=record.studyBook||null;
  if (generated) {
    const builder=build || (await import('./studyEngineV10.js')).buildStudyBook;
    generated=await builder(fresh,{
      level:record.studyBook.level||'studio',preferAi:true,forceFresh:true,
      onProgress:(done,total,phase,meta)=>onProgress?.({
        phase:'study-'+phase,done,total,meta,
      }),
    });
    if (!generated?.chapters?.length) throw new Error('Rielaborazione non terminata: versione precedente conservata.');
    const check=audit(fresh,generated);
    if ((check?.issues||[]).some(issue=>issue.type!=='source-ending')) {
      throw new Error('Il controllo rileva possibili omissioni. Il libro precedente è stato conservato.');
    }
    generated={...generated,quality:{
      ...(generated.quality||{}),sourceIntegrity:check,
      sourceRecheckedFromSavedOriginal:true,
      sourceRecheckComparison:compare,
    }};
  }
  // One atomic library transaction AFTER the full PDF + derived book checks.
  const saved=await saveBook({
    id:record.id,fileName:record.fileName,profileId:record.profileId||'default',
    originalFile:file,sourceData:fresh,studyBook:generated,
    dsaMode:record.dsaMode!==false,subject:record.subject,
    collections:record.collections,favorite:record.favorite,
    readingProgress:record.readingProgress,
  });
  if (!saved || saved.id!==record.id) throw new Error('Salvataggio non confermato: verifica la Libreria.');
  if (generated?.resumeSignature||generated?.quality?.resumeSignature)
    await markResumeStatePublished(generated.resumeSignature||generated.quality.resumeSignature);
  return {record:saved,sourceComparison:compare,reviewPages:fresh.sourceShield?.reviewPages||[]};
}
