import assert from 'node:assert/strict';
import {indexedDB as fakeIndexedDB} from 'fake-indexeddb';
import {studyLetters,assertProgressiveBook} from '../src/lib/studyPillarV38.js';
import {fitStudyUnitV53,reviewGeminiPartsV53} from '../src/lib/editionRepairV53.js';
import {generateIntegralEditionsV51} from '../src/lib/generativeIntegralV51.js';
import bulkHandler from '../api/editionsBulkV51.js';

const source='argomento '.repeat(20).trim(),letters=studyLetters(source);
const unit={id:'0:0',ci:0,pi:0,source,pageStart:1,pageEnd:1,
  targetLetters:letters-1,summaryCapLetters:letters/2};
const candidate='argomento '.repeat(20).trim();
const lengthReview=reviewGeminiPartsV53([unit],'10',[{id:unit.id,text:candidate}]);
assert.equal(lengthReview.verified.length,0,'A too-long draft is not verified');
assert.equal(lengthReview.failed[0].letterDelta,1);
const smallSource='Una norma precisa, cioè una disposizione vincolante.';
const before='Una norma precisa, cioè una disposizione vincolante.';
const fixUnit={source:smallSource,targetLetters:studyLetters(before)+1};
const fixed=fitStudyUnitV53(fixUnit,'10',before);
assert.equal(fixed.audit.ok,true,'Simple Italian synonym may safely fit one letter');
assert.equal(studyLetters(fixed.text),studyLetters(before)+1);
assert.ok(fixed.text.includes('ossia'));

const a=globalThis.fetch;
let counted=0,generated=0;
globalThis.fetch=async (url,request)=>{
 if(String(url).includes(':countTokens')){
   counted++;return new Response(JSON.stringify({totalTokens:100}),{status:200});
 }
 generated++;
 const body=JSON.parse(request.body);
 const requested=JSON.parse(body.messages[1].content);
 return new Response(JSON.stringify({choices:[{finish_reason:'stop',
   message:{content:JSON.stringify({parts:requested.units.map(u=>({
     id:u.id,text:u.source
   }))})}}],usage:{completion_tokens:200}}),{status:200});
};
try{
 const res={statusCode:200,headers:{},status(code){this.statusCode=code;return this;},
   setHeader(k,v){this.headers[k]=v;return this;},json(body){this.body=body;return this;}};
 await bulkHandler({method:'POST',env:{AI_API_KEY:'FAKE',AI_MODEL:'gemini-3.5-flash-lite'},
   body:{level:'10',targetLetters:letters-1,
     units:[{id:'0:0',source,pageStart:1,pageEnd:1}]}},res);
 assert.equal(res.statusCode,200,'Do not discard entire response for one-letter gap');
 assert.equal(res.body.lengthReview.exact,false);
 assert.equal(res.body.parts[0].id,'0:0');
 assert.equal(generated,1);
 assert.equal(counted,1);
}finally{globalThis.fetch=a;}

const originalIndexedDB=globalThis.indexedDB;
globalThis.indexedDB=fakeIndexedDB;
const book={title:'Studio continuo',studyPillarV38:'studybook-progressive-v38-1',
 canonicalBookMap:{pageCount:2,originalFingerprint:'b'.repeat(64),uncertain:[],
   pages:[1,2].map(p=>({physicalPage:p,sourceStatus:'verified'}))},
 chapters:[{title:'Introduzione',pageStart:1,pageEnd:2,
   paragraphs:[1,2].map(p=>({original:source,sourcePageStart:p,sourcePageEnd:p}))}]};
let calls=0,firstPageOnFirstCall=false,firstDraftPreserved=false;
const snapshots=[];
globalThis.fetch=async(url,request)=>{
 assert.ok(String(url).endsWith('/api/editions/bulk/v51'));
 const payload=JSON.parse(request.body);
 calls++;
 const reps=payload.level==='summary'?8:20*(1-Number(payload.level)/100);
 const output=payload.units.map(u=>({id:u.id,text:'argomento '.repeat(reps).trim()}));
 if(payload.level==='summary'&&calls===1)output[1].text='Una bozza priva del termine fondamentale.';
 if(payload.level==='summary'&&calls===2)
   firstDraftPreserved=payload.repairDrafts?.length===1&&payload.repairDrafts[0].id==='0:1';
 return new Response(JSON.stringify({engine:'ai',version:'integral-v51',
   level:payload.level,parts:output}),{status:200,headers:{'Content-Type':'application/json'}});
};
try{
 const result=await generateIntegralEditionsV51(book,{onProgress:progress=>{
   snapshots.push({count:progress.verifiedVariants,through:progress.publishedThroughPage?.summary});
 }});
 assert.equal(result.complete,true,'Both pages and six editions validated');
 assert.equal(result.publishedThroughPage.summary,2);
 assert.equal(result.verifiedVariants,12);
 assert.equal(firstDraftPreserved,true,'Failed only paragraph is sent back for repair');
 assert.ok(snapshots.some(s=>s.count===1&&s.through===1),
   'First page ready while second paragraph is still unverified');
 assert.equal(calls,7,'Six large calls and one targeted repair');
 const audit=assertProgressiveBook(result.rows[0],book.chapters[0].paragraphs.map(p=>p.original));
 assert.ok(audit.every(x=>x.exact),'All five mathematical reductions remain exact');
 const again=await generateIntegralEditionsV51({...book,editionsV36:result});
 assert.equal(again.complete,true);
 assert.equal(calls,7,'No repeated Gemini calls for a verified checkpoint');
}finally{
 globalThis.fetch=a;
 if(originalIndexedDB===undefined)delete globalThis.indexedDB;
 else globalThis.indexedDB=originalIndexedDB;
}
console.log('LAB53 PASS: complete drafts not discarded, one-page partial salvage, exact verified ratios, one repair and checkpoint reuse.');
