// StudyBook LAB77: one persistent, local-only predictive pacing policy.
// NOT a new queue/scheduler and NOT proof that Google 503 can be eliminated.
// Used only by the already existing single Gemini request owner LAB58.
// Learned failures and high-load successful calls shape inter-start spacing.
// 503 does not indicate overlarge input; page boundaries stay untouched.
import {loadResumeState,saveResumeState,deleteResumeState} from './resumeStore.js';

const KEY='studybook-gemini-throughput-v77';
const LIFE_MS=6*60*60*1000;
const LARGE_INPUT_TOKENS=5000;
const MAX_GAP_MS=180000;
const clamp=(v,low,high)=>Math.max(low,Math.min(high,v));
const validClock=v=>Number.isFinite(Number(v))?Number(v):0;

export function throughputFailureV77(previous=null,{now=Date.now()}={}){
 const was=previous?.version===1&&previous.expiresAt>now?previous:null;
 const failures=clamp((was?.overloadCount||0)+1,1,12);
 const trial113=import.meta.env?.VITE_STUDYBOOK_TRIAL_113==='1';
 const gapMs=trial113
  ?clamp(Math.round(45000*Math.pow(1.4,failures-1)),45000,90000)
  :clamp(Math.round(90000*Math.pow(1.35,failures-1)),90000,MAX_GAP_MS);
 return{version:1,kind:'overload-avoidance',overloadCount:failures,
  successesSinceOverload:0,gapMs,observedInputTokens:was?.observedInputTokens||0,
  lastStartedAt:was?.lastStartedAt||0,nextAllowedAt:now,
  learnedAt:now,expiresAt:now+LIFE_MS};
}
export function throughputSuccessV77(previous=null,{
 now=Date.now(),requestStartedAt=now,inputTokens=0
}={}){
 const was=previous?.version===1&&previous.expiresAt>now?previous:null;
 const elapsed=Math.max(0,now-validClock(requestStartedAt));
 const input=Math.max(0,Math.ceil(Number(inputTokens)||0));
 const hadOverload=(was?.overloadCount||0)>0;
 if(!hadOverload&&input<LARGE_INPUT_TOKENS)return null;
 let gapMs,overloadCount=was?.overloadCount||0,successesSinceOverload=0;
 if(hadOverload){
  successesSinceOverload=(was.successesSinceOverload||0)+1;
  // Retain a conservative recovery window but decay only AFTER repeated
  // successful calls. A second 503 quickly raises the interval again.
  const discount=Math.floor(successesSinceOverload/2)*15000;
  gapMs=clamp(was.gapMs-discount,25000,
   import.meta.env?.VITE_STUDYBOOK_TRIAL_113==='1'?90000:MAX_GAP_MS);
  if(successesSinceOverload>=8){
   overloadCount=0;
   gapMs=input>=LARGE_INPUT_TOKENS?
    clamp(Math.ceil(elapsed*1.2),15000,90000):0;
  }
 }else{
  // After a large, fast response: schedule the NEXT request 20% after the
  // previous request's observed start-to-completion time. If Gemini already
  // took >90 seconds, this adds no artificial waiting.
  gapMs=clamp(Math.ceil(elapsed*1.2),15000,90000);
 }
 if(gapMs===0)return null;
 return{version:1,kind:hadOverload?'overload-avoidance':'large-block-warmup',
  overloadCount,successesSinceOverload,gapMs,observedInputTokens:input||was?.observedInputTokens||0,
  lastStartedAt:requestStartedAt,
  nextAllowedAt:Math.max(now,requestStartedAt+gapMs),
  learnedAt:was?.learnedAt||now,expiresAt:now+LIFE_MS};
}
export function throughputDelayV77(record,now=Date.now()){
 if(record?.version!==1||record?.expiresAt<=now)return 0;
 const trial113=import.meta.env?.VITE_STUDYBOOK_TRIAL_113==='1';
 const maxGap=trial113&&record.kind==='overload-avoidance'?90000:MAX_GAP_MS;
 const allowedAt=trial113&&record.kind==='overload-avoidance'&&record.lastStartedAt>0
   ?Math.min(validClock(record.nextAllowedAt),validClock(record.lastStartedAt)+maxGap)
   :validClock(record.nextAllowedAt);
 return Math.max(0,Math.min(maxGap,allowedAt-now));
}
export async function readGeminiThroughputV77(){
 const d=await loadResumeState(KEY);
 return d?.version===1&&d.expiresAt>Date.now()?d:null;
}
export async function registerGeminiOverloadV77(){
 const prior=await readGeminiThroughputV77();
 const next=throughputFailureV77(prior);
 await saveResumeState(KEY,next);
 return next;
}
export async function noteGeminiSuccessV77(input){
 const prior=await readGeminiThroughputV77();
 const next=throughputSuccessV77(prior,input);
 if(next)await saveResumeState(KEY,next);
 else if(prior)await deleteResumeState(KEY);
 return next;
}
export async function clearGeminiThroughputForTestV77(){await deleteResumeState(KEY);}
