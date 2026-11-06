import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {generateGeminiEditionsV36} from '../src/lib/generativeEditionsV36.js';
import {progressDiagnostic} from '../src/lib/geminiRecoveryV39.js';
import {STUDY_PILLAR_VERSION,studyLetters} from '../src/lib/studyPillarV38.js';
import {clearGeminiPause} from '../src/lib/geminiQuotaControllerV36.js';
import handler from '../api/editionsV36.js';

const source='la teoria studia norme e relazioni. '.repeat(8);
const book={studyPillarV38:STUDY_PILLAR_VERSION,
  canonicalBookMap:{originalFingerprint:'lab39-unique-quality-test',uncertain:[],pages:[{physicalPage:1,sourceStatus:'verified'}]},
  chapters:[{title:'Diritto',paragraphs:[{original:source,sourcePageStart:1,sourcePageEnd:1}]}]};
let calls=[],strategy='invalid';
const oldFetch=globalThis.fetch;
function exemplar(letters){
 const head='la teoria studia norme e relazioni. ';
 let answer=head;
 while(studyLetters(answer)+studyLetters(head)<letters-5)answer+=head;
 return answer+' '+('a'.repeat(Math.max(0,letters-studyLetters(answer))))+'.';
}
await clearGeminiPause();
try{
 globalThis.fetch=async(_url,options)=>{
   const req=JSON.parse(options.body);
   calls.push(req);
   const output=strategy==='invalid'?'la.':exemplar(req.level==='summary'?req.summaryCapLetters-8:req.targetLetters);
   return new Response(JSON.stringify({engine:'ai',sourceVersion:'original',editions:{[req.level]:output}}),{status:200});
 };
 const blocked=await generateGeminiEditionsV36(book,{paceMs:0});
 assert.equal(blocked.status,'quality-review','Must identify a failed strict compression, not silently cycle');
 assert.equal(blocked.execution.haltedOn,'AI_QUALITY_REVIEW');
 assert.equal(calls.length,2,'At most 2 Gemini calls for a failing edition, not twelve');
 assert.equal(calls[1].repairDraft,'la.','Second call must repair the previous draft');
 assert.equal(blocked.diagnostics.quality.level,'summary',
   'The first blocked level is the initial summary in the progressive study order');
 assert.ok(blocked.diagnostics.quality.reasons.some(x=>
   x.includes('coverage')||x.includes('essential')||x.includes('summary')),
   'A summary rejected for missing concepts must expose the actual quality reason');
 assert.equal(progressDiagnostic(blocked).kind,'QUALITA');
 assert.match(progressDiagnostic(blocked).description,/non supera i vincoli/);
 assert.equal(blocked.verifiedChunkVariants,0,'Invalid draft must never count as verified');
 strategy='valid';
 const before=calls.length;
 const restored=await generateGeminiEditionsV36(book,{paceMs:0});
 assert.equal(restored.complete,true,JSON.stringify(restored.diagnostics));
 assert.equal(calls.length-before,6,'Manual resume must reuse the stored invalid draft and only call pending editions');
 assert.equal(calls[before].repairDraft,'la.','Resume must use saved repair candidate');
 const reused=await generateGeminiEditionsV36(book,{paceMs:0});
 assert.equal(reused.complete,true);
 assert.equal(calls.length-before,6,'Cached verified editions must require no additional request');
 const app=readFileSync(new URL('../src/AppV15.jsx',import.meta.url),'utf8');
 const home=readFileSync(new URL('../src/components/HomeDashboardV16.jsx',import.meta.url),'utf8');
 const studio=readFileSync(new URL('../src/components/AppScreens.jsx',import.meta.url),'utf8');
 assert.match(app,/void resumeGeminiEditions\(record\)\.catch/,'Home read must not stay busy for complete Gemini run');
 assert.match(app,/progressDiagnostic\(snapshot\)/);
 assert.match(home,/resumeCandidate\.diagnostic\.description/);
 assert.match(studio,/Diagnosi elaborazione/);
 let prompt='';
 process.env.AI_API_KEY='test-only';process.env.AI_API_URL='https://mock.invalid';
 globalThis.fetch=async(_url,options)=>{
  const data=JSON.parse(options.body);prompt=data.messages[0].content;
  return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({edition:'testo corretto.'})}}]}),{status:200});
 };
 const res={code:0,setHeader(){return this;},status(x){this.code=x;return this},json(x){this.body=x;return this}};
 await handler({method:'POST',body:{source,level:'50',policy:STUDY_PILLAR_VERSION,targetLetters:90,
   repairDraft:'la teoria contiene norme',repairIssues:['exact-letters-target:90;actual:21;delta:-69']}},res);
 assert.equal(res.code,200);
 assert.match(prompt,/MODIFICA QUESTA BOZZA GIÀ GENERATA/);
 assert.match(prompt,/la teoria contiene norme/);
 console.log('LAB39: 2-call quality stop, real reason, persisted repair draft, successful resume, zero duplicated verified calls, UI diagnostics, targeted Gemini prompt PASS');
}finally{
 globalThis.fetch=oldFetch;
 delete process.env.AI_API_KEY;delete process.env.AI_API_URL;
 await clearGeminiPause();
}
