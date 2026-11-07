// LAB58: minimal adaptive cadence for the existing SINGLE Gemini request owner.
// No new queue, model, key or worker. Never split blocks just to slow sending.
// Only an explicitly diagnosed per-minute provider 429 learns a pacing rule.
// Zero delay while the provider succeeds and no measured minute-limit exists.
import {loadResumeState,saveResumeState,deleteResumeState} from './resumeStore.js';

const KEY='studybook-gemini-cadence-v58';
const LIFE_MS=6*60*60*1000;
const MAX_GAP_MS=120000;
const DEFAULT_RPM_AFTER_429_MS=20000;
const bounded=(value,min,max)=>Math.max(min,Math.min(max,value));
const validMs=value=>Number.isFinite(Number(value))?Number(value):0;

export function cadenceFromQuotaV58(quota,previous=null,now=Date.now()){
 const kind=quota?.kind;
 if(kind!=='requests-minute'&&kind!=='tokens-minute')return null;
 const limit=Number(quota?.limit);
 const cap=Number.isFinite(limit)&&limit>0?limit:null;
 const last=previous?.kind===kind?Number(previous?.failures)||0:0;
 const failures=bounded(last+1,1,20);
 let gapMs=0;
 if(kind==='requests-minute'){
   // Only AFTER a real RPM 429. If the provider does not report the ceiling,
   // use a bounded conservative initial cadence and record the uncertainty.
   gapMs=cap?Math.ceil(66000/cap):DEFAULT_RPM_AFTER_429_MS;
   gapMs=Math.ceil(gapMs*Math.min(2,1+0.15*(failures-1)));
 }else if(cap){
   // TPM controls input tokens, NOT request count. Reuse the *same* block:
   // derive a delay only when its measured input is below the minute budget.
   const lastInput=Number(previous?.lastInputTokens);
   const expected=Number.isFinite(lastInput)&&lastInput>0?lastInput:0;
   if(expected>0&&expected<=cap)
     gapMs=Math.ceil(66000*expected/cap);
 }
 if(!gapMs)return null; // Unknown TPM cannot be fixed by invented pauses.
 return {version:1,kind,quotaLimit:cap,measuredLimit:cap!==null,
   gapMs:bounded(gapMs,1000,MAX_GAP_MS),failures,
   lastInputTokens:Number(previous?.lastInputTokens)||0,
   lastRequestAt:validMs(previous?.lastRequestAt),
   nextAllowedAt:now,learnedAt:now,expiresAt:now+LIFE_MS};
}
export function cadenceDelayV58(record,now=Date.now()){
 if(!record||record.version!==1||Number(record.expiresAt)<=now)return 0;
 return Math.max(0,Math.min(MAX_GAP_MS,validMs(record.nextAllowedAt)-now));
}
export function cadenceAfterSuccessV58(record,{
 now=Date.now(),requestStartedAt=now,inputTokens=0
}={}){
 if(!record||record.version!==1||Number(record.expiresAt)<=now)return null;
 const result={...record,lastRequestAt:requestStartedAt};
 if(Number.isFinite(Number(inputTokens))&&Number(inputTokens)>0)
   result.lastInputTokens=Math.ceil(Number(inputTokens));
 if(result.kind==='tokens-minute'&&result.quotaLimit>0&&
    result.lastInputTokens>0&&result.lastInputTokens<=result.quotaLimit){
   result.gapMs=bounded(
     Math.ceil(66000*result.lastInputTokens/result.quotaLimit),1000,MAX_GAP_MS);
 }
 // Measured long generation time counts toward the minute-window gap.
 result.nextAllowedAt=Math.max(now,requestStartedAt+result.gapMs);
 result.expiresAt=now+LIFE_MS;
 return result;
}
export function restoredLargeBlockLimitV58(previous){
 // LAB53-57 persisted 1,600-token soft budgets after 503 overload despite
 // no provider evidence that the ORIGINAL 44-page book was oversized.
 // Replan using the original safe hard caps; only an explicit hard-size 413
 // may justify splitting at full page boundaries.
 return previous?.diagnostics?.hardBlockSizeLimitV58>0?
   Math.max(1600,Math.min(900000,Number(previous.diagnostics.hardBlockSizeLimitV58))):
   900000;
}
export async function learnGeminiCadenceV58(quota){
 if(!quota||!['requests-minute','tokens-minute'].includes(quota.kind))return null;
 const prior=await loadResumeState(KEY);
 const next=cadenceFromQuotaV58(quota,prior);
 if(next)await saveResumeState(KEY,next);
 return next;
}
export async function markGeminiCadenceSuccessV58({
 requestStartedAt=Date.now(),inputTokens=0
}={}){
 const prior=await loadResumeState(KEY);
 const next=cadenceAfterSuccessV58(prior,{requestStartedAt,inputTokens});
 if(next)await saveResumeState(KEY,next);
 return next;
}
export async function readGeminiCadenceV58(){
 const value=await loadResumeState(KEY);
 return value?.version===1&&value.expiresAt>Date.now()?value:null;
}
function abortError(){return Object.assign(new Error('Richiesta annullata'),{
 name:'AbortError',code:'AI_MANUAL_RESTART'});}
function sleepWithAbort(ms,signal){
 if(signal?.aborted)return Promise.reject(abortError());
 return new Promise((resolve,reject)=>{
   let timer,done=false;
   function finish(error){
     if(done)return;done=true;clearTimeout(timer);
     signal?.removeEventListener?.('abort',onAbort);
     if(error)reject(error);else resolve();
   }
   function onAbort(){finish(abortError());}
   signal?.addEventListener?.('abort',onAbort,{once:true});
   timer=setTimeout(()=>finish(),ms);
 });
}
export async function waitForGeminiCadenceV58({signal=null,onWait=()=>{}}={}){
 // Re-evaluate clock on Android foreground wake. This function is inside
 // the EXISTING request owner and is NOT a separate scheduler.
 for(;;){
   if(signal?.aborted)throw abortError();
   const next=await readGeminiCadenceV58();
   const delay=cadenceDelayV58(next);
   if(delay<=0)return 0;
   const chunk=Math.min(15000,delay);
   onWait({kind:next.kind,remainingMs:delay,expectedGapMs:next.gapMs});
   await sleepWithAbort(chunk,signal);
 }
}
export async function clearGeminiCadenceForTestV58(){await deleteResumeState(KEY);}
