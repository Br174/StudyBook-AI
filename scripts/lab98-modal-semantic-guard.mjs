// MotorLab StudyBook AI LAB98 — semantic guard on source/output pairs.
// This file does NOT rewrite meaning. It only raises targeted, reviewable alerts.
// Never infer academic correctness from zero alerts; do not send rules to Gemini.
export const RULES={
 scienze:[
  {id:'seasons_not_distance',severity:'high',
   source:/stagion[\s\S]*?non.{0,35}distanza/iu,
   output:/(?:stagion|inclinaz)[\s\S]{0,160}(?:non.{0,50}(?:distanza|vicinan)|(?:distanza|vicinan).{0,45}non)|non.{0,45}distanza[\s\S]{0,100}stagion/iu,
   reason:'Non confondere la causa delle stagioni con la distanza dal Sole.'},
  {id:'eclipses_not_every_lunation',severity:'high',
   source:/ecliss.{0,100}non.{0,40}ogni\s+lunaz/iu,
   output:/(?:ecliss.{0,115}non.{0,40}(?:ogni|tutte).{0,25}lunaz|non.{0,35}(?:ogni|tutte).{0,25}lunaz.{0,100}ecliss|ecliss.{0,90}non.{0,25}ogni\s+(?:mese|ciclo))/iu,
   reason:'Preservare la negazione: non ogni lunazione comporta una eclissi.'},
  {id:'single_result_insufficient',severity:'high',
   source:/un risultato isolato non basta/iu,
   output:/(?:risultat.{0,35}(?:isolat|singol).{0,45}(?:non basta|non.{0,15}suffic)|un.{0,20}risultat.{0,25}non basta|non basta.{0,45}(?:risultat|prova)|(?:prova|risultat).{0,20}isolat.{0,25}insuffic)/iu,
   reason:'Un singolo risultato non è sufficiente a dimostrare una spiegazione.'}
 ],
 medicina:[
  {id:'possible_increase_not_certainty',severity:'high',
   source:/frequenza respiratoria può aumentare/iu,
   output:/(?:frequenza\s+respiratoria.{0,100}(?:può|potrebbe).{0,35}(?:aument|salir)|(?:può|potrebbe).{0,35}(?:aument|salir).{0,100}(?:frequenza respiratoria|respirazione|respiro)|(?:può|potrebbe).{0,35}(?:essere|risultare).{0,30}più\s+(?:alta|elevata))/iu,
   reason:'L originale esprime una possibilità: «può aumentare», non un evento certo.'},
  {id:'pressure_is_partial',severity:'high',
   source:/pressione parziale/iu,
   output:/pression.{0,20}parzial/iu,
   reason:'Non trasformare pressione parziale in una generica pressione.'},
  {id:'single_value_not_always_sufficient',severity:'high',
   source:/un singolo valore misurato non basta sempre/iu,
   output:/(?:un.{0,25}(?:singol|solo).{0,30}(?:valore|dato|misur).{0,65}(?:non.{0,30}(?:sempre|suffic|basta)|non\s+è\s+sempre)|non.{0,25}sempre.{0,35}(?:valore|dato|misur)|(?:valore|dato).{0,55}da solo.{0,35}(?:non|insuffic))/iu,
   reason:'La diagnosi non può basarsi automaticamente su una sola misura.'}
 ],
 procedura:[
  {id:'internal_rule_not_generic_norm',severity:'high',
   source:/regola interna numero 12/iu,
   output:/(?:regol.{0,20}intern.{0,35}(?:12|dodici)|(?:12|dodici).{0,35}regol.{0,20}intern)/iu,
   reason:'Non trasformare la regola interna della biblioteca in una norma generale.'},
  {id:'extension_not_automatic',severity:'high',
   source:/proroga non è automatica/iu,
   output:/(?:prorog|prolungament).{0,80}non.{0,25}automatic|non.{0,25}automatic.{0,70}(?:prorog|prolungament)/iu,
   reason:'La proroga richiede verifica e non è automatica.'},
  {id:'written_confirmation_initial_deadline',severity:'high',
   source:/senza conferma scritta resta valida la data iniziale/iu,
   output:/(?:senza|assenza|mancanza).{0,35}(?:conferma|autorizzaz).{0,100}(?:inizial|originari|scaden)|(?:conferma|autorizzaz).{0,35}scritt.{0,100}(?:inizial|originari|scaden)/iu,
   reason:'Senza conferma scritta resta la scadenza iniziale.'}
 ],
 concetto_sbilanciato:[
  {id:'documented_not_proven',severity:'high',
   source:/fatti documentati/iu,
   output:/fatt.{0,35}documentat|(?:fatt|event).{0,35}attestat.{0,20}(?:font|document)/iu,
   reason:'«Documentato» non equivale a «dimostrato» nel ragionamento storico.'},
  {id:'fact_vs_opinion',severity:'high',
   source:/fatto da un.opinione/iu,
   output:/(?:fatt.{0,70}opinion|opinion.{0,70}fatt)/iu,
   reason:'Distinguere fatti e opinioni.'},
  {id:'source_uncertainty',severity:'high',
   source:/segnalare ciò che resta incerto/iu,
   output:/(?:incert|dubb|non.{0,25}sicuro|non.{0,25}accertat)/iu,
   reason:'Preservare il dovere di segnalare ciò che resta incerto.'}
 ],
 pagina_breve_continua:[
  {id:'peremptory_term',severity:'high',
   source:/termine perentorio/iu,
   output:/termine.{0,15}perentor/iu,
   reason:'Termine perentorio non equivale a scadenza indicativa.'},
  {id:'right_to_motivation_remains',severity:'high',
   source:/resta il diritto alla motivazione/iu,
   output:/(?:rest|manten|rimane|conserv).{0,60}(?:motivaz|ragion)|(?:motivaz|ragion).{0,60}(?:rest|manten|rimane|conserv)/iu,
   reason:'Il diritto alla motivazione permane anche dopo la scadenza.'}
 ]
};
export function semanticGuard(sourceId,original,generated,{level=10}={}){
 if(typeof original!=='string'||typeof generated!=='string')throw Error('Expected source and generated text');
 const source=original.normalize('NFC').replace(/\s+/gu,' ');
 const output=generated.normalize('NFC').replace(/\s+/gu,' ');
 const matched=[],alerts=[],skipped=[];
 for(const rule of RULES[sourceId]||[]){
  if(!rule.source.test(source)){skipped.push(rule.id);continue}
  const isPresent=rule.output.test(output);
  const event={id:rule.id,reason:rule.reason,severity:rule.severity,verifiedBy:'regex heuristic only'};
  if(isPresent)matched.push(event);
  else alerts.push(event);
 }
 const orthography=[];
 if(/\bpoichè\b/iu.test(output))orthography.push('poichè → poiché');
 if(/\bl\s+(?:alunno|iscritto|apparato|inspirazione|espirazione)\b/iu.test(output))orthography.push('Apostrofo assente dopo l');
 if(/\b(?:all|dall)\s+asse\b/iu.test(output))orthography.push('Apostrofo assente davanti ad asse');
 if(/\bnon e\b/iu.test(output))orthography.push('Possibile accento assente in «non è»');
 return{sourceId,level,totalApplicable:matched.length+alerts.length,matched:matched.length,alerts,skipped,orthography,
   use:'Review alerts after generation. Do not correct meaning mechanically; compare with original source.',
   semanticCertified:false};
}
