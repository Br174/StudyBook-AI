// LAB118C, 2000 pages: local post-model composition ONLY, no Gemini.
// Synthetic exact repetitions, not an educational or Android performance proof.
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {prepareSourceTiersV116} from '../src/lib/studySourceTiersV116.js';
import {composeSourcePatchesV118} from '../src/lib/studySourcePatchV118.js';
const sentence='Il registro mostra il titolo richiesto, e il registro mostra il titolo richiesto.';
const replacement='Il registro mostra il titolo richiesto.';
let done=0,pagesChecked=0,maxBlockMs=0,peakHeapMB=0;
const totalStarted=performance.now();
for(let block=0;block<20;block++){
 const input=Array.from({length:100},(_,i)=>({
  id:block+':'+i,source:Array(20).fill(sentence).join(' '),
  pageStart:block*100+i+1,pageEnd:block*100+i+1
 }));
 const plan=prepareSourceTiersV116(input);
 const reply={units:plan.units.map(u=>({
  id:u.id,patches:Array.from({length:20},(_,i)=>({
   from:sentence,occurrence:i,
   to:i<10?'':replacement,importance:3
  })),macro50:'',macroSummary:''
 }))};
 const t0=performance.now(),result=composeSourcePatchesV118(plan,reply);
 maxBlockMs=Math.max(maxBlockMs,performance.now()-t0);
 for(const [level,q] of Object.entries(result.quality)){
  assert.equal(q.quantitativePass,true,'Unmatched level '+level+' in batch '+block);
  pagesChecked+=q.totalGroups;
 }
 assert.equal(result.providerRequestsMade,0);
 done+=input.length;
 peakHeapMB=Math.max(peakHeapMB,process.memoryUsage().heapUsed/1024/1024);
}
assert.equal(done,2000);assert.equal(pagesChecked,12000);
console.log(JSON.stringify({lab:'LAB118C',pages:done,levelPageChecks:pagesChecked,
 levels:['summary','50','40','30','20','10'],geminiRequests:0,
 elapsedMs:Math.round(performance.now()-totalStarted),
 max100PageBlockMs:Math.round(maxBlockMs),
 sampledHeapPeakMB:Math.round(peakHeapMB),
 onlySyntheticRepeatedSources:true,semanticCertified:false,approvedForApp:false},null,2));
