// LAB34 Fonte Blindata. Two independent truths:
// 1) The archived PDF bytes are immutable and content-addressed.
// 2) Extracted text is evidence, NEVER proof of semantic OCR completeness.
// Do not discard a suspicious sentence or fabricate its completion.
const clean = value => String(value || '').replace(/\s+/g,' ').trim();

export function inspectAcquiredPage(page, previous = null, next = null) {
  const text=clean(page?.text);
  const number=Number(page?.pageNumber||0);
  const issues=[];
  if (page?.status !== 'verified') issues.push('not-extracted');
  if (!text) {
    issues.push('no-recognized-text'); // May be a blank/cover/diagram page, manual review.
  } else {
    if (text.includes('\uFFFD') || /[|¤_]{6,}/u.test(text)) issues.push('unrecognized-glyphs');
    if (/^[,;:.)]/u.test(text)) issues.push('orphan-page-start');
    // Do not call every unpunctuated page a loss: text naturally runs over pages.
    if (/(?:\b(?:mediante|durante|perché|poiché|mentre|ossia|che|di|del|della|con|per)\s*)$/iu.test(text)
      && (!next || /^[A-ZÀ-Ö0-9]/u.test(clean(next.text)))) {
      issues.push('possible-page-ending-gap');
    }
    const letters=(text.match(/\p{L}/gu)||[]).length;
    if (text.length>60 && letters < text.length * 0.14) issues.push('mostly-symbols');
  }
  if (text && text.length < 65 && (page?.imageCount||page?.inkCount||0)>0)
    issues.push('visual-text-coverage-uncertain');
  return {pageNumber:number, issues, readyForStudy:page?.status==='verified'
      && !issues.includes('unrecognized-glyphs') && !issues.includes('not-extracted')
      && !issues.includes('no-recognized-text')
      && !issues.includes('visual-text-coverage-uncertain'),
    textLength:text.length, evidenceSource:page?.source||'unknown'};
}

export function auditSourceAgainstOriginal({pages=[],pdfPageCount=0,fingerprint=''}={}) {
  const expected=Math.max(0,Number(pdfPageCount)||0);
  const ordered=pages.length===expected && pages.every((p,i)=>p?.pageNumber===i+1);
  const reviews=pages.map((page,index)=>inspectAcquiredPage(page,pages[index-1],pages[index+1]))
    .filter(row=>row.issues.length);
  const missing=[];
  for(let i=0;i<expected;i++)if(pages[i]?.pageNumber!==i+1 || pages[i]?.status!=='verified')missing.push(i+1);
  return {
    sourceSha256:fingerprint||null, pdfPageCount:expected,
    extractedPageCount:pages.filter(p=>p?.status==='verified').length,
    pageNumbersOrdered:ordered, missingOrFailedPages:missing,
    reviewPages:reviews.map(row=>row.pageNumber),
    findings:reviews.slice(0,300),
    textReady:expected>0 && ordered && !missing.length &&
      reviews.every(row=>row.readyForStudy),
    // Do not conflate byte-perfect source transfer with perfect OCR.
    bytesVerified:Boolean(fingerprint && /^[a-f0-9]{64}$/i.test(fingerprint)),
    semanticCertified:false,
  };
}

// Re-extraction must NEVER silently replace a formerly more complete page
// with a shorter result. A disagreement is evidence for targeted review.
export function compareAcquisitions(oldDoc,newDoc) {
  const before=new Map((oldDoc?.pages||[]).map(page=>[page.pageNumber,page]));
  const disputes=[];
  for(const row of newDoc?.pages||[]){
    const prior=before.get(row.pageNumber);
    if (!prior || prior.status!=='verified') continue;
    if(row.status!=='verified') disputes.push({page:row.pageNumber,reason:'regressed-status'});
    else if (clean(row.text).length < clean(prior.text).length*.80)
      disputes.push({page:row.pageNumber,reason:'shorter-than-prior-extraction'});
  }
  const previousReady=Number(oldDoc?.integrity360?.verifiedPages||0);
  const currentReady=Number(newDoc?.integrity360?.verifiedPages||0);
  return {publishable:!disputes.length && currentReady>=previousReady,
    disputes, previousReady, currentReady};
}
