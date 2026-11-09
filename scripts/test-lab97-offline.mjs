// StudyBook LAB97 offline baseline and stress before spending any Gemini quota.
// Source segmentation and fact checks are stable from LAB93–96; do not update app.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {FIXTURES,sourceById} from './lab93-semantic-gate.mjs';
import {budget,letters,wrap} from './lab92-stop-complete-engine.mjs';
import {evaluateLean} from './lab96-eval.mjs';
const gold=JSON.parse(readFileSync('audit/test-fixtures/lab94-golden-20-percent-manual.json','utf8')).samples;
const prev=JSON.parse(readFileSync('audit/reports/lab96-source-only-real-gemini.json','utf8'));
const metrics=[],issues=[];
for(const src of FIXTURES)for(const level of [10,20,30,40,50,65]){
 const b=budget(src,level),sourceText=src.concepts.join(' ');
 const orig=evaluateLean(src,level,sourceText);
 if(!orig.valid||orig.originalLetters!==b.originalLetters||orig.grid.rows!==b.originalRows)issues.push({source:src.id,level,problem:'source mismatch'});
 if(b.goalPerConcept.reduce((n,c)=>n+c.softTargetLetters,0)!==b.targetLetters)issues.push({source:src.id,level,problem:'allocation sum'});
 metrics.push({source:src.id,level,short:b.short,originalLetters:b.originalLetters,
  targetLetters:b.targetLetters,lines:b.targetCap});
}
const golden=gold.map(s=>{
 const x=sourceById(s.id),e=evaluateLean(x,s.level,s.sections.map(z=>z.text).join(' '));
 if(!e.completeMathPass||e.facts.missing.length)issues.push({source:s.id,level:s.level,problem:'manual reference invalid'});
 return{source:s.id,level:s.level,letters:e.actualLetters,percent:e.reduction,rows:e.grid.rows,
  math:e.completeMathPass,missingLexicalFacts:e.facts.missing.length,
  authorship:'manual, not Gemini'};
});
const baseline=prev.cases.filter(r=>r.valid).map(r=>{
 const src=sourceById(r.source),m=evaluateLean(src,r.level,r.metrics.text);
 if(Math.abs(m.reduction-r.metrics.reduction)>0.011)issues.push({source:r.source,level:r.level,problem:'baseline drift'});
 return{source:r.source,level:r.level,percent:m.reduction,rows:m.grid.rows,
   strict:m.completeMathPass,coreMissing:m.facts.missing.filter(f=>f.importance==='core').length};
});
let seed=202611097,stress=0,negativeDetection=0;
const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
for(let i=0;i<12000;i++){
 const s=FIXTURES[Math.floor(random()*FIXTURES.length)],level=[10,20,30,40,50,65][i%6];
 const b=budget(s,level),e=evaluateLean(s,level,s.concepts.join(' '));
 if(e.originalLetters!==b.originalLetters||e.grid.rows!==b.originalRows||!e.valid)issues.push({i,error:'original baseline drift'});
 const deleted=evaluateLean(s,level,'Testo volutamente non fedele.');
 if(deleted.facts.missing.length)negativeDetection++;
 else issues.push({i,error:'trivial omission not caught'});
 stress++;if(issues.length>3)break;
}
const output={study:'StudyBook LAB97 offline invariants / golden and historical baselines',date:new Date().toISOString(),
 status:'offline tests only, no provider calls',
 warnings:'Source fragments already extracted manually; automatic detection of facts and real PDF dimensions not tested. Golden examples manually authored.',
 summary:{plans:metrics.length,manualGolden:golden.length,manualGoldenConforming:golden.filter(x=>x.math&&!x.missingLexicalFacts).length,
  pastGeminiReplays:baseline.length,stressCases:stress,omissionProbesDetected:negativeDetection,errors:issues.length},
 metrics,golden,baseline,issues};
mkdirSync('audit/reports',{recursive:true});
writeFileSync('audit/reports/lab97-offline-preflight.json',JSON.stringify(output,null,2)+'\n');
console.log('LAB97_OFFLINE_FINAL',JSON.stringify(output.summary));
if(issues.length||golden.filter(x=>x.math&&!x.missingLexicalFacts).length!==2)process.exitCode=1;
