// StudyBook LAB114: one bounded failover only after a provider HTTP 503.
// Keep the original LARGE natural block intact. Healthy path = ONE call.
// No extra countTokens, no new scheduler, no paid model, no quota-bypass.
// The 3.1 Flash-Lite model is a distinct Google stable/free-tier candidate;
// its free allocation is never presumed from app code.
import {diagnoseGeminiQuota} from '../../api/geminiQuotaV36.js';

export const STUDY_503_FAILOVER_V114='studybook-503-one-shot-flashlite-v114';
export const STUDY_503_BACKUP_V114='gemini-3.1-flash-lite';
const PRIMARY='gemini-3.5-flash-lite';
const MAX_FIRST_MS=45000;
const MIN_REMAINING_MS=60000;
const WAIT_MS=1200;

export function eligible503FailoverV114({
 enabled=false,model='',status=0,body=null,headers=null,
 elapsedMs=Infinity,remainingMs=0,signal=null
}={}){
 if(!enabled||model!==PRIMARY||status!==503||signal?.aborted||
    elapsedMs>MAX_FIRST_MS||remainingMs<MIN_REMAINING_MS)return false;
 const quota=diagnoseGeminiQuota({status:503,body,headers,model});
 // Google retry_after / RetryInfo is authoritative. No early retry.
 return quota.kind==='overload'&&quota.estimated===true;
}
function waitShort(signal,ms=WAIT_MS){
 if(signal?.aborted)return Promise.reject(Object.assign(new Error('Aborted'),{name:'AbortError'}));
 return new Promise((resolve,reject)=>{
  let done=false;
  const cleanup=()=>{if(done)return;done=true;clearTimeout(timer);
   signal?.removeEventListener?.('abort',abort);resolve()};
  const abort=()=>{if(done)return;done=true;clearTimeout(timer);
   signal?.removeEventListener?.('abort',abort);
   reject(Object.assign(new Error('Aborted'),{name:'AbortError'}))};
  signal?.addEventListener?.('abort',abort,{once:true});
  const timer=setTimeout(cleanup,ms);
 });
}
export async function invoke503FailoverV114({
 primaryModel=PRIMARY,enabled=false,invoke,signal=null,
 now=()=>Date.now(),deadlineMs=0,wait=waitShort
}={}){
 if(typeof invoke!=='function')throw Error('V114_INVOKE_REQUIRED');
 const firstAt=now();
 const original=await invoke(primaryModel);
 const elapsedMs=now()-firstAt;
 const remainingMs=deadlineMs-now();
 const eligible=eligible503FailoverV114({enabled,model:primaryModel,
  status:original?.response?.status,body:original?.payload,
  headers:original?.response?.headers,elapsedMs,remainingMs,signal});
 if(!eligible)return {response:original.response,payload:original.payload,
  model:primaryModel,attempts:1,failoverRecovered:false,
  fallbackStatus:null,declined:original?.response?.status===503?'not-safe':'not-needed'};
 await wait(signal,WAIT_MS);
 // No additional model calls if cancelled after the short bounded wait.
 if(signal?.aborted)throw Object.assign(new Error('Aborted'),{name:'AbortError'});
 const backup=await invoke(STUDY_503_BACKUP_V114);
 if(backup?.response?.ok)return {response:backup.response,payload:backup.payload,
  model:STUDY_503_BACKUP_V114,attempts:2,failoverRecovered:true,
  fallbackStatus:200,declined:null};
 // If the backup has a distinct quota/model failure, do not confuse
 // its status with the PRIMARY model's quota or poison free-tier pacing.
 return {response:original.response,payload:original.payload,
  model:primaryModel,attempts:2,failoverRecovered:false,
  fallbackStatus:backup?.response?.status||null,declined:'backup-unavailable'};
}
