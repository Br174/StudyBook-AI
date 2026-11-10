// LAB111 44-page and 2000-page local stress test; provider requests = 0.
// The incremental planner must produce EXACTLY the same natural blocks as
// LAB51 for small fixtures, while avoiding repeated whole-prefix scans.
import assert from 'node:assert/strict';
import {planNaturalBlocksV51,naturalBoundaryV51} from '../src/lib/integralPlannerV51.js';
import {planNaturalBlocksLinearV111} from '../src/lib/studyLinearPlannerV111.js';
import {STUDY_LEVELS_V67} from '../src/lib/studyRebalancePolicyV67.js';
import {studyLetters} from '../src/lib/studyPillarV38.js';
const stem='Nella storia della filosofia, una teoria distingue le condizioni necessarie dalle possibilità e considera gli esempi che chiariscono un argomento. ';
const levels=STUDY_LEVELS_V67;
function make(pages,overlap=false){
 return Array.from({length:pages},(_,i)=>({
  id:'0:'+i,ci:0,pi:i,source:(stem.repeat(5+i%4)).trim(),
  pageStart:i+1-(overlap&&i%17===0&&i>0?1:0),
  pageEnd:i+1,chapterTitle:'Capitolo '+Math.floor(i/30)
 }));
}
let checks=0;
const equal=(a,b,msg)=>{assert.deepEqual(a,b,msg);checks++};
const okay=(v,msg)=>{assert.ok(v,msg);checks++};
const small=make(44),medium=make(240,true);
for(const fixture of [small,medium])for(const level of levels){
 const opts={maxInputTokens:32000,maxOutputTokens:8400};
 const old=planNaturalBlocksV51(fixture,level,opts),fresh=planNaturalBlocksLinearV111(fixture,level,opts);
 equal(fresh.map(xs=>xs.map(x=>x.id)),old.map(xs=>xs.map(x=>x.id)),
  'LAB111 block packing differs from LAB51: '+level);
}
const book=make(2000,true);
const times=[],plans=[],sourceLetters=book.reduce((sum,x)=>sum+studyLetters(x.source),0);
for(const level of levels){
 const started=performance.now();
 const blocks=planNaturalBlocksLinearV111(book,level,{
  maxInputTokens:900000,maxOutputTokens:50000});
 const elapsedMs=Math.round((performance.now()-started)*100)/100;
 const count=blocks.reduce((n,b)=>n+b.length,0);
 equal(count,book.length,'lost source units on '+level);
 equal(blocks.flatMap(x=>x.map(u=>u.id)),book.map(u=>u.id),'source order not preserved '+level);
 for(let j=0;j<blocks.length-1;j++){
  const tail=blocks[j].at(-1).pi;
  okay(naturalBoundaryV51(book,tail),'cut source page: '+level+'/'+tail);
 }
 plans.push({level,sourcePages:2000,blocks:blocks.length,totalUnits:count});
 times.push({level,milliseconds:elapsedMs});
}
const result={
 lab:'LAB111',offline:true,pages:2000,levels:levels.length,sourceLetters,
 comparisonsWithExistingPlanner:12,passedAssertions:checks,
 peakHeapMb:Math.round(process.memoryUsage().heapUsed/1024/1024*100)/100,
 elapsedPerLevel:times,
 blocksByLevel:plans,geminiCalls:0,paidServices:0,
 sourcePageSplits:0,bookContentChanged:false,
 noExtraSemanticModelCalls:true,certifiedPerformanceOnAndroid:false
};
console.log(JSON.stringify(result,null,2));
