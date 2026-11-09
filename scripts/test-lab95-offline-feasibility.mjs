// LAB95 deterministic feasibility validation. No model calls or quota consumed.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {sourceById,checkFactCoverage,FIXTURES} from './lab93-semantic-gate.mjs';
import {budget,evaluate,letters,wrap} from './lab92-stop-complete-engine.mjs';
const source=JSON.parse(readFileSync('audit/test-fixtures/lab94-golden-20-percent-manual.json','utf8'));
const validated=[],errors=[];
for(const sample of source.samples){
 const src=sourceById(sample.id),plan=budget(src,sample.level);
 const evaluated=evaluate(src,plan,sample.sections);
 const coverage=checkFactCoverage(src,sample.level,sample.sections);
 validated.push({source:sample.id,authoredBy:'manual editorial reference',level:sample.level,
  targetLetters:plan.targetLetters,actual: evaluated.letters,actualReduction: evaluated.reduction,
  rows:evaluated.rows,cap:plan.targetCap,mathPass:evaluated.strictCombined,
  atomicAlerts:coverage.missingCount,englishSourceLeak:/\b(?:oxygen|tides|hypotheses|revolution|seasons)\b/iu.test(evaluated.rawText),
  potentialSemanticPass:coverage.missingCount===0&&evaluated.wordIntegrity});
 if(!evaluated.strictCombined||coverage.missingCount||evaluated.rows>plan.targetCap||!evaluated.wordIntegrity)errors.push({source:sample.id,issue:'reference not conformant',check:evaluated});
}
let seed=20261109;const rnd=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
let mutations=0,detected=0;
for(let i=0;i<4000;i++){
 const s=FIXTURES[Math.floor(rnd()*FIXTURES.length)];
 const pieces=s.concepts.map((text,j)=>({id:'C'+(j+1),text}));const level=[10,20,30,40,50,65][i%6];
 const pick=Math.floor(rnd()*pieces.length);pieces[pick].text='Frase senza informazioni.';
 const check=checkFactCoverage(s,level,pieces);mutations++;
 if(check.missingCount>0)detected++;else errors.push({source:s.id,issue:'mutated empty fact passed'});
}
const older=[
 ['LAB92','audit/reports/lab92-stop-complete-real-gemini.json'],
 ['LAB94','audit/reports/lab94-real-italian-facts-gemini.json']
];
const baseline=[];
for(const [lab,path] of older){
 const r=JSON.parse(readFileSync(path,'utf8'));
 const rows=lab==='LAB92'?r.results:r.results;
 for(const x of rows.filter(x=>x.valid||x.outputValid)){
  if(x.level!==20||x.source==='pagina_breve_continua')continue;
  const src=sourceById(x.source),plan=budget(src,20),sections=x.rawSections;
  const ev=evaluate(src,plan,sections);
  baseline.push({lab,source:x.source,percentage:ev.reduction,rows:ev.rows,band:ev.strictBand,combined:ev.strictCombined});
 }
}
const report={study:'LAB95 feasibility before asking Gemini',type:'offline',
 note:'The two good 20 percent examples were manually written, not model generated. Atomic lexical checks can miss semantic errors.',
 golden:validated,baseline,mutations:{count:mutations,detected},errors,
 summary:{goldSamples:validated.length,goldConforming:validated.filter(x=>x.mathPass&&x.atomicAlerts===0).length,
  baselineCases:baseline.length,negativeTests:mutations,negativeDetected:detected,failures:errors.length}};
mkdirSync('audit/reports',{recursive:true});
writeFileSync('audit/reports/lab95-offline-feasibility.json',JSON.stringify(report,null,2)+'\n');
console.log('LAB95_OFFLINE',JSON.stringify(report.summary));
if(errors.length)process.exitCode=1;
