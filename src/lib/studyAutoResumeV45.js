import {recoveryActionV79} from './studyQualityRecoveryV79.js';
// LAB46: the original single recovery owner. One foreground retry plan, no
// second scheduler, no immediate retry storm and no bypass of Gemini cooldown.
const QUALITY=['AI_QUALITY_REVIEW_REQUIRED','AI_QUALITY_REVIEW'];
const TRANSIENT=['AI_TIMEOUT_OR_NETWORK','AI_PROVIDER_TIMEOUT','AI_PROVIDER_NETWORK','AI_CLIENT_NETWORK',
  'AI_NETWORK_REVIEW_REQUIRED','INVALID_EDITION_RESPONSE','AI_FORMAT_REVIEW_REQUIRED'];
export function planStudyAutoResumeV45(snapshot,now=Date.now(),stalledAttempts=0){
  if(!snapshot||snapshot.complete)return null;
  // LAB125 single-edition: a quality-review is not terminal. The same
  // foreground scheduler performs bounded, targeted retries; no second timer.
  // Progress (more accepted pages) resets stalledAttempts in AppV15.
  if(['lab122-one-explained-glossary-v1','lab126-whole-book-comprehension-v1'].includes(snapshot.version) &&
     snapshot.status==='quality-review' &&
     Number(snapshot.diagnostics?.qualityReview||0)>0){
    if(stalledAttempts>=2)return null;
    const savedAt=Date.parse(String(snapshot.diagnostics?.nextReviewAt||''));
    const minimum=now+30000*Math.pow(2,stalledAttempts);
    return {reason:'explained-targeted-quality-retry',
      at:Number.isFinite(savedAt)?Math.max(minimum,savedAt):minimum};
  }

  // LAB126: resume understanding only through the already-existing LAB45
  // foreground scheduler; do NOT begin the explanation before all source maps.
  if(snapshot.version==='lab126-whole-book-comprehension-v1'){
    const quota=snapshot.quota;
    if(quota?.automatic){
      const at=Date.parse(String(quota.retryAt||''));
      return Number.isFinite(at)?{reason:'provider-cooldown',at:Math.max(now,at)}:null;
    }
    if(snapshot.status==='provider-blocked'&&stalledAttempts<2)
      return {reason:'lab126-provider-recovery',at:now+45000*Math.pow(2,stalledAttempts)};
    if(snapshot.status==='interrupted'&&stalledAttempts<2)
      return {reason:'interrupted-checkpoint',at:now+1500};
    if(['comprehension','partial'].includes(snapshot.status)&&stalledAttempts<2)
      return {reason:'lab126-unfinished-bookwide-phase',at:now+1500};
    return null;
  }

  // LAB66: old books stuck after finishing ALL drafts migrate locally with
  // zero provider traffic. This runs even if Gemini has a provider cooldown.
  // LAB79: a LAB78 audit that already checked 44x6 pages is terminal
  // until the user explicitly requests targeted Gemini recalibration.
  // It must never wake the foreground auto-resume loop every 1.2 seconds.
  const qualityAction=recoveryActionV79(snapshot);
  if(qualityAction==='manual-recalibration'||qualityAction==='none')return null;
  if(qualityAction==='local-audit'&&
     snapshot.publicationModeV66!=='generated-text-quality-not-certified')
    return {reason:'local-quality-audit',at:now+1200};
  const quota=snapshot.quota;
  if(quota){
    if(!quota.automatic)return null;
    const time=Date.parse(quota.retryAt||'');
    return Number.isFinite(time)?{reason:'provider-cooldown',at:Math.max(now,time)}:null;
  }
  const halt=snapshot.execution?.haltedOn;
  const left=Number(snapshot.execution?.remainingBatches)||0;
  // LAB61: only the existing ONE foreground scheduler may resume quality
  // review. Do not regenerate drafts; only retry remaining targeted pages.
  // Zero eligible pages or two no-progress wakes must stop automatically.
  if(snapshot.draftComplete&&snapshot.status==='quality-review'){
    if(!QUALITY.includes(halt)||left<=0||stalledAttempts>=2)return null;
    const safeAt=Date.parse(String(snapshot.execution?.reviewAfter||''));
    const floor=now+15000*(stalledAttempts+1);
    return {reason:'quality-continue',
      at:Number.isFinite(safeAt)?Math.max(floor,safeAt):floor};
  }
  // LAB123: a single-edition request can finish as "provider-blocked" when a
  // transient HTTP 502/network fault followed a 503 cooldown. Recheck with
  // the SAME foreground scheduler, never spawn another timer/worker.
  if(snapshot.version==='lab122-one-explained-glossary-v1' &&
     snapshot.status==='provider-blocked' && stalledAttempts<2)
    return {reason:'lab123-provider-recovery',
      at:now+45000*Math.pow(2,stalledAttempts)};
  if(TRANSIENT.includes(halt)&&stalledAttempts<2)
    return {reason:'transient-recovery',at:now+30000*Math.pow(2,stalledAttempts)};
  if(snapshot.status==='interrupted'&&stalledAttempts<2)
    return {reason:'interrupted-checkpoint',at:now+1500};
  // A process killed during generation may leave a partial source with no
  // terminal execution status. Resume once from verified local checkpoints.
  if(['partial','drafting','reviewing'].includes(snapshot.status)&&!halt&&stalledAttempts<2)
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


// LAB55: one read-only presentation of the SAME cooldown state used by LAB45.
// No new scheduler, no new storage, and no action that bypasses the provider.
export function geminiResumeDisplayV55(snapshot,now=Date.now()){
  const quota=snapshot?.quota;
  if(!quota||!quota.automatic)return {waiting:false,expired:false,label:'',button:'↻ Verifica e riprendi'};
  const at=Date.parse(String(quota.retryAt||''));
  if(!Number.isFinite(at))return {waiting:false,expired:false,
    label:'Attesa Gemini: orario non verificabile; controlla lo stato del provider.',
    button:'↻ Verifica attesa Gemini'};
  const waiting=now<at;
  const time=new Date(at).toLocaleString('it-IT',{dateStyle:'short',timeStyle:'short'});
  const reason=quota.kind==='overload'?'Gemini occupato (HTTP 503)':quota.kind==='daily'?'Quota giornaliera Gemini':'Pausa Gemini';
  return {waiting,expired:!waiting,retryAt:at,
    label:waiting?
      reason+' · prossima verifica '+time+(quota.estimated?' (stima locale).':' (indicazione provider).')+
      ' I checkpoint restano salvati; ripresa automatica quando l’app è attiva.':
      'Attesa Gemini conclusa · verifica e riprendi dai checkpoint salvati.',
    button:waiting?'↻ Gemini in attesa · controlla orario':'↻ Verifica e riprendi'};
}
