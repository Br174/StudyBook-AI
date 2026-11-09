// LAB93 offline tests: atomic ledger correct against source, detect losses on saved Gemini texts.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {FIXTURES,requiredFacts,checkFactCoverage} from './lab93-semantic-gate.mjs';
import {budget,evaluate,letters,wrap} from './lab92-stop-complete-engine.mjs';
const previous=[
 {id:'LAB89',path:'audit/reports/lab89-proportional-real-gemini.json'},
 {id:'LAB90',path:'audit/reports/lab90-fluid-useful-elaboration-real.json'},
 {id:'LAB92',path:'audit/reports/lab92-stop-complete-real-gemini.json'}
];
const fixtureChecks=[];const results=[];const errors=[];
for(const s of FIXTURES)for(const level of [10,20,30,40,50,65]){
 const sourceSections=s.concepts.map((text,i)=>({id:'C'+(i+1),text}));
 const cov=checkFactCoverage(s,level,sourceSections);
 const p=budget(s,level);
 if(!cov.valid||cov.missingCount)errors.push({case:s.id+':'+level,error:'source must pass own facts',missing:cov.missing});
 if(p.goalPerConcept.reduce((v,x)=>v+x.softTargetLetters,0)!==p.targetLetters)errors.push({case:s.id+':'+level,error:'letter sum'});
 fixtureChecks.push({source:s.id,level,sourceCoreTotal:requiredFacts(s,level).reduce((v,x)=>v+x.core.length,0),requiredTotal:cov.required,sourceCoverage:cov.matched,
  target:p.targetLetters,gridRows:p.targetCap,originalRows:p.originalRows,short:p.short});
}
for(const old of previous){
 const r=JSON.parse(readFileSync(old.path,'utf8'));
 const entries=old.id==='LAB89'?r.records.filter(x=>x.textReturned&&x.validation?.structurallyValid).map(x=>({source:x.source,level:x.level,sections:x.sections})):
 old.id==='LAB90'?r.records.filter(x=>x.validJson&&x.validation?.structural).map(x=>({source:x.source,level:x.level,sections:x.rawSections})):
 r.results.filter(x=>x.outputValid).map(x=>({source:x.source,level:x.level,sections:x.rawSections}));
 for(const item of entries){
  const source=FIXTURES.find(x=>x.id===item.source);
  const cov=checkFactCoverage(source,item.level,item.sections);
  const p=budget(source,item.level);
  const metrics=evaluate(source,p,item.sections);
  if(!metrics.valid||!cov.valid)errors.push({case:item,error:'invalid saved response'});
  results.push({lab:old.id,source:item.source,level:item.level,long:!p.short,
   pct:metrics.reduction,rows:metrics.rows,cap:metrics.targetCap,
   strict:metrics.strictCombined,required:cov.required,matching:cov.matched,missing:cov.missing.map(x=>x.fact),
   sourceCorePreservedHeuristically:cov.missing.filter(x=>x.type==='core').length===0,
   note:'This is a cheap lexical omission hint, not semantic validation.'});
 }
}
let seeded=73011;
const random=()=>((seeded=(Math.imul(seeded,1664525)+1013904223)>>>0)/4294967296);
let seededChecks=0;
for(let k=0;k<14000;k++){
 const s=FIXTURES[Math.floor(random()*FIXTURES.length)],level=[10,20,30,40,50,65][k%6];
 const original=s.concepts.map((text,i)=>({id:'C'+(i+1),text}));
 const cov=checkFactCoverage(s,level,original);
 if(!cov.valid||cov.missingCount)errors.push({case:k,source:s.id,error:'unstable original matching'});
 // Assert removing all text cannot fake coverage.
 if(k%50===0){
  const tampered=original.map((x,i)=>({id:x.id,text:i===0?'Testo senza contenuto':x.text}));
  const test=checkFactCoverage(s,level,tampered);
  if(!test.valid||test.missingCount===0)errors.push({case:k,error:'missing facts not detected'});
 }
 seededChecks++;
 if(errors.length>5)break;
}
const summary={
 sourceLevelCases:fixtureChecks.length,seededChecks,oldOutputReplays:results.length,
 baselineLAB89:results.filter(x=>x.lab==='LAB89').length,
 baselineLAB90:results.filter(x=>x.lab==='LAB90').length,
 baselineLAB92:results.filter(x=>x.lab==='LAB92').length,
 missingFactsFlagged:results.reduce((a,b)=>a+b.missing.length,0),
 oldAllCoreHeuristicPass:results.filter(x=>x.sourceCorePreservedHeuristically).length,
 oldMathAndHeuristicCorePass:results.filter(x=>x.strict&&x.sourceCorePreservedHeuristically).length,
 failures:errors.length
};
const report={experiment:'LAB93 first-reading atomic fact ledger and absence alerts',kind:'offline deterministic',
 date:new Date().toISOString(),summary,fixtureChecks,storedModelReplay:results,errors,
 caveat:'Checklist manually prepared from synthetic source, not automatic real-PDF fact extraction. Regex matches cannot detect semantic contradiction in all phrasing. Never publish solely by these results.'};
mkdirSync('audit/reports',{recursive:true});
writeFileSync('audit/reports/lab93-offline-fact-check.json',JSON.stringify(report,null,2)+'\n');
console.log('LAB93_OFFLINE',JSON.stringify(summary));
if(errors.length)process.exitCode=1;
