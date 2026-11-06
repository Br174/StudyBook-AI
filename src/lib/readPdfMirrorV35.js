// LAB35 safe adapter layered on the verified LAB34 PDF text acquisition.
// Text checkpoints stay owned by Integrity 360. This adds a SECOND
// content-addressed metadata phase, not a second parser of text.
import * as pdfjsLib from 'pdfjs-dist';
import { readPdfIntegrity360 } from './pdfIntegrityTurbo.js';
import { scanPdfPageFigures, loadPdfMirrorOutline } from './visualMirrorV35.js';
import { loadMirrorVisualPages,saveMirrorVisualPage } from './mirrorVisualStoreV35.js';
import { buildCanonicalBookMap } from './libroSpecchioV35.js';
import { detectChaptersFromPages } from './documentParserV10.js';
import { choosePdfChapterAuthority } from './outlineAuthorityV35.js';

export async function readPdfMirrorV35(file,options={}){
  const progress=options.onProgress;
  const parsed=await readPdfIntegrity360(file,options);
  const fingerprint=parsed.originalFingerprint;
  if(!fingerprint || !/^[a-f0-9]{64}$/i.test(fingerprint))
    throw new Error('Impossibile verificare il PDF originale per il Libro Specchio.');
  const signature='mirror35:'+fingerprint;
  const cached=await loadMirrorVisualPages(signature);
  const documentBytes=new Uint8Array(await file.arrayBuffer());
  const pdf=await pdfjsLib.getDocument({data:documentBytes}).promise;
  try {
    const pageCount=pdf.numPages;
    if(parsed.pages?.length!==pageCount)
      throw new Error('Il numero di pagine del PDF è diverso dal testo acquisito.');
    const original=await loadPdfMirrorOutline(pdf);
    const rows=[],every=Math.max(1,Math.min(6,Math.floor(pageCount/50)||1));
    let done=0,failures=0,restored=0;
    progress?.({phase:'mirror-figure-map',done:0,total:pageCount,restored:cached.size});
    for(let i=1;i<=pageCount;i++){
      let row=cached.get(i);
      if(row)restored++;
      else {
        const page=await pdf.getPage(i);
        try {const scan=await scanPdfPageFigures(page,i);
          const vp=page.getViewport({scale:1});
          row={pageNumber:i,anchors:scan.anchors,review:scan.review,
            rasterCount:scan.rasterCount,vectorCount:scan.vectorCount,
            pageWidthPt:vp.width,pageHeightPt:vp.height};
          if(!await saveMirrorVisualPage(signature,i,row))
            failures++;
        }catch(error){
          failures++;
          row={pageNumber:i,anchors:[],review:['figure-scan-failed:'+String(error?.message||error).slice(0,90)]};
        }finally{try{page.cleanup?.()}catch{}}
      }
      rows.push(row);
      done++;
      if(done%every===0||done===pageCount){
        progress?.({phase:'mirror-figure-map',done,total:pageCount,restored,failures});
        await new Promise(resolve=>setTimeout(resolve,0));
      }
    }
    const anchors=rows.flatMap(r=>r.anchors||[]);
    // The unmerged parser preserves the physical owner of every paragraph.
    const detectedChapters=detectChaptersFromPages(parsed.pages||[]);
    const authority=choosePdfChapterAuthority(parsed.pages||[],detectedChapters,original.outline);
    const chapters=authority.chapters;
    const canonicalBookMap=buildCanonicalBookMap({
      pages:parsed.pages,chapters,outline:original.outline,pageLabels:original.pageLabels,
      pageDimensions:rows.map(row=>({widthPt:row.pageWidthPt,heightPt:row.pageHeightPt})),
      originalFingerprint:fingerprint,pdfPageCount:pageCount,visualAnchors:anchors,
    });
    const review=[...new Set([
      ...(canonicalBookMap.uncertain||[]),
      ...(authority.review||[]),
      ...(failures?['visual-page-checkpoint-or-scan-failed']:[]),
      ...rows.filter(r=>(r.review||[]).length).map(r=>'figure-review-on-page:'+r.pageNumber),
    ])];
    canonicalBookMap.uncertain=review;
    canonicalBookMap.structuralStatus=review.length?'needs-review':'source-mapped';
    progress?.({phase:'mirror-index-verify',done:pageCount,total:pageCount,
      chapters:chapters.length,figures:anchors.length,review:review.length});
    return {
      ...parsed,chapters,canonicalBookMap,visualAnchors:anchors,
      visualPagesDetected:rows.filter(r=>(r.anchors||[]).length).length,
      assets:[],assetsTruncated:0,
      structure:{...(parsed.structure||{}),chapterCount:chapters.length,
        sectionCount:chapters.reduce((n,ch)=>n+(ch.sections||[]).length,0),
        paragraphCount:chapters.reduce((n,ch)=>n+(ch.paragraphs||[]).length,0),
        visualAnchorCount:anchors.length,
        chapterAuthority:authority.authority,
        mirrorEngine:'libro-specchio-v35',mirrorImageCheckpointSaved:pageCount-failures,
        mirrorImageCheckpointResumed:restored,
      },
      integrity360:{...(parsed.integrity360||{}),
        ready:parsed.integrity360?.ready!==false && failures===0,
        mirrorStructuralStatus:canonicalBookMap.structuralStatus,
        mirrorReview:review,mirrorFigurePages:pageCount,
        mirrorFigureCheckpointFailures:failures,
        semanticCertified:false,
      },
    };
  } finally {
    try{pdf.cleanup()}catch{}
    try{await pdf.destroy()}catch{}
  }
}
