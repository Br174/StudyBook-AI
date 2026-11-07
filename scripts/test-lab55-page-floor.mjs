// LAB55: real red banner regression: a later complete PDF page is larger
// than the adaptive Gemini input limit saved after multiple HTTP 503 errors.
// Do not split a page, discard checkpoint data, or throw unexpectedly.
import assert from 'node:assert/strict';
import {indexedDB as fakeIndexedDB} from 'fake-indexeddb';
import {bookUnitsV51,naturalBoundaryV51,planNaturalBlocksV51,
  minimumCompletePageInputV55,safeNaturalInputLimitV55}
  from '../src/lib/integralPlannerV51.js';
import {generateIntegralEditionsV51} from '../src/lib/generativeIntegralV51.js';
import {clearGeminiPause} from '../src/lib/geminiQuotaControllerV36.js';

const source='argomento '.repeat(20).trim();
const chapters=[{title:'Filosofia del diritto',pageStart:1,pageEnd:44,paragraphs:[]}];
for(let page=1;page<=44;page++){
 for(let i=0;i<page%3+2;i++){
  const isLong=page===32;
  chapters[0].paragraphs.push({
    original: isLong?'argomento '.repeat(500).trim():source,
    sourcePageStart:page,sourcePageEnd:page
  });
 }
}
const units=bookUnitsV51({chapters});
assert.ok(units.length>119);
const tooSmall=1600;
const floor=minimumCompletePageInputV55(units,'summary');
assert.ok(floor>tooSmall,'the initial LAB54 input cap strands page 32');
const safe=safeNaturalInputLimitV55(units,'summary',tooSmall);
assert.ok(safe>=floor,'planner must restore enough input for a whole page');
assert.ok(safe<=900000,'no bypass of the hard Gemini input ceiling');
for(const level of ['summary','50','40','30','20','10']){
  const blocks=planNaturalBlocksV51(units,level,{maxInputTokens:tooSmall});
  assert.ok(blocks.length>1,'adaptive planning still uses large, safe groups');
  assert.equal(blocks.flat().length,units.length);
  for(let i=0;i<blocks.length-1;i++){
    const a=blocks[i].at(-1),b=blocks[i+1][0];
    assert.ok(a.pageEnd<b.pageStart,'NEVER split an original physical PDF page');
  }
}
const samePageDifferentChapters=[{id:'0:0',ci:0,pi:0,source, pageStart:1,pageEnd:1},
 {id:'1:0',ci:1,pi:0,source,pageStart:1,pageEnd:1},
 {id:'1:1',ci:1,pi:1,source,pageStart:2,pageEnd:2}];
assert.equal(naturalBoundaryV51(samePageDifferentChapters,0),false,
 'chapter boundary on same original physical page must not cut the page');
assert.equal(naturalBoundaryV51(samePageDifferentChapters,1),true);
assert.equal(planNaturalBlocksV51(samePageDifferentChapters,'10',{
 maxInputTokens:1600})[0].length>=2,true);

const db=globalThis.indexedDB,oldFetch=globalThis.fetch;
globalThis.indexedDB=fakeIndexedDB;
const fp='f'.repeat(64),staged=chapters[0].paragraphs.map((_,i)=>({
 editions:{summary:i<73?'argomento '.repeat(8).trim():null},
 verified:{summary:i<73},issues:{},achievedPercent:{},partialFragments:{}
}));
const book={title:'Libro 44 pagine dopo HTTP 503',studyPillarV38:'studybook-progressive-v38-1',
 canonicalBookMap:{pageCount:44,originalFingerprint:fp,uncertain:[],
  pages:Array.from({length:44},(_,i)=>({physicalPage:i+1,sourceStatus:'verified'}))},
 chapters,editionsV36:{
   sourceFingerprint:fp,rows:[staged],stagedRows:[staged],
   verifiedChunkVariants:73,totalChunkVariants:714,
   status:'partial',complete:false,integralInputLimit:1600
 }};
let called=0;
globalThis.fetch=async(url,options)=>{
 called++;
 assert.ok(String(url).endsWith('/api/editions/bulk/v51'));
 return new Response(JSON.stringify({code:'AI_TEMPORARY_OVERLOAD',
  error:'Google 503',quota:{kind:'overload',automatic:true,
    retryAfterSeconds:40,estimated:false,httpStatus:503}}),
  {status:503,headers:{'Content-Type':'application/json'}});
};
try{
 await clearGeminiPause();
 const result=await generateIntegralEditionsV51(book);
 assert.equal(called,1,'must reach Gemini rather than crash on a too-small local limit');
 assert.equal(result.status,'quota-paused');
 assert.equal(result.verifiedChunkVariants,73,'all 73 previously verified units retained');
 assert.equal(result.quota.kind,'overload');
 assert.equal(result.sourceFingerprint,fp);
 assert.equal(result.totalChunkVariants,staged.length*6);
 const again=await generateIntegralEditionsV51({...book,editionsV36:result});
 assert.equal(again.status,'quota-paused');
 assert.equal(called,1,'respect persistent 503 cooldown during manual button press');
}finally{
 globalThis.fetch=oldFetch;
 await clearGeminiPause();
 if(db===undefined)delete globalThis.indexedDB;else globalThis.indexedDB=db;
}
console.log('LAB55 PASS: formerly blocking complete later PDF page now fits; no mid-page split, no lost 73/714, provider 503 remains cooled down.');
