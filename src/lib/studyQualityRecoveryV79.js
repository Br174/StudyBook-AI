// LAB79: distinguish a completed LOCAL quality audit from an unfinished
// Gemini generation. Prevent pointless 1.2s re-audit/restart loops.
export const STUDY_QUALITY_RECOVERY_V79='lab79-audited-drafts-targeted-recalibration-v1';
export function hasFinishedLocalAuditV79(snapshot){
 return Boolean(snapshot?.draftComplete&&snapshot?.draftRowsV57&&
  snapshot?.publicationModeV66==='lab78-numeric-gate-semantic-unverified'&&
  snapshot?.qualityV66?.levels&&snapshot?.qualityV66?.summary);
}
export function requiresRecalibrationV79(snapshot){
 return hasFinishedLocalAuditV79(snapshot)&&snapshot.complete!==true&&
  snapshot.qualityV66.summary.numericAndGeometryCompleteV78!==true;
}
export function recoveryActionV79(snapshot){
 if(!snapshot||snapshot.complete)return 'none';
 if(requiresRecalibrationV79(snapshot))return 'manual-recalibration';
 if(hasFinishedLocalAuditV79(snapshot))return 'none';
 if(snapshot.draftComplete&&snapshot.draftRowsV57)return 'local-audit';
 return 'resume-generation';
}
