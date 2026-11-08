import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import handler from '../api/editionsV36.js';
import {STUDY_PILLAR_VERSION,STUDY_ORDER,STUDY_PERCENTAGES,
  studyLetters,exactRetained,coreAnchors,allocateExactLetterBudgets,
  inspectProgressiveEdition} from '../src/lib/studyPillarV38.js';
import {generateGeminiEditionsV36} from '../src/lib/generativeEditionsV36.js';
import {actualMirrorPageStatistics} from '../src/lib/libroSpecchioV35.js';
import {clearGeminiPause} from '../src/lib/geminiQuotaControllerV36.js';

assert.deepEqual(STUDY_ORDER,['summary','50','40','30','20','10','0']);
const pillar=readFileSync(new URL('../docs/STUDYBOOK_STUDIO_PROGRESSIVO_PILASTRO_V1.md',import.meta.url),'utf8');
assert.match(pillar,/NON cambiare senza sua approvazione esplicita/);
assert.match(pillar,/stessi concetti fondamentali/i);
assert.match(pillar,/percentuali VINCOLANTI/i);
const chunks=['La teoria normativistica descrive norme.','Kant e Bobbio studiano la giustizia.','Il diritto organizza le relazioni sociali.'];
for(const percentage of STUDY_PERCENTAGES){
  const budgets=allocateExactLetterBudgets(chunks,percentage);
  assert.equal(budgets.reduce((a,b)=>a+b,0),exactRetained(chunks.reduce((n,x)=>n+studyLetters(x),0),percentage));
}
assert.ok(coreAnchors('Kant e Bobbio studiano tre teorie.').includes('Kant'));
assert.ok(coreAnchors('Kant e Bobbio studiano tre teorie.').includes('Bobbio'));
const failed=inspectProgressiveEdition('Kant e Bobbio studiano teorie giuridiche.',
  'Kant studia il diritto.','50');
assert.ok(failed.issues.some(x=>x.startsWith('essential-anchors-missing')));
assert.ok(failed.issues.some(x=>x.startsWith('exact-letters-target')));
const tooLong=inspectProgressiveEdition('la teoria riguarda tutte le norme della giustizia.',
  'la teoria riguarda tutte le norme della giustizia.','summary');
assert.ok(!tooLong.verified);
const page=actualMirrorPageStatistics({pages:[{physicalPage:4,text:'Kant e Bobbio spiegano il diritto.'}]},null,
  [{kind:'text',sourcePage:4,blocks:[{kind:'paragraph',text:'Kant e Bobbio.'}]}],4);
assert.ok(page.measured&&page.originalWords>page.resultWords&&page.achievedPercent>0,
  'Page statistics must count visible words, never 0 to 0');

const oldFetch=globalThis.fetch,oldKey=process.env.AI_API_KEY,oldUrl=process.env.AI_API_URL,oldModel=process.env.AI_MODEL;
process.env.AI_API_KEY='test-only';
process.env.AI_API_URL='https://provider.invalid/mock';
process.env.AI_MODEL='test-only';
let prompt='';
const respond=(res)=>({method:'POST',body:res});
function recorder(){return {code:200,payload:null,setHeader(){return this},status(n){this.code=n;return this},json(x){this.payload=x;return this}};}
try {
  globalThis.fetch=async(_url,options)=>{
    const args=JSON.parse(options.body);prompt=args.messages[0].content;
    return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({edition:'la teoria.'})}}]}),{status:200});
  };
  const response=recorder();
  await handler(respond({source:'la teoria è una disciplina del diritto.',level:'50',policy:STUDY_PILLAR_VERSION,
    targetLetters:12,context:{chapterTitle:'Diritto'}}),response);
  assert.equal(response.code,200);
  assert.match(prompt,/VINCOLO MATEMATICO OBBLIGATORIO/);
  assert.match(prompt,/ESATTAMENTE 12 lettere/);
  assert.match(prompt,/STESSI concetti portanti/);
  assert.equal(response.payload.policyVersion,STUDY_PILLAR_VERSION);

  // LAB68 compatibility: the old LAB38 fixture has an intentionally
  // NON-SHA256 fingerprint. Under the current LAB66+ source gate it must
  // fail closed without calling Gemini. Pure exact-letter helpers above
  // continue to be checked against their original immutable contract.
  const text='la teoria studia norme e relazioni. '.repeat(8);
  const book={studyPillarV38:STUDY_PILLAR_VERSION,
    canonicalBookMap:{originalFingerprint:'lab38-pillar-test-unique',
      pageCount:1,pages:[{physicalPage:1,sourceStatus:'verified'}],uncertain:[]},
    chapters:[{title:'Prova Studio',pageStart:1,pageEnd:1,
      paragraphs:[{original:text,sourcePageStart:1,sourcePageEnd:1}]}]};
  let calls=0;
  globalThis.fetch=async()=>{calls++;throw Error('invalid source must not call Gemini');};
  const result=await generateGeminiEditionsV36(book,{paceMs:0,maxConcurrency:1});
  assert.equal(calls,0,'Invalid original fingerprint must not reach Gemini');
  assert.equal(result.complete,false,'Do not invent completed editions');
  console.log('LAB38 permanent pillar PASS: exact budget helpers, secure source refusal, legacy backend prompt, truthful page statistics');
}finally{
  globalThis.fetch=oldFetch;
  for(const [name,val] of [['AI_API_KEY',oldKey],['AI_API_URL',oldUrl],['AI_MODEL',oldModel]]){
    if(val===undefined)delete process.env[name];else process.env[name]=val;
  }
  await clearGeminiPause();
}
