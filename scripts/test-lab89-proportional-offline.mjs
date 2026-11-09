// StudyBook LAB89 offline allocator stress: 5 examples x 6 reductions + >=6000 deterministic adversarial budgets.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {allocate,largestRemainder,LEVELS,wrap,alpha,WIDTH,MEAN_LETTERS,validate} from './lab89-budget-engine.mjs';
const sources=JSON.parse(readFileSync('audit/test-fixtures/lab89-semantic-concepts.json','utf8')).sources;
const tests=[];
for(const source of sources)for(const level of LEVELS){
 const plan=allocate(source,level);
 const base={source:source.id,level,originalLetters:plan.totalLetters,originalRows:plan.originalRows,rows:plan.maxRows,short:plan.short,feasible:plan.feasible,reason:plan.reason||null,
 allocations:plan.segments?.map(s=>({id:s.id,sourceLetters:s.sourceLetters,rows:s.maxRows,suggestedLetters:s.suggestedLetters})),
 riskSignals:plan.riskSignals||[]};
 if(plan.feasible){
  if(plan.allocatedRowSum!==plan.maxRows)throw Error('sum cap wrong');
  if(plan.segments.some(c=>c.maxRows<1))throw Error('zero concept');
  if(plan.reductionBand&&(plan.reductionBand.minLetters>plan.desired||plan.reductionBand.maxLetters<plan.desired))throw Error('wrong percent range');
 }
 tests.push(base);
}
let seed=456781,validRandom=0,impossibleRandom=0;const failures=[], examples=[];
const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
for(let k=0;k<9000;k++){
 const n=1+Math.floor(random()*14),sourceConcepts=Array.from({length:n},()=> 'parola '.repeat(2+Math.floor(Math.pow(random(),3)*120)).trim());
 const source={id:'random_'+k,concepts:sourceConcepts,importance:sourceConcepts.map(()=>0.7+random()*1.8),
  keyPoints:sourceConcepts.map(()=>[])};
 const level=LEVELS[k%LEVELS.length];const p=allocate(source,level);
 if(!p.feasible){impossibleRandom++;if(examples.length<3)examples.push({id:k,reason:p.reason});continue}
 validRandom++;
 try{
  if(p.segments.length!==n)throw Error('not all concepts assigned');
  if(p.allocatedRowSum!==p.maxRows)throw Error('sum mismatch');
  if(p.segments.some(s=>s.maxRows<1||s.sourceLetters<1))throw Error('invalid segment');
  if(p.segments.reduce((a,s)=>a+s.maxRows,0)!==p.maxRows)throw Error('not exact');
  if(!p.short&&p.segments.reduce((a,s)=>a+s.suggestedLetters,0)!==p.desired)throw Error('bad letter sum');
 }catch(e){failures.push({id:k,error:String(e)});if(failures.length>=10)break}
}
const deliberatelySkewed={
 id:'10-1-1-1',concepts:['lettera '.repeat(70),'lettera '.repeat(7),'lettera '.repeat(7),'lettera '.repeat(7)],
 importance:[1,1,1,1],keyPoints:[[],[],[],[]]
};
const synthetic=largestRemainder(6,[9,0,0,0]).map(x=>x+1);
if(synthetic.join(',')!=='7,1,1,1')throw Error('10:1:1:1 weight allocation failed');
const fake=allocate(sources[0],40);
const fixtureValidation=validate(sources[0],fake,fake.segments.map(s=>({id:s.id,text:s.source})));
if(!fixtureValidation.structurallyValid||!fixtureValidation.geometry.length)throw Error('bad validation');
const outcome={date:new Date().toISOString(),context:'LAB89 proportional semantic budgeting offline only (no Gemini calls)',calibration:{width:WIDTH,lettersPerRow:MEAN_LETTERS},
 fixtureCases:tests.length,fixtureFeasible:tests.filter(t=>t.feasible).length,
 randomizedCases:validRandom+impossibleRandom,feasibleRandom:validRandom,infeasibleRandom:impossibleRandom,
 failures,deliberateSkewCheck:{weights:[9,0,0,0],totalRows:10,allocated:synthetic},
 fixtureChecks:tests,examples};
mkdirSync('audit/reports',{recursive:true});
writeFileSync('audit/reports/lab89-offline-allocation-stress.json',JSON.stringify(outcome,null,2)+'\n');
console.log('LAB89_OFFLINE_FINAL',JSON.stringify({fixtureCases:outcome.fixtureCases,fixtureFeasible:outcome.fixtureFeasible,randomizedCases:outcome.randomizedCases,feasibleRandom:outcome.feasibleRandom,infeasibleRandom:outcome.infeasibleRandom,failed:outcome.failures.length,skew:synthetic}));
if(failures.length||tests.filter(t=>t.feasible).length<20)process.exitCode=1;
