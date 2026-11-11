// LAB119 offline: one canonical core + five additions, 6 targets, provenance.
// NO real Gemini, no user PDF and absolutely no production changes.
import assert from 'node:assert/strict';
import {prepareSemanticLadderV119,composeSemanticLadderV119,
 semanticLadderInstructionV119,semanticLadderUserV119}
 from '../src/lib/studySemanticLadderV119.js';
import {STUDY_LEVELS_V67} from '../src/lib/studyRebalancePolicyV67.js';
const sentences=Array.from({length:10},(_,i)=>
 'Il registro conserva il fatto numero '+String(i+1).padStart(2,'0')+'.');
const original=sentences.join(' ');
let checks=0;
const eq=(a,b,n)=>{assert.deepEqual(a,b,n);checks++};
const ok=(a,n)=>{assert.ok(a,n);checks++};
const source=(n=44)=>Array.from({length:n},(_,i)=>({
 id:'unit'+i,pageStart:i+1,pageEnd:i+1,source:original
}));
function response(plan){
 return{units:plan.units.map(u=>({id:u.id,
  core:sentences.slice(0,4).join(' '),
  extra50:sentences[4],extra40:sentences[5],
  extra30:sentences[6],extra20:sentences[7],extra10:sentences[8]
  + ' '+sentences[9]}))};
}
// 10% version must retain NINE of ten complete sentences, not all ten.
// For offline length targets, select five first original sentences for
// core and four extras with a total of nine after all five expansions.
function equalLengthResponse(plan){
 return{units:plan.units.map(u=>({
  id:u.id,core:sentences.slice(0,4).join(' '),
  extra50:sentences[4],
  extra40:sentences[5],
  extra30:sentences[6],
  extra20:sentences[7],
  extra10:sentences[8]
 }))};
}
const plan=prepareSemanticLadderV119(source());
eq(plan.units.length,44);
eq(semanticLadderUserV119(plan).units.length,44);
ok(semanticLadderInstructionV119().includes('una sola')||
   semanticLadderInstructionV119().includes('UNA SOLA'));
const composed=composeSemanticLadderV119(plan,equalLengthResponse(plan));
eq(Object.keys(composed.partsByLevel).sort(),[...STUDY_LEVELS_V67].sort());
let metrics=[];
for(const level of STUDY_LEVELS_V67){
 const q=composed.quality[level];
 ok(q.numericAndRowsPass,'44 page numeric/row gate '+level);
 eq(q.compliantPages,44);
 ok(q.achievedReduction>=Number(level==='summary'?55:level)-5||
  q.numericAndRowsPass);
 metrics.push({level,actual:q.achievedReduction,pass:q.numericAndRowsPass});
}
eq(composed.allSixNumeric,true);
eq(composed.semanticCertified,false);
eq(composed.approvedForApp,false);
// Four source claims were kept and five more added: one original claim is
// deliberately missing at 10%, so this is NOT a semantically certified test.
ok(!composed.allSixPreliminarySafe,'Numeric pass cannot imply semantic pass');
let nonmonotonic=equalLengthResponse(plan);
nonmonotonic.units[0].extra50='';
assert.throws(()=>composeSemanticLadderV119(plan,nonmonotonic),/INCOMPLETE_FIELD/);checks++;
const sourceUnit=[{id:'multi-a',source:original,
 pageStart:1,pageEnd:1},{id:'multi-b',source:original,
 pageStart:1,pageEnd:1}];
const combinedPlan=prepareSemanticLadderV119(sourceUnit);
const combined=composeSemanticLadderV119(combinedPlan,equalLengthResponse(combinedPlan));
eq(combined.quality.summary.pageCount,1);
ok(combined.quality['50'].numericAndRowsPass);
// Explicitly record that a text changing a date is risky despite correct size.
const harmful=equalLengthResponse(plan);
harmful.units[0].core=harmful.units[0].core.replace('01','21');
const audited=composeSemanticLadderV119(plan,harmful);
ok(audited.quality.summary.meaningDiagnostics[0].newProtectedClaims.includes('21')||
   audited.quality.summary.meaningDiagnostics[0].preliminarySafetyPass===false,
   'Unfounded source number cannot pass concept guard');
console.log(JSON.stringify({lab:'LAB119',checks,syntheticOriginalPages:44,
 sixEditionPageChecks:264,numericOutcomes:metrics,
 noGeminiCalls:true,semanticCertified:false,
 safeForRelease:false},null,2));
