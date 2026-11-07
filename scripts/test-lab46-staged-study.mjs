import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {generateGeminiEditionsV36} from '../src/lib/generativeEditionsV36.js';
import {buildGeminiEditionViewV36,mayPublishGeminiEdition} from '../src/lib/editionViewV36.js';
import {bookAcquisitionProgressV46} from '../src/lib/bookAcquisitionV46.js';
import {planStudyAutoResumeV45} from '../src/lib/studyAutoResumeV45.js';
import {STUDY_PILLAR_VERSION,studyLetters} from '../src/lib/studyPillarV38.js';
import {clearGeminiPause} from '../src/lib/geminiQuotaControllerV36.js';

const homeMarkup=readFileSync(new URL('../src/components/HomeDashboardV16.jsx',import.meta.url),'utf8');
const libraryMarkup=readFileSync(new URL('../src/components/AppScreens.jsx',import.meta.url),'utf8');
const appSource=readFileSync(new URL('../src/AppV15.jsx',import.meta.url),'utf8');
assert.match(homeMarkup,/Pagine scaricate:/);
assert.match(homeMarkup,/sb-download-progress-track/);
assert.match(libraryMarkup,/sb-library-download/);
assert.match(appSource,/resumeFromHome\(\{auto:true\}\)/);
assert.deepEqual(bookAcquisitionProgressV46({pages:44,pagesAcquired:44,hasOriginal:true}),
  {total:44,acquired:44,percent:100,completed:true});
assert.equal(bookAcquisitionProgressV46({pages:44,pagesAcquired:44},
  {id:'a',total:44,done:18}).percent,40);
assert.equal(bookAcquisitionProgressV46({pages:0,hasOriginal:true}).percent,null);
assert.equal(bookAcquisitionProgressV46({pages:44,hasOriginal:true}).acquired,44,
  'Old library records may use the exact already-stored original');
const now=Date.UTC(2026,10,7,12);
const pending={status:'partial',complete:false,execution:{remainingBatches:100}};
assert.equal(planStudyAutoResumeV45(pending,now,0).reason,'unfinished-checkpoint');
assert.equal(planStudyAutoResumeV45(pending,now,2),null,'No foreground retry spin');
const error={status:'provider-blocked',execution:{haltedOn:'AI_NETWORK_REVIEW_REQUIRED'}};
assert.equal(planStudyAutoResumeV45(error,now,0).at,now+30000);
assert.equal(planStudyAutoResumeV45(error,now,2),null);
const waitUntil=new Date(now+75000).toISOString();
assert.equal(planStudyAutoResumeV45({quota:{automatic:true,retryAt:waitUntil}},now,0).at,now+75000);
assert.equal(planStudyAutoResumeV45({quota:{automatic:false}},now,0),null);

const clause='La norma disciplina i rapporti sociali. ';
const source=clause.repeat(8).trim();
const simulated=(target)=>{
 let answer='';
 while(studyLetters(answer)+studyLetters(clause)<target-4)answer+=clause;
 return (answer+'n'.repeat(Math.max(0,target-studyLetters(answer)))+'.').trim();
};
const book={studyPillarV38:STUDY_PILLAR_VERSION,
  canonicalBookMap:{originalFingerprint:'lab46-staged-quality-pillar-unique-fixture',uncertain:[],
    pages:[{physicalPage:1,sourceStatus:'verified'}]},
  chapters:[{title:'Norme giuridiche',paragraphs:[
    {original:source,sourcePageStart:1,sourcePageEnd:1},
    {original:source,sourcePageStart:1,sourcePageEnd:1}
  ]}]};
let calls=[],summaryReady=false;
const old=globalThis.fetch;
try{
 await clearGeminiPause();
 globalThis.fetch=async(_url,{body})=>{
   const payload=JSON.parse(body);
   calls.push(payload.level);
   assert.equal(payload.policy,STUDY_PILLAR_VERSION);
   const target=payload.level==='summary'
     ?Math.max(1,Number(payload.summaryCapLetters)-9):payload.targetLetters;
   return new Response(JSON.stringify({engine:'ai',sourceVersion:'original',
     editions:{[payload.level]:simulated(target).replace(/[.]$/,'')}}),{status:200});
 };
 const final=await generateGeminiEditionsV36(book,{paceMs:0,onProgress:snapshot=>{
   if(snapshot.activeLevel!=='summary'||snapshot.complete)return;
   const view=buildGeminiEditionViewV36({...book,editionsV36:snapshot},'summary');
   if(view.editionReadiness.complete&&mayPublishGeminiEdition(view))summaryReady=true;
 }});
 assert.equal(final.complete,true,'Every edition is audited before the book completes');
 assert.equal(final.verifiedChunkVariants,12);
 assert.equal(summaryReady,true,'Summary publishable before 50/40/30/20/10');
 const stages=['summary','50','40','30','20','10'];
 assert.deepEqual(calls,stages.flatMap(level=>[level,level]),
   'All of the book summary must complete BEFORE the first 50 percent request');
 const finalView=buildGeminiEditionViewV36({...book,editionsV36:final},'10');
 assert.equal(finalView.editionReadiness.complete,true);
 console.log('LAB46 PASS: 12 independently verified provider responses, staged reading and exact physical pages');
}finally{
 globalThis.fetch=old;
 await clearGeminiPause();
}
