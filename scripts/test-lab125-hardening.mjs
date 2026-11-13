// LAB125: deterministic integration regressions. Runs with node >=22 and npm install.
// Gemini requests are mocked; DO NOT confuse this with provider or phone QA.
import assert from 'node:assert/strict';
import {auditExplainedPageV122,modelInstructionV122,modelPayloadV122,
  EXPLAINED_PRIVATE_BAND_V122,EXPLAINED_POLICY_V122}
 from '../src/lib/explainedPolicyV122.js';
import {auditItalianGrammarV125,auditCriticalRelationsV125}
 from '../src/lib/fidelityEngine.js';
import {planExplainedBlocksV122,preflightExplainedCallsV124,estimateSerializedInputTokensV125,
  generateExplainedBookV122} from '../src/lib/explainedGeneratorV122.js';
import {buildExplainedEditionViewV122}
 from '../src/lib/explainedViewV122.js';
import {composeExplainedSheetsV122}
 from '../src/lib/explainedLayoutV122.js';
import {planStudyAutoResumeV45}
 from '../src/lib/studyAutoResumeV45.js';
import handler from '../api/explainedV122.js';

let checks=0;
const test=(yes,message)=>{assert.ok(yes,message);checks++;};
const page=(src,sourceLineCount=8,n=1,answer=src,glossary=[])=>{
 const original={id:'p'+n,sourceLineCount,segments:[{id:'p'+n+'-s0',source:src}]};
 const proposed={id:'p'+n,segments:[{id:'p'+n+'-s0',text:answer}],glossary};
 return auditExplainedPageV122(original,proposed);
};
const bad=(src,changed,code)=>test(
  auditCriticalRelationsV125(src,changed).issues.includes(code),'Missed '+code);

assert.deepEqual(EXPLAINED_PRIVATE_BAND_V122,{min:40,max:60});
checks++;
test(!/40\s*[%–-]|60\s*[%–-]|40.{0,15}60/iu.test(modelInstructionV122()),
  'Acceptance interval leaked into provider instructions');

bad('Hart definisce primarie le norme che regolano la condotta e secondarie quelle che conferiscono poteri.',
    'Hart definisce secondarie le norme che regolano la condotta e primarie quelle che conferiscono poteri.',
    'V125_PRIMARY_SECONDARY_RELATION_REVERSED');
bad('Kelsen considera primaria la norma sanzionatoria e non quella precettiva.',
    'Kelsen considera primaria la norma precettiva e non quella sanzionatoria.',
    'V125_PRIMARY_SANCTION_RELATION_REVERSED');
bad('La validità afferisce al dover essere e l’efficacia afferisce all’essere.',
    'La validità afferisce all’essere e l’efficacia afferisce al dover essere.',
    'V125_VALIDITY_EFFICACY_REVERSED');
bad('Il criterio gerarchico dà prevalenza alla legge superiore; il cronologico alla legge posteriore.',
    'Il criterio cronologico dà prevalenza alla legge superiore; il gerarchico alla legge posteriore.',
    'V125_HIERARCHY_CHRONOLOGY_REVERSED');
bad('Kelsen presenta la norma fondamentale. Hart presenta la norma di riconoscimento.',
    'Hart presenta la norma fondamentale. Kelsen presenta la norma di riconoscimento.',
    'V125_AUTHOR_THEORY_REVERSED');
bad('La legge può prevedere sanzioni positive e negative.',
    'La legge deve prevedere sanzioni positive e negative.',
    'V125_PERMISSION_OBLIGATION_CHANGED');
bad('Agli artt 4 e 8 disp. prel. c.c. la fonte superiore prevale.',
    'Agli artt 4 e 9 disp. prel. c.c. la fonte superiore prevale.',
    'V125_PLURAL_LEGAL_REFERENCE_CHANGED');

const originalHart='Hart definisce primarie le norme che regolano la condotta e secondarie quelle che conferiscono poteri pubblici o privati, favorendo l’integrazione e la convivenza sociale.';
const invertedHart='Per Hart le norme secondarie regolano la condotta; le primarie conferiscono poteri pubblici e privati.';
const hartReview=page(originalHart,8,35,invertedHart);
test(hartReview.exactReduction>=40&&hartReview.exactReduction<=60,
 'Hart regression must be INSIDE private reduction interval');
test(!hartReview.ready && hartReview.issues.includes('V125_PRIMARY_SECONDARY_RELATION_REVERSED'),
 'Reversed Hart roles must be rejected even at correct reduction');

const short='L’ermeneutica degli operatori giuridici, ma soprattutto dei consociati che individuano il diritto e lo riconoscono come valido conformando i loro comportamenti ad esso. Qui nasce e muore la teoria generale del diritto.';
const shortSimple='Il diritto viene interpretato sia dai professionisti sia, soprattutto, dai cittadini. Questi riconoscono le regole come valide e le seguono. Da qui comincia e qui finisce la teoria generale del diritto.';
test(page(short,3,44,shortSimple).ready,'Short page must accept a faithful simplified rewrite');
test(!page(short,3,44,short).ready,'Copying a short page verbatim is not simplification');
test(page(short,3,44,shortSimple).shortPage===true,'Short page classification');
const letters='a'.repeat(10000);
for(const [output,pass] of [[6000,true],[6001,false],[4000,true],[3999,false]]){
 const a=page(letters,8,1,'a'.repeat(output));
 test(a.sizeCompliant===pass,'Exact integer threshold failed for '+output);
}
test(!page('La norma è valida.',8,1,'La norma non è valida.').ready,
 'A new legal negation needs review');
test(auditItalianGrammarV125('Il diritto Ã¨ valido.').issues.length>0,
 'Mojibake must be rejected');
test(auditItalianGrammarV125('La **(norma** è valida.').issues.length>0,
 'Unbalanced parentheses must be rejected');
test(auditItalianGrammarV125('Il testo e piu chiaro.').issues.length>0,
 'Missing written accent should be caught');
test(auditItalianGrammarV125('Il testo è più chiaro e comprensibile.').issues.length===0,
 'Correct accented Italian should not be rejected');
test(auditCriticalRelationsV125('La norma fondamentale è presupposta, non posta.',
   'La **(norma fondamentale)** è presupposta, non posta.',
   [{term:'norma fondamentale',definition:'Legge ordinaria approvata dal Parlamento.'}])
   .issues.includes('V125_GLOSSARY_FOUNDATIONAL_NORM_CONTRADICTION'),
 'Invented glossary definition must be detected');

const sentence='Questa pagina presenta una spiegazione completa e chiara che gli studenti possono leggere e comprendere facilmente.';
const text=Array(25).fill(sentence).join('\n');
const reduced=Array(12).fill(sentence).join('\n');
const shortBase='Lo studio dei testi aiuta gli studenti a capire meglio il contenuto.';
const shortReduced='Studiare questi testi aiuta a capire meglio.';
const originals=Array.from({length:44},(_,i)=>({
  physicalPage:i+1,label:String(i+1),text:i===43?shortBase:text,
  sourceStatus:'verified',widthPt:595.28,heightPt:841.89
}));
const book={canonicalBookMap:{originalFingerprint:'a'.repeat(64),pageCount:44,
 chapters:[],pages:originals},
 chapters:[{pageStart:1,pageEnd:44,title:'Lezioni',paragraphs:
  originals.map((x,i)=>({sourcePageStart:i+1,sourcePageEnd:i+1,original:x.text}))}]};
const sourcePages=originals.map((p,i)=>({
 physicalPage:i+1,id:'p'+(i+1),
 segments:[{id:'p'+(i+1)+'-s0',source:p.text}]
}));
const measuredJson=JSON.stringify(modelPayloadV122(sourcePages.slice(0,5))).length;
const predictedTokens=Math.ceil((measuredJson+modelInstructionV122().length)/2.6);
test(estimateSerializedInputTokensV125(sourcePages.slice(0,5))===predictedTokens,
 'Cached per-page payload estimation must equal exact complete JSON serialization');
const plan=planExplainedBlocksV122(sourcePages);
const estimate=preflightExplainedCallsV124(sourcePages);
test(plan.flat().length===44&&plan.length>=3&&plan.length<=5,
 'All 44 pages must survive the planned 40k blocks');
test(estimate.details.every(x=>x.sourceChars<=40000&&
 x.estimatedInputTokens<=35000&&x.estimatedOutputTokens<=30000),
 'Every planned block must fit all limits');
const longPages=Array.from({length:2000},(_,i)=>({
 id:'p'+(i+1),physicalPage:i+1,
 segments:[{id:'p'+(i+1)+'-s0',source:sentence.repeat(15)}]}));
test(planExplainedBlocksV122(longPages).flat().length===2000,
 'A long source must keep all 2000 page boundaries');

const originalFetch=globalThis.fetch;
let requests=0,providerRequests=0,firstBad=false;
const seen=new Map();
globalThis.fetch=async(url,options)=>{
 if(!String(url).includes('/api/explained/v122')){
  providerRequests++;
  const posted=JSON.parse(options.body);
  test(!posted.messages[0].content.includes('40–60') &&
       !posted.messages[0].content.includes('40-60'),
       'Private band leaked during provider generation');
  const pages=JSON.parse(posted.messages[1].content).pages;
  const responses=pages.map(p=>{
    const n=Number(p.id.slice(1));
    seen.set(n,(seen.get(n)||0)+1);
    let content=n===44?shortReduced:reduced;
    if(n===17&&!firstBad){content='Testo molto corto.';firstBad=true;}
    return {id:p.id,segments:p.segments.map(s=>({id:s.id,text:content})),glossary:[]};
  });
  return {ok:true,status:200,headers:new Headers(),
   json:async()=>({choices:[{message:{content:JSON.stringify({pages:responses})},finish_reason:'stop'}]})};
 }
 requests++;
 const body=JSON.parse(options.body),out=await fakeWorker({method:'POST',
   body,env:{AI_API_KEY:'local-mock',AI_MODEL:'gemini-3.5-flash-lite'}});
 return {ok:out.status===200,status:out.status,headers:new Headers(),json:async()=>out.body};
};
async function fakeWorker(req){
 let status=200,body=null;
 const res={setHeader(){return res;},status(s){status=s;return res;},
   json(v){body=v;return res;}};
 await handler(req,res);
 return {status,body};
}
try {
 const first=await generateExplainedBookV122(book,{onProgress:async()=>{}});
 test(first.draftUnitsSaved===44&&first.verifiedChunkVariants===43&&!first.complete,
   'First pass must checkpoint 43 of 44 accepted pages');
 const originalVersion={...book,editionsV36:first};
 const opened=buildExplainedEditionViewV122(originalVersion);
 test(opened.editionReadiness.readyPages===43&&opened.editionReadiness.partial,
   '43 conforming pages must be available on the phone');
 test(opened.chapters[0].paragraphs[17].editionPending!==true,
   'A page after the rejected page must still be readable');
 test(opened.chapters[0].paragraphs[16].editionPending===true,
   'Nonconforming page must not be published');
 const wake=planStudyAutoResumeV45(first,Date.now(),0);
 test(wake?.reason==='explained-targeted-quality-retry',
   'Only the established recovery scheduler may retry the rejected page');
 assert.throws(()=>composeExplainedSheetsV122(originalVersion,{requireComplete:true}),
   /non verificata/iu);
 checks++;
 const second=await generateExplainedBookV122(originalVersion,{retryReviewed:true,onProgress:async()=>{}});
 test(second.complete&&second.verifiedChunkVariants===44&&second.numericCompliant,
   'Second pass must finish the 44-page book');
 test(seen.get(17)===2&&[...seen.entries()].every(([k,v])=>k===17?v===2:v===1),
   'No accepted page may be sent twice');
 test(composeExplainedSheetsV122({...book,editionsV36:second},
   {requireComplete:true}).allReady===true,
   'Complete book may be handed to PDF renderer');
 const priorProvider=providerRequests;
 await generateExplainedBookV122({...book,editionsV36:second},
   {retryReviewed:true,onProgress:async()=>{}});
 test(providerRequests===priorProvider,
   'Resume after completion must not call provider');
 const rejected=await fakeWorker({method:'POST',body:{policy:EXPLAINED_POLICY_V122,
   pages:[{id:'p1',segments:[{id:'p1-s0',source:'a'.repeat(42001)}]}]},
   env:{AI_API_KEY:'local-mock',AI_MODEL:'gemini-3.5-flash-lite'}});
 test(rejected.status===413,'Worker must enforce 42k hard cap');
} finally {globalThis.fetch=originalFetch;}
// Empty original pages must preserve numbering and never block PDF completion.
const blankBook={...book,canonicalBookMap:{...book.canonicalBookMap,
 pageCount:2,pages:[{...originals[0],text:''},{...originals[1],physicalPage:2,label:'2'}]}};
const fetchBeforeBlank=globalThis.fetch;
globalThis.fetch=async(url,options)=>{
 const req=JSON.parse(options.body);
 if(String(url).includes('/api/explained/v122')){
  const data=await fakeWorker({method:'POST',body:req,
    env:{AI_API_KEY:'local-mock',AI_MODEL:'gemini-3.5-flash-lite'}});
  return {ok:data.status===200,status:data.status,headers:new Headers(),
   json:async()=>data.body};
 }
 return {ok:true,status:200,headers:new Headers(),
  json:async()=>({choices:[{finish_reason:'stop',message:{content:JSON.stringify({
   pages:JSON.parse(JSON.parse(options.body).messages[1].content).pages.map(p=>({
    id:p.id,segments:p.segments.map(s=>({id:s.id,text:reduced})),glossary:[]}))})}}]})};
};
try {
 const blank=await generateExplainedBookV122(blankBook,{onProgress:async()=>{}});
 test(blank.complete&&blank.verifiedChunkVariants===2&&
   blank.pages[0].review.sizeCompliant===true,
   'Blank cover must remain numbered and not block completion');
} finally {globalThis.fetch=fetchBeforeBlank;}
// HTTP 429/503 must retain the calibrated request size and the durable pause.
// Never split or re-request from an overloaded free provider immediately.
for(const [status,code,wait] of [[429,'AI_QUOTA_LIMIT',7200],
  [503,'AI_TEMPORARY_OVERLOAD',120]]){
 const old=globalThis.fetch;
 globalThis.fetch=async()=>({ok:false,status,headers:new Headers({'Retry-After':String(wait)}),
   json:async()=>({code,retryAfterSeconds:wait})});
 try{
  const paused=await generateExplainedBookV122(book,{onProgress:async()=>{}});
  test(paused.status==='quota-paused'&&paused.diagnostics.nextBlockChars===40000,
   '429/503 must not poison the calibrated block capacity: '+status);
  test(Date.parse(paused.quota.retryAt)-Date.now()>=wait*1000-2000,
   'Retry-After must be preserved: '+status);
 }finally{globalThis.fetch=old;}
}
console.log(JSON.stringify({suite:'LAB125 hardening',passed:true,checks,
 mockedRequests:requests,providerCalls:providerRequests,
 realGeminiCalls:0,realAndroidTests:0,realPDFSourceInThisSuite:false}));
