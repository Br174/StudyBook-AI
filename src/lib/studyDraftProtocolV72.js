// LAB72 protocol identity only. Numeric owner remains STUDY_TARGET_V67.
export const STUDY_DRAFT_PROTOCOL_V72='lab72-canonical-range-observability-v1';

export function verifyStudyDraftResponseV72(response,sourceLetters,level){
 const ok=response?.draftProtocol===STUDY_DRAFT_PROTOCOL_V72&&
   response?.level===String(level)&&Number.isFinite(sourceLetters)&&sourceLetters>0&&
   response?.lengthReview?.sourceLetters===sourceLetters&&
   Number.isFinite(response?.lengthReview?.observedLetters)&&
   typeof response?.lengthReview?.withinBand==='boolean'&&
   typeof response?.lengthReview?.compliant==='boolean'&&
   Object.hasOwn(response||{},'finishReason')&&
   Number.isFinite(response?.outputTokenLimit);
 if(!ok)return {ok:false,code:'AI_DRAFT_BACKEND_VERSION_MISMATCH',
   message:'Il servizio Gemini non corrisponde al protocollo diagnostico LAB72; bozze e origine preservate.'};
 return {ok:true,withinBand:response.lengthReview.withinBand,
   compliant:response.lengthReview.compliant,
   finishReason:response.finishReason};
}
