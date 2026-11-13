import assert from 'node:assert/strict';
import {originalExplainedPagesV122,modelInstructionV122,modelPayloadV122,
  auditExplainedPageV122,normalizeExplainedAnchorsV122,EXPLAINED_POLICY_V122,
  EXPLAINED_PRIVATE_BAND_V122} from '../src/lib/explainedPolicyV122.js';
import {planExplainedBlocksV122,generateExplainedBookV122} from '../src/lib/explainedGeneratorV122.js';
import {composeExplainedSheetsV122} from '../src/lib/explainedLayoutV122.js';
import handler from '../api/explainedV122.js';

const say=name=>process.stdout.write('PASS '+name+'\n');
function sampleBook(count=2){
 const sentence='Una norma imperativa è una regola obbligatoria che non può essere eliminata da accordi tra privati.';
 const text=sentence+' '+sentence;
 return {canonicalBookMap:{
  originalFingerprint:'a'.repeat(64),pageCount:count,
  pages:Array.from({length:count},(_,i)=>({
   physicalPage:i+1,label:String(i+1),sourceStatus:'verified',
   widthPt:595.28,heightPt:841.89,text
  })),chapters:[{title:'Le norme',pageStart:1,pageEnd:count,sections:[]}],
 },chapters:[{title:'Le norme',pageStart:1,pageEnd:count,paragraphs:Array.from({length:count},(_,i)=>({
  original:text,sourcePageStart:i+1,sourcePageEnd:i+1
 }))}]};
}
const makeAnswer=p=>({
 id:p.id,
 segments:p.segments.map(s=>({id:s.id,text:
  'Una **(norma imperativa)** è una regola obbligatoria che non può essere eliminata da accordi tra privati.'})),
 glossary:[{term:'norma imperativa',definition:'Regola obbligatoria che i privati non possono eliminare con un accordo.'}]
});
const book=sampleBook(),pages=originalExplainedPagesV122(book);
assert.equal(pages.length,2);assert.equal(pages[0].segments.length,1);
const valid=makeAnswer(pages[0]),review=auditExplainedPageV122(pages[0],valid);
assert.equal(review.ready,true,'A faithful half-length simple explanation must be accepted: '+review.issues.join(', '));
assert.ok(review.reduction>=40&&review.reduction<=60);
say('one explained page true reduction and anchored glossary');
const prompt=modelInstructionV122(),payload=modelPayloadV122(pages);
assert.ok(prompt.includes('50%'),'Only central target is model-visible');
assert.ok(!/30\s*[%–-]|60\s*[%–-]|30.{0,20}60/iu.test(prompt));
for(const word of ['minLetters','maxLetters','tolerancePercentagePoints','acceptanceMinimum','acceptanceMaximum']){
 assert.ok(!JSON.stringify(payload).includes('"'+word+'"'));
}
assert.deepEqual(EXPLAINED_PRIVATE_BAND_V122,{min:40,max:60});
say('provider sees only precise 50 percent target, not private margins');
const badTerm=makeAnswer(pages[0]);badTerm.glossary=[];
assert.equal(auditExplainedPageV122(pages[0],badTerm).ready,false);
say('missing glossary definition rejected');
const looseTerm=makeAnswer(pages[0]);
looseTerm.segments[0].text=looseTerm.segments[0].text.replace('**(norma imperativa)**','norma imperativa');
const normalizedTerm=normalizeExplainedAnchorsV122(looseTerm);
assert.ok(normalizedTerm.segments[0].text.includes('**(norma imperativa)**'));
assert.equal(auditExplainedPageV122(pages[0],normalizedTerm).ready,true);
const absentTerm=makeAnswer(pages[0]);
absentTerm.segments[0].text='La regola obbligatoria non può essere eliminata da accordi tra privati.';
assert.ok(!normalizeExplainedAnchorsV122(absentTerm).segments[0].text.includes('**(norma imperativa)**'));
say('local typographic repair never fabricates omitted legal terminology');
const wrongOrder={...valid,id:'p2'};
assert.equal(auditExplainedPageV122(pages[0],wrongOrder).ready,false);
const emptySegment=makeAnswer(pages[0]);emptySegment.segments[0].text='';
assert.equal(auditExplainedPageV122(pages[0],emptySegment).ready,false);
say('wrong page identity and empty page rejected');
const legalPage={
 id:'p3',segments:[{id:'p3-s0',source:'Ai sensi dell\'art. 1418 del Codice civile, il contratto può essere nullo quando viola una norma imperativa. Questa regola obbligatoria deve essere rispettata da tutti.'}]};
const badLaw={id:'p3',segments:[{id:'p3-s0',text:'Ai sensi dell\'art. 1419 del Codice civile il contratto è nullo.'}],glossary:[]};
assert.ok(auditExplainedPageV122(legalPage,badLaw).issues.some(x=>x.includes('legal-reference')),'Altered law rejected');
say('changed legislative article rejected');
const quoted={id:'p4',segments:[{id:'p4-s0',source:'Ai sensi dell\'art. 1418: «Il contratto è nullo quando è contrario a norme imperative». Questa disposizione precisa una regola obbligatoria.'}]};
const invented={id:'p4',segments:[{id:'p4-s0',text:'Ai sensi dell\'art. 1418: «Il contratto è valido quando è contrario a norme imperative».'}],glossary:[]};
assert.ok(auditExplainedPageV122(quoted,invented).issues.some(x=>x.includes('normative-quotation')),'Altered quote rejected');
say('unaltered normative quotation required');
const formulaPage={id:'p5',segments:[{id:'p5-s0',source:'La formula è a = b + c. La relazione indica che il totale si ottiene sommando due quantità separate.'}]};
const formulaBad={id:'p5',segments:[{id:'p5-s0',text:'La formula è a = b - c. Il totale deriva dalle quantità.'}],glossary:[]};
assert.ok(auditExplainedPageV122(formulaPage,formulaBad).issues.some(x=>x.includes('formula')),'Changed formula rejected');
say('changed formula rejected');
const malformed={...book,canonicalBookMap:{...book.canonicalBookMap,
 pages:[book.canonicalBookMap.pages[0],{...book.canonicalBookMap.pages[1],sourceStatus:'unknown'}]}};
assert.throws(()=>originalExplainedPagesV122(malformed),/non verificata/iu);
say('source pages not verified fail closed');
const large=sampleBook(2000),largePages=originalExplainedPagesV122(large);
const blocks=planExplainedBlocksV122(largePages);
assert.equal(largePages.length,2000);
assert.ok(blocks.length>=28&&blocks.flat().length===2000);
assert.ok(blocks.every(x=>x.length>=1&&x.length<=72));
say('2000 source pages planned without cuts or model requests');
const outputs=pages.map(p=>({...makeAnswer(p),review:{...auditExplainedPageV122(p,makeAnswer(p))}}));
const completeBook={...book,editionsV36:{
 version:EXPLAINED_POLICY_V122,sourceFingerprint:book.canonicalBookMap.originalFingerprint,
 pages:outputs.map((p,i)=>({...p,sourcePage:i+1})),complete:true}};
const layout=composeExplainedSheetsV122(completeBook,{requireComplete:true});
assert.equal(layout.sourcePages,2);
assert.deepEqual([...new Set(layout.pages.map(p=>p.sourcePage))],[1,2]);
assert.ok(layout.pages[0].rows.some(r=>(r.notes||[]).some(n=>n.term==='norma imperativa')));
say('two-column layout anchors legal term to its explanation');
const originalFetch=globalThis.fetch;
let workerCalls=0,modelCalls=0;
let capturedPrompt='',capturedUser='';
globalThis.fetch=async(uri,options)=>{
 if(String(uri).includes('/api/explained/v122')){
  workerCalls++;
  const req=JSON.parse(options.body);
  const reply=await runMockWorker({
   method:'POST',env:{AI_API_KEY:'unit-test',AI_MODEL:'gemini-3.5-flash-lite'},
   body:req
  });
  return {ok:reply.status===200,status:reply.status,json:async()=>reply.body};
 }
 modelCalls++;
 const posted=JSON.parse(options.body);
 capturedPrompt=posted.messages[0].content;
 capturedUser=posted.messages[1].content;
 const requested=JSON.parse(capturedUser).pages;
 const all=requested.map(x=>({id:x.id,
  segments:x.segments.map(s=>({id:s.id,text:'Una **(norma imperativa)** è una regola obbligatoria che non può essere eliminata da accordi tra privati.'})),
  glossary:[{term:'norma imperativa',definition:'Regola obbligatoria che i privati non possono eliminare con un accordo.'}]
 }));
 return {ok:true,status:200,headers:new Headers(),json:async()=>({
  choices:[{message:{content:JSON.stringify({pages:all})},finish_reason:'stop'}]
 })};
};
async function runMockWorker(req){
 let status=200,body=null;
 const res={setHeader(){return res},status(n){status=n;return res},json(v){body=v;return res}};
 await handler(req,res);
 return {status,body};
}
try{
 const snapshots=[];
 const finished=await generateExplainedBookV122(book,{onProgress:async snap=>snapshots.push(snap)});
 assert.equal(finished.complete,true,'All verified page outputs should become one complete edition');
 assert.equal(finished.totalChunkVariants,2);
 assert.equal(workerCalls,1);
 assert.equal(modelCalls,1);
 assert.ok(snapshots.length>=2);
 assert.ok(!capturedPrompt.includes('30%')&&!capturedPrompt.includes('60%'));
 assert.ok(!capturedUser.includes('minLetters'));
 say('real Worker handler + simulated model, two source pages bundled in ONE provider request');
 const unchanged=await generateExplainedBookV122({...book,editionsV36:finished},{
  onProgress:async()=>{}});
 assert.equal(unchanged.complete,true);
 assert.equal(workerCalls,1);
 say('restart reuses verified checkpoint; zero repeated Gemini calls');
 const bad=await runMockWorker({method:'POST',env:{AI_API_KEY:'test',AI_MODEL:'gemini-3.5-flash-lite'},
  body:{policy:EXPLAINED_POLICY_V122,pages:[{id:'p1',segments:[{id:'p1-s0',source:''}]}]}});
 assert.equal(bad.status,400);
 say('worker rejects missing source without provider request');
}finally{globalThis.fetch=originalFetch;}
console.log(JSON.stringify({test:'LAB122',passed:true,checks:13,workerCalls,modelCalls,
 privateBandDisclosedToGemini:false,semanticCertified:false}));

{
 const source={id:'p1',segments:[{id:'p1-s0',
  source:'Una disposizione non può derogare alla fonte superiore, salvo che questa lo consenta. Questo significa che una disposizione inferiore non può derogare alla fonte superiore, salvo che questa lo consenta.'}]};
 const candidate={id:'p1',segments:[{id:'p1-s0',text:'La norma inferiore non può violare la fonte superiore.'}],glossary:[]};
 const review=auditExplainedPageV122(source,candidate);
 assert.equal(review.ready,false);
 const prepared=modelPayloadV122([{...source,repair:review.repair}]).pages[0];
 assert.ok(prepared.requiredQualifiers.includes('salvo'));
 assert.ok(prepared.repair.missingProtectedItems.some(item=>item.value==='salvo'));
 assert.ok(prepared.repair.missingEssentialConcepts.some(text=>text.includes('salvo')));
 const corrected={id:'p1',segments:[{id:'p1-s0',
  text:'Una disposizione non può **(derogare)** alla fonte superiore, salvo che questa lo consenta.'}],
  glossary:[{term:'derogare',definition:'Fare eccezione a una regola.'}]};
 const repaired=auditExplainedPageV122(source,corrected);
 assert.equal(repaired.ready,true);
 assert.ok(repaired.reduction>=40&&repaired.reduction<=60);
 assert.ok(modelInstructionV122().includes('missingEssentialConcepts'));
 assert.ok(!JSON.stringify(prepared).includes('40-60'));
 assert.ok(!JSON.stringify(prepared).includes('minLetters'));
 console.log('PASS: legal exception remains mandatory and the retry gets source-grounded correction hints');
}
