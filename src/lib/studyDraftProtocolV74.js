// LAB74 worker handshake; page budget is calculated from IMMUTABLE originals.
export const STUDY_DRAFT_PROTOCOL_V74='lab74-page-letter-budget-plusminus5-v1';
export function verifyStudyDraftResponseV74(reply,sourceLetters,level){
 const valid=reply?.draftProtocol===STUDY_DRAFT_PROTOCOL_V74&&
  reply?.level===String(level)&&
  Number.isSafeInteger(Number(sourceLetters))&&Number(sourceLetters)>0&&
  reply?.lengthReview?.sourceLetters===Number(sourceLetters)&&
  reply?.lengthReview?.pageReviewV74?.policy===
    'original-page-source-letters-plusminus-5pct-v1'&&
  Array.isArray(reply?.lengthReview?.pageReviewV74?.groups)&&
  typeof reply?.lengthReview?.pageReviewV74?.withinBand==='boolean'&&
  (typeof reply?.finishReason==='string'||reply?.finishReason===null);
 return valid?{ok:true,
  pageGroups:reply.lengthReview.pageReviewV74.groups.length,
  withinBand:reply.lengthReview.pageReviewV74.withinBand}:
  {ok:false,code:'AI_DRAFT_BACKEND_VERSION_MISMATCH',
   message:'La generazione per pagina richiede il Worker LAB74; bozze e PDF originali conservati.'};
}
