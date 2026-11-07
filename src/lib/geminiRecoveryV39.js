// LAB39: diagnostica causale per l'elaborazione progressiva.
// Solo codici e conteggi: non salvare testo originale né chiavi del provider.
export const RECOVERY_KINDS={
 'AI_QUOTA_LIMIT':'QUOTA_ATTESA','AI_TEMPORARY_OVERLOAD':'QUOTA_ATTESA',
 'AI_QUOTA_MANUAL_REVIEW':'CONFIGURAZIONE','AI_NOT_CONFIGURED':'CONFIGURAZIONE',
 'AI_PROVIDER_REJECTED':'PROVIDER','AI_SERVICE_ERROR':'PROVIDER',
 'AI_PROVIDER_TIMEOUT':'CONNESSIONE','AI_PROVIDER_NETWORK':'CONNESSIONE','AI_NETWORK_REVIEW_REQUIRED':'CONNESSIONE',
 'AI_TIMEOUT_OR_NETWORK':'CONNESSIONE','INVALID_EDITION_RESPONSE':'RISPOSTA_NON_VALIDA',
 'INVALID_GENERATIVE_RESPONSE':'RISPOSTA_NON_VALIDA','AI_FORMAT_REVIEW_REQUIRED':'RISPOSTA_NON_VALIDA',
 'SOURCE_REVIEW':'SORGENTE_DA_VERIFICARE',
 'AI_QUALITY_REVIEW':'QUALITA','AI_QUALITY_REVIEW_REQUIRED':'QUALITA',
 'AI_QUALITY_STOP':'QUALITA','AI_MANUAL_RESTART':'INTERROTTO'
};
export function progressDiagnostic(snapshot){
 const stored=Math.max(0,Number(snapshot?.verifiedChunkVariants)||0);
 const total=Math.max(0,Number(snapshot?.totalChunkVariants)||0);
 const status=snapshot?.status||'partial';
 const halted=snapshot?.execution?.haltedOn||snapshot?.diagnostics?.lastCode||null;
 const kind=snapshot?.quota?.automatic?'QUOTA_ATTESA':snapshot?.quota?'CONFIGURAZIONE':
  status==='drafting'?'BOZZA':
  status==='reviewing'?'VERIFICA':
  status==='quality-review'?'QUALITA':
  status==='source-review-needed'?'SORGENTE_DA_VERIFICARE':
  RECOVERY_KINDS[halted]|| (status==='complete'?'COMPLETO':status==='partial'?'PARZIALE':'ATTESA');
 const base=stored+'/'+total+' parti IA verificate'+
   (snapshot?.draftUnitsTotal?
     ' · bozze '+(snapshot.draftUnitsSaved||0)+'/'+snapshot.draftUnitsTotal:'');
 const messages={
  COMPLETO:'Tutte le edizioni verificate e salvate.',
  BOZZA:'Prima fase: Gemini sta creando e salvando i blocchi completi. Le verifiche didattiche inizieranno solo a bozza completa.',
  VERIFICA:'La bozza del libro è stata completata e salvata. Sono in corso verifica globale e correzioni mirate.',
  PARZIALE:'Elaborazione parziale: ripresa possibile dai checkpoint.',
  QUOTA_ATTESA:'Gemini ha sospeso una richiesta. I checkpoint sono conservati. Il codice 503 indica sovraccarico, non quota esaurita; il 429 indica un limite d’utilizzo. Riprova solo dopo l’attesa indicata.',
  CONFIGURAZIONE:'Gemini non ha una quota o una configurazione valida. Verificare le impostazioni, senza acquistare nulla.',
  PROVIDER:'Il servizio Gemini ha rifiutato la richiesta; ripetere ora non risolve il problema.',
  CONNESSIONE:'Le richieste a Gemini non sono riuscite. I checkpoint sono conservati; non ripetere tentativi identici senza diagnosi.',
  RISPOSTA_NON_VALIDA:'Una risposta Gemini non è valida. La parte è conservata come non verificata; le altre vengono elaborate, salvo errori ripetuti.',
  SORGENTE_DA_VERIFICARE:'Una o più pagine della fonte richiedono verifica prima della compressione.',
  QUALITA:'Alcuni paragrafi attendono una verifica didattica mirata. Le bozze non vengono pubblicate; i risultati delle altre pagine sono conservati.',
  INTERROTTO:'Elaborazione interrotta: i checkpoint precedenti restano validi.',
  ATTESA:'Stato di elaborazione non conclusivo: verifica i dettagli.'
 };
 const quality=snapshot?.diagnostics?.quality||null;
 const provider=snapshot?.diagnostics?.lastProviderDiagnostic||null;
 const reasons=Array.isArray(quality?.reasons)?quality.reasons:[];
 const reasonLabels={
  'missing-protected':'informazione essenziale da recuperare',
  'scoped-qualifier':'negazione o condizione da verificare',
  'letter-budget':'numero di lettere non ancora conforme',
  'new-protected-fact-not-in-source':'dato aggiunto non presente nell’originale',
  'source-topic-support-insufficient':'argomento non sufficientemente fedele',
  'missing-ordered-paragraphs':'paragrafo non restituito da Gemini'
 };
 const reasonText=reasons.slice(0,3).map(x=>reasonLabels[x]||'verifica didattica da completare').join('; ');
 const delayed=Math.max(0,Number(snapshot?.diagnostics?.qualityDeferrals)||0);
 const why=kind==='QUALITA'
  ?(quality?.level?' Livello '+quality.level+' · '+reasonText+'.':'')+
   (delayed?' '+delayed+' blocchi di pagine intere restano da correggere; le altre elaborazioni sono state salvate e possono proseguire.':'')
  :'';
 const diagnosticLabel=provider?.reason?(' Diagnosi: '+String(provider.reason).slice(0,60)+
   (provider.httpStatus?' (HTTP '+Number(provider.httpStatus)+')':'')+'.'):'';
 const pauseReason=snapshot?.quota?.kind==='overload'?' Servizio occupato (HTTP 503).':
   snapshot?.quota?.httpStatus===429?' Limite HTTP 429.':'';
 const waitSource=snapshot?.quota?.estimated?
   ' L’orario di ripresa è una stima locale, non una promessa di Google.':'';
 return {kind,base,halted,description:messages[kind]+why+pauseReason+waitSource+diagnosticLabel,
   checked:stored,remaining:Math.max(0,total-stored),
   retryAt:snapshot?.quota?.retryAt||null,
   canResume:!snapshot?.complete&&kind!=='QUOTA_ATTESA'&&kind!=='CONFIGURAZIONE',
   pendingManualReview:kind==='QUALITA'||kind==='SORGENTE_DA_VERIFICARE'||kind==='PROVIDER'};
}
export function limitedQualityAttemptCount(oldCount=0){
 return Math.min(2,Math.max(0,Number(oldCount)||0)+1);
}
