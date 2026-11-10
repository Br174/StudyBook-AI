// StudyBook LAB113: small local-only, crash-safe Gemini dispatch ledger.
// One owner: existing StudyBook request() function. No second scheduler,
// no telemetry upload, no book text, no API credentials, no model calls.
// Fixed-size ring; exact Worker fetch dispatch counts are distinguished
// from provider generation outcomes, which can be unknown on HTTP errors.
import {loadResumeState,saveResumeState} from './resumeStore.js';

export const STUDY_GEMINI_TRAFFIC_V113='studybook-local-gemini-traffic-v113';
const PREFIX='studybook-local-gemini-traffic-v113:';
const MAX_RECENT=80,MAX_ERRORS=12;
const number=(v,max=1e9)=>Number.isFinite(Number(v))?
 Math.max(0,Math.min(max,Math.round(Number(v)))):0;
const safeLevel=v=>['summary','50','40','30','20','10'].includes(String(v))?String(v):'unknown';
const safeCode=v=>/^[A-Z0-9_:-]{1,55}$/.test(String(v||''))?String(v):'UNKNOWN';
export function emptyGeminiTrafficV113(){
 return {policy:STUDY_GEMINI_TRAFFIC_V113,version:1,
  nextId:0,dispatched:0,worker200:0,workerFailures:0,
  confirmedParts:0,http503:0,http429:0,
  inputTokensReported:0,outputTokensReported:0,
  lastHttp:null,errors:{},recent:[]};
}
export function applyGeminiTrafficV113(state,entry,now=Date.now()){
 const current=state?.policy===STUDY_GEMINI_TRAFFIC_V113?
  {...state,recent:[...(state.recent||[])],errors:{...(state.errors||{})}}:
  emptyGeminiTrafficV113();
 if(entry?.type==='dispatch'){
  const id=current.nextId+1;
  current.nextId=id;current.dispatched++;
  current.recent.push({
   id,level:safeLevel(entry.level),phase:entry.phase==='repair'?'repair':'draft',
   pageStart:number(entry.pageStart,1e6),pageEnd:number(entry.pageEnd,1e6),
   units:number(entry.units,1e6),sourceChars:number(entry.sourceChars,1e9),
   estimatedInputTokens:number(entry.estimatedInputTokens,1e9),
   outputTokenLimit:number(entry.outputTokenLimit,1e7),
   at:new Date(now).toISOString(),state:'sent',
   // This is one Android -> Worker dispatch, not proof that Gemini was reached.
  });
  if(current.recent.length>MAX_RECENT)
   current.recent.splice(0,current.recent.length-MAX_RECENT);
  return {state:current,id};
 }
 if(entry?.type==='result'){
  const id=number(entry.id,Number.MAX_SAFE_INTEGER);
  const item=current.recent.find(x=>x.id===id);
  if(!item||item.state!=='sent')return {state:current,id};
  const http=number(entry.httpStatus,599);
  item.state=http===200?'received':'failed';
  item.http=http||null;
  item.elapsedMs=number(entry.elapsedMs,600000);
  item.code=safeCode(entry.code||http===200?'OK':'TRANSPORT');
  item.inputTokens=number(entry.inputTokens,1e9);
  item.outputTokens=number(entry.outputTokens,1e9);
  item.parts=number(entry.parts,10000);
  current.lastHttp=http||null;
  if(http===200){current.worker200++;if(item.parts>0)current.confirmedParts++}
  else{current.workerFailures++;if(http===503)current.http503++;if(http===429)current.http429++;
   const code=safeCode(entry.code||('HTTP_'+http));
   current.errors[code]=(current.errors[code]||0)+1;
   const keys=Object.keys(current.errors);
   if(keys.length>MAX_ERRORS)delete current.errors[keys[0]];
  }
  current.inputTokensReported+=item.inputTokens;
  current.outputTokensReported+=item.outputTokens;
  return {state:current,id};
 }
 return {state:current,id:null};
}
export function geminiTrafficSummaryV113(state){
 const s=state?.policy===STUDY_GEMINI_TRAFFIC_V113?state:emptyGeminiTrafficV113();
 const last=s.recent?.at(-1)||null;
 return {policy:STUDY_GEMINI_TRAFFIC_V113,
  dispatched:number(s.dispatched),worker200:number(s.worker200),
  workerFailures:number(s.workerFailures),confirmedParts:number(s.confirmedParts),
  http503:number(s.http503),http429:number(s.http429),
  inputTokensReported:number(s.inputTokensReported),
  outputTokensReported:number(s.outputTokensReported),
  last:last?{level:last.level,pageStart:last.pageStart,pageEnd:last.pageEnd,
   sourceChars:last.sourceChars,estimatedInputTokens:last.estimatedInputTokens,
   outputTokenLimit:last.outputTokenLimit,http:last.http||null,
   elapsedMs:last.elapsedMs||0,state:last.state}:null,
  // Only latest metadata; no original content, no PII, no provider keys.
 };
}
export async function readGeminiTrafficV113(bookFingerprint){
 if(!bookFingerprint)return emptyGeminiTrafficV113();
 const value=await loadResumeState(PREFIX+bookFingerprint);
 return value?.policy===STUDY_GEMINI_TRAFFIC_V113?value:emptyGeminiTrafficV113();
}
export async function saveGeminiTrafficV113(bookFingerprint,state){
 if(!bookFingerprint)return false;
 return saveResumeState(PREFIX+bookFingerprint,state);
}
