// LAB47: text-only fast path for books. Preserve the original PDF bytes in
// Library unchanged, but do NOT open the file a second time, scan PDF graphics,
// render JPEGs, run OCR or create visual IndexedDB checkpoints.
import { readPdfIntegrity360 } from './pdfIntegrityTurbo.js';
import { buildCanonicalBookMap } from './libroSpecchioV35.js';
import { detectChaptersFromPages } from './documentParserV10.js';
import { choosePdfChapterAuthority } from './outlineAuthorityV35.js';

export async function readPdfMirrorV35(file, options = {}) {
  const progress = options.onProgress;
  // Never allow a legacy autoOcr:true caller to re-enable image handling for
  // PDF books. Scanner's voluntary photo pipeline remains separate.
  const parsed = await readPdfIntegrity360(file,{
    ...options,autoOcr:false,textOnly:true,
  });
  const fingerprint=parsed.originalFingerprint;
  if(!fingerprint || !/^[a-f0-9]{64}$/i.test(fingerprint))
    throw new Error('Impossibile verificare il PDF originale per il Libro Specchio.');
  const pageCount=Number(parsed.structure?.pageCount||parsed.pages?.length||0);
  if(parsed.pages?.length!==pageCount)
    throw new Error('Il numero di pagine del PDF non coincide con il testo acquisito.');
  const originalOutline=Array.isArray(parsed.pdfOutline)?parsed.pdfOutline:[];
  const pageLabels=Array.isArray(parsed.pdfPageLabels)?parsed.pdfPageLabels:[];
  const detectedChapters=detectChaptersFromPages(parsed.pages||[]);
  const authority=choosePdfChapterAuthority(parsed.pages||[],detectedChapters,originalOutline);
  const chapters=authority.chapters;
  const canonicalBookMap=buildCanonicalBookMap({
    pages:parsed.pages,chapters,outline:originalOutline,pageLabels,
    originalFingerprint:fingerprint,pdfPageCount:pageCount,visualAnchors:[],
  });
  const review=[...new Set([
    ...(canonicalBookMap.uncertain||[]),
    ...(authority.review||[]),
  ])];
  canonicalBookMap.uncertain=review;
  canonicalBookMap.structuralStatus=review.length?'needs-review':'source-mapped';
  progress?.({phase:'mirror-index-verify',done:pageCount,total:pageCount,
    chapters:chapters.length,figures:0,review:review.length});
  return {
    ...parsed,chapters,canonicalBookMap,
    visualAnchors:[],visualPagesDetected:0,assets:[],assetsTruncated:0,
    structure:{...(parsed.structure||{}),
      chapterCount:chapters.length,
      sectionCount:chapters.reduce((n,ch)=>n+(ch.sections||[]).length,0),
      paragraphCount:chapters.reduce((n,ch)=>n+(ch.paragraphs||[]).length,0),
      visualAnchorCount:0,chapterAuthority:authority.authority,
      mirrorEngine:'libro-specchio-text-only-v47',
      mirrorImageCheckpointSaved:0,mirrorImageCheckpointResumed:0,
      textOnlyBookImport:true,
    },
    integrity360:{...(parsed.integrity360||{}),
      ready:parsed.integrity360?.ready===true,
      mirrorStructuralStatus:canonicalBookMap.structuralStatus,
      mirrorReview:review,mirrorFigurePages:0,mirrorFigureCheckpointFailures:0,
      semanticCertified:false,
    },
  };
}
