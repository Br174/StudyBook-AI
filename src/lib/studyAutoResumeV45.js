// Foreground-only, bounded restart plan. Never spin on an unresolved systemic error.
const QUALITY=['AI_QUALITY_REVIEW_REQUIRED','AI_QUALITY_REVIEW'];
export function planStudyAutoResumeV45(snapshot,now=Date.now(),stalledAttempts=0){
  if(!snapshot || snapshot.complete)return null;
  const quota=snapshot.quota;
  if(quota){
    if(!quota.automatic)return null;
    const time=Date.parse(quota.retryAt||'');
    return Number.isFinite(time)?{reason:'provider-cooldown',at:Math.max(now,time)}:null;
  }
  const halt=snapshot.execution?.haltedOn;
  const left=Number(snapshot.execution?.remainingBatches)||0;
  if(!QUALITY.includes(halt)||snapshot.status!=='quality-review'||left<=0)return null;
  // At most two automatic runs without any NEW approved units.
  // If progress rises the app resets this counter and keeps processing.
  if(stalledAttempts>=2)return null;
  return {reason:'quality-continue',at:now+15000*(stalledAttempts+1)};
}
