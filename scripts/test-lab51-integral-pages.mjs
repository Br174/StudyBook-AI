// LAB51: 44-page boundary and provider API safety, no paid credentials.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {bookUnitsV51,naturalBoundaryV51,planNaturalBlocksV51,
  bisectAtNaturalBoundaryV51,blockLetterTargetV51} from '../src/lib/integralPlannerV51.js';
import {studyLetters,exactRetained} from '../src/lib/studyPillarV38.js';
import {publishSequentialPagesV51} from '../src/lib/pagePublicationV51.js';
import bulkHandler from '../api/editionsBulkV51.js';
import {indexedDB as fakeIndexedDB} from 'fake-indexeddb';
import {generateIntegralEditionsV51} from '../src/lib/generativeIntegralV51.js';

const chapters=[{title:'Capitolo uno',pageStart:1,pageEnd:44,paragraphs:[],sections:[]}];
for(let page=1;page<=44;page++)for(let part=0;part<2;part++)
  chapters[0].paragraphs.push({
    original:'Argomento '+page+' parte '+part+' descrizione completa. '.repeat(4),
    sourcePageStart:page,sourcePageEnd:page,sourceSection:'Sezione '+Math.ceil(page/11)});
const units=bookUnitsV51({chapters});
assert.equal(units.length,88);
for(let i=0;i<units.length-1;i++)
  assert.equal(naturalBoundaryV51(units,i),i%2===1,'no split within a page');
const blocks=planNaturalBlocksV51(units,'10',{maxOutputTokens:5000});
assert.ok(blocks.length>1);
assert.equal(blocks.flat().length,88);
for(const b of blocks)assert.equal(b.length%2,0,'a block ends at a complete page');
for(const b of blocks)assert.ok(bisectAtNaturalBoundaryV51(b)?.every(half=>half.length%2===0)||
  b.length===2);
for(const level of ['10','20','30','40','50']){
  const expected=exactRetained(units.reduce((n,u)=>n+studyLetters(u.source),0),Number(level));
  const actual=planNaturalBlocksV51(units,level,{maxOutputTokens:5000})
    .reduce((n,b)=>n+blockLetterTargetV51(b,level).targetLetters,0);
  assert.equal(actual,expected,'exact global letter budget for '+level);
}
const summary=planNaturalBlocksV51(units,'summary',{maxOutputTokens:5000});
assert.ok(summary.reduce((n,b)=>n+blockLetterTargetV51(b,'summary').summaryCapLetters,0)<
  exactRetained(units.reduce((n,u)=>n+studyLetters(u.source),0),50));
const staged=chapters[0].paragraphs.map((_,pi)=>({
 editions:{summary:'Risultato'},verified:{summary:pi>=8&&pi<=9},
 issues:{},achievedPercent:{},partialFragments:{}
}));
const visible=publishSequentialPagesV51({
 chapters,canonicalBookMap:{pageCount:44}
},[staged]);
assert.equal(visible.through.summary,0);
assert.equal(visible.rows[0][8].verified.summary,false,
  'later pages must never appear ready before page 1');
assert.equal(staged[8].verified.summary,true,'later checkpoint remains stored');
staged[0].verified.summary=true;staged[1].verified.summary=true;
const first=publishSequentialPagesV51({
 chapters,canonicalBookMap:{pageCount:44}
},[staged]);
assert.equal(first.through.summary,1);
assert.equal(first.rows[0][0].verified.summary,true);
assert.equal(first.rows[0][8].verified.summary,false);
const spanning=[
  {id:'0:0',ci:0,source:'a'.repeat(200),pageStart:1,pageEnd:2},
  {id:'0:1',ci:0,source:'b'.repeat(200),pageStart:2,pageEnd:3},
  {id:'0:2',ci:0,source:'c'.repeat(200),pageStart:4,pageEnd:4},
];
assert.equal(naturalBoundaryV51(spanning,0),false,'a paragraph spanning pages cannot be split');
assert.equal(naturalBoundaryV51(spanning,1),true);
assert.equal(bisectAtNaturalBoundaryV51(spanning)[0].length,2);
assert.throws(()=>planNaturalBlocksV51([{
  id:'0:0',ci:0,pi:0,source:'x'.repeat(200000),
  pageStart:1,pageEnd:1
}],'10',{maxOutputTokens:5000}),{code:'NATURAL_BOUNDARY_REQUIRED'});
const mirror=readFileSync(new URL('../src/lib/libroSpecchioV35.js',import.meta.url),'utf8');
assert.ok(mirror.includes("images:variant==='study'?[]:"));
const generator=readFileSync(new URL('../src/lib/generativeEditionsV36.js',import.meta.url),'utf8');
assert.ok(generator.includes('return generateIntegralEditionsV51(book,options)'));
assert.ok(!generator.includes('for(const level of levels){'),
  'old six tiny-fragment passes must no longer govern pillar books');
const pageSimple=readFileSync(new URL('../src/lib/pageSimpleV49.js',import.meta.url),'utf8');
assert.ok(pageSimple.includes('/api/page-simple/v49'),
  'manual-only simple words route preserved');
const worker=readFileSync(new URL('../worker/index.js',import.meta.url),'utf8');
assert.ok(worker.includes("'/api/editions/bulk/v51'"));
const actualFetch=globalThis.fetch;
let counted=0,generated=0,requestCap=0;
globalThis.fetch=async(url,options)=>{
  if(String(url).includes(':countTokens')){counted++;return new Response(JSON.stringify({totalTokens:200}),
    {status:200,headers:{'Content-Type':'application/json'}});}
  generated++;
  const request=JSON.parse(options.body);
  requestCap=request.max_tokens;
  const items=JSON.parse(request.messages[1].content).units;
  // Identity output is exactly the requested result for a 0%-reduction-like
  // summary test; the server checks the supplied length ceiling independently.
  return new Response(JSON.stringify({choices:[{finish_reason:'stop',
    message:{content:JSON.stringify({parts:items.map(u=>({id:u.id,text:u.source}))})}}],
    usage:{completion_tokens:75}}),{status:200,headers:{'Content-Type':'application/json'}});
};
const result={statusCode:200,headers:{},status(code){this.statusCode=code;return this;},
 setHeader(k,v){this.headers[k]=v;return this;},
 json(body){this.body=body;return this;}};
const original='Una definizione breve e significativa.';
const req={method:'POST',env:{AI_API_KEY:'TEST_KEY',AI_MODEL:'gemini-3.5-flash-lite'},
 body:{level:'summary',summaryCapLetters:studyLetters(original)+1,maxOutputTokens:4500,
 units:[{id:'0:0',source:original,chapterTitle:'Capitolo',pageStart:1,pageEnd:1}]}};
try{
 await bulkHandler(req,result);
 assert.equal(result.statusCode,200);
 assert.equal(result.body.parts.length,1);
 assert.equal(result.body.inputTokens,200);
 assert.equal(result.body.countedBy,'google-countTokens');
 assert.equal(counted,1);
 assert.equal(generated,1);
 assert.equal(requestCap,4500);
}finally{globalThis.fetch=actualFetch;}

// End-to-end isolated fake provider: the complete 44-page book needs only SIX
// generation calls, one per edition. No secrets, no live Gemini consumption.
const previousIndexedDB=globalThis.indexedDB;
globalThis.indexedDB=fakeIndexedDB;
const baseSource='argomento '.repeat(20).trim();
const completeBook={
  title:'Test 44 pagine',
  studyPillarV38:'studybook-progressive-v38-1',
  canonicalBookMap:{pageCount:44,originalFingerprint:'a'.repeat(64),
    uncertain:[],pages:Array.from({length:44},(_,i)=>({
      physicalPage:i+1,sourceStatus:'verified',text:baseSource
    }))},
  chapters:[{title:'Capitolo primo',pageStart:1,pageEnd:44,
    paragraphs:Array.from({length:44},(_,i)=>({
      original:baseSource,sourcePageStart:i+1,sourcePageEnd:i+1
    }))}]
};
let aiCalls=0;
globalThis.fetch=async(_url,request)=>{
  assert.ok(String(_url).endsWith('/api/editions/bulk/v51'));
  const input=JSON.parse(request.body);
  aiCalls++;
  const reps=input.level==='summary'?8:20*(1-Number(input.level)/100);
  const parts=input.units.map(u=>({id:u.id,text:'argomento '.repeat(reps).trim()}));
  return new Response(JSON.stringify({engine:'ai',version:'integral-v51',
    sourceVersion:'original',level:input.level,parts,model:'gemini-3.5-flash-lite'}),
    {status:200,headers:{'Content-Type':'application/json'}});
};
const stages=[];
try{
 const final=await generateIntegralEditionsV51(completeBook,{
   onProgress:snapshot=>stages.push({level:snapshot.activeLevel,
     through:snapshot.publishedThroughPage,ready:snapshot.verifiedVariants})
 });
 assert.equal(final.complete,true);
 assert.equal(aiCalls,6,'44 pages in six generation requests');
 assert.equal(final.rows[0][0].verified['10'],true);
 assert.equal(final.rows[0][43].verified.summary,true);
 assert.equal(final.publishedThroughPage['10'],44);
 assert.ok(stages.some(s=>s.through?.summary===44&&s.through?.['10']===0),
   'summary is readable before the other five versions');
}finally{
 globalThis.fetch=actualFetch;
 if(previousIndexedDB===undefined)delete globalThis.indexedDB;
 else globalThis.indexedDB=previousIndexedDB;
}
console.log('LAB51 PASS: 44 pages, natural boundaries, six exact budgets, text-only and counted Gemini API.');
