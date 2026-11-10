// LAB36: shared free-tier Gemini cooldown persisted in the EXISTING resumeStore.
import {loadResumeState,saveResumeState,deleteResumeState} from './resumeStore.js';
// The old 3.6 Flash cooldown must not lock the new free model family.
const KEY='lab36-gemini-free-tier-quota-free-family-v2';
const MAX_WAIT_MS=48*3600000;
const MAX_ESTIMATED_WAIT_MS=6*3600000;
const ESTIMATED_BASE_SECONDS={daily:24*3600,overload:90,
  'requests-minute':90,'tokens-minute':90,unknown:15*60};
// Provider supplied timing is authoritative as a minimum; local estimates
// increase after repeated failures, and never masquerade as Google deadlines.
const validKinds=new Set(['requests-minute','tokens-minute','daily','billing','no-free-allocation','overload','unknown']);
export function estimatedOverloadSecondsV113(attempts){
 return Math.min(120,Math.ceil(35*Math.pow(1.43,
   Math.max(0,Math.min(20,Number(attempts)||1)-1))));
}
export function makeGeminiPause(quota={},previous=null,now=Date.now()){
  const kind=validKinds.has(quota.kind)?quota.kind:'unknown';
  const automatic=quota.automatic!==false&&!['billing','no-free-allocation'].includes(kind);
  const last=previous?.kind===kind?Math.max(0,Number(previous.attempts)||0):0;
  const attempts=Math.min(20,last+1);
  let seconds=Number(quota.retryAfterSeconds);
  if(!Number.isFinite(seconds)||seconds<1){
    const absolute=Date.parse(String(quota.retryAt||''));
    seconds=Number.isFinite(absolute)&&absolute>now?Math.ceil((absolute-now)/1000):NaN;
  }
  let estimated=Boolean(quota.estimated);
  if(!Number.isFinite(seconds)||seconds<1)estimated=true;
  if(estimated){
    if(kind==='overload'&&import.meta.env?.VITE_STUDYBOOK_TRIAL_113==='1'){
      // LAB113: a provider 503 is NOT a daily quota reset. Cap only
      // *locally guessed* cooldowns. A real Retry-After remains authoritative.
      // Conservative bounded sequence 35, 50, 72, 103, 120 seconds.
      seconds=estimatedOverloadSecondsV113(attempts);
    }else{
      const base=Number.isFinite(seconds)&&seconds>=1
        ?seconds:ESTIMATED_BASE_SECONDS[kind]||15*60;
      seconds=Math.min(MAX_ESTIMATED_WAIT_MS/1000,
        Math.max(base,base*Math.pow(2,Math.min(attempts-1,8))));
    }
  }
  // Only non-estimated provider RetryInfo / Retry-After is treated as official.
  const delay=Math.max(15*1000,Math.min(MAX_WAIT_MS,Math.ceil(seconds)*1000));
  return {
    version:1,kind,automatic,estimated,attempts,
    httpStatus:[429,503].includes(Number(quota.httpStatus))?Number(quota.httpStatus):null,
    providerStatus:typeof quota.providerStatus==='string'?quota.providerStatus.slice(0,55):null,
    retrySource:estimated?'local-estimate':
      typeof quota.retrySource==='string'?quota.retrySource.slice(0,40):'provider',
    model:typeof quota.model==='string'?quota.model.slice(0,100):null,
    quotaId:typeof quota.quotaId==='string'?quota.quotaId.slice(0,120):null,
    quotaMetric:typeof quota.quotaMetric==='string'?quota.quotaMetric.slice(0,120):null,
    retryAt:automatic?new Date(now+delay).toISOString():null,
    registeredAt:new Date(now).toISOString(),
    // No book contents and no provider keys are stored here.
  };
}
export async function readGeminiPause({now=Date.now()}={}){
  const saved=await loadResumeState(KEY);
  if(!saved||saved.version!==1)return null;
  if(!saved.automatic)return saved;
  let until=Date.parse(saved.retryAt||'');
  if(import.meta.env?.VITE_STUDYBOOK_TRIAL_113==='1'&&
     saved.kind==='overload'&&saved.estimated===true){
    // Existing LAB111 installation may hold an older 6-minute estimate.
    // Never bypass an official Google Retry-After or any real 429 limit.
    const from=Date.parse(saved.registeredAt||'');
    if(Number.isFinite(from))until=Math.min(until,from+120000);
  }
  if(!Number.isFinite(until)||until<=now)return null;
  return {...saved,retryAt:new Date(until).toISOString()};
}
export async function registerGeminiPause(quota,{now=Date.now()}={}){
  const previous=await loadResumeState(KEY);
  const pause=makeGeminiPause(quota,previous,now);
  const saved=await saveResumeState(KEY,pause);
  // A storage error must never lead to a storm of retries in the same run.
  return {...pause,persistent:saved};
}
export async function clearGeminiPause(){
  await deleteResumeState(KEY);
}
export function quotaDisplayV36(pause){
  if(!pause)return '';
  const names={
    'daily':'Quota giornaliera','requests-minute':'Limite richieste al minuto',
    'tokens-minute':'Limite token al minuto','overload':'Servizio Gemini occupato',
    'billing':'Limite amministrativo o di spesa',
    'no-free-allocation':'Modello senza quota gratuita disponibile',unknown:'Limite Gemini temporaneo'};
  const name=names[pause.kind]||names.unknown;
  if(!pause.automatic)return name+'; nessun acquisto automatico.';
  const ms=Date.parse(pause.retryAt);
  const stamp=Number.isFinite(ms)?new Date(ms).toLocaleString('it-IT',{dateStyle:'short',timeStyle:'short'}):'non disponibile';
  const source=pause.estimated?'orario stimato dall’app, non comunicato da Google':
    'orario basato sull’indicazione del provider';
  const attempt=Number(pause.attempts)>1?' · Tentativo '+Number(pause.attempts):'';
  return name+'; nuova prova dal '+stamp+' ('+source+')'+attempt+'.';
}
