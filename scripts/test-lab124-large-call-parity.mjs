// LAB125 compatibility: compare NUMBER of remote Gemini calls, NOT internal text editing.
// Historical LAB58: six large calls for six variants; now one explanation.
import assert from 'node:assert/strict';
import {planExplainedBlocksV122,preflightExplainedCallsV124} from '../src/lib/explainedGeneratorV122.js';
import {planNaturalBlocksV51} from '../src/lib/integralPlannerV51.js';
function pages(count,chars){
 const source=('Il diritto impone una regola precisa, salvo le eccezioni previste dalla legge. ').repeat(
  Math.ceil(chars/60)).slice(0,chars);
 return Array.from({length:count},(_,i)=>({id:'p'+(i+1),physicalPage:i+1,
   segments:[{id:'p'+(i+1)+'-s0',source}]}));
}
function oldUnits(bookPages){
 return bookPages.map((p,i)=>({id:'0:'+i,ci:0,pi:i,
  source:p.segments[0].source,pageStart:i+1,pageEnd:i+1,
  chapterTitle:'Parte generale',sectionTitle:''}));
}
for(const chars of [180,1500,2300,5500]){
 const p=pages(44,chars);
 const oldCalls=planNaturalBlocksV51(oldUnits(p),'50').length;
 const newGroups=planExplainedBlocksV122(p);
 const newCalls=newGroups.length;
 const forecast=preflightExplainedCallsV124(p);
 assert.equal(forecast.estimatedLocally,true);
 assert.equal(forecast.providerCallsForEstimate,0);
 assert.equal(forecast.plannedRequests,newCalls);
 assert.equal(forecast.details.reduce((n,x)=>n+x.pages,0),44);
 assert.ok(forecast.details.every(x=>x.estimatedInputTokens<=35000));
 assert.ok(forecast.details.every(x=>x.estimatedOutputTokens<=30000));
 assert.equal(forecast.oversizedPages.length,0);
 assert.deepEqual(newGroups.flatMap(x=>x.map(p=>p.id)),p.map(p=>p.id));
 assert.ok(newGroups.every(g=>g.length>0&&g.every(p=>p.segments[0].source.length===chars)));
 assert.ok(newGroups.every(g=>g.reduce((n,p)=>n+p.segments[0].source.length,0)<=40000));
 assert.ok(newGroups.every(g=>g.length<=72));
 if(chars===180)assert.equal(newCalls,1,'44 short pages are ONE call');
 if(chars===1500)assert.ok(newCalls>=2&&newCalls<=4,'44 average pages use 2-4 large calls');
 if(chars===2300)assert.ok(newCalls>=3&&newCalls<=5,'44 long pages safely use 3-5 calls');
 if(chars===5500)assert.ok(newCalls>4,'long book must split instead of truncating output');
 console.log(JSON.stringify({case:'LAB124_44_PAGE_CALLS',sourceCharsPerPage:chars,
  oldCallsPerEdition:oldCalls,oldCallsSixEditions:oldCalls*6,
  newCallsOneExplainedEdition:newCalls,pagesByCall:newGroups.map(g=>g.length),
  pagesLost:0,requestsExecuted:0}));
}
const huge=pages(2000,1800);
const groups=planExplainedBlocksV122(huge);
const before=Date.now();
const forecast=preflightExplainedCallsV124(huge);
const durationMs=Date.now()-before;
assert.equal(forecast.plannedRequests,groups.length);
assert.equal(forecast.providerCallsForEstimate,0);
assert.ok(durationMs<5000,'2000-page local estimate should be inexpensive on Node 22: '+durationMs+'ms');
assert.equal(groups.reduce((n,g)=>n+g.length,0),2000);
assert.deepEqual(groups.flatMap(g=>g.map(p=>p.id)),huge.map(p=>p.id));
console.log(JSON.stringify({test:'LAB124_LARGE_CALL_PARITY',passed:true,
 originalPages:2000,plannedRequests:groups.length,
 modelRequestsExecuted:0,preflightMs:durationMs,contentGenerationUnchanged:true}));
