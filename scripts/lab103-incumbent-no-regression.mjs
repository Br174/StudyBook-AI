// StudyBook AI / MotorLab LAB103: NO-REGRESSION incumbent benchmark.
// Read historical REAL Gemini outputs; DO NOT invoke Gemini; DO NOT edit production.
// Numeric "champions" and semantic candidates are separate. Neither is an APK release.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {FIXTURES} from './lab93-semantic-gate.mjs';
import {budget,letters,wrap} from './lab92-stop-complete-engine.mjs';
import {normalize,sha256} from './lab100-first-read-ledger.mjs';
import {relationshipGuard} from './lab99-relational-guard.mjs';
import {oxygenDirectionRisk} from './lab103-source-direction-risk.mjs';
const READ=p=>JSON.parse(readFileSync(p,'utf8'));
const old97=READ('audit/reports/lab97-level-specific-real.json');
const old98=READ('audit/reports/lab98-real-gemini.json');
const old99=READ('audit/reports/lab99-gemini-sentence-repairs.json');
const old99b=READ('audit/reports/lab99-one-retry-gemini.json');
const raw102sci=READ('audit/reports/lab102-real-six-reductions.json');
const raw102other=READ('audit/reports/lab102-other-four-real-six-reductions.json');
const edits102sci=READ('audit/reports/lab102-science-targeted-review.json');
const lab101=READ('audit/reports/lab101-real-priorities.json');
const originals=new Map(FIXTURES.map(s=>[s.id,s]));
const inventories=new Map(lab101.pages.filter(p=>p.anchorValidated).map(p=>[p.source,p]));
const candidates=[],warnings=[];
function add(source,level,from,text,meta={}){
 if(!text||!originals.has(source))return;
 const key=source+'|'+level+'|'+from;
 if(candidates.some(c=>c.key===key))throw Error('DUPLICATE_CANDIDATE_'+key);
 const src=originals.get(source),ledger=inventories.get(source);
 assert(ledger,'MISSING_LAB101_LEDGER '+source);
 assert.equal(sha256(normalize(src.concepts.join(' '))),ledger.ledger.sourceHash,'SOURCE_DRIFT');
 assert(ledger.plans.some(p=>p.level===level),'NO_SIX_LEVEL_PLAN');
 const b=budget(src,level),n=letters(text),w=wrap(text);
 const percent=+(100*(1-n/b.originalLetters)).toFixed(2);
 const numeric=b.short||(b.band.low<=n&&n<=b.band.high);
 const geometry=w.lines.length<=b.targetCap&&!w.overlong;
 const rel=relationshipGuard(source,normalize(src.concepts.join(' ')),normalize(text));
 candidates.push({
  key,source,level,from,sourceHash:ledger.ledger.sourceHash,
  rankedInventoryHash:ledger.ledger.hash,textHash:sha256(normalize(text)),
  text,sourceLetters:b.originalLetters,actualLetters:n,lettersSaved:b.originalLetters-n,
  targetLetters:b.targetLetters,range:b.band,reduction:percent,
  maxRows:b.targetCap,rows:w.lines.length,fitPercent:numeric,fitGrid:geometry,
  hardPass:numeric&&geometry,percentExempt:b.short,
  relationAlerts:rel.alerts.map(x=>x.id),relationRulePass:rel.alerts.length===0,
  finalSemanticCertified:false,approvedForApp:false,meta
 });
}
// Complete historical sweep LAB85–96 before deciding any numerically closest
// incumbent. Treat these as archived candidates; never mistake a prior math
// success for an expert semantic certificate.
const history=[
 ['85','lab85-six-levels-real-gemini','records','text'],
 ['86','lab86-six-levels-real-gemini','records','text'],
 ['87','lab87-targeted-repair-real-gemini','records','repaired'],
 ['89','lab89-proportional-real-gemini','records','validation.rawText'],
 ['90','lab90-fluid-useful-elaboration-real','records','validation.text'],
 ['92','lab92-stop-complete-real-gemini','results','check.rawText'],
 ['93','lab93-real-atomic-fact-gemini','results','metrics.rawText'],
 ['94','lab94-real-italian-facts-gemini','results','metrics.rawText'],
 ['95','lab95-compact-facts-real','records','metrics.rawText'],
 ['96','lab96-source-only-real-gemini','cases','metrics.text']
];
for(const [lab,file,key,textPath] of history){
 const h=READ('audit/reports/'+file+'.json');
 for(const v of h[key]||[]){
  const actual=textPath.split('.').reduce((a,k)=>a?.[k],v);
  if(typeof actual!=='string'||!actual.trim()||!Number.isInteger(v.level))continue;
  if(v.valid===false||v.outputValid===false||v.textReturned===false)continue;
  const src=originals.get(v.source);
  if(!src)continue;
  const sourceLetters=letters(src.concepts.join(' '));
  const historicalLetters=v.originalLetters??v.validation?.originalLetters??v.metrics?.sourceLetters??v.check?.sourceLetters??v.plan?.originalLetters??v.plan?.sourceLetters;
  if(historicalLetters!=null&&historicalLetters!==sourceLetters){
   warnings.push({lab,source:v.source,level:v.level,reason:'SOURCE_LETTER_COUNT_MISMATCH',historicalLetters,sourceLetters});
   continue;
  }
  add(v.source,v.level,'LAB'+lab+'_GEMINI'+(v.variant?'_'+v.variant:''),actual,{historicalRaw:true});
 }
}
for(const x of old97.results||[])if(x.valid&&x.metrics?.text)add(x.source,x.level,'LAB97_GEMINI',x.metrics.text);
for(const x of old98.results||[])if(x.valid&&x.metrics?.text)add(x.source,x.level,'LAB98_GEMINI',x.metrics.text);
for(const x of old99.results||[])if(x.check?.newText&&x.check.acceptedMathematically)add(x.source,x.level,'LAB99_TARGETED_FIRST_'+x.caseId,x.check.newText,
 {correctedRelation:x.caseId,otherPagesStillRequireQA:true});
const retry=old99b.result;
if(retry?.check?.newText)add(retry.check.source,retry.check.level,'LAB99_TARGETED_RETRY_'+retry.caseId,retry.check.newText,
 {correctedRelation:retry.caseId,oldGuardHadSynonymFalseAlert:true,otherPagesStillRequireQA:true});
for(const p of [raw102sci,...[raw102other]])for(const page of p.pages||[])for(const version of page.versions||[])
 if(version.providerOk&&version.analysis?.sections){
  add(page.source,version.level,'LAB102_GEMINI',version.analysis.sections.map(s=>s.text).join(' '));
 }
for(const p of edits102sci.patches||[]){
 add('scienze',p.level,'LAB102_TARGETED_REVIEW_COPY',p.proposal.map(s=>s.text).join(' '),
  {originalGeminiUnchanged:true,editorialProposalNotModelOutput:true});
}
// Independent closest-to-target index across all archived real responses.
// This does NOT replace curated winners or override semantic risk vetoes.
const nearestMeasured=[65,50,40,30,20,10].map(level=>{
 const eligible=candidates.filter(c=>c.level===level&&c.hardPass&&!c.percentExempt)
 .sort((a,b)=>Math.abs(a.reduction-level)-Math.abs(b.reduction-level)
   ||a.relationAlerts.length-b.relationAlerts.length
   ||a.key.localeCompare(b.key,'it'));
 const c=eligible[0];
 return c?{level,key:c.key,source:c.source,reduction:c.reduction,rows:c.rows,maxRows:c.maxRows,
  distancePoints:+Math.abs(c.reduction-level).toFixed(2),relationAlerts:c.relationAlerts,
  semanticCertified:false}:null;
});
assert(nearestMeasured.every(Boolean),'ONE_LEVEL_WITHOUT_HISTORIC_NUMERIC_SUCCESS');
const get=(s,l,f)=>{const c=candidates.find(x=>x.source===s&&x.level===l&&x.from===f);assert(c,'MISSING_BEST_'+s+'_'+l+'_'+f);return c};
// Independently verified numeric baselines: chosen as examples of precise output,
// not falsely represented as six levels of the same source.
const pinnedQuantitative=[
 get('scienze',65,'LAB98_GEMINI'),         // 64.94%, but omits essential facts
 get('scienze',50,'LAB98_GEMINI'),         // 50.08%, but omits essential facts
 get('procedura',40,'LAB99_TARGETED_RETRY_unread_reserved_procedura40'),
 get('concetto_sbilanciato',30,'LAB102_GEMINI'),
 get('medicina',20,'LAB99_TARGETED_FIRST_hemoglobin_red_cells_medicina20'),
 get('medicina',10,'LAB102_GEMINI')
];
for(const x of pinnedQuantitative)assert(x.hardPass,'NUMERIC_INCUMBENT_REGRESSION '+x.key+' '+JSON.stringify({pct:x.reduction,rows:x.rows,cap:x.maxRows}));
const semanticCandidates=[
 get('medicina',10,'LAB102_GEMINI'),
 get('concetto_sbilanciato',20,'LAB102_GEMINI'),
 get('scienze',65,'LAB102_TARGETED_REVIEW_COPY'),
 get('scienze',30,'LAB102_TARGETED_REVIEW_COPY')
];
for(const x of semanticCandidates)assert(x.hardPass,'SEMANTIC_CANDIDATE_MATH_REGRESSION '+x.key);
// Human-readable FACT REVIEW prompts are not repeated into generation. This is
// a reproducible independent inspection aid: evidence presence is NOT entailment.
const reviews={
 'medicina|10':[
  ['respiratory_airways',/vie aeree/iu],
  ['inspiration_diaphragm_contraction_torso_expands',/inspiraz.{0,35}diaframma si contrae.{0,35}torace aumenta di volume/iu],
  ['expiration_diaphragm_relaxes',/espiraz.{0,35}diaframma si rilassa/iu],
  ['oxygen_to_blood',/ossigeno passa dall'aria al sangue/iu],
  ['co2_reverse',/anidride carbonica fa il percorso inverso/iu],
  ['partial_pressure',/pressione parziale/iu],
  ['hemoglobin_in_red_blood_cells',/emoglobina nei globuli rossi/iu],
  ['respiration_may_increase',/frequenza respiratoria può aumentare/iu],
  ['effort_oxygen_and_co2',/consuma più ossigeno e produce più anidride carbonica/iu],
  ['diagnosis_three_sources',/sintomi, storia clinica ed esame obiettivo/iu],
  ['one_value_not_always',/singolo valore.{0,30}non basta sempre/iu],
  ['clinical_context',/contesto clinico/iu]
 ],
 'concetto_sbilanciato|20':[
  ['source_types',/lettere, cronache, carte geografiche e registri/iu],
  ['provenance_author_time_purpose',/provenienza.{0,55}autore, tempo e scopo/iu],
  ['testimonies_and_interests',/testimonianze diverse.{0,100}interessi particolari/iu],
  ['independent_sources',/fonti indipendenti/iu],
  ['fact_vs_opinion',/distinguere fatti da opinioni/iu],
  ['uncertainty',/segnalare l'incertezza/iu],
  ['causes_context_consequences',/data isolata non spiega le cause.{0,75}contesto e conseguenze/iu],
  ['primary_source',/fonte primaria è prodotta nel periodo studiato/iu],
  ['secondary_source',/fonte secondaria interpreta documenti precedenti/iu],
  ['hypotheses_documented_facts',/ipotesi vanno distinte dai fatti documentati/iu]
 ],
 'scienze|65':[
  ['rotation_day_night',/Terra ruota.{0,20}giorno e notte/iu],
  ['revolution_orbit_year',/Orbita attorno al Sole in un anno/iu],
  ['seasons_tilt_not_distance',/Stagioni: asse inclinato, non distanza/iu],
  ['tides_moon_and_sun',/Luna e Sole causano maree/iu],
  ['eclipse_alignment_not_every_lunation',/Eclissi: allineamento, non ogni lunazione/iu],
  ['testable_hypotheses_repeatable_observations',/ipotesi verificabili, osservazioni ripetibili/iu],
  ['single_result_not_enough',/un risultato isolato non basta/iu],
  ['movement_vs_causes',/Distinguere moti e cause/iu]
 ],
 'scienze|30':[
  ['rotating_earth_day_night',/Terra ruota.{0,90}rotazione causa il giorno e la notte/iu],
  ['sun_orbit_one_year',/rivoluzione attorno al Sole dura circa un anno/iu],
  ['tilt_not_distance',/stagioni dipendono dall'inclinazione.{0,70}non dalla distanza/iu],
  ['moon_and_sun_tides',/Luna influisce sulle maree insieme al Sole/iu],
  ['eclipses_alignment_and_not_each_lunation',/eclissi richiedono un allineamento.{0,100}non avvengono a ogni lunazione/iu],
  ['testable_hypotheses_repeatable_observations',/ipotesi verificabili e osservazioni ripetibili/iu],
  ['isolated_result_not_enough',/risultato non basta/iu],
  ['distinguish_moves_causes',/Distinguere movimenti e cause delle variazioni/iu]
 ]
};
const reviewed=[];
for(const c of semanticCandidates){
 const ruleSet=reviews[c.source+'|'+c.level]||[];
 const facts=ruleSet.map(([fact,re])=>({fact,evidencePhraseLocated:re.test(c.text)}));
 const missed=facts.filter(x=>!x.evidencePhraseLocated).map(x=>x.fact);
 reviewed.push({candidate:c.key,actualLetters:c.actualLetters,reduction:c.reduction,
   rows:c.rows,maxRows:c.maxRows,fitPercent:c.fitPercent,fitGrid:c.fitGrid,
   relationAlerts:c.relationAlerts,checkedEvidencePhrases:facts.length,phrasesNotLocated:missed,
   semanticCertified:false,
   humanFactReviewStillRequired:true,
   limitation:'String evidence is not semantic entailment; review polarity, scope, modality, subject, cause independently.'
 });
}
const adverse=[];
const targetedDirectionRisks=[];
for(const {source,level,from,editId,original,replacement} of [
 {source:'medicina',level:10,from:'LAB102_GEMINI',editId:'may_to_must',original:'può aumentare',replacement:'deve aumentare'},
 {source:'concetto_sbilanciato',level:20,from:'LAB102_GEMINI',editId:'documented_to_proven',original:'fatti documentati',replacement:'fatti dimostrati'},
 {source:'scienze',level:65,from:'LAB102_TARGETED_REVIEW_COPY',editId:'negation_removed',original:'non ogni lunazione',replacement:'ogni lunazione'},
 {source:'medicina',level:10,from:'LAB102_GEMINI',editId:'direction_swapped',original:"ossigeno passa dall'aria al sangue",replacement:"ossigeno passa dal sangue all'aria"}
]){
 const c=get(source,level,from);
 assert(c.text.includes(original),'MISSING_NEGATIVE_TEST_SOURCE');
 const mutant=c.text.replace(original,replacement);
 const srcText=normalize(originals.get(source).concepts.join(' '));
 const guard=relationshipGuard(source,srcText,mutant);
 const detected=guard.alerts.length>c.relationAlerts.length||guard.alerts.some(a=>!c.relationAlerts.includes(a.id));
 const extra=oxygenDirectionRisk(source,srcText,mutant);
 const targetedDetected=extra.directionReversal;
 adverse.push({editId,source,level,oldGuardDetected:detected,targetedDirectionDetected:targetedDetected,
  combinedDetected:detected||targetedDetected,alerts:guard.alerts.map(x=>x.id),
  warning:!detected&&!targetedDetected?'KNOWN_FALSE_NEGATIVE_KEEP_PROMOTION_BLOCKED':null});
}
assert(adverse.some(x=>!x.oldGuardDetected),'OLD_GUARD_LIMIT_NOT_DOCUMENTED');
assert(adverse.every(x=>x.combinedDetected),'TARGETED_FIX_DID_NOT_CATCH_NEGATIVE');
const medWinner=get('medicina',10,'LAB102_GEMINI');
const medDirection=oxygenDirectionRisk('medicina',normalize(originals.get('medicina').concepts.join(' ')),medWinner.text);
assert.equal(medDirection.sourceSupportedDirection,true,'VALID_MEDICINE_WINNER_DIRECTION_FLAGGED');
assert.equal(medDirection.requiresReview,false,'VALID_MEDICINE_WINNER_FALSE_POSITIVE');
targetedDirectionRisks.push({candidate:medWinner.key,sourceSupportedDirection:true,reversal:false});
const report={
 name:'MotorLab StudyBook LAB103 incumbent no-regression baseline',
 executedAt:new Date().toISOString(),
 scope:'OFFLINE historical-only, no Gemini requests, no APK/production changes',
 sourceOrigin:'LAB97,LAB98,LAB99,LAB101,LAB102 GitHub evidence',
 totals:{historicalRealCandidates:candidates.length,additionalOlderDatasets:history.length,
  quantitativeIncumbents:pinnedQuantitative.length,
  semanticReviewCandidates:semanticCandidates.length,fullySemanticallyCertified:0,
  adversarialCases:adverse.length,oldGuardFalseNegatives:adverse.filter(x=>!x.oldGuardDetected).length,
  remainingCombinedGuardFalseNegatives:adverse.filter(x=>!x.combinedDetected).length},
 nearestMeasured,
 warnings,
 quantitativeIncumbents:pinnedQuantitative.map(x=>({key:x.key,source:x.source,level:x.level,
  reduction:x.reduction,rows:x.rows,maxRows:x.maxRows,letters:x.actualLetters,
  relationAlerts:x.relationAlerts,sourceHash:x.sourceHash,textHash:x.textHash,
  quantitativePass:x.hardPass,semanticCertified:false})),
 semanticReviewCandidates:reviewed,
 adversarialChecks:adverse,
 targetedDirectionRisks,
 candidateIndex:candidates.map(x=>({key:x.key,source:x.source,level:x.level,from:x.from,
  reduction:x.reduction,rows:x.rows,maxRows:x.maxRows,letters:x.actualLetters,
  mathPass:x.hardPass,relationAlerts:x.relationAlerts,textHash:x.textHash})),
 permanentAntiRegressionRules:[
  'Keep verified baseline winners unchanged until a replacement beats both their numeric AND factual-relation metrics.',
  'Numerical and semantic champions are distinct; neither is automatically released.',
  'Use LAB97 conservative editing for 10/20; LAB98 modality safeguards; LAB99 sentence-only repairs with rollback.',
  'Reuse LAB101 single-read ledger, but NEVER duplicate its full fact claims in the Gemini generation prompt.',
  'Do NOT use LAB102 verbose prompt as the baseline; its source-ledger reuse and checkpoint evidence remain useful.',
  'Do not repeat prior Gemini pages; first compare and inspect archived candidates with offline tests.',
  'If faithful reduction is impossible, flag impossibility; do not trim words, fabricate filler or silently move source facts.',
  'Require separate full human/expert semantical audit before APK or production promotion.'
 ],
 conclusion:'Incumbents and key qualitative artifacts locked. Current rules do not prove semantic fidelity. No further Gemini calls justified until exact gaps on incumbent pages are reviewed.',
 appChanged:false,freeTierCalls:0,addedCostEuro:0,releaseEligible:false
};
mkdirSync('audit/reports',{recursive:true});
writeFileSync('audit/reports/lab103-incumbent-no-regression.json',JSON.stringify(report,null,2)+'\n');
console.log('LAB103_INCUMBENTS',JSON.stringify({totals:report.totals,
 quantitative:report.quantitativeIncumbents.map(x=>({level:x.level,reduction:x.reduction,rows:x.rows,cap:x.maxRows,source:x.source})),
 qualitative:reviewed.map(x=>({id:x.candidate,phrasesMissing:x.phrasesNotLocated,relAlerts:x.relationAlerts})),
 mutated:adverse}));
