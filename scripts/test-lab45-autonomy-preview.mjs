import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import {restoreMissingTerminalPunctuation} from '../src/lib/studyEditionRepairV45.js';
import {buildVerifiedFragmentPreviewV45} from '../src/lib/studyPreviewV45.js';
import {planStudyAutoResumeV45} from '../src/lib/studyAutoResumeV45.js';
import {buildGeminiEditionViewV36,mayPublishGeminiEdition} from '../src/lib/editionViewV36.js';
import {generateGeminiEditionsV36} from '../src/lib/generativeEditionsV36.js';
import {STUDY_PILLAR_VERSION,STUDY_ORDER,STUDY_PERCENTAGES,studyLetters,
 allocateExactLetterBudgets} from '../src/lib/studyPillarV38.js';
import {clearGeminiPause} from '../src/lib/geminiQuotaControllerV36.js';

assert.deepEqual(STUDY_ORDER,['summary','50','40','30','20','10','0']);
assert.deepEqual(STUDY_PERCENTAGES,[10,20,30,40,50]);
const punctuation='La norma giuridica disciplina i rapporti sociali';
assert.equal(restoreMissingTerminalPunctuation(punctuation),punctuation+'.');
assert.equal(studyLetters(restoreMissingTerminalPunctuation(punctuation)),studyLetters(punctuation));
assert.equal(restoreMissingTerminalPunctuation('La norma non'), 'La norma non');
assert.equal(restoreMissingTerminalPunctuation('La legge è valida solo quando'),'La legge è valida solo quando');
assert.equal(restoreMissingTerminalPunctuation('La norma disciplina i rapporti sociali.'),'La norma disciplina i rapporti sociali.');
const fragment=buildVerifiedFragmentPreviewV45({count:3,parts:[{index:0,text:'Prima parte verificata.'},
 {index:2,text:'Terza parte verificata.'}]});
assert.equal(fragment.verifiedFragments,2);
assert.match(fragment.text,/Prima parte verificata/);
assert.match(fragment.text,/Parte 2 in elaborazione, non verificata/);
assert.ok(!fragment.text.includes('bozza privata'));
const original='La norma giuridica disciplina i rapporti sociali.';
const book={
 studyPillarV38:STUDY_PILLAR_VERSION,
 chapters:[{title:'Diritto',paragraphs:[{original},{original}]}],
 editionsV36:{version:'lab38-progressive-editions-v1',complete:false,verifiedVariants:1,totalVariants:12,
  rows:[[{
   editions:{summary:null},verified:{summary:false},
   partialFragments:{summary:{count:3,parts:[{index:0,text:'Norma giuridica verificata.'}]}},
   issues:{summary:['not-verified']}
  },{
   editions:{summary:'La norma giuridica disciplina i rapporti sociali.'},
   verified:{summary:true},issues:{summary:[]}
  }]]}
};
const view=buildGeminiEditionViewV36(book,'summary');
assert.equal(view.editionReadiness.verifiedParagraphs,1);
assert.equal(view.editionReadiness.readableParagraphs,2);
assert.equal(view.editionReadiness.verifiedPreviewFragments,1);
assert.equal(view.editionReadiness.complete,false);
assert.equal(mayPublishGeminiEdition(view),false);
assert.match(view.chapters[0].paragraphs[0].summary,/Norma giuridica verificata/);
assert.match(view.chapters[0].paragraphs[0].summary,/in elaborazione/);
assert.ok(!view.chapters[0].paragraphs[0].summary.includes('bozza privata'));

const now=Date.parse('2026-11-07T08:30:00Z');
const quality={status:'quality-review',execution:{haltedOn:'AI_QUALITY_REVIEW_REQUIRED',remainingBatches:1451},complete:false};
assert.equal(planStudyAutoResumeV45(quality,now,0).at,now+15000);
assert.equal(planStudyAutoResumeV45(quality,now,1).at,now+30000);
assert.equal(planStudyAutoResumeV45(quality,now,2),null,'Never spin indefinitely when no progress');
const quota={status:'quota-paused',quota:{automatic:true,retryAt:new Date(now+150000).toISOString()}};
assert.equal(planStudyAutoResumeV45(quota,now,0).at,now+150000,'Provider throttle is binding');
assert.equal(planStudyAutoResumeV45({...quota,quota:{automatic:false}},now,0),null);
assert.equal(planStudyAutoResumeV45({...quality,execution:{haltedOn:'SOURCE_REVIEW',remainingBatches:500}},now,0),null);
assert.equal(planStudyAutoResumeV45({status:'complete',complete:true},now,0),null);

// Thousands of source pages must be representable without making false
// verified paragraphs or materializing missing/rejected drafts.
const large={
 chapters:[{title:'Simulazione 3000 pagine',paragraphs:Array.from({length:3000},()=>({original}))}],
 editionsV36:{status:'partial',complete:false,version:'lab38-progressive-editions-v1',
   verifiedVariants:0,totalVariants:3000*6,
   rows:[Array.from({length:3000},(_,i)=>i<6?{
     editions:{},verified:{summary:false},
     partialFragments:{summary:{count:3,parts:[{index:0,text:'Norma verificata.'}]}}
   }:{editions:{},verified:{summary:false}})]}
};
const largeStart=performance.now();
const largePreview=buildGeminiEditionViewV36(large,'summary');
const buildMs=performance.now()-largeStart;
assert.equal(largePreview.editionReadiness.readableParagraphs,6);
assert.equal(largePreview.editionReadiness.verifiedParagraphs,0);
assert.equal(largePreview.editionReadiness.verifiedPreviewFragments,6);
assert.equal(mayPublishGeminiEdition(largePreview),false);
assert.ok(buildMs<15000,'Preview must not freeze on 3000-paragraph fixture');
console.log('LAB45 LARGE_PREVIEW 3000 paragraphs, buildMs='+Math.round(buildMs)+', no false approvals');

const clause='La norma disciplina i rapporti sociali. ';
const source=clause.repeat(8).trim();
const simulated=(target)=>{
 let answer='';
 while(studyLetters(answer)+studyLetters(clause)<target-4)answer+=clause;
 return (answer+'n'.repeat(Math.max(0,target-studyLetters(answer)))+'.').trim();
};
const document={studyPillarV38:STUDY_PILLAR_VERSION,
 canonicalBookMap:{originalFingerprint:'lab45-local-safe-punctuation-real-pillar',uncertain:[],
   pages:[{physicalPage:1,sourceStatus:'verified'}]},
 chapters:[{title:'Filosofia del diritto',paragraphs:[{original:source,sourcePageStart:1,sourcePageEnd:1}]}]};
const fifty=allocateExactLetterBudgets([source],50)[0];
const originalFetch=globalThis.fetch;
try{
 await clearGeminiPause();
 let count=0;
 globalThis.fetch=async(_url,{body})=>{
  const request=JSON.parse(body);count++;
  assert.equal(request.policy,STUDY_PILLAR_VERSION);
  const target=request.level==='summary'?fifty-9:request.targetLetters;
  const edition=simulated(target).replace(/[.]$/,'');
  return new Response(JSON.stringify({engine:'ai',sourceVersion:'original',
    editions:{[request.level]:edition}}),{status:200});
 };
 const final=await generateGeminiEditionsV36(document,{paceMs:0});
 assert.equal(final.complete,true,'Mechanical period restored only after strict re-audit');
 assert.equal(final.verifiedChunkVariants,6,'All six editions approved individually');
 assert.equal(count,6,'No six extra provider repair requests for missing periods');
 console.log('LAB45 PUNCTUATION saved six unnecessary repair calls, original pillar unchanged');
}finally{globalThis.fetch=originalFetch;await clearGeminiPause();}
console.log('LAB45 PASS: bounded autonomous foreground quality resumption, earliest honest verified-fragment preview and exact pillar regression');
