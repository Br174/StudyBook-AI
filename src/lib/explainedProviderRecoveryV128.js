// LAB128. Recovery policy is local, deterministic and checkpoint-friendly.
// HTTP 503 is provider overload, NOT an invalid page or quality rejection.
// Five content-correction attempts never count provider 503/429 responses.
export const V128_DEFAULT_BLOCK_CHARS=30000;
export const V128_MIN_BLOCK_CHARS=2500;
export const V128_MAX_COOLDOWN_SECONDS=172800;
const safeInteger=(x,defaultValue=0)=>Number.isFinite(Number(x))?
  Math.max(0,Math.floor(Number(x))):defaultValue;

export function providerRecoveryStateV128(value){
 const x=value&&typeof value==='object'?value:{};
 return {
  overloadStrikes:safeInteger(x.overloadStrikes),
  quotaStrikes:safeInteger(x.quotaStrikes),
  maxBlockChars:Math.max(V128_MIN_BLOCK_CHARS,
   Math.min(V128_DEFAULT_BLOCK_CHARS,safeInteger(x.maxBlockChars,V128_DEFAULT_BLOCK_CHARS))),
  successfulBlocks:safeInteger(x.successfulBlocks),
  lastStatus:safeInteger(x.lastStatus),
  lastCode:String(x.lastCode||'').slice(0,100)
 };
}
export function providerPauseV128(previous,{httpStatus=503,code='',
 retryAfterSeconds=null,now=Date.now()}={}){
 const old=providerRecoveryStateV128(previous);
 const overload=httpStatus===503;
 const quota=httpStatus===429;
 const overloadStrikes=overload?old.overloadStrikes+1:0;
 const quotaStrikes=quota?old.quotaStrikes+1:0;
 // Two consecutive 503s trigger ONE downshift; the third does not.
 const nextSize=overload&&overloadStrikes%2===0?
  Math.max(V128_MIN_BLOCK_CHARS,Math.floor(old.maxBlockChars/2)):
  old.maxBlockChars;
 const strikes=overload?overloadStrikes:quota?quotaStrikes:1;
 const minimum=overload||quota?90:120;
 const exponential=Math.min(1800,minimum*Math.pow(2,Math.min(5,strikes-1)));
 const providerSeconds=Number(retryAfterSeconds);
 const hasProvider=retryAfterSeconds!==null&&retryAfterSeconds!==undefined&&
  retryAfterSeconds!==''&&Number.isFinite(providerSeconds)&&providerSeconds>0;
 const seconds=Math.min(V128_MAX_COOLDOWN_SECONDS,
  Math.max(60,exponential,hasProvider?providerSeconds:0));
 const timestamp=Number.isFinite(now)?now:Date.now();
 return {state:{...old,overloadStrikes,quotaStrikes,maxBlockChars:nextSize,
   successfulBlocks:0,lastStatus:httpStatus,lastCode:String(code||'').slice(0,100)},
  retryAt:new Date(timestamp+seconds*1000).toISOString(),
  seconds,source:hasProvider?'provider-and-local-backoff':'local-exponential-backoff'};
}
export function providerSuccessfulBlockV128(previous){
 const old=providerRecoveryStateV128(previous);
 // Two consecutive validated HTTP-200 blocks trigger a gentle 50% increase;
 // never exceed the original 30k limit. A 503 resets the success streak.
 const success=old.successfulBlocks+1;
 const shouldGrow=success>=2&&old.maxBlockChars<V128_DEFAULT_BLOCK_CHARS;
 const nextSize=shouldGrow?
   Math.min(V128_DEFAULT_BLOCK_CHARS,Math.floor(old.maxBlockChars*1.5)):
   old.maxBlockChars;
 return {...old,overloadStrikes:0,quotaStrikes:0,
  maxBlockChars:nextSize,successfulBlocks:success>=2?0:success,
  lastStatus:200,lastCode:''};
}
export function recoveryProgressV128(snapshot){
 const total=Math.max(0,Number(snapshot?.totalChunkVariants||snapshot?.originalPages||0));
 const verified=Math.max(0,Number(snapshot?.verifiedChunkVariants||0));
 const reserved=Math.max(0,Number(snapshot?.acceptedWithReserveV127||0));
 const missing=Math.max(0,total-verified-reserved);
 const maps=Math.max(0,Number(snapshot?.comprehensionV126?.verifiedPages||0));
 return {total,verified,reserved,missing,understood:maps};
}
