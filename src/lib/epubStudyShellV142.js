// LAB142 EPUB preflight: constant-pass native study shell. Zero Gemini calls,
// no legacy six-level text generation, no expensive paragraph-level fidelity
// re-audit. The explained engine owns the actual 50% reduction and checkpoints.
// All chapter titles, paragraph text, sections and page anchors are retained.
import {auditMirrorAgainstSource} from './libroSpecchioV35.js';
export const EPUB_STUDY_SHELL_V142='lab142-epub-fast-original-shell-v1';
export function buildEpubStudyShellV142(source){
 const map=source?.canonicalBookMap;
 if(source?.sourceFormat!=='epub'||
    map?.paginationOwner!=='lab142-epub-immutable-logical-pages-v1'||
    !map?.exactTextCoverage||!map?.pages?.length)
  throw Error('Struttura originale EPUB non verificata: nessuna vecchia compressione avviata.');
 const chapters=(source.chapters||[]).map((chapter,chapterIndex)=>({
  ...chapter,sections:(chapter.sections||[]).map(x=>({...x})),
  paragraphs:(chapter.paragraphs||[]).map((original,i)=>{
   const meta=chapter.paragraphMeta?.[i]||{};
   const text=String(original||'');
   return {original:text,summary:text,dsaSummary:text,
    sourcePageStart:meta.pageStart||chapter.pageStart,
    sourcePageEnd:meta.pageEnd||meta.pageStart||chapter.pageStart,
    sourceSection:meta.sectionTitle||null,
    sourceChapterIndex:chapterIndex,sourceParagraphIndex:i,
    engine:'locale',editionPending:true,
    semanticCertified:false};
  })
 }));
 const mirrorStructureAudit=auditMirrorAgainstSource(map,{chapters});
 if(!mirrorStructureAudit.valid)
  throw Error('Capitoli o paragrafi EPUB fuori ordine: originale conservato.');
 const count=chapters.reduce((n,ch)=>n+ch.paragraphs.length,0);
 return {
  version:9,engine:'locale',sourceStructure:source.structure,
  canonicalBookMap:map,chapters,
  studyShellV142:EPUB_STUDY_SHELL_V142,
  quality:{
   mirrorStructureAudit,
   paragraphs:count,localParagraphs:count,
   aiParagraphs:0,mixedParagraphs:0,
   sourceProvenance:{
    originalFingerprint:map.originalFingerprint,
    basis:map.fingerprintBasis,
    pageCount:map.pageCount,semanticCertified:false
   },
   fidelityGate:{
    paragraphsChecked:0,paragraphsPassed:0,paragraphsFailed:0,
    conceptUnits:null,protectedItems:null,recoveredUnits:0,
    averageCoveragePercent:null,compressionPercent:null,
    passed:null,semanticCertified:false,
    note:'Il controllo didattico della sola lunghezza è eseguito dopo Gemini.'
   }
  }
 };
}
