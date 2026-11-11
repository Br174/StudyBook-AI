// LAB118C exact source patch research only: no Gemini, no APK.
import assert from 'node:assert/strict';
import {prepareSourceTiersV116} from '../src/lib/studySourceTiersV116.js';
import {validateSourcePatchesV118,composeSourcePatchesV118,sourcePatchPromptV118}
 from '../src/lib/studySourcePatchV118.js';
import {studyLetters} from '../src/lib/studyPillarV38.js';
const sentence='Il registro mostra il titolo richiesto, e il registro mostra il titolo richiesto.';
const replacement='Il registro mostra il titolo richiesto.';
const perPage=20,pages=4;
const units=Array.from({length:pages},(_,i)=>({
 id:'p:'+i,source:Array(perPage).fill(sentence).join(' '),
 pageStart:i+1,pageEnd:i+1
}));
const plan=prepareSourceTiersV116(units);
const reply={units:plan.units.map(u=>({
 id:u.id,patches:Array.from({length:perPage},(_,i)=>({
  from:sentence,to:replacement,occurrence:i,importance:3})),
 macro50:'',macroSummary:''
}))};
let checks=0;const eq=(x,y,m)=>{assert.deepEqual(x,y,m);checks++};
const ok=(x,m)=>{assert.ok(x,m);checks++};
const inspected=validateSourcePatchesV118(plan,reply);
eq(inspected.accepted,pages*perPage);
eq(inspected.rejected,0);
const out=composeSourcePatchesV118(plan,reply);
eq(out.providerRequestsMade,0);
ok(out.quality['10'].quantitativePass,'10% should be feasible from exact repeated phrases');
ok(out.quality['20'].quantitativePass,'20% should be feasible from exact repeated phrases');
ok(out.quality['30'].quantitativePass,'30% should be feasible from exact repeated phrases');
ok(out.quality['40'].quantitativePass,'40% should be feasible from exact repeated phrases');
ok(out.quality['50'].quantitativePass,'50% feasible on truly redundant source should pass');
eq(out.quality.summary.quantitativePass,false);
ok(out.quality.summary.groups.every(x=>x.feasibility==='INSUFFICIENT_SAFE_PATCHES'));
eq(out.approvedForApp,false);
eq(out.semanticCertified,false);
ok(out.partsByLevel['10'].every(x=>x.text.includes('Il registro mostra il titolo richiesto.')));
ok(out.partsByLevel['40'].every(x=>studyLetters(x.text)<studyLetters(units[0].source)));
ok(sourcePatchPromptV118().includes('occurrence'));
const risky='Nel 2024, la proroga è ammessa solo se il libro non è prenotato.';
const dangerPlan=prepareSourceTiersV116([{
 id:'risky',source:risky,pageStart:1,pageEnd:1}]);
const dangerous={units:[{id:'risky',patches:[{
 from:risky,to:'La proroga è ammessa sempre.',occurrence:0,importance:1
}],macro50:'',macroSummary:''}]};
const rejected=validateSourcePatchesV118(dangerPlan,dangerous);
eq(rejected.accepted,0);
eq(rejected.rejected,1);
ok(rejected.units[0].rejected[0].reason!=='PRELIMINARY_LOCAL_HEURISTIC');
const noChanges=composeSourcePatchesV118(dangerPlan,dangerous);
eq(noChanges.partsByLevel['10'][0].text,risky);
eq(noChanges.quality['10'].quantitativePass,false);
const overlapping={units:plan.units.map(u=>({
 id:u.id,patches:[{
 from:sentence,to:replacement,occurrence:0,importance:1
 },{
 from:sentence,to:replacement,occurrence:0,importance:1
 },{
 from:sentence,to:replacement,occurrence:999,importance:1
 }],macro50:'',macroSummary:''
}))};
const checked=validateSourcePatchesV118(plan,overlapping);
eq(checked.accepted,4);
eq(checked.rejected,8);
// LAB118D: combine 10 guarded exact duplicate deletions and 10 conservative
// changes. One untouched sentence must survive every selected deletion.
const mix={units:plan.units.map(u=>({
 id:u.id,
 patches:Array.from({length:perPage},(_,i)=>({
  from:sentence,to:i<10?'':replacement,
  occurrence:i,importance:3})),
 macro50:'',macroSummary:''
}))};
const mixedInput=validateSourcePatchesV118(plan,mix);
eq(mixedInput.accepted,pages*perPage);
eq(mixedInput.rejected,0);
const mixed=composeSourcePatchesV118(plan,mix);
for(const level of ['10','20','30','40','50','summary']){
 ok(mixed.quality[level].quantitativePass,'All six percentages when literal redundancies are truly present: '+level);
 ok(mixed.partsByLevel[level].every(p=>p.text.includes(sentence)),
  'One unchanged literal source carrier must remain at every level');
}
eq(mixed.quality.summary.achievedReduction>=55,true);
eq(mixed.quality.summary.achievedReduction<=65,true);
eq(mixed.providerRequestsMade,0);
const mustKeep=prepareSourceTiersV116([{
 id:'unique',source:'Il termine unico 2024 non deve essere cancellato.',
 pageStart:1,pageEnd:1}]);
const attempt={units:[{id:'unique',patches:[{
 from:'Il termine unico 2024 non deve essere cancellato.',to:'',
 occurrence:0,importance:0
}],macro50:'',macroSummary:''}]};
eq(validateSourcePatchesV118(mustKeep,attempt).accepted,0);
console.log(JSON.stringify({lab:'LAB118-SOURCE-PATCHES',checks,
 pages,originalLettersPerPage:studyLetters(units[0].source),
 acceptedPatches:inspected.accepted,rejectedPatches:0,
 levels:Object.entries(out.quality).map(([level,q])=>({
 level,reduction:q.achievedReduction,pass:q.quantitativePass,
 pages:q.passingGroups,total:q.totalGroups
 })),
 invalid2024QualifierRejected:true,ambiguousSourceOccurrenceRejected:true,
 incompletePatchListSafe:true,sourcePreserved:true,
 providerCalls:0,approvedForApp:false,semanticCertified:false},null,2));
