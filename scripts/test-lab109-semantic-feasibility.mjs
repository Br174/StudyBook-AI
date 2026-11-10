// LAB109: evidence of mathematical feasibility, NOT evidence of model reliability.
// The 40% reference was manually authored from immutable synthetic original.
// Run an adversarial fact check and keep it separate from Gemini reports.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {studyGeometryReviewV78,studyGeometryPlanV78} from '../src/lib/studyGeometryV78.js';
import {studyLetters} from '../src/lib/studyPillarV38.js';
import {auditFidelity} from '../src/lib/fidelityEngine.js';

const f=JSON.parse(readFileSync('audit/test-fixtures/lab109-worker-source.json','utf8'));
const source=f.sources.find(s=>s.id==='scienze').text;
const manual=f.manuallyAuthoredScience40Feasibility.text;
const units=[{id:'1:1',source,pageStart:1,pageEnd:1}];
const review=studyGeometryReviewV78(units,[{id:'1:1',text:manual}],'40');
const row=review.groups[0];
assert.equal(studyLetters(source),599);
assert.equal(studyLetters(manual),381);
assert.equal(row.rows,8);
assert.equal(row.maxRows,8);
assert.equal(row.inBand,true);
assert.equal(row.fitsRows,true);
const checks=(t)=>{
 const s=t.toLocaleLowerCase('it');
 return {
  rotation_axis_day_night:/terr/.test(s)&&/asse/.test(s)&&/giorno/.test(s)&&/notte/.test(s),
  sunlight_shadow:/luce/.test(s)&&/buio/.test(s),
  revolution_approx_year:/rivoluzione/.test(s)&&/sole/.test(s)&&/circa un anno/.test(s),
  season_inclination_not_distance:/stagion/.test(s)&&/inclinat/.test(s)&&/non.{0,50}distanz/.test(s),
  tides_influence_moon_sun:/luna/.test(s)&&/sole/.test(s)&&/maree/.test(s)&&/risent|influis|influen/.test(s)&&!/maree.{0,20}caus/.test(s),
  eclipses_alignment_not_each:/eclissi/.test(s)&&/allineament/.test(s)&&/non.{0,35}lunazione/.test(s),
  testable_hypotheses_repeatable_observations:/ipotesi verificabili/.test(s)&&/osservazioni ripetibili/.test(s),
  single_result_not_proof:/dato isolato|risultato isolato/.test(s)&&/non.{0,30}prov/.test(s),
  description_vs_causes_of_variations:/descriv|descriz/.test(s)&&/caus/.test(s)&&/variazion/.test(s)
 };
};
const originalCheck=checks(manual);
assert.ok(Object.values(originalCheck).every(Boolean),JSON.stringify(originalCheck));
for(const mutation of [
 {id:'remove_eclipse_negation',text:manual.replace('non avvengono a ogni lunazione','avvengono a ogni lunazione'),mustFail:'eclipses_alignment_not_each'},
 {id:'invert_tides_influence',text:manual.replace('Le maree risentono di Luna e Sole','Luna e Sole causano le maree'),mustFail:'tides_influence_moon_sun'},
 {id:'lose_description_vs_cause',text:manual.replace('Descrivere il moto non spiega le cause delle variazioni.',''),mustFail:'description_vs_causes_of_variations'}
])assert.equal(checks(mutation.text)[mutation.mustFail],false,mutation.id);
const fidelity=auditFidelity(source,manual);
const report={lab:'LAB109',scope:'offline manual feasibility reference ONLY',
 originalLetters:studyLetters(source),manualReferenceLetters:studyLetters(manual),
 reductionPercent:+((1-studyLetters(manual)/studyLetters(source))*100).toFixed(2),
 rows:row.rows,maxRows:row.maxRows,numericGridPass:true,
 factHeuristicsPassed:Object.values(originalCheck).filter(Boolean).length,
 factHeuristicsTotal:Object.keys(originalCheck).length,
 adversarialMutationsCaught:3,
 heuristicNotSemanticCertification:true,
 protectedSourceAudit:{missingCount:fidelity.missingProtected?.length||0,
 qualifierMismatchCount:fidelity.qualifierMismatches?.length||0},
 manualSourceText:manual,
 geminiGeneratedThisText:false,modelReliabilityProven:false,
 physicallyPrintedA4Checked:false,approvedForApp:false,productionModified:false};
mkdirSync('audit/reports',{recursive:true});
writeFileSync('audit/reports/lab109-manual-semantic-feasibility.json',JSON.stringify(report,null,2)+'\n');
console.log('LAB109_MANUAL_FEASIBILITY',JSON.stringify({...report,manualSourceText:'[synthetic fixture preserved in report]'}));
