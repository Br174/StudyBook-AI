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
  status==='quality-review'?'QUALITA':
  status==='source-review-needed'?'SORGENTE_DA_VERIFICARE':
  RECOVERY_KINDS[halted]|| (status==='complete'?'COMPLETO':status==='partial'?'PARZIALE':'ATTESA');
 const base=stored+'/'+total+' parti IA verificate';
 const messages={
  COMPLETO:'Tutte le edizioni verificate e salvate.',
  PARZIALE:'Elaborazione parziale: ripresa possibile dai checkpoint.',
  QUOTA_ATTESA:'Limite temporaneo Gemini. I checkpoint sono conservati. Non inviare nuove richieste prima della ripresa consentita.',
  CONFIGURAZIONE:'Gemini non ha una quota o una configurazione valida. Verificare le impostazioni, senza acquistare nulla.',
  PROVIDER:'Il servizio Gemini ha rifiutato la richiesta; ripetere ora non risolve il problema.',
  CONNESSIONE:'Le richieste a Gemini non sono riuscite. I checkpoint sono conservati; non ripetere tentativi identici senza diagnosi.',
  RISPOSTA_NON_VALIDA:'Una risposta Gemini non è valida. La parte è conservata come non verificata; le altre vengono elaborate, salvo errori ripetuti.',
  SORGENTE_DA_VERIFICARE:'Una o più pagine della fonte richiedono verifica prima della compressione.',
  QUALITA:'Una risposta Gemini non supera i vincoli di fedeltà o riduzione esatta. La parte resta in bozza; le altre proseguono salvo errori ripetuti.',
  INTERROTTO:'Elaborazione interrotta: i checkpoint precedenti restano validi.',
  ATTESA:'Stato di elaborazione non conclusivo: verifica i dettagli.'
 };
 const quality=snapshot?.diagnostics?.quality||null;
 const provider=snapshot?.diagnostics?.lastProviderDiagnostic||null;
 const why=kind==='QUALITA'&&quality?.level
  ?' Livello '+quality.level+' · '+(quality.reasons||[]).slice(0,3).join(', '):'';
 const diagnosticLabel=provider?.reason?(' Diagnosi: '+String(provider.reason).slice(0,60)+
   (provider.httpStatus?' (HTTP '+Number(provider.httpStatus)+')':'')+'.'):'';
 return {kind,base,halted,description:messages[kind]+why+diagnosticLabel,
   checked:stored,remaining:Math.max(0,total-stored),
   retryAt:snapshot?.quota?.retryAt||null,
   canResume:!snapshot?.complete&&kind!=='QUOTA_ATTESA'&&kind!=='CONFIGURAZIONE',
   pendingManualReview:kind==='QUALITA'||kind==='SORGENTE_DA_VERIFICARE'||kind==='PROVIDER'};
}
export function limitedQualityAttemptCount(oldCount=0){
 return Math.min(2,Math.max(0,Number(oldCount)||0)+1);
}
