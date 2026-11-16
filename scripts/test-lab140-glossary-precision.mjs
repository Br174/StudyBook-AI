#!/usr/bin/env node
// LAB140 offline regression: glossary, sidebar anchoring and target calibration.
// No live Gemini, no paid services, no additional AI call.
import assert from 'node:assert/strict';
import {glossaryTermMentionedV140,nextLengthTargetScaleV140,
 targetScaleV140,applyTargetScaleV140} from '../src/lib/explainedQualityV140.js';
import {lessonInstructionOnePassV139,lessonInstructionOnePassV140,
 lessonPayloadOnePassV140,studyUnitsV126,EXPLAINED_POLICY_V126}
 from '../src/lib/explainedStagesV126.js';
import explainedV140Handler from '../api/explainedV140.js';
import explainedV139Handler from '../api/explainedV139.js';
import {composeExplainedSheetsV122} from '../src/lib/explainedLayoutV122.js';
import {glossaryForExplainedPageV129} from '../src/lib/explainedMobileLayoutV129.js';
import glossaryV140Handler from '../api/glossaryV140.js';
import 'fake-indexeddb/auto';
import {glossaryCacheKeyV140,readLegacyGlossaryV140,
 saveLegacyGlossaryV140,requestLegacyGlossaryV140}
 from '../src/lib/legacyGlossaryV140.js';
import {readFileSync} from 'node:fs';
import {generateExplainedBookV126} from '../src/lib/explainedGeneratorV126.js';

assert.equal(glossaryTermMentionedV140(
 'La norma giuridica stabilisce obblighi.','norma giuridica'),true);
assert.equal(glossaryTermMentionedV140(
 'Si parla di **(norma giuridica)** nel testo.','norma giuridica'),true);
assert.equal(glossaryTermMentionedV140('L’obbligazione nasce.','obbligazione'),true);
assert.equal(glossaryTermMentionedV140('La transazione è conclusa.','azione'),false,
 'Never attach a glossary definition to a substring of a different word');
assert.equal(glossaryTermMentionedV140('Diritto e diritto.','diritto'),true);
assert.equal(glossaryTermMentionedV140('Il giudice applica la norma.','re[g]ola'),false);
assert.ok(lessonInstructionOnePassV139().includes('Lascia glossary vuoto'));
assert.ok(!lessonInstructionOnePassV140().includes('Lascia glossary vuoto'));
assert.ok(lessonInstructionOnePassV140().includes('NELLA STESSA RISPOSTA'));
assert.ok(!lessonInstructionOnePassV140().includes('40–60'),
 'Private acceptance tolerance must not be shown to Gemini');
const text='La norma giuridica stabilisce obblighi e tutela i diritti. '.repeat(24);
const explanation='La norma giuridica stabilisce obblighi e tutela i diritti. '.repeat(12);
const envelope={id:'p1',sourceLineCount:6,
 segments:[{id:'p1-s0',source:text}]};
const p1=lessonPayloadOnePassV140([envelope],[],1).pages[0];
assert.ok(Math.abs(p1.targetBodyUnits-studyUnitsV126(text)/2)<=1);
const scaled=lessonPayloadOnePassV140([envelope],[],1.1).pages[0];
assert.ok(scaled.targetBodyUnits>p1.targetBodyUnits);
assert.ok(scaled.segments[0].targetSegmentUnits>p1.segments[0].targetSegmentUnits);
assert.equal(targetScaleV140(999),1.12);
assert.equal(targetScaleV140(-100),0.88);
assert.equal(targetScaleV140(null),1,'Missing scale must remain the exact neutral target');
assert.equal(nextLengthTargetScaleV140(1,[{
 ready:true,shortPage:false,sourceUnits:1000,outputUnits:400
 }])>1,true,'Model too short: request slightly more next time');
assert.equal(nextLengthTargetScaleV140(1,[{
 ready:true,shortPage:false,sourceUnits:1000,outputUnits:600
 }])<1,true,'Model too long: request slightly less next time');
assert.equal(nextLengthTargetScaleV140(1,[]),1);
assert.equal(nextLengthTargetScaleV140(1,[{
 ready:false,sourceUnits:1000,outputUnits:100
 }]),1,'Do not learn from rejected or truncated responses');
assert.equal(applyTargetScaleV140({pages:[{
 targetBodyUnits:100,segments:[{targetSegmentUnits:50}]
 }]},1.12).pages[0].targetBodyUnits,112);

const fakeRes=()=>({statusCode:200,headers:{},data:null,
 setHeader(name,value){this.headers[name]=value;return this},
 status(code){this.statusCode=code;return this},
 json(data){this.data=data;return data}});
const oldFetch=globalThis.fetch;
try{
 const head=fakeRes();
 await explainedV140Handler({method:'HEAD',env:{}},head);
 assert.equal(head.statusCode,405);
 assert.equal(head.headers['X-StudyBook-Glossary-Contract'],
  'lab140-glossary-one-pass-precision-v1');
 const legacy=fakeRes();
 await explainedV139Handler({method:'HEAD',env:{}},legacy);
 assert.ok(!('X-StudyBook-Glossary-Contract' in legacy.headers));
 const sent=[];
 const glossary=[
  {term:'norma giuridica',definition:'Regola che stabilisce obblighi e tutela diritti secondo il contenuto della pagina.'},
  {term:'obblighi',definition:'Comportamenti che la regola richiede di rispettare nel contesto descritto.'}];
 globalThis.fetch=async(_url,options)=>{
  sent.push(JSON.parse(options.body));
  return {ok:true,status:200,headers:{get:()=>null},
   json:async()=>({choices:[{finish_reason:'stop',message:{
    content:JSON.stringify({pages:[{id:'p1',
     segments:[{id:'p1-s0',text:explanation}],glossary}]})}}]})};
 };
 const request={method:'POST',env:{AI_API_KEY:'OFFLINE_TEST_ONLY'},
  body:{policy:EXPLAINED_POLICY_V126,phase:'explain',
   onePassV135:true,pages:[envelope],bookContext:[],
   targetScaleV140:1.06,modelCandidate:'gemini-3.1-flash-lite'}};
 const out=fakeRes();await explainedV140Handler(request,out);
 assert.equal(out.statusCode,200);
 assert.equal(out.data.focusedGlossaryV140,true);
 assert.equal(out.data.fastLengthV139,true);
 assert.equal(out.data.validated,1);
 assert.equal(out.data.pages[0].glossary.length,2);
 assert.equal(sent.length,1,'Glossary must arrive in SAME Gemini call');
 assert.ok(sent[0].messages[0].content.includes('NELLA STESSA RISPOSTA'));
 const userPayload=JSON.parse(sent[0].messages[1].content);
 assert.ok(userPayload.pages[0].targetBodyUnits>p1.targetBodyUnits);
 assert.ok(!sent[0].messages[0].content.includes('40–60'));

 const sourceBook={canonicalBookMap:{originalFingerprint:'a'.repeat(64),
  pageCount:1,chapters:[],pages:[{physicalPage:1,label:'1',
   text,sourceStatus:'verified',widthPt:595,heightPt:842}]},
  editionsV36:{version:EXPLAINED_POLICY_V126,
   sourceFingerprint:'a'.repeat(64),lengthOnlyV139:true,
   glossaryPrecisionV140:true,complete:true,
   pages:[{id:'p1',segments:[{id:'p1-s0',text:explanation}],
    glossary,review:{ready:true}}]}};
 // The renderer must populate sidebar even if markers were NOT added.
 const sheets=composeExplainedSheetsV122(sourceBook,{requireComplete:true});
 const sidebar=sheets.pages.flatMap(p=>glossaryForExplainedPageV129(p.rows));
 assert.ok(sidebar.some(n=>n.term==='norma giuridica'));
 assert.ok(sidebar.some(n=>n.term==='obblighi'));
 assert.equal(new Set(sidebar.map(n=>n.term)).size,sidebar.length,
  'Each definition appears once per page');

 // Existing v139 response contract remains isolated.
 const old=fakeRes();await explainedV139Handler(request,old);
 assert.equal(old.statusCode,200);
 assert.equal(old.data.focusedGlossaryV140,false);
 assert.ok(sent[1].messages[0].content.includes('Lascia glossary vuoto'));

 // Previous LAB139 pages legitimately lack glossary. The optional button
 // calls one small Gemini endpoint only on a direct user action.
 const manualHead=fakeRes();
 await glossaryV140Handler({method:'HEAD',env:{}},manualHead);
 assert.equal(manualHead.statusCode,405);
 assert.equal(manualHead.headers['X-StudyBook-Glossary-Manual-Contract'],
  'lab140-glossary-manual-optional-v1');
 let manualCalls=0;
 globalThis.fetch=async(_url,options)=>{
  manualCalls++;
  assert.equal(JSON.parse(options.body).model,'gemini-3.1-flash-lite');
  return {ok:true,status:200,headers:{get:()=>null},
   json:async()=>({choices:[{finish_reason:'stop',message:{
    content:JSON.stringify({glossary:[
     ...glossary,{term:'inesistente',definition:'Termine non presente nel corpo.'}
    ]})}}]})};
 };
 const manualRes=fakeRes();
 await glossaryV140Handler({
  method:'POST',env:{AI_API_KEY:'OFFLINE_TEST_ONLY'},
  body:{originalText:text,explainedText:explanation}
 },manualRes);
 assert.equal(manualRes.statusCode,200);
 assert.equal(manualRes.data.glossary.length,2);
 assert.equal(manualCalls,1);
 // A 503 in the optional glossary route must not spin or change the book.
 let failedCalls=0;
 globalThis.fetch=async()=>{failedCalls++;
  return {ok:false,status:503,headers:{get:()=>null}};};
 const unavailable=fakeRes();
 await glossaryV140Handler({method:'POST',env:{AI_API_KEY:'OFFLINE_TEST_ONLY'},
  body:{originalText:text,explainedText:explanation}},unavailable);
 assert.equal(unavailable.statusCode,503);
 assert.equal(failedCalls,1,'No automatic follow-up after an optional 503');
 const key=glossaryCacheKeyV140('book-140','a'.repeat(64),1,explanation);
 await saveLegacyGlossaryV140(key,manualRes.data.glossary);
 assert.equal((await readLegacyGlossaryV140(key)).glossary.length,2);
 assert.notEqual(key,glossaryCacheKeyV140('book-140','a'.repeat(64),1,
  explanation+' cambiato'),'Edited text must never use a stale glossary');
 let demandCalls=0;
 globalThis.fetch=async(_url,options)=>{
  demandCalls++;
  return {ok:true,status:200,json:async()=>({glossary})};
 };
 const requested=await requestLegacyGlossaryV140({
  originalText:text,explainedText:explanation});
 assert.equal(requested.length,2);
 assert.equal(demandCalls,1);
 const component=readFileSync('src/components/ExplainedReaderV122.jsx','utf8');
 assert.ok(component.includes('onClick={()=>void defineLegacyTerms()}'));
 assert.ok(component.includes('readLegacyGlossaryV140(glossaryKey)'));
 assert.ok(component.includes('requestLegacyGlossaryV140({'));
 const app=readFileSync('src/AppV15.jsx','utf8');
 assert.ok(app.includes('glossaryPrecisionV140:true'),
  'New Android app must select the V140 contract');
 assert.ok(!component.includes('useEffect(()=>void defineLegacyTerms()'),
  'No automatic Gemini glossary calls while importing or reading');

 // The model tends to oversimplify? Learn from the first successful packet,
 // then adjust the TARGET of the NEXT packet without repeating ANY page.
 const paragraph='La norma giuridica stabilisce obblighi e tutela i diritti. ';
 const sourcePage=Array.from({length:6},()=>paragraph.repeat(6)).join('\n');
 const sourceMap={originalFingerprint:'b'.repeat(64),pageCount:44,chapters:[],
  pages:Array.from({length:44},(_,i)=>({
   physicalPage:i+1,label:String(i+1),text:sourcePage,
   sourceStatus:'verified',widthPt:595,heightPt:842
  }))};
 const book44={canonicalBookMap:sourceMap,chapters:[],
  editionsV36:{version:EXPLAINED_POLICY_V126,
   sourceFingerprint:sourceMap.originalFingerprint,onePassV135:true,
   originalPages:44,pages:[],complete:false,status:'partial'}};
 const batchCalls=[];
 globalThis.fetch=async(url,options)=>{
  assert.ok(String(url).endsWith('/api/explained/v140'));
  const req=JSON.parse(options.body);
  batchCalls.push(req);
  return {ok:true,status:200,headers:{get:()=>null},
   json:async()=>({engine:'ai',
    repairContractV127:'lab127-automatic-recovery-v1',
    version:EXPLAINED_POLICY_V126,phase:'explain',
    model:'gemini-3.1-flash-lite',
    pages:req.pages.map(p=>({id:p.id,glossary:[glossary[0]],
     segments:p.segments.map(seg=>({
      id:seg.id,text:paragraph.repeat(15)
     }))}))})};
 };
 const complete44=await generateExplainedBookV126(book44,{
  fastLengthV139:true,glossaryPrecisionV140:true});
 assert.ok(batchCalls.length>=2,'The 44-page test must exercise multiple batches');
 assert.ok(batchCalls[1].targetScaleV140>batchCalls[0].targetScaleV140,
  'After 58% compression, request a slightly longer body in next batch');
 assert.equal(complete44.verifiedChunkVariants,44);
 assert.equal(complete44.lengthOnlyV139,true);
 assert.equal(complete44.glossaryPrecisionV140,true);
 assert.ok(complete44.lengthTargetScaleV140>1);
 assert.ok(complete44.precisionV140.pagesMeasured>=44);
 assert.ok(complete44.pages.every(p=>p.glossary?.length===1));
 assert.ok(batchCalls.reduce((n,r)=>n+r.pages.length,0)===44,
  'Every page must be sent once; no glossary retry or duplicate summary call');
 console.log('LAB140 PASS: fast sidebar definitions, one Gemini call, adaptive targets,');
 console.log('legacy v139 isolation and PDF-visible glossary.');
}finally{globalThis.fetch=oldFetch;}
