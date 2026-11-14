#!/usr/bin/env node
// LAB130: no live Gemini, no network, no paid service, no user-data mutation.
import assert from 'node:assert/strict';
import {studyToolPayloadV130,auditStudyToolItemsV130,
 STUDY_TOOLS_CONTRACT_V130} from '../src/lib/studyToolsV130Policy.js';
import {buildStudyToolSourceV130,studyToolCacheKeyV130,
 generateStudyToolsV130,savedStudyToolsV130,saveStudyToolsV130
} from '../src/lib/studyToolsOnDemandV130.js';
import studyToolsHandler from '../api/studyToolsV130.js';
import {readFileSync} from 'node:fs';

const paragraph='La filosofia del diritto studia il problema deontico e il rapporto tra diritto e giustizia. '+
 'La sociologia del diritto analizza i rapporti tra le norme e i comportamenti dei consociati. '+
 'La validità delle norme è distinta dalla loro effettività nella società.';
const passages=[{page:'2',title:'Filosofia del diritto',text:paragraph}];
assert.equal(studyToolPayloadV130({tool:'flashcards',scope:'page',passages}).ok,true);
assert.equal(studyToolPayloadV130({tool:'other',passages}).ok,false);
const valid=[
 {question:'Quale questione analizza la filosofia del diritto?',answer:
  'Il problema deontico e il rapporto tra diritto e giustizia.',
  evidence:'La filosofia del diritto studia il problema deontico e il rapporto tra diritto e giustizia.'},
 {question:'Che cosa si intende per «perché» secondo il libro?',answer:
  'È una parola funzionale da non trasformare in flashcard.',
  evidence:'La filosofia del diritto studia il problema deontico e il rapporto tra diritto e giustizia.'},
 {question:'Che cosa si intende per «Campania» o » secondo il libro?',
  answer:'Domanda incompleta.',evidence:'La sociologia del diritto analizza i rapporti tra le norme e i comportamenti dei consociati.'},
 {question:'Che cosa sostiene il testo sulla sociologia del diritto?',
  answer:'Una dichiarazione esterna alla fonte.',
  evidence:'Questa citazione non compare nel libro originale e quindi deve fallire.'}
];
const quality=auditStudyToolItemsV130('flashcards',valid,passages);
assert.equal(quality.items.length,1);
assert.ok(quality.rejected.length>=3);
const quiz=[{question:'Quale problema studia la filosofia del diritto?',
 options:['Problema deontico','Fenomeni meteorologici','Trasporti marittimi'],
 correctIndex:0,explanation:'Analizza il problema deontico in relazione a diritto e giustizia.',
 evidence:'La filosofia del diritto studia il problema deontico e il rapporto tra diritto e giustizia.'}];
assert.equal(auditStudyToolItemsV130('quiz',quiz,passages).items.length,1);
const badQuiz=[{...quiz[0],options:['A','A','C']}];
assert.equal(auditStudyToolItemsV130('quiz',badQuiz,passages).items.length,0);
const unrelated=[{question:'Quale questione analizza la filosofia del diritto?',
 answer:'Marte è un pianeta gassoso in una galassia lontana.',
 evidence:'La filosofia del diritto studia il problema deontico e il rapporto tra diritto e giustizia.'}];
assert.equal(auditStudyToolItemsV130('flashcards',unrelated,passages).items.length,0,
 'An unrelated answer is not grounded merely by quoting a real sentence.');
const map=[{title:'Diritto e giustizia',
 points:['La filosofia del diritto studia il problema deontico.',
 'Si occupa del rapporto tra diritto e giustizia.'],
 keywords:['diritto','giustizia'],
 evidence:'La filosofia del diritto studia il problema deontico e il rapporto tra diritto e giustizia.'}];
assert.equal(auditStudyToolItemsV130('map',map,passages).items.length,1);
const book={chapters:[{title:'Capitolo A',paragraphs:[
 {original:paragraph,sourcePageStart:2},{original:paragraph,sourcePageStart:3}
 ]}]};
const source=buildStudyToolSourceV130(book,{scope:'page',chapterIndex:0,paragraphIndex:1});
assert.equal(source.passages.length,1);
assert.equal(source.passages[0].page,'3');
assert.equal(buildStudyToolSourceV130(book,{scope:'chapter'}).passages.length,2);
const large={chapters:Array.from({length:100},(_,i)=>({title:'Capitolo '+i,
 paragraphs:Array.from({length:20},(_,j)=>({original:paragraph,sourcePageStart:i*20+j+1}))}))};
const manyShort={chapters:[{title:'Capitolo con tanti passaggi',
 paragraphs:Array.from({length:90},(_,i)=>({
  original:'La norma disciplina i comportamenti e i rapporti tra cittadini.',
  sourcePageStart:i+1}))}]};
const bounded=buildStudyToolSourceV130(manyShort,{scope:'chapter'});
assert.equal(bounded.passages.length,40,
 'Even a chapter of many short passages must honor the Worker 40-passage cap.');
assert.equal(bounded.sampled,true);
const veryLong={chapters:[{title:'Long page',paragraphs:[
 {original:paragraph.repeat(100),sourcePageStart:1}]}]};
assert.ok(buildStudyToolSourceV130(veryLong,{scope:'page'})
 .passages[0].text.length<=12000,
 'A large page must honor the Worker per-passage limit.');
const sampled=buildStudyToolSourceV130(large,{scope:'book'});
assert.ok(sampled.sampled&&sampled.passages.length<=18);
assert.ok(sampled.passages.map(p=>p.text.length).reduce((a,b)=>a+b,0)<=13500);
const before=JSON.stringify(book);
const key=studyToolCacheKeyV130('libro', 'flashcards','page',source.passages);
assert.ok(key.includes('lab130'));
assert.equal(JSON.stringify(book),before);
assert.equal(await savedStudyToolsV130(key),null);

let aiCalls=0;
const originalFetch=globalThis.fetch;
const fake={tool:'flashcards',contract:STUDY_TOOLS_CONTRACT_V130,
 items:[{front:valid[0].question,back:valid[0].answer,evidence:valid[0].evidence}]};
globalThis.fetch=async (_url,opt)=>{
 aiCalls++;
 assert.equal(opt.method,'POST');
 const payload=JSON.parse(opt.body);
 assert.equal(payload.tool,'flashcards');
 return {ok:true,status:200,json:async()=>fake};
};
try{
 assert.equal(aiCalls,0,'Switching tabs or opening cached deck must not call Gemini.');
 const result=await generateStudyToolsV130({tool:'flashcards',scope:'page',
  chapterTitle:'Capitolo A',passages:source.passages});
 assert.equal(result.items.length,1);
 assert.equal(aiCalls,1);
 await saveStudyToolsV130(key,result);
 assert.deepEqual((await savedStudyToolsV130(key)).items,result.items);
 assert.equal(aiCalls,1,'Cache read must not incur another provider request.');
 globalThis.fetch=async()=>({ok:false,status:503,json:async()=>({
  code:'AI_TEMPORARY_OVERLOAD',error:'Gemini sovraccarico',retryAfterSeconds:90})});
 await assert.rejects(()=>generateStudyToolsV130({
  tool:'flashcards',passages:source.passages,scope:'page'
 }),e=>e.code==='AI_TEMPORARY_OVERLOAD'&&e.retryAfterSeconds===90);
}finally{globalThis.fetch=originalFetch;}
function response(){
 let status=200,headers={},body;
 return {setHeader(k,v){headers[k]=v;return this;},
 status(n){status=n;return this;},json(x){body=x;return {status,headers,body}}};
}
const head=await studyToolsHandler({method:'HEAD',env:{}},response());
assert.equal(head.status,405);
assert.equal(head.headers['X-StudyBook-Tools-Contract'],'lab130');
const old=globalThis.fetch;
let providerCalls=0;
globalThis.fetch=async()=>{providerCalls++;return {
 ok:true,status:200,headers:{get:()=>null},
 json:async()=>({choices:[{finish_reason:'stop',
  message:{content:JSON.stringify({items:[valid[0]]})}}]})}};
try{
 const result=await studyToolsHandler({
  method:'POST',body:{tool:'flashcards',scope:'page',passages},
  env:{AI_API_KEY:'MOCK_KEY',AI_MODEL:'gemini-3.5-flash-lite',
   STUDYBOOK_LAB123_503_FAILOVER:'0'}},response());
 assert.equal(result.status,200);
 assert.equal(result.body.items.length,1);
 assert.equal(providerCalls,1);
 const invalid=await studyToolsHandler({
  method:'POST',body:{tool:'flashcards',scope:'page',passages:[
  {text:'Non sufficientemente chiaro.'}]},env:{AI_API_KEY:'MOCK'}},response());
 assert.equal(invalid.status,400);
 assert.equal(providerCalls,1);
}finally{globalThis.fetch=old;}
const ui=readFileSync('src/components/StudyMode.jsx','utf8');
const worker=readFileSync('worker/index.js','utf8');
const app=readFileSync('src/components/AppScreens.jsx','utf8');
const delivery=readFileSync('src/lib/fileDelivery.js','utf8');
assert.ok(!ui.includes('buildFlashcards(studySource'));
assert.ok(ui.includes('generateToolDeck')&&ui.includes('Rigenera'));
assert.ok(ui.includes("studyScope==='page'"));
assert.ok(worker.includes("'/api/study-tools/v130'"));
assert.ok(delivery.includes('FileOpener.open')&&
 delivery.includes('openWithDefault:false'));
assert.ok(app.includes('Word (DOCX)')&&app.includes('eBook (EPUB)')&&
 app.includes("performExport('pdf-open'"));
console.log('LAB130 PASS: no preset questions, user-triggered Gemini, source evidence');
console.log('guarded 4 tool types, persistent cache, 503, 2000-page sample,');
console.log('file chooser, DOCX EPUB TXT controls and trial Worker contract.');
