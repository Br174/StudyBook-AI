// LAB117 scale proof: 2,000 synthetic pages in page-safe blocks,
// NO Gemini, NO private PDF, NO modification of active app.
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {prepareSourceTiersV116} from '../src/lib/studySourceTiersV116.js';
import {composeSourceMacroV117} from '../src/lib/studyConceptMacroV117.js';
const sentence='Il programma registra i libri e mostra il titolo richiesto.';
const original=Array(10).fill(sentence).join(' ');
const macro50=Array(5).fill(sentence).join(' ');
const macroSummary=Array(4).fill(sentence).join(' ');
let pages=0,checked=0,peakMB=0,maxBlockMs=0;
const start=performance.now();
for(let block=0;block<20;block++){
 const input=Array.from({length:100},(_,p)=>({
  id:block+':'+p,source:original,pageStart:block*100+p+1,
  pageEnd:block*100+p+1
 }));
 const plan=prepareSourceTiersV116(input);
 const reply={units:plan.units.map(u=>({id:u.id,
  variants:u.segments.map(x=>({compact:x.original,brief:x.original,
   importance:5,essential:true})),
  macro50,macroSummary}))};
 const started=performance.now();
 const result=composeSourceMacroV117(plan,reply);
 maxBlockMs=Math.max(maxBlockMs,performance.now()-started);
 assert.equal(result.quality['50'].compliantPages,100);
 assert.equal(result.quality.summary.compliantPages,100);
 pages+=100;checked+=200;
 peakMB=Math.max(peakMB,process.memoryUsage().heapUsed/1024/1024);
}
assert.equal(pages,2000);assert.equal(checked,4000);
console.log(JSON.stringify({lab:'117',pagesProcessed:pages,
 pageLevelNumericChecks:checked,geminiCalls:0,
 elapsedMs:Math.round(performance.now()-start),max100PageBlockMs:Math.round(maxBlockMs),
 sampledHeapPeakMB:Math.round(peakMB),
 batchSize:100,modelOutputSyntheticallyAuthored:true,
 semanticCertified:false,approvedForApp:false},null,2));
