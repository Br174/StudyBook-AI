// StudyBook AI / MotorLab LAB99 — finite source-anchored relation checks.
// IMPORTANT: This is an audit research prototype for five synthetic sources.
// It is NOT a general-purpose Italian semantic reasoner, nor a release gate by itself.
// Facts remain private to StudyBook and are NOT copied into ordinary Gemini prompts.
const has=(re,txt)=>re.test(txt);
const clean=s=>String(s||'').normalize('NFC').replace(/\s+/gu,' ').trim();
export const sentences=(s)=>clean(s).match(/[^.!?]+[.!?]?/gu)?.map(v=>v.trim()).filter(Boolean)||[];
const checks={
 scienze:[
  {id:'tides_both_moon_and_sun',orig:/La Luna influisce sulle maree insieme al Sole/iu,
   words:[/\bmaree\b/iu,/\bLuna\b/iu,/\bSole\b/iu,/(?:influisc|influenz|caus|provoc|dipend)/iu],
   why:'Conservare insieme il ruolo della Luna e quello del Sole nelle maree.'},
  {id:'eclipse_alignment',orig:/eclissi richiedono un allineamento particolare/iu,
   words:[/ecliss/iu,/allineam/iu],
   why:'Le eclissi richiedono un allineamento particolare.'},
  {id:'eclipse_not_each_lunation',orig:/eclissi.{0,85}non avvengono a ogni lunazione/iu,
   words:[/ecliss/iu,/non.{0,30}(?:ogni|tutte)|non.{0,30}sempre/iu,/(?:lunaz|mese lunar)/iu],
   why:'Non ogni lunazione produce un eclissi.'},
  {id:'observations_repeatable',orig:/osservazioni ripetibili/iu,
   words:[/osservaz/iu,/ripet/iu],
   why:'Il metodo scientifico richiede osservazioni ripetibili.'},
  {id:'seasons_not_distance',orig:/stagioni.{0,100}non dalla distanza/iu,
   words:[/stagion/iu,/non/iu,/(?:distanza|vicinan)/iu],
   why:'Le stagioni NON dipendono dalla distanza dal Sole.'},
  {id:'single_result_not_proof',orig:/un risultato isolato non basta/iu,
   words:[/(?:risultat|prova|evidenz)/iu,/(?:singol|isolat|un solo)/iu,/(?:non.{0,20}(?:basta|suffic)|insuffic|non.{0,35}dimostr)/iu],
   why:'Un risultato isolato non basta a dimostrare una spiegazione.'}
 ],
 medicina:[
  {id:'hemoglobin_in_red_cells',orig:/emoglobina nei globuli rossi/iu,
   words:[/emoglobin/iu,/globul.{0,15}ross/iu],
   why:'La fonte colloca l emoglobina nei globuli rossi.'},
  {id:'partial_pressure',orig:/pressione parziale/iu,
   words:[/pression/iu,/parzial/iu],
   why:'Lo scambio di gas dipende da differenze di pressione parziale.'},
  {id:'effort_both_oxygen_and_co2',orig:/consuma più ossigeno e produce più anidride carbonica/iu,
   words:[/(?:sforz|eserciz)/iu,/ossigen/iu,/anidride carbonica/iu,/(?:consum|richied|utilizz|aument)/iu,/(?:produc|gener|aument)/iu],
   why:'Lo sforzo aumenta il consumo di ossigeno e la produzione di anidride carbonica.'},
  {id:'respiration_may_increase',orig:/frequenza respiratoria può aumentare/iu,
   words:[/(?:frequenza respiratoria|respiro|respiraz)/iu,/(?:può|potrebbe|possibil)/iu,/(?:aument|salir|più rapid)/iu],
   why:'La frequenza respiratoria PUÒ aumentare, non necessariamente aumenta.'},
  {id:'single_value_not_always_enough',orig:/un singolo valore misurato non basta sempre/iu,
   words:[/(?:singol|un solo|un unic)/iu,/(?:valore|misur)/iu,/(?:non.{0,20}(?:basta|suffic|sempre)|insuffic)/iu],
   why:'Un singolo valore non basta sempre per una diagnosi.'}
 ],
 procedura:[
  {id:'internal_rule_12',orig:/regola interna numero 12/iu,
   words:[/regol/iu,/intern/iu,/(?:12|dodici)/iu],
   why:'Non trasformare la regola interna 12 in una norma generica.'},
  {id:'unconfirmed_extension_original_deadline',orig:/senza conferma scritta resta valida la data iniziale/iu,
   words:[/(?:senza|mancanz|assenza)/iu,/(?:conferma|autorizzaz)/iu,/(?:data|scadenza)/iu,/(?:inizial|originari)/iu],
   why:'Senza conferma scritta resta valida la data iniziale.'},
  {id:'reserved_return_even_if_unread',orig:/restituirlo alla scadenza anche se non ha completato la lettura/iu,
   words:[/(?:prenot|riserv)/iu,/(?:restitu|rendere|render|riport)/iu,/(?:anche se|pur|nonostante|senza)/iu,/(?:finito|completat|terminat|letto|lettura|legger)/iu],
   why:'Il libro prenotato va restituito anche se lo studente non ha finito di leggerlo.'},
  {id:'register_who_and_when',orig:/ricostruire chi ha ricevuto il libro e in quale giorno/iu,
   words:[/\bregistro\b/iu,/(?:\bchi\b|student|lettor|destinatar)/iu,/(?:giorn|data|quando)/iu],
   why:'Nel registro risultano la persona che riceve il libro e il giorno.'},
  {id:'extension_not_automatic',orig:/proroga non è automatica/iu,
   words:[/prorog/iu,/non/iu,/automatic/iu],
   why:'La proroga non è automatica.'}
 ],
 concetto_sbilanciato:[
  {id:'facts_not_opinions',orig:/distinguere un fatto da un.opinione/iu,
   words:[/fatt/iu,/opinion/iu,/(?:distingu|separ|differenz)/iu],
   why:'I fatti vanno distinti dalle opinioni.'},
  {id:'uncertainty_explicit',orig:/segnalare ciò che resta incerto/iu,
   words:[/(?:incert|dubb|non.{0,25}sicuro|non.{0,25}accert)/iu,/(?:segnal|dichiar|evidenz)/iu],
   why:'La parte incerta della ricostruzione deve essere segnalata.'},
  {id:'documented_not_proven',orig:/fatti documentati/iu,
   words:[/fatt/iu,/(?:documentat|attestat)/iu],
   why:'Fatti documentati non significa dimostrati con certezza.'}
 ],
 pagina_breve_continua:[
  {id:'peremptory_15_days_notification',orig:/termine perentorio.{0,90}15 giorni dalla notifica/iu,
   words:[/perentor/iu,/(?:15|quindici)/iu,/(?:giorn)/iu,/(?:notific)/iu],
   why:'Termine perentorio di 15 giorni dalla notifica.'},
  {id:'right_motivation_remains',orig:/resta però il diritto di conoscere la motivazione/iu,
   words:[/(?:diritto|facolt)/iu,/(?:rest|permane|continu|conserv|manten|rimane)/iu,/(?:motivaz|ragion)/iu],
   why:'Dopo la scadenza resta il diritto alla motivazione.'}
 ]
};
export const relationRulesFor=id=>checks[id]||[];
export function relationshipGuard(sourceId,original,output){
 const source=clean(original),target=clean(output),scope=sentences(target);
 const applicable=[],alerts=[],matched=[],notApplicable=[];
 for(const rule of relationRulesFor(sourceId)){
  if(!has(rule.orig,source)){notApplicable.push(rule.id);continue}
  applicable.push(rule.id);
  const inSameSentence=scope.some(sentence=>rule.words.every(re=>has(re,sentence)));
  const entry={id:rule.id,why:rule.why,evidence:'same-sentence lexical co-occurrence only'};
  if(inSameSentence)matched.push(entry);
  else alerts.push(entry);
 }
 const typing=[];
 if(/\bpoichè\b/iu.test(target))typing.push('Accent: poichè');
 if(/\bl\s+(?:alunno|iscritto|apparato|inspirazione|espirazione)\b/iu.test(target))typing.push('Missing apostrophe');
 return{sourceId,applicable:applicable.length,passed:matched.length,alerts,notApplicable,typing,
  advisoryOnly:true,
  limitation:'A same-sentence keyword match does NOT prove correct polarity/causality, and valid rephrasings may be flagged. Do not auto-certify or auto-correct meanings.'};
}
