// LAB117 OFFLINE: explicit no-extra-provider tests for concept redundancy,
// exact counts and no fake "semantic approval". Runs on public synthetic text.
import assert from 'node:assert/strict';
import {prepareSourceTiersV116} from '../src/lib/studySourceTiersV116.js';
import {composeSourceMacroV117,macroUserV117,macroInstructionV117}
 from '../src/lib/studyConceptMacroV117.js';
import {studyLetters} from '../src/lib/studyPillarV38.js';
const sentence='Il programma registra i libri e mostra il titolo richiesto.';
const source=Array(10).fill(sentence).join(' ');
const units=[
 {id:'0:0',source,pageStart:1,pageEnd:1},
 {id:'0:1',source,pageStart:2,pageEnd:2},
 {id:'0:2',source,pageStart:3,pageEnd:3},
 {id:'0:3',source,pageStart:4,pageEnd:4}
];
const plan=prepareSourceTiersV116(units);
const makeReply=(plan)=>({units:plan.units.map(u=>({id:u.id,
 variants:u.segments.map(x=>({compact:x.original,brief:x.original,importance:5,essential:true})),
 macro50:Array(5).fill(sentence).join(' '),
 macroSummary:Array(4).fill(sentence).join(' ')
}))});
let assertions=0;const eq=(a,b,msg)=>{assert.deepEqual(a,b,msg);assertions++};
const ok=(a,msg)=>{assert.ok(a,msg);assertions++};
const prompt=macroInstructionV117(plan),user=macroUserV117(plan);
ok(prompt.includes('SAME')===false);
eq(user.units.length,4);
const result=composeSourceMacroV117(plan,makeReply(plan));
eq(result.policy,'lab117-concept-macro-fusion-one-call-v1');
eq(result.generatedModelRequests,0);
ok(result.quality['50'].numericAndRows,'50 from real redundancy must pass');
ok(result.quality.summary.numericAndRows,'summary from real redundancy must pass');
eq(result.quality['50'].compliantPages,4);
eq(result.quality.summary.compliantPages,4);
eq(result.quality['50'].achievedReduction,50);
eq(result.quality.summary.achievedReduction,60);
ok(result.quality['50'].groups.every(x=>x.choices[0]==='macro50'));
ok(result.quality.summary.groups.every(x=>x.choices[0]==='macroSummary'));
eq(result.approvedForApp,false);
eq(result.semanticCertified,false);
// One physical page can contain multiple source units. Its full page target
// must be measured on the entire original page, not on a synthetic split.
const shared=plan.units.map(u=>({...u,pageStart:1,pageEnd:1}));
const grouped=prepareSourceTiersV116(shared);
const groupedOut=composeSourceMacroV117(grouped,makeReply(grouped));
eq(groupedOut.quality['50'].pageCount,1);
eq(groupedOut.quality.summary.pageCount,1);
ok(groupedOut.quality['50'].numericAndRows,'aggregated original page should pass');
ok(groupedOut.quality.summary.numericAndRows,'aggregated summary should pass');
// Source facts must not be changed to make a count look correct.
const special='Nel 2024 la regola 12 richiede il titolo prima del prestito. Una proroga è ammessa solo se il libro non è prenotato.';
const specialPlan=prepareSourceTiersV116([{id:'1:0',source:special,pageStart:1,pageEnd:1}]);
const wrong={units:[{id:'1:0',variants:specialPlan.units[0].segments.map(s=>({
 compact:s.original,brief:s.original,importance:5,essential:true})),
 macro50:'Nel 2023 la regola 12 permette una proroga sempre.',
 macroSummary:'La proroga è sempre ammessa.'}]};
const fail=composeSourceMacroV117(specialPlan,wrong);
eq(fail.quality['50'].numericAndRows,false);
eq(fail.quality.summary.numericAndRows,false);
ok(fail.partsByLevel['50'][0].text.includes('2024'));
ok(!fail.partsByLevel['50'][0].text.includes('2023'));
ok(fail.partsByLevel.summary[0].text.includes('solo se'));
ok(fail.quality['50'].groups[0].feasibility!=='NUMERIC_AND_ROWS_PASS');
console.log(JSON.stringify({lab:'117',providerRequests:0,assertions,
 syntheticPages:4,groupedPageHandled:true,
 factualInventionRejected:true,level50:result.quality['50'].achievedReduction,
 summary:result.quality.summary.achievedReduction,
 sourceLettersPerUnit:studyLetters(source),
 semanticCertified:false,approvedForApp:false},null,2));
