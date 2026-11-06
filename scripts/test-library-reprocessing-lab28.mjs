import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { hasReprocessSource, reprocessStoredBook } from '../src/lib/libraryReprocess.js';

const originalFile = new Blob(['ORIGINALE COMPLETO E INALTERATO'],{type:'text/plain'});
const sourceData = {chapters:[{title:'Diritto',paragraphs:['La norma disciplina il comportamento.','Il requisito è obbligatorio.']}]};
const oldVersion = {level:'studio',chapters:[{title:'Diritto',paragraphs:[{original:'La norma disciplina il comportamento.',summary:'Versione precedente.'}]}]};
const oldRecord = {
  id:'book-17',profileId:'default',fileName:'Diritto.pdf',sourceData,studyBook:oldVersion,
  originalFile,coverCustom:'data:image/png;base64,TEST',coverOrigin:'custom',
  subject:'Giurisprudenza',favorite:true,collections:['Esame'],readingProgress:{chapter:4,percent:32},dsaMode:false,
};
const copy=JSON.stringify({...oldRecord,originalFile:null});
const nextVersion = {level:'studio',chapters:[{title:'Diritto',paragraphs:[
  {original:sourceData.chapters[0].paragraphs[0],summary:'Versione migliore.'},
  {original:sourceData.chapters[0].paragraphs[1],summary:'Il requisito è obbligatorio.'},
]}]};
let calls=0,saves=0,seen=null;
const result=await reprocessStoredBook('book-17',{
 loadBook: async (id)=>{calls++;assert.equal(id,'book-17');return oldRecord;},
 build: async (source, options)=>{
   assert.equal(source,sourceData,'Il motore usa solo il testo originale salvato');
   assert.equal(options.forceFresh,true,'Non deve riutilizzare i vecchi checkpoint MotorLab');
   assert.equal(options.level,'studio');
   return nextVersion;
 },
 audit:()=>({passed:true,issues:[],issueCount:0}),
 saveBook:async input=>{
   saves++;seen=input;
   return {...oldRecord,...input};
 },
});
assert.equal(calls,1);
assert.equal(saves,1,'Una sola scrittura dopo il successo');
assert.equal(result.studyBook.chapters[0].paragraphs[0].summary,'Versione migliore.');
assert.equal(result.studyBook.quality.sourceIntegrity.passed,true);
assert.equal(seen.id,oldRecord.id,'Mantieni lo stesso record');
assert.equal(seen.fileName,oldRecord.fileName);
assert.equal(seen.originalFile,originalFile,'Non modificare il file originale');
assert.equal(await seen.originalFile.text(),await originalFile.text());
assert.equal(seen.sourceData,sourceData);
assert.equal(seen.favorite,true);assert.deepEqual(seen.collections,['Esame']);
assert.deepEqual(seen.readingProgress,oldRecord.readingProgress);
assert.equal(seen.dsaMode,false);
assert.equal(JSON.stringify({...oldRecord,originalFile:null}),copy,'Vecchio record non modificato in memoria');

// On ANY failure the prior book has not been overwritten, deleted or re-created.
for (const bad of [
 {name:'motore',build:async()=>{throw new Error('Motore bloccato');},audit:()=>({passed:true,issues:[]})},
 {name:'ricostruzione',build:async()=>nextVersion,audit:()=>({passed:false,issues:[{type:'chapter-count'}]})},
 {name:'nessun capitolo',build:async()=>({chapters:[]}),audit:()=>({passed:true,issues:[]})},
]) {
 let writes=0;
 await assert.rejects(reprocessStoredBook('book-17',{
   loadBook:async()=>oldRecord,build:bad.build,audit:bad.audit,saveBook:async()=>{writes++;},
 }),undefined,bad.name);
 assert.equal(writes,0,'Fallimento: vecchia versione non toccata '+bad.name);
}
let writeNoSource=0;
await assert.rejects(reprocessStoredBook('missing-source',{
 loadBook:async()=>({...oldRecord,sourceData:null}),
 saveBook:async()=>{writeNoSource++;},
}),/origine/i);
assert.equal(writeNoSource,0);
assert.equal(hasReprocessSource(oldRecord),true);
assert.equal(hasReprocessSource({...oldRecord,sourceData:null}),false);

const app=readFileSync(new URL('../src/AppV15.jsx',import.meta.url),'utf8');
const screens=readFileSync(new URL('../src/components/AppScreens.jsx',import.meta.url),'utf8');
const engine=readFileSync(new URL('../src/lib/studyEngineV09.js',import.meta.url),'utf8');
assert.ok(app.includes('onReprocessBook={reprocessLibraryItem}'));
assert.ok(app.includes('async function reprocessLibraryItem(id)'));
assert.ok(screens.includes('Rielabora libro') && screens.includes('Conferma rielaborazione'));
assert.ok(screens.includes('reprocessCandidate') && screens.includes('Sì, rielabora'));
assert.ok(screens.includes('onBookActions={item => { setActionCandidate(item)'));
assert.ok(engine.includes('forceFresh && previous?.published'),
  'LAB34 must ignore previously published reprocess runs but resume unfinished ones');
assert.ok(engine.includes('forceFresh ? new Map() : await loadRuntimeUnitResults('));
console.log('LAB28: reprocessing fresh, atomic, protected original, single write, dialog and error rollback: PASS');
