// StudyBook AI LAB110 source-backed risk signals. NOT a general semantic
// verifier. Each rule activates ONLY when the original actually contains
// the corresponding relation. These are one-way warnings, never approvals.
// No provider calls, no model inference, no original text in returned audit.
const normalized=v=>String(v??'').normalize('NFC').toLocaleLowerCase('it-IT')
 .replace(/\s+/gu,' ').trim();
export const STUDY_SOURCE_RISK_POLICY_V110='original-triggered-relation-risk-v110';
function risksForPair(source,output){
 const src=normalized(source),out=normalized(output),warnings=[];
 function rule(trigger,presence,code){
  if(trigger.test(src)&&!presence(out))warnings.push(code);
 }
 rule(/eclissi.{0,85}non avvengono a ogni lunazione/u,
  t=>/ecliss/u.test(t)&&/non.{0,75}lunazion/u.test(t),
  'ECLIPSE_NOT_EVERY_LUNATION_MISSING');
 rule(/stagioni.{0,105}non dalla distanza/u,
  t=>/stagion/u.test(t)&&/non.{0,70}distanz/u.test(t),
  'SEASON_NOT_DISTANCE_MISSING');
 rule(/distinguere fra descrizione del movimento e cause delle variazioni/u,
  t=>/descriz|descriv/u.test(t)&&/caus/u.test(t)&&/variazion/u.test(t),
  'DESCRIPTION_VS_CAUSES_OF_VARIATIONS_MISSING');
 rule(/ipotesi verificabili e osservazioni ripetibili/u,
  t=>/ipotes/u.test(t)&&/verific/u.test(t)&&/osserv/u.test(t)&&/ripet/u.test(t),
  'TESTABLE_HYPOTHESES_REPEATABLE_OBSERVATIONS_MISSING');
 rule(/un risultato isolato non basta/u,
  t=>/(risultat|dato|esito).{0,50}(isolat|singol)/u.test(t)&&/non.{0,45}(bast|dimostr|prov)/u.test(t),
  'ISOLATED_RESULT_NOT_PROOF_UNCLEAR');
 if(/luna influisce sulle maree insieme al sole/u.test(src)&&
    /(luna.{0,55}caus.{0,25}maree|sole.{0,55}caus.{0,25}maree)/u.test(out))
  warnings.push('TIDES_INFLUENCE_CHANGED_TO_CAUSE');
 rule(/regola interna numero 12/u,
  t=>/regol.{0,30}intern/u.test(t)&&/(12|dodici)/u.test(t),
  'INTERNAL_RULE_12_UNCLEAR');
 rule(/registri il titolo prima del prestito/u,
  t=>/titol/u.test(t)&&/prim.{0,35}prestito/u.test(t),
  'TITLE_MUST_BE_REGISTERED_BEFORE_LOAN_MISSING');
 rule(/confermi la restituzione entro dieci giorni/u,
  t=>/conferm/u.test(t)&&/restitu|reso|rientr/u.test(t)&&/dieci|10/u.test(t),
  'RETURN_CONFIRMATION_WITHIN_TEN_DAYS_MISSING');
 rule(/proroga non è automatica/u,
  t=>/prorog/u.test(t)&&(/non.{0,35}automatic/u.test(t)||/richied.{0,35}conferm.{0,20}scritt/u.test(t)),
  'EXTENSION_NOT_AUTOMATIC_UNCLEAR');
 rule(/ricostruire chi ha ricevuto il libro e in quale giorno/u,
  t=>/registr/u.test(t)&&/chi|ricev|beneficiar/u.test(t)&&/giorn|dat|quando/u.test(t),
  'REGISTER_WHO_RECEIVED_WHEN_MISSING');
 rule(/anche se non ha completato la lettura/u,
  t=>/scadenz/u.test(t)&&/anche se|pur/u.test(t)&&/lettur|lett|terminat|completat/u.test(t),
  'RESERVED_RETURN_EVEN_IF_UNREAD_UNCLEAR');
 return warnings;
}
export function sourceRiskReviewV110(units,parts){
 const byId=new Map((parts||[]).map(x=>[x.id,x.text]));
 const groups=(units||[]).map(u=>{
  const t=byId.get(u.id),missing=typeof t!=='string'||!t.trim();
  const warnings=missing?['SOURCE_PART_MISSING']:risksForPair(u.source,t);
  return {id:u.id,warningCodes:warnings,needsReview:missing||warnings.length>0};
 });
 return {
  policy:STUDY_SOURCE_RISK_POLICY_V110,heuristicOnly:true,semanticCertified:false,
  readyForStudy:false, // NEVER translate no warnings into certified semantics.
  signalCount:groups.reduce((n,x)=>n+x.warningCodes.length,0),
  groups
 };
}
