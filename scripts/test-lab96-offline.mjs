// LAB96 offline baseline and deterministic test suite, zero model calls.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {FIXTURES} from './lab93-semantic-gate.mjs';
import {budget,letters,wrap,largest} from './lab92-stop-complete-engine.mjs';
import {evaluateLean} from './lab96-eval.mjs';
const gold=JSON.parse(readFileSync('audit/test-fixtures/lab94-golden-20-percent-manual.json','utf8')).samples;
const past92=JSON.parse(readFileSync('audit/reports/lab92-stop-complete-real-gemini.json','utf8'));
const past95=JSON.parse(readFileSync('audit/reports/lab95-compact-facts-real.json','utf8'));
const trials=[],issues=[];
for(const sample of gold){
 const source=FIXTURES.find(s=>s.id===sample.id);
 const text=sample.sections.map(x=>x.text).join(' ');
 const v=evaluateLean(source,sample.level,text);
 trials.push({kind:'MANUAL_GOLD_NOT_GEMINI',source:sample.id,level:sample.level,metric:v});
 if(!v.completeMathPass||v.facts.missing.length>0)issues.push('gold failure '+sample.id);
}
for(const r of past92.results.filter(x=>x.outputValid)){
 const source=FIXTURES.find(s=>s.id===r.source);
 const v=evaluateLean(source,r.level,r.rawSections.map(s=>s.text).join(' '));
 trials.push({kind:'LAB92_GEMINI_REPLAY',source:r.source,level:r.level,metric:v});
 if(Math.abs(v.reduction-r.check.reduction)>0.02)issues.push('LAB92 replay mismatch '+r.source+':'+r.level);
}
for(const r of past95.records.filter(x=>x.valid)){
 const source=FIXTURES.find(s=>s.id===r.source);
 const v=evaluateLean(source,r.level,r.sections.map(s=>s.text).join(' '));
 trials.push({kind:'LAB95_GEMINI_REPLAY',source:r.source,level:r.level,variant:r.variant,metric:v});
 if(Math.abs(v.reduction-r.metrics.reduction)>0.02)issues.push('LAB95 replay mismatch '+r.source+':'+r.level+':'+r.variant);
}
let seed=202611096;
const rnd=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
let count=0,negative=0,negativeDetected=0;
for(let i=0;i<6000;i++){
 const source=FIXTURES[Math.floor(rnd()*FIXTURES.length)],level=[10,20,30,40,50,65][i%6];
 const p=budget(source,level);
 const value=evaluateLean(source,level,source.concepts.join(' '));
 if(!value.valid||value.originalLetters!==p.originalLetters||value.grid.rows!==p.originalRows)issues.push('source invariants '+i);
 const blank=evaluateLean(source,level,'Testo incompleto.');
 if(!blank.valid||blank.facts.missing.length===0)issues.push('blank detection '+i);
 negative++;negativeDetected+=blank.facts.missing.length>0?1:0;
 count++;
 if(issues.length>6)break;
}
const summary={gold2:trials.filter(x=>x.kind==='MANUAL_GOLD_NOT_GEMINI').length,
 goldPass:trials.filter(x=>x.kind==='MANUAL_GOLD_NOT_GEMINI'&&x.metric.completeMathPass&&x.metric.facts.missing.length===0).length,
 replay92:trials.filter(x=>x.kind==='LAB92_GEMINI_REPLAY').length,replay95:trials.filter(x=>x.kind==='LAB95_GEMINI_REPLAY').length,
 randomChecks:count,negativeDetected,errors:issues.length};
const report={study:'LAB96 source-only prompt offline control',date:new Date().toISOString(),modelCalls:0,summary,
 warning:'The two golden cases were manually prepared, not Gemini outputs. Regex fact coverage is not proof of semantic equivalence. Does not test physical PDF/A4.',
 cases:trials,issues};
mkdirSync('audit/reports',{recursive:true});writeFileSync('audit/reports/lab96-offline.json',JSON.stringify(report,null,2)+'\n');
console.log('LAB96_OFFLINE',JSON.stringify(summary));
if(issues.length||summary.goldPass!==2||negativeDetected!==count)process.exitCode=1;
