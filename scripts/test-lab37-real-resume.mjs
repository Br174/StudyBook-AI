import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {generateGeminiEditionsV36,GEMINI_LEVELS} from '../src/lib/generativeEditionsV36.js';
import {clearGeminiPause} from '../src/lib/geminiQuotaControllerV36.js';
import {saveLibraryBook,getLibraryBook,listLibraryBooks} from '../src/lib/library.js';

const original='Articolo 7: la regola non cambia, salvo eccezione. La condizione rimane necessaria.';
const book={chapters:[{title:'Capitolo test',paragraphs:[{original,sourcePageStart:1,sourcePageEnd:1}]}],
 canonicalBookMap:{originalFingerprint:'lab37-resume-unique',uncertain:[],pages:[{physicalPage:1,sourceStatus:'verified'}]}};
const sourceData={chapters:[{title:'Capitolo test',paragraphs:[original]}],pages:[{text:original}]};
const oldFetch=globalThis.fetch;
const calls=[];
await clearGeminiPause();
try {
  globalThis.fetch=async(_url,opts)=>{
    assert.ok(opts.signal || !opts.signal,'signal must remain optional for LAB36 compatibility');
    const request=JSON.parse(opts.body);
    calls.push(request.level);
    return new Response(JSON.stringify({engine:'ai',sourceVersion:'original',
      editions:{[request.level]:request.source}}),{status:200,headers:{'Content-Type':'application/json'}});
  };
  const controller=new AbortController();
  const interrupted=await generateGeminiEditionsV36(book,{paceMs:0,signal:controller.signal,
    onProgress(snapshot){
      if(snapshot.verifiedChunkVariants===1&&!controller.signal.aborted)controller.abort();
    }});
  assert.equal(interrupted.status,'interrupted','Manual interruption must stop the one active worker');
  assert.equal(interrupted.verifiedChunkVariants,1,'First verified edition must survive abort');
  assert.deepEqual(calls,['10'],'No extra Gemini call after cancellation');
  const record=await saveLibraryBook({id:'lab37-test',fileName:'Libro prova.pdf',
    sourceData,studyBook:{...book,editionsV36:interrupted}});
  assert.equal(record.metadata.geminiEditionIncomplete,true);
  const listed=await listLibraryBooks();
  assert.ok(listed.some(item=>item.id==='lab37-test'&&item.metadata.geminiEditionIncomplete));
  const reopened=await getLibraryBook('lab37-test');
  assert.equal(reopened.studyBook.editionsV36.verifiedChunkVariants,1);
  const resumed=await generateGeminiEditionsV36(reopened.studyBook,{paceMs:0});
  assert.equal(resumed.complete,true,'All six editions must finish from reopened book');
  assert.equal(resumed.verifiedChunkVariants,6);
  assert.deepEqual(calls,GEMINI_LEVELS,'Only the five missing editions may be called');
  const repeated=await generateGeminiEditionsV36(reopened.studyBook,{paceMs:0});
  assert.equal(repeated.complete,true);
  assert.equal(calls.length,6,'Completed editions are never requested again');
  const completed=await saveLibraryBook({id:'lab37-test',fileName:'Libro prova.pdf',
    sourceData,studyBook:{...book,editionsV36:resumed}});
  assert.equal(completed.metadata.geminiEditionIncomplete,false);

  const disconnected={...book,canonicalBookMap:{...book.canonicalBookMap,
    originalFingerprint:'lab37-offline-different'}};
  let offlineCalls=0;
  globalThis.fetch=async()=>{offlineCalls++;throw new TypeError('Network offline');};
  const blocked=await generateGeminiEditionsV36(disconnected,{paceMs:0});
  assert.equal(blocked.status,'provider-blocked','Network errors must stop futile repeated Gemini calls');
  assert.equal(blocked.execution.haltedOn,'AI_TIMEOUT_OR_NETWORK');
  assert.equal(offlineCalls,1);

  const app=readFileSync(new URL('../src/AppV15.jsx',import.meta.url),'utf8');
  const home=readFileSync(new URL('../src/components/HomeDashboardV16.jsx',import.meta.url),'utf8');
  const studio=readFileSync(new URL('../src/components/AppScreens.jsx',import.meta.url),'utf8');
  assert.match(app,/async function resumeFromHome\(/,'Auto-resume now supports an optional mode argument');
  assert.match(app,/runGeminiWithSafeRestart\(current/);
  assert.match(app,/if\(generating\)\{\s*if\(geminiStalled\)requestActiveGeminiRecovery\(\)/,
  'Active Gemini must never be interrupted by ordinary navigation');
  assert.match(app,/getLibraryBook\(resumeCandidate\.id\)/);
  assert.match(app,/restartRequestedRef\.current=true/);
  assert.match(home,/onClick=\{onResumeProcessing\}/);
  assert.match(home,/onClick=\{onResumeProcessing\}/,'Home retains the explicit resume action');
  assert.match(studio,/Riprendi elaborazione dal checkpoint/,'Studio retains the visible checkpoint resume action');
  console.log('LAB37: abort, one runner, durable book reopen, 5-only missing editions, zero duplicates, offline stop, Home/Studio controls PASS');
} finally {
  globalThis.fetch=oldFetch;
  await clearGeminiPause();
}
