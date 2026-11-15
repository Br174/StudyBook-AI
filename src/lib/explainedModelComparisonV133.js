// LAB133: observational comparison of existing FREE Gemini Flash-Lite models.
// No duplicate requests, no book text/secret logging, no automatic paid tier.
export const FREE_STUDY_MODELS_V133=Object.freeze([
 'gemini-3.1-flash-lite','gemini-3.5-flash-lite']);
export const MODEL_COMPARISON_POLICY_V133='lab133-free-model-comparison-v1';
const number=(v)=>Number.isFinite(Number(v))?Math.max(0,Number(v)):0;
const empty=()=>({attempts:0,success:0,http503:0,http429:0,
 sourceChars:0,elapsedMs:0,readyPages:0,receivedPages:0,otherErrors:0});
export function modelComparisonStateV133(value){
 const x=value&&typeof value==='object'?value:{};
 return {version:MODEL_COMPARISON_POLICY_V133,
  stats:Object.fromEntries(FREE_STUDY_MODELS_V133.map(model=>{
   const raw=x.stats?.[model]||{},item=empty();
   for(const key of Object.keys(item))item[key]=number(raw[key]);
   return [model,item];
  }))};
}
// User-selected LAB134 model; keep old benchmark metrics for reference only.
export const STUDY_PRIMARY_MODEL_V134='gemini-3.1-flash-lite';
export const STUDY_MODEL_POLICY_V134='lab134-fixed-gemini-3.1-flash-lite-v1';
export function selectFreeStudyModelV133(){return STUDY_PRIMARY_MODEL_V134;}
export function recordFreeStudyModelV133(value,{
 model,status,elapsedMs=0,sourceChars=0,readyPages=0,receivedPages=0
}={}){
 const state=modelComparisonStateV133(value);
 if(!FREE_STUDY_MODELS_V133.includes(model))return state;
 const item=state.stats[model];
 item.attempts++;
 if(status===200){
  item.success++;
  item.sourceChars+=number(sourceChars);
  item.elapsedMs+=number(elapsedMs);
  item.readyPages+=number(readyPages);
  item.receivedPages+=number(receivedPages);
 }else if(status===503)item.http503++;
 else if(status===429)item.http429++;
 else item.otherErrors++;
 return state;
}
export function modelComparisonReportV133(value){
 const stats=modelComparisonStateV133(value).stats;
 return FREE_STUDY_MODELS_V133.map(model=>{
  const x=stats[model];
  return {model,attempts:x.attempts,success:x.success,
   http503:x.http503,http429:x.http429,otherErrors:x.otherErrors,
   milliseconds:x.elapsedMs,sourceChars:x.sourceChars,
   readyPages:x.readyPages,receivedPages:x.receivedPages,
   charsPerSecond:x.elapsedMs?Math.round(x.sourceChars*1000/x.elapsedMs):null,
   acceptancePct:x.receivedPages?Math.round(100*x.readyPages/x.receivedPages):null};
 });
}
