// Isolated, no-Gemini-cost diagnostics for current LAB56 large-block generation.
// No source modification, no model secret, no changes to the installed app.
import assert from 'node:assert/strict';
import {indexedDB as fakeIndexedDB} from 'fake-indexeddb';
import {planNaturalBlocksV51,bookUnitsV51,assignBudgetsV51} from '../src/lib/integralPlannerV51.js';
import {studyLetters} from '../src/lib/studyPillarV38.js';
import {auditStudyUnitV53} from '../src/lib/editionRepairV53.js';
import {generateIntegralEditionsV51} from '../src/lib/generativeIntegralV51.js';
import {clearGeminiPause} from '../src/lib/geminiQuotaControllerV36.js';

const levels=['summary','50','40','30','20','10'];
const pages=44,paragraphs=119;
const baseSource='argomento '.repeat(20).trim();
const chapter={title:'Capitolo di verifica',pageStart:1,pageEnd:pages,
 paragraphs:Array.from({length:paragraphs},(_,i)=>({
  original:baseSource,sourcePageStart:Math.floor(i*pages/paragraphs)+1,
  sourcePageEnd:Math.floor(i*pages/paragraphs)+1
 }))};
const units=bookUnitsV51({chapters:[chapter]});
assert.equal(units.length,119);
const planCounts=Object.fromEntries([
 ['normal',900000],['adaptive_3500',3500],['adaptive_1600',1600]
].map(([name,limit])=>[name,Object.fromEntries(levels.map(level=>[
 level,planNaturalBlocksV51(units,level,{maxInputTokens:limit}).length
]))]));
const sum=o=>Object.values(o).reduce((a,b)=>a+b,0);
const planned={normal:sum(planCounts.normal),
 adaptive_3500:sum(planCounts.adaptive_3500),
 adaptive_1600:sum(planCounts.adaptive_1600)};
assert.equal(planned.normal,6,'small 44-page document normally fits one request per edition');
assert.ok(planned.adaptive_1600>=planned.normal*3,
 'the real adaptive downgrade greatly increases requests after repeated 503');

const short='Articolo 10.';
const shortUnit={source:short,
 summaryCapLetters:assignBudgetsV51([{id:'x',source:short,pageStart:1,pageEnd:1}],'summary')[0].summaryCapLetters};
const literal=auditStudyUnitV53(shortUnit,'summary','Articolo 10');
const compressed=auditStudyUnitV53(shortUnit,'summary','art.10');
assert.ok(literal.reasons.includes('letter-budget'));
assert.ok(compressed.reasons.includes('missing-protected'),
 'compressed legal citation does not pass literal protected matching');
const shortConflict={source:short,letters:studyLetters(short),
 summaryCap:shortUnit.summaryCapLetters,
 fullCitationLetters:studyLetters('Articolo 10'),
 literalIssues:literal.reasons,compactIssues:compressed.reasons};

const oldFetch=globalThis.fetch,oldDb=globalThis.indexedDB;
globalThis.indexedDB=fakeIndexedDB;
function makeBook(fp){
 return {title:'Simulazione tecnica 44 pagine',studyPillarV38:'studybook-progressive-v38-1',
  canonicalBookMap:{originalFingerprint:fp.repeat(64),pageCount:pages,uncertain:[],
   pages:Array.from({length:pages},(_,i)=>({
    physicalPage:i+1,sourceStatus:'verified'}))},
  chapters:[chapter]};
}
let trace=[];
const fakeProvider=(failId=null)=>async(url,options)=>{
 assert.ok(String(url).endsWith('/api/editions/bulk/v51'));
 const req=JSON.parse(options.body);
 const repairIds=req.repairDrafts?.map(x=>x.id)||[];
 const reps=req.level==='summary'?8:20*(1-Number(req.level)/100);
 const bad=failId && req.level==='summary';
 trace.push({level:req.level,units:req.units.length,
  pageStart:req.units[0].pageStart,pageEnd:req.units.at(-1).pageEnd,
  repairHints:repairIds.length,
  badOriginalRepeated:!!bad&&req.units.some(u=>u.id===failId)});
 const response={engine:'ai',version:'integral-v51',
  level:req.level,
  parts:req.units.map(u=>({id:u.id,text:bad&&u.id===failId?
   'frase completamente estranea': 'argomento '.repeat(reps).trim()}))};
 return new Response(JSON.stringify(response),{status:200,
  headers:{'Content-Type':'application/json'}});
};
const executions={};
try{
 await clearGeminiPause();
 globalThis.fetch=fakeProvider();
 const baseline=await generateIntegralEditionsV51(makeBook('a'));
 assert.equal(baseline.complete,true);
 assert.equal(baseline.verifiedChunkVariants,714);
 assert.equal(baseline.publishedThroughPage.summary,44);
 assert.equal(trace.length,6);
 executions.ideal={requests:trace.length,unitInputs:trace.reduce((n,r)=>n+r.units,0),
  completed:baseline.complete,verified:baseline.verifiedChunkVariants};
 trace=[];
 globalThis.fetch=fakeProvider('0:0');
 const broken=await generateIntegralEditionsV51(makeBook('b'));
 assert.equal(broken.complete,false);
 assert.equal(broken.verifiedChunkVariants,713,
   'all 713 correct versions must survive one permanently wrong summary');
 assert.equal(broken.publishedThroughPage.summary,0,
   'one missing paragraph in page 1 masks all later summary pages');
 assert.ok(trace.length>6);
 assert.ok(trace.some(r=>r.level==='summary'&&r.repairHints>0),
  'repair is attempted after the first 119-unit model response');
 assert.ok(trace.some(r=>r.level==='summary'&&r.repairHints>0&&r.units>1),
  'repair request resends whole multi-page block even when one unit was wrong');
 assert.ok(broken.diagnostics.deferredPages.some(p=>p.pages.includes(1)));
 executions.oneBad={requests:trace.length,
  unitInputs:trace.reduce((n,r)=>n+r.units,0),
  requestsOverIdeal:trace.length-6,
  redundantUnitInputs:trace.reduce((n,r)=>n+r.units,0)-714,
  verified:broken.verifiedChunkVariants,
  publishedSummaryPages:broken.publishedThroughPage.summary,
  summaryTrace:trace.filter(t=>t.level==='summary')};
 // Run-time diagnostic requestsSent resets when the operation resumes:
 // evidence: each invocation creates a fresh diagnostics object.
 const restored=await generateIntegralEditionsV51({...makeBook('b'),editionsV36:broken});
 assert.equal(restored.verifiedChunkVariants,713);
 executions.counterAfterResume={newRunRequestsSent:restored.diagnostics.requestsSent,
  previousRunRequestsSent:broken.diagnostics.requestsSent,
  cumulativeIndependentFromRuns:false};
}finally{
 globalThis.fetch=oldFetch;
 await clearGeminiPause();
 if(oldDb===undefined)delete globalThis.indexedDB;
 else globalThis.indexedDB=oldDb;
}
console.log('BULK_DIAGNOSTIC_REPORT='+JSON.stringify({
 syntheticNotRealUserPdf:true,pages,paragraphs,editions:6,
 blockPlan:planCounts,totalInitialBlocks:planned,
 exactLengthVsProtectedCitation:shortConflict,measuredSimulations:executions
}));
console.log('BULK_DIAGNOSTIC_PASS');
