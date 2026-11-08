// LAB76 preflight benchmark ONLY: no app/Worker production changes,
// no Gemini calls and no actual user documents. 44 pages x 6 levels.
// Captures the solver-only time to avoid confusing it with model latency.
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {solve} from 'yalps';

const countUnicodeLetters = text =>
 ([...String(text).normalize('NFC').matchAll(/\p{L}/gu)]).length;
assert.equal(countUnicodeLetters('à è é ì ò ù'),6);
assert.equal(countUnicodeLetters('e\u0301'),1);
assert.equal(countUnicodeLetters('x😀 ́y'),2);

const pageCount=44;
const levels=[{id:'summary',cut:60},{id:'50',cut:50},{id:'40',cut:40},
{id:'30',cut:30},{id:'20',cut:20},{id:'10',cut:10}];
const times=[],examples=[],failures=[];
let solved=0;
for(let page=1;page<=pageCount;page++){
 const originalLetters=900+(page*59)%2400;
 for(const level of levels){
  const target=Math.round(originalLetters*(100-level.cut)/100);
  const min=Math.ceil(originalLetters*(100-(level.cut+5))/100);
  const max=Math.floor(originalLetters*(100-(level.cut-5))/100);
  const constraints={retainedLetters:{min,max}};
  const variables={};
  // Exactly one of 3 semantically equivalent wordings per mandatory concept.
  // Candidate lengths are synthetic measured *letter* counts.
  const countConcepts=6;
  for(let concept=0;concept<countConcepts;concept++){
   constraints['concept_'+concept]={equal:1};
   for(let variant=0;variant<3;variant++){
    const id='p'+page+'_'+level.id+'_c'+concept+'_v'+variant;
    const length=Math.max(3,Math.round(target/countConcepts*
      [0.85,1,1.15][variant])+((page+concept+variant)%5-2));
    variables[id]={
      retainedLetters:length,
      ['concept_'+concept]:1,
      pedagogicalQuality:[80,100,94][variant]+(concept+page)%7
    };
   }
  }
  const before=performance.now();
  const result=solve({
   direction:'maximize',
   objective:'pedagogicalQuality',
   constraints,variables,integers:true
  });
  const elapsed=performance.now()-before;
  times.push(elapsed);
  if(result.status!=='optimal'){
   failures.push({page,level:level.id,status:result.status});continue;
  }
  solved++;
  const chosen=new Map(result.variables);
  const letters=[...chosen].reduce((sum,[id,x])=>
   sum+Number(x||0)*variables[id].retainedLetters,0);
  assert.ok(letters>=min&&letters<=max,
    'solver outside bounds at page '+page+': '+letters+' versus '+min+'-'+max);
  if(page===1)examples.push({
   level:level.id,originalLetters,target,min,max,actual:letters,
   elapsedMs:+elapsed.toFixed(3)
  });
 }
}
const sorted=[...times].sort((a,b)=>a-b);
const p=n=>+sorted[Math.min(sorted.length-1,Math.floor(sorted.length*n))].toFixed(3);
const summary={
 type:'yalps-only-synthetic-speed',
 host:'GitHub Actions Node22 Linux, NOT Android device',
 pages:pageCount,levels:levels.length,independentOptimizations:times.length,
 integerVariablesPerProblem:18,constraintsPerProblem:7,
 feasible:solved,infeasible:failures.length,failures,
 totalSolverMs:+times.reduce((a,b)=>a+b,0).toFixed(2),
 meanSolverMs:+(times.reduce((a,b)=>a+b,0)/times.length).toFixed(3),
 medianSolverMs:p(.5),p95SolverMs:p(.95),maxSolverMs:p(1),
 samplePageResults:examples,
 limitation:'no Gemini generation, no semantic validation, no Android timing; optimizes among already created variants'
};
console.log('LAB76_YALPS_SPEED_PROOF',JSON.stringify(summary));
assert.equal(solved,times.length,'synthetic feasible model must solve all levels');
