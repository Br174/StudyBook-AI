// MotorLab LAB36: diagnose provider limits, never relay provider response text or keys.
// Gemini's public limit types are RPM, TPM, RPD; a 429 may also mean no free allocation.
const MAX_WAIT_S=48*60*60;
const waitSeconds=(raw)=>{
  if(raw===undefined||raw===null)return null;
  if(typeof raw==='number')return Number.isFinite(raw)&&raw>=0?Math.ceil(raw):null;
  const text=String(raw).trim();
  const duration=text.match(/^(\d+(?:\.\d+)?)s$/i)||text.match(/^(\d+(?:\.\d+)?)$/);
  if(duration)return Math.ceil(Number(duration[1]));
  const minutes=text.match(/^(\d+(?:\.\d+)?)m$/i);
  if(minutes)return Math.ceil(Number(minutes[1])*60);
  return null;
};
function parseRetryAfter(headers,now){
  const value=headers?.get?.('retry-after');
  const seconds=waitSeconds(value);
  if(seconds!==null)return seconds;
  const ms=Date.parse(String(value||''));
  return Number.isFinite(ms)?Math.max(0,Math.ceil((ms-now)/1000)):null;
}
function nextPacificResetSeconds(now){
  try{
    const fmt=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'});
    const day=fmt.format(new Date(now));
    let low=now,high=now+30*3600000;
    for(let i=0;i<34&&high-low>1000;i++){
      const mid=Math.floor((low+high)/2);
      if(fmt.format(new Date(mid))===day)low=mid;else high=mid;
    }
    return Math.ceil((high+2*60000-now)/1000);
  }catch{return 24*3600;}
}
function safeCode(s,max=120){
  const text=String(s||'');
  return /^[a-z0-9_./:-]{1,200}$/i.test(text)?text.slice(0,max):null;
}
export function diagnoseGeminiQuota({status=429,body=null,headers=null,model=null,now=Date.now()}={}){
  const error=body?.error||body||{};
  const details=Array.isArray(error.details)?error.details:(Array.isArray(body?.details)?body.details:[]);
  const violations=details.flatMap(d=>Array.isArray(d.violations)?d.violations:[]);
  const v=violations[0]||{};
  const message=String(error.message||'').slice(0,1200).toLowerCase();
  const signal=[...violations.map(x=>[x.quotaMetric,x.quotaId,x.description].join(' ')),message].join(' ').toLowerCase();
  const billing=/prepay|spend.cap|billing|payment|funds.depleted|credit.balance/.test(signal);
  const zero=violations.some(x=>Number(x.quotaValue)===0)||/\blimit\s*[:=]\s*0\b/.test(signal);
  let kind='unknown';
  if(status===503)kind='overload';
  else if(billing)kind='billing';
  else if(zero)kind='no-free-allocation';
  else if(/per.?day|requests.?per.?day|daily|rpd|free_tier_requests\b/.test(signal))kind='daily';
  else if(/tokens?.?per.?minute|input_token_count|tpm/.test(signal))kind='tokens-minute';
  else if(/per.?minute|rpm|request.?rate/.test(signal))kind='requests-minute';
  let seconds=parseRetryAfter(headers,now);
  if(seconds===null){
    const info=details.find(d=>d.retryDelay!==undefined||d.retry_delay!==undefined);
    seconds=waitSeconds(info?.retryDelay??info?.retry_delay);
  }
  if(seconds===null){
    const inline=message.match(/(?:retry|try again)(?:\s+in|\s+after)\s+(\d+(?:\.\d+)?)\s*(seconds?|s|minutes?|m)\b/i);
    if(inline)seconds=Math.ceil(Number(inline[1])*(inline[2].startsWith('m')?60:1));
  }
  const automatic=!['billing','no-free-allocation'].includes(kind);
  const estimated=seconds===null;
  if(seconds===null){
    seconds=kind==='daily'?nextPacificResetSeconds(now):
      kind==='requests-minute'||kind==='tokens-minute'?75:
      kind==='overload'?90:15*60;
  }
  seconds=Math.max(automatic?15:0,Math.min(MAX_WAIT_S,seconds));
  const limit=Number(v.quotaValue);
  const chosenModel=safeCode(v?.quotaDimensions?.model||model);
  return {
    kind,automatic,estimated,
    retryAfterSeconds:automatic?seconds:null,
    retryAt:automatic?new Date(now+seconds*1000).toISOString():null,
    quotaMetric:safeCode(v.quotaMetric),quotaId:safeCode(v.quotaId),
    model:chosenModel,limit:Number.isFinite(limit)?limit:null
  };
}
export function quotaPublicMessage(kind){
  switch(kind){
    case 'daily':return 'Quota giornaliera Gemini esaurita: libro conservato, ripresa dopo il ripristino.';
    case 'requests-minute':return 'Troppe richieste Gemini al minuto: elaborazione sospesa temporaneamente.';
    case 'tokens-minute':return 'Limite di token Gemini al minuto: elaborazione sospesa temporaneamente.';
    case 'billing':return 'Limite amministrativo o di spesa Gemini: nessun pagamento automatico autorizzato.';
    case 'no-free-allocation':return 'Il modello Gemini non dispone di quota gratuita utilizzabile: serve verificare il modello.';
    case 'overload':return 'Gemini temporaneamente sovraccarico: progresso conservato.';
    default:return 'Gemini temporaneamente limitato: progressi salvati e ripresa controllata.';
  }
}
