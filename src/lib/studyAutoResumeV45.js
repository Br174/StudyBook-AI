// LAB46: the original single recovery owner. One foreground retry plan, no
// second scheduler, no immediate retry storm and no bypass of Gemini cooldown.
const QUALITY=['AI_QUALITY_REVIEW_REQUIRED','AI_QUALITY_REVIEW'];
const TRANSIENT=['AI_TIMEOUT_OR_NETWORK','AI_PROVIDER_TIMEOUT','AI_PROVIDER_NETWORK',
  'AI_NETWORK_REVIEW_REQUIRED','INVALID_EDITION_RESPONSE','AI_FORMAT_REVIEW_REQUIRED'];
export function planStudyAutoResumeV45(snapshot,now=Date.now(),stalledAttempts=0){
  if(!snapshot||snapshot.complete)return null;
  const quota=snapshot.quota;
  if(quota){
    if(!quota.automatic)return null;
    const time=Date.parse(quota.retryAt||'');
    return Number.isFinite(time)?{reason:'provider-cooldown',at:Math.max(now,time)}:null;
  }
  const halt=snapshot.execution?.haltedOn;
  const left=Number(snapshot.execution?.remainingBatches)||0;
  if(QUALITY.includes(halt)&&snapshot.status==='quality-review'){
    if(left<=0||stalledAttempts>=2)return null;
    return {reason:'quality-continue',at:now+15000*(stalledAttempts+1)};
  }
  if(TRANSIENT.includes(halt)&&stalledAttempts<2)
    return {reason:'transient-recovery',at:now+30000*Math.pow(2,stalledAttempts)};
  if(snapshot.status==='interrupted'&&stalledAttempts<2)
    return {reason:'interrupted-checkpoint',at:now+1500};
  // A process killed during generation may leave a partial source with no
  // terminal execution status. Resume once from verified local checkpoints.
  if(snapshot.status==='partial'&&!halt&&stalledAttempts<2)
    return {reason:'unfinished-checkpoint',at:now+1500};
  return null;
}


// LAB54: pure wakeup decisions for the EXISTING single foreground scheduler.
// Browser timers can fire just before the threshold, be frozen by Android,
// or be discarded while the app is hidden. Recompute the remaining wait on
// every wake; do not consume the only retry event prematurely.
export function autoResumeWakeDecisionV54(plan,{
  now=Date.now(),visible=true,inFlight=false
}={}){
  if(!plan||!Number.isFinite(Number(plan.at)))return 'no-plan';
  if(inFlight)return 'in-flight';
  if(now<Number(plan.at))return 'too-early';
  if(!visible)return 'foreground-required';
  return 'ready';
}

export function autoResumeNextWakeMsV54(plan,now=Date.now()){
  if(!plan||!Number.isFinite(Number(plan.at)))return null;
  // Periodic recheck within the SAME one-shot scheduler catches clock changes
  // without a retry storm and never asks Gemini before the provider cooldown.
  const remaining=Math.max(0,Number(plan.at)-now);
  return Math.max(40,Math.min(60_000,remaining+80));
}
