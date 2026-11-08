// LAB70: one protocol identity shared by the Android generator and its isolated
// Cloudflare backend. Never silently accept an older Worker for new drafts.
export const STUDY_DRAFT_PROTOCOL_V70='lab70-draft-length-v1';

export function verifyStudyDraftResponseV70(response,sourceLetters,level){
 const safe=Number(sourceLetters);
 if(response?.draftProtocol!==STUDY_DRAFT_PROTOCOL_V70||
    !Number.isFinite(safe)||safe<=0||
    response?.lengthReview?.sourceLetters!==safe||
    response?.level!==String(level)){
   return {ok:false,code:'AI_DRAFT_BACKEND_VERSION_MISMATCH',
     message:'Il servizio Gemini non corrisponde al motore LAB70: le bozze già salvate rimangono intatte.'};
 }
 return {ok:true};
}
