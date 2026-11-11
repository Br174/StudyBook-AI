// LAB119 2000 page proof: locally assemble one core+five expansions per page.
// All AI content here is MANUALLY synthetic. Zero requests or app mutation.
// This measures the existing single-call postprocessing cost, not model latency.
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {prepareSemanticLadderV119,composeSemanticLadderV119}
 from '../src/lib/studySemanticLadderV119.js';
const sentences=Array.from({length:10},(_,i)=>
 'Il registro conserva il fatto numero '+String(i+1).padStart(2,'0')+'.');
const source=sentences.join(' ');
let pages=0,checked=0,maxBlockMs=0,maxHeap=0,nonCertified=0;
const started=performance.now();
for(let block=0;block<20;block++){
 const units=Array.from({length:100},(_,i)=>({
  id:block+':'+i,pageStart:block*100+i+1,
  pageEnd:block*100+i+1,source
 }));
 const plan=prepareSemanticLadderV119(units);
 const response={units:units.map(u=>({
  id:u.id,core:sentences.slice(0,4).join(' '),
  extra50:sentences[4],extra40:sentences[5],
  extra30:sentences[6],extra20:sentences[7],extra10:sentences[8]
 }))};
 const start=performance.now();
 const result=composeSemanticLadderV119(plan,response);
 maxBlockMs=Math.max(maxBlockMs,performance.now()-start);
 assert.equal(result.allSixNumeric,true,'Six numeric levels not met in block '+block);
 assert.equal(result.semanticCertified,false);
 if(!result.allSixPreliminarySafe)nonCertified++;
 pages+=units.length;checked+=units.length*6;
 maxHeap=Math.max(maxHeap,process.memoryUsage().heapUsed/1024/1024);
}
assert.equal(pages,2000);
assert.equal(checked,12000);
console.log(JSON.stringify({lab:'LAB119',syntheticPages:pages,
 sixLevelNumericChecks:checked,
 localElapsedMs:Math.round(performance.now()-started),
 slowest100PageBlockMs:Math.round(maxBlockMs),
 sampledHeapPeakMB:Math.round(maxHeap),
 blocksNotSemanticallyCertified:nonCertified,
 modelRequests:0,androidDeviceTested:false,
 semanticCertified:false,approvedForApp:false},null,2));
