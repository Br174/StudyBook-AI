import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import 'fake-indexeddb/auto';
import {
  loadResumeState, loadStudyParagraphs, saveResumeState, saveStudyParagraphs,
  markResumeStatePublished,
} from '../src/lib/resumeStore.js';
import { auditSourceAgainstOriginal, compareAcquisitions } from '../src/lib/sourceShieldV34.js';
import { buildStudyBook } from '../src/lib/studyEngineV09.js';
import { reacquireFromSavedPdf } from '../src/lib/sourceRecoveryV34.js';

const suffix='source34:test:'+Date.now();
assert.equal(await saveResumeState(suffix,{
  version:5,signature:suffix,generation:'g1',complete:false,results:[],total:3,
}),true);
const completed={original:'Testo iniziale',summary:'Testo completo',dsaSummary:'Testo completo',engine:'locale'};
assert.equal(await saveStudyParagraphs(suffix,'g1',[
  {index:0,result:completed},
  {index:1,pieces:[{chunkIndex:0,summary:'Prima parte.',dsaSummary:'Prima parte.',engine:'locale'}]},
]),true);
assert.equal((await loadStudyParagraphs(suffix,'g1')).get(0).result.summary,'Testo completo');
assert.equal((await loadStudyParagraphs(suffix,'g1')).get(1).pieces.length,1);
assert.equal(await markResumeStatePublished(suffix),false,'incomplete job must not be published');
assert.equal((await loadResumeState(suffix)).complete,false);
assert.equal(await saveResumeState(suffix,{
  version:5,signature:suffix,generation:'g1',complete:true,results:[],total:3,
}),true);
assert.equal(await markResumeStatePublished(suffix),true);
assert.equal((await loadResumeState(suffix)).published,true);

const sampleChapters=[{title:'Diritto',paragraphs:[
  'La legge definisce un principio generale e tutela gli interessi legittimi degli studenti.',
  'L’interpretazione giuridica stabilisce le condizioni necessarie per una valida decisione.',
  'La disposizione comprende una descrizione delle fonti e delle conseguenze giuridiche.',
  'Salvo le eccezioni previste dalla legge, la norma conserva la propria efficacia.',
  'Il diritto naturale distingue principi generali e regole particolari.',
  'La competenza dipende dai limiti e dalle disposizioni dell’ordinamento.',
  'La legge stabilisce una procedura e disciplina le conseguenze per il destinatario.',
  'La norma contiene definizioni che non possono essere tagliate arbitrariamente.',
]}];
const source={sourceFormat:'pdf',originalFingerprint:'a'.repeat(64),
  fullText:sampleChapters[0].paragraphs.join('\n\n'),chapters:sampleChapters};
let crashedAt=null;
await assert.rejects(buildStudyBook(source,{
  level:'studio',preferAi:false,maxConcurrency:1,forceFresh:true,
  onCheckpoint:async cp=>{
    if(crashedAt===null){crashedAt=cp;throw new Error('simulated process death');}
  },
}),/simulated process death/);
assert.ok(crashedAt?.completed>=1,'At least one batch is persisted before test crash');
assert.ok((await loadStudyParagraphs(crashedAt.signature,crashedAt.generation)).size>=1);
const resumed=await buildStudyBook(source,{
  level:'studio',preferAi:false,maxConcurrency:1,forceFresh:true,
});
assert.equal(resumed.chapters.length,1);
assert.equal(resumed.chapters[0].paragraphs.length,8);
assert.ok(resumed.quality.resumedParagraphs>=1,'Resume must reuse already persisted paragraphs despite forceFresh');
assert.equal(resumed.quality.resumeRecoveredFromCrash,true);
assert.equal((await loadResumeState(resumed.resumeSignature)).complete,true);
assert.equal((await loadResumeState(resumed.resumeSignature)).published,false,
  'Before library commit the job remains resumable');
assert.equal(await markResumeStatePublished(resumed.resumeSignature),true);
const state=await loadResumeState(resumed.resumeSignature);
assert.equal(state.published,true);
assert.equal((await loadStudyParagraphs(resumed.resumeSignature,state.generation)).size,8);
const fresh=await buildStudyBook(source,{level:'studio',preferAi:false,maxConcurrency:1,forceFresh:true});
assert.equal(fresh.quality.resumeRecoveredFromCrash,false,
  'A NEW explicit reprocess after publication must start fresh instead of replaying prior publication');

const all=Array.from({length:1000},(_,index)=>({
  pageNumber:index+1,status:'verified',source:'embedded',
  text:'La pagina '+(index+1)+' contiene il testo integrale della disciplina con periodi completi.',
}));
const shield=auditSourceAgainstOriginal({
  pages:all,pdfPageCount:1000,fingerprint:'f'.repeat(64),
});
assert.equal(shield.pdfPageCount,1000);
assert.equal(shield.extractedPageCount,1000);
assert.equal(shield.bytesVerified,true);
assert.equal(shield.semanticCertified,false);
const damaged=all.map((p,i)=>i===499?{...p,text:'Il capitolo mediante'}:p);
const sourceAudit=auditSourceAgainstOriginal({
  pages:damaged,pdfPageCount:1000,fingerprint:'f'.repeat(64),
});
assert.ok(sourceAudit.reviewPages.includes(500),'Suspect page must not be silently called fully faithful');

const oldRecord={
  id:'book-34',fileName:'Filosofia.pdf',
  originalFile:new Blob(['PDF original mock'],{type:'application/pdf'}),
  sourceData:{pages:all.slice(0,3),integrity360:{verifiedPages:3}},
  studyBook:{level:'studio',chapters:[{title:'Diritto',paragraphs:[{original:'a',summary:'b'}]}]},
  favorite:true,collections:['Studio'],
};
const newData={
  pages:all.slice(0,3),chapters:[{title:'Diritto',paragraphs:['La legge prevede la disciplina.']}],
  integrity360:{ready:true,verifiedPages:3,issues:[]},
  originalFingerprint:'b'.repeat(64),sourceShield:shield,
};
const priorSnapshot=JSON.stringify({...oldRecord,originalFile:null});
let writes=0,readCount=0;
const result=await reacquireFromSavedPdf('book-34',{
  loadBook:async()=>oldRecord,
  read:async(_,opts)=>{readCount++;assert.equal(opts.autoOcr,false);assert.equal(opts.textOnly,true);return newData;},
  build:async()=>({resumeSignature:null,chapters:[{title:'Diritto',paragraphs:[{original:'La legge prevede la disciplina.',summary:'La legge prevede la disciplina.'}]}]}),
  audit:()=>({passed:true,issues:[]}),
  saveBook:async input=>{writes++;return {...oldRecord,...input};},
});
assert.equal(writes,1);assert.equal(readCount,1);
assert.equal(result.record.originalFile,oldRecord.originalFile);
assert.equal(result.record.favorite,true);
assert.equal(JSON.stringify({...oldRecord,originalFile:null}),priorSnapshot);
const truncated={...newData,pages:newData.pages.map((p,i)=>i===1?{...p,text:'testo'}:p)};
await assert.rejects(reacquireFromSavedPdf('book-34',{
  loadBook:async()=>oldRecord,read:async()=>truncated,
  saveBook:async()=>{writes++;},
}),/pagine più corte/i);
assert.equal(writes,1,'Never overwrite previous book with a degraded PDF extraction');

const engine=readFileSync(new URL('../src/lib/studyEngineV09.js',import.meta.url),'utf8');
assert.ok(engine.includes('saveStudyParagraphs(signature,generation,deltas)'));
assert.ok(engine.includes('AbortController()'));
const app=readFileSync(new URL('../src/AppV15.jsx',import.meta.url),'utf8');
assert.ok(app.includes('recoverSourceFromLibrary'));
assert.ok(app.includes('Ripresa dal checkpoint'));
const ui=readFileSync(new URL('../src/components/AppScreens.jsx',import.meta.url),'utf8');
assert.ok(ui.includes('Riesamina dal PDF originale'));
assert.ok(ui.includes('Riprendi acquisizione PDF'));

console.log('LAB34_SOURCE_SHIELD_AND_CRASH_RESUME_PASS',JSON.stringify({
  resumedParagraphs:resumed.quality.resumedParagraphs,
  storedAfterCrash:crashedAt.completed,
  recoveredPages:shield.extractedPageCount,
  suspectPage:500,originalProtected:true,
}));
