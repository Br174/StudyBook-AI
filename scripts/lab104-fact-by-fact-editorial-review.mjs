// StudyBook AI / MotorLab LAB104 — source-backed fact-by-fact editorial audit.
// REVIEW ONLY: no Gemini calls; no PDF conversion; no app/production changes.
// Four strongest LAB103 quality candidates, 52 source-ledger facts, four bounded edits.
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {FIXTURES} from './lab93-semantic-gate.mjs';
import {letters, wrap, budget} from './lab92-stop-complete-engine.mjs';
import {normalize, sha256} from './lab100-first-read-ledger.mjs';
import {relationshipGuard} from './lab99-relational-guard.mjs';
import {oxygenDirectionRisk} from './lab103-source-direction-risk.mjs';
const read=path=>JSON.parse(readFileSync(path,'utf8'));
const sourceMap=new Map(FIXTURES.map(s=>[s.id,s]));
const inventories=new Map(read('audit/reports/lab101-real-priorities.json').pages.map(p=>[p.source,p]));
const four=read('audit/reports/lab102-other-four-real-six-reductions.json');
const scienceCopies=read('audit/reports/lab102-science-targeted-review.json');
const previous=read('audit/reports/lab103-incumbent-no-regression.json');
const historyPatch=read('audit/reports/lab103-targeted-history-modality.json');
function oldTextFor(source,level){
 if(source==='scienze')return normalize(scienceCopies.patches.find(p=>p.level===level).proposal.map(s=>s.text).join(' '));
 const page=four.pages.find(p=>p.source===source);
 let txt=normalize(page.versions.find(v=>v.level===level&&v.providerOk).analysis.sections.map(s=>s.text).join(' '));
 if(source==='concetto_sbilanciato'&&level===20){
  assert.equal(txt.split(historyPatch.oldSentence).length,2,'LAB103 old sentence no longer unique');
  txt=txt.replace(historyPatch.oldSentence,historyPatch.replacementSentence);
  assert.equal(sha256(txt),historyPatch.after.textHash,'LAB103_HISTORY_HASH_DRIFT');
 }
 return txt;
}
const changes={
 'scienze|65':[
  {old:'Luna e Sole causano maree.',replacement:'Maree: Luna e Sole influiscono.',reason:'Do not strengthen source influence into definite cause.'},
  {old:'un risultato isolato non basta',replacement:'un esito isolato non basta',reason:'Synonymous compact wording offsets letters without padding; still needs explicit proof object.'}
 ],
 'scienze|30':[
  {old:'Metodo scientifico: ipotesi verificabili e osservazioni ripetibili; un solo risultato non basta. Distinguere movimenti e cause delle variazioni.',
   replacement:'Metodo: ipotesi verificabili, osservazioni ripetibili; un solo risultato non dimostra una spiegazione. Distinguere moto e cause delle variazioni.',
   reason:'Explicitly restore what a single result cannot demonstrate. Keep the rest of page identical.'}
 ],
 'concetto_sbilanciato|20':[
  {old:'Due testimonianze sullo stesso episodio possono differire per aspetti osservati o interessi particolari.',
   replacement:'Testimonianze sullo stesso episodio possono differire per aspetti osservati o interessi degli autori.',
   reason:'Make interests belong to authors while preserving possibility and same episode.'}
 ],
 'medicina|10':[]
};
// Codes FULL = claim preserved by exact inspected excerpt (NOT expert certification).
// PARTIAL = source-backed nuance is missing or too elliptical.
// OPTIONAL_OMITTED = contextual/support information absent, not a core loss.
// Every judgment is explicit and traceable to one saved LAB101 fact.
const map={
 'medicina|10':[
  ['F1','OPTIONAL_OMITTED','', 'Didactic introduction omitted: context, not a fundamental mechanism.'],
  ['F2','FULL',"L'apparato respiratorio porta aria ai polmoni tramite le vie aeree",'Airways and direction preserved.'],
  ['F3','FULL',"Durante l'inspirazione il diaframma si contrae",'Inspiratory contraction preserved.'],
  ['F4','FULL','il torace aumenta di volume','Thoracic volume increase preserved.'],
  ['F5','FULL',"durante l'espirazione a riposo il diaframma si rilassa",'Resting exhalation qualifier retained.'],
  ['F6','FULL',"Negli alveoli polmonari l'ossigeno passa dall'aria al sangue",'Oxygen direction correct.'],
  ['F7','FULL',"mentre l'anidride carbonica fa il percorso inverso",'Inverse path refers to blood-to-air; antecedent preserved.'],
  ['F8','FULL','Lo scambio avviene per differenze di pressione parziale','Partial pressures preserved.'],
  ['F9','PARTIAL','attraverso pareti sottili','Original says molto sottili; mild support-level qualifier omitted.'],
  ['F10','PARTIAL',"L'emoglobina nei globuli rossi trasporta gran parte dell'ossigeno",'The explicit words nel sangue are absent, though nearby alveolar context implies blood.'],
  ['F11','FULL','La frequenza respiratoria può aumentare nello sforzo','May, not must, preserved.'],
  ['F12','FULL',"l'organismo consuma più ossigeno e produce più anidride carbonica",'Both changes and causal linkage with preceding perché preserved.'],
  ['F13','FULL','il medico valuta sintomi, storia clinica ed esame obiettivo','Three diagnostic inputs preserved.'],
  ['F14','FULL','Un singolo valore misurato non basta sempre per la diagnosi','Not always, not an absolute no, preserved.'],
  ['F15','FULL','va interpretato nel contesto clinico','Obligation to interpret clinically preserved.']
 ],
 'concetto_sbilanciato|20':[
  ['F1','FULL','lettere, cronache, carte geografiche e registri','Four source types retained.'],
  ['F2','FULL','per ricostruire gli avvenimenti','Historical aim retained.'],
  ['F3','FULL','La provenienza aiuta a capire autore, tempo e scopo','Origin, author, chronology and purpose retained.'],
  ['F4','FULL','Testimonianze sullo stesso episodio possono differire','Same event and modality preserved.'],
  ['F5','FULL','per aspetti osservati o interessi degli autori','Observation versus authors interests preserved in concise form.'],
  ['F6','FULL','confrontare fonti indipendenti','Plural sources and independence retained.'],
  ['F7','FULL','distinguere fatti da opinioni','Fact versus opinion retained.'],
  ['F8','FULL',"segnalare l'incertezza",'Uncertain claims flagged.'],
  ['F9','FULL','Una data isolata non spiega le cause','Date by itself insufficient.'],
  ['F10','FULL','serve studiare contesto e conseguenze','Context and consequences preserved.'],
  ['F11','FULL','Una fonte primaria è prodotta nel periodo studiato','Primary source definition preserved.'],
  ['F12','FULL','Una fonte secondaria interpreta documenti precedenti','Secondary source definition preserved.'],
  ['F13','FULL','Le ipotesi vanno distinte dai fatti documentati','Documented not demonstrated preserved.']
 ],
 'scienze|65':[
  ['F1','PARTIAL','La Terra ruota','Missing explicit rotation about its axis.'],
  ['F2','PARTIAL','giorno e notte','Cause between rotation and day/night is elliptical.'],
  ['F3','OPTIONAL_OMITTED','', 'Lit hemisphere and shaded hemisphere support detail omitted.'],
  ['F4','PARTIAL','Orbita attorno al Sole in un anno','Source qualifies duration circa un anno.'],
  ['F5','PARTIAL','Stagioni: asse inclinato','Relationship is telegraphic, axis not explicitly terrestre.'],
  ['F6','PARTIAL','non distanza','Sun-Earth distance referent omitted.'],
  ['F7','FULL','Maree: Luna e Sole influiscono','Influence not full causation, both bodies retained.'],
  ['F8','PARTIAL','Eclissi: allineamento','Source says alignment is required; still elliptical.'],
  ['F9','FULL','non ogni lunazione','Explicit not every lunation retained.'],
  ['F10','FULL','Metodo: ipotesi verificabili, osservazioni ripetibili','Verifiable hypotheses and repeatable observations retained.'],
  ['F11','PARTIAL','un esito isolato non basta','Missing object: not enough to demonstrate a scientific explanation.'],
  ['F12','PARTIAL','Distinguere moti e cause','Missing contrast between description and causes of observed changes.']
 ],
 'scienze|30':[
  ['F1','FULL','La Terra ruota attorno al proprio asse','Axis rotation retained.'],
  ['F2','FULL','La rotazione causa il giorno e la notte','Causation retained.'],
  ['F3','FULL',"una parte riceve luce e l'altra resta al buio",'Day/night illumination relation kept.'],
  ['F4','FULL','La rivoluzione attorno al Sole dura circa un anno','About one year retained.'],
  ['F5','FULL',"Le stagioni dipendono dall'inclinazione dell'asse terrestre",'Season tilt dependence kept.'],
  ['F6','FULL','e non dalla distanza','Negative distance qualification linked to preceding solar orbit.'],
  ['F7','FULL','La Luna influisce sulle maree insieme al Sole','Influence relationship preserved.'],
  ['F8','FULL','Le eclissi richiedono un allineamento particolare','Alignment necessary, not sufficient, retained.'],
  ['F9','FULL','non avvengono a ogni lunazione','Not every lunation retained.'],
  ['F10','FULL','Metodo: ipotesi verificabili, osservazioni ripetibili','Verifiable and repeatable both retained.'],
  ['F11','FULL','un solo risultato non dimostra una spiegazione','A single result does not establish the explanation.'],
  ['F12','PARTIAL','Distinguere moto e cause delle variazioni','Source specifically contrasts description of movement and causes of observed variations.']
 ]
};
const norm=s=>normalize(s).toLocaleLowerCase('it-IT');
const report={study:'MotorLab LAB104 exact source-backed fact-by-fact review',
 stage:'isolated editorial inspection; NOT independent academic certification',date:new Date().toISOString(),
 candidates:[],patches:[],semanticCertified:0,certifiedForApp:0,geminiCalls:0,addedCostEuro:0,
 source:'LAB101 citation-anchored ledger + LAB103 best-quality candidates',
 rationale:'Evaluate best existing outputs, never regenerate six versions or accept a numerically perfect but semantically weak output.'};
for(const [source,level] of [['medicina',10],['concetto_sbilanciato',20],['scienze',65],['scienze',30]]){
 const id=source+'|'+level,base=oldTextFor(source,level),fixture=sourceMap.get(source),p=inventories.get(source);
 assert(p?.anchorValidated,'NO_VERIFIED_LEDGER_'+source);
 assert.equal(sha256(normalize(fixture.concepts.join(' '))),p.ledger.sourceHash,'SOURCE_DRIFT_'+source);
 const requiredFrom=source==='scienze'?'LAB102_TARGETED_REVIEW_COPY':'LAB102_GEMINI';
 const historicHash=previous.candidateIndex.find(x=>x.source===source&&x.level===level&&x.from===requiredFrom)?.textHash;
 if(source!=='concetto_sbilanciato')assert.equal(sha256(base),historicHash,'LAB103_WINNER_DRIFT_'+id);
 let after=base;
 const edits=changes[id];
 for(const e of edits){
  assert.equal(after.split(e.old).length,2,'TARGET_IS_NOT_UNIQUE_'+id);
  after=after.replace(e.old,e.replacement);
 }
 const plan=budget(fixture,level);
 function measure(t){
  const n=letters(t),geometry=wrap(t),rel=relationshipGuard(source,normalize(fixture.concepts.join(' ')),t);
  const direction=oxygenDirectionRisk(source,normalize(fixture.concepts.join(' ')),t);
  return{letters:n,reductionPercent:+(100*(1-n/plan.originalLetters)).toFixed(2),
   originalLetters:plan.originalLetters,band:plan.band,rows:geometry.lines.length,maxRows:plan.targetCap,
   percentPass:plan.short||(n>=plan.band.low&&n<=plan.band.high),
   gridPass:geometry.lines.length<=plan.targetCap&&!geometry.overlong,
   relationAlerts:rel.alerts.map(x=>x.id),directionRisk:direction.risk??null,sourceHash:p.ledger.sourceHash,
   textHash:sha256(t),noSplitWords:!geometry.overlong};
 }
 const before=measure(base),current=measure(after);
 assert(before.percentPass&&before.gridPass,'SOURCE_BASELINE_NOT_NUMERICALLY_VALID_'+id);
 assert(current.percentPass&&current.gridPass,'TARGETED_EDIT_NUMERIC_REGRESSION_'+id);
 assert(current.relationAlerts.every(x=>before.relationAlerts.includes(x)),'NEW_RELATIONAL_WARNING_'+id);
 assert(current.directionRisk===null,'DIRECTION_REGRESSION_'+id);
 if(source==='scienze'&&level===65)assert.equal(current.letters,before.letters,'SUMMARY_PERCENTAGE_MUST_NOT_REGRESS');
 if(source==='scienze'&&level===30)assert.equal(current.letters,before.letters,'SCIENCE30_PERCENTAGE_MUST_NOT_REGRESS');
 if(source==='concetto_sbilanciato')assert(Math.abs(current.reductionPercent-level)<Math.abs(before.reductionPercent-level),
  'HISTORY_MUST_IMPROVE_NUMERIC_CLOSENESS');
 const reviews=map[id];assert.equal(reviews.length,p.ledger.facts.length,'FACT_COVERAGE_NOT_COMPLETE_'+id);
 const keys=new Set(reviews.map(x=>x[0]));
 assert.equal(keys.size,reviews.length,'DUPLICATE_FACTS_'+id);
 const details=p.ledger.facts.map(f=>{
  const row=reviews.find(x=>x[0]===f.id);
  assert(row,'MISSING_LAB101_FACT_'+id+'_'+f.id);
  const [fid,status,evidence,note]=row;
  assert(['FULL','PARTIAL','OPTIONAL_OMITTED'].includes(status),'BAD_REVIEW_STATUS_'+fid);
  if(status==='OPTIONAL_OMITTED')assert(f.priority!=='fondamentale','CORE_FACT_MARKED_OPTIONAL_'+id+'_'+fid);
  else assert(norm(after).includes(norm(evidence)),'MISSING_SOURCE_BACKED_PHRASE_'+id+'_'+fid+'_'+evidence);
  return{factId:fid,sourceClaim:f.claim,sourceQuote:f.evidence,priority:f.priority,
   status,evidenceExcerpt:evidence||null,note,sourceHash:p.ledger.sourceHash};
 });
 const counts=Object.fromEntries(['FULL','PARTIAL','OPTIONAL_OMITTED'].map(status=>
  [status,details.filter(x=>x.status===status).length]));
 const critical=details.filter(x=>x.priority==='fondamentale'&&x.status!=='FULL');
 if(edits.length)report.patches.push({source,level,edits,before,after:current,sourceIntact:true,
   untouchedOtherPhrases:true,verdict:'TARGETED_MATH_GRID_PASS_SEMANTIC_REVIEW_OPEN'});
 report.candidates.push({source,level,provenance:source==='scienze'?'LAB102_TARGETED_REVIEW_COPY':
  source==='concetto_sbilanciato'?'LAB103_TARGETED_HISTORY_COPY':'LAB102_BEST_REAL_GEMINI',
  baseline:before,latest:current,edits:edits.length,
  sourceFacts:details.length,reviewCounts:counts,fundamentalStillPartial:critical.map(x=>x.factId),
  ledgerEvidence:details,sourceText:fixture.concepts.join(' '),
  finalText:after,semanticCertified:false,approvedForApp:false,
  independentExpertReviewStillNeeded:true});
}
const medicine=report.candidates.find(c=>c.source==='medicina');
const hist=report.candidates.find(c=>c.source==='concetto_sbilanciato');
const sci65=report.candidates.find(c=>c.source==='scienze'&&c.level===65);
const sci30=report.candidates.find(c=>c.source==='scienze'&&c.level===30);
assert.equal(report.candidates.reduce((s,c)=>s+c.sourceFacts,0),52,'52_FACT_AUDIT_INCOMPLETE');
assert.equal(hist.fundamentalStillPartial.length,0,'HISTORY_UNEXPECTED_CORE_GAP');
assert.equal(medicine.fundamentalStillPartial.length,1,'MEDICINE_QUALIFIER_GAP_NOT_EXPLICIT');
assert.equal(sci65.fundamentalStillPartial.length,8,'SUMMARY_REMAINING_GAPS_NEED_REVIEW');
assert.equal(sci30.fundamentalStillPartial.length,1,'SCIENTIFIC_CAUSE_DESCRIPTION_GAP');
report.summary={
 factRecordsReviewed:52,
 full:report.candidates.reduce((a,c)=>a+c.reviewCounts.FULL,0),
 partial:report.candidates.reduce((a,c)=>a+c.reviewCounts.PARTIAL,0),
 optionalOmitted:report.candidates.reduce((a,c)=>a+c.reviewCounts.OPTIONAL_OMITTED,0),
 allNumericGridConforming:report.candidates.every(c=>c.latest.percentPass&&c.latest.gridPass),
 targetsPatched:report.patches.length,
 sourceAnchorsChecked:52,
 remainingFundamentalReview:report.candidates.reduce((a,c)=>a+c.fundamentalStillPartial.length,0),
 semanticCertifications:0,
 corpusType:'controlled pre-segmented synthetic pages',
 actualA4PdfTest:false,
 versionPromotion:false
};
mkdirSync('audit/reports',{recursive:true});
writeFileSync('audit/reports/lab104-fact-by-fact-editorial-review.json',JSON.stringify(report,null,2)+'\n');
console.log('LAB104_FACT_AUDIT',JSON.stringify({summary:report.summary,results:report.candidates.map(c=>({
 source:c.source,level:c.level,count:c.reviewCounts,pct:c.latest.reductionPercent,rows:c.latest.rows,max:c.latest.maxRows,
 criticalStillPartial:c.fundamentalStillPartial
})),patches:report.patches.map(p=>({source:p.source,level:p.level,before:p.before.reductionPercent,after:p.after.reductionPercent}))}));
