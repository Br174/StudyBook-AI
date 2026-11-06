// LAB36: shared free-tier Gemini cooldown persisted in the EXISTING resumeStore.
import {loadResumeState,saveResumeState,deleteResumeState} from './resumeStore.js';
const KEY='lab36-gemini-free-tier-quota-global-v1';
const MAX_WAIT_MS=48*3600000;
const validKinds=new Set(['requests-minute','tokens-minute','daily','billing','no-free-allocation','overload','unknown']);
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
  if(!Number.isFinite(seconds)||seconds<1){
    estimated=true;
    const base=kind==='daily'?24*3600:kind==='overload'?90:
      kind==='requests-minute'||kind==='tokens-minute'?90:15*60;
    seconds=Math.min(24*3600,base*Math.pow(2,Math.min(attempts-1,5)));
  }
  const delay=Math.max(15*1000,Math.min(MAX_WAIT_MS,Math.ceil(seconds)*1000));
  return {
    version:1,kind,automatic,estimated,attempts,
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
  const until=Date.parse(saved.retryAt||'');
  if(!Number.isFinite(until)||until<=now)return null;
  return saved;
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
  return name+'; nuova prova '+(pause.estimated?'stimata ':'prevista ')+'dal '+stamp+'.';
}
