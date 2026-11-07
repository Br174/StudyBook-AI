// LAB56 regression: a deontic paraphrase may preserve meaning WITHOUT the
// literal word "non", but flipped polarity, dates, exceptions and unsupported
// legal references MUST remain blocked. An irreparable page cannot stop later
// complete pages and verified 73/714 checkpoints may never be wiped.
import assert from 'node:assert/strict';
import {indexedDB as fakeIndexedDB} from 'fake-indexeddb';
import {auditFidelity} from '../src/lib/fidelityEngine.js';
import {auditStudyUnitV53,repairFocusForUnitV56}
  from '../src/lib/editionRepairV53.js';
import {generateIntegralEditionsV51} from '../src/lib/generativeIntegralV51.js';
import {studyLetters} from '../src/lib/studyPillarV38.js';

const source='La legge non permette questa azione.';
const safe='La legge vieta questa azione.';
const unsafe='La legge permette questa azione.';
const valid=auditFidelity(source,safe);
assert.equal(valid.missingProtected.length,0,'preserved prohibition is not a missing literal');
assert.equal(valid.qualifierMismatches.length,0,'prohibition scope and polarity preserved');
assert.equal(auditStudyUnitV53({source,summaryCapLetters:100},'summary',safe).ok,true);
const wrong=auditFidelity(source,unsafe);
assert.ok(wrong.missingProtected.length>0||wrong.qualifierMismatches.length>0,
 'changing prohibition into permission must fail');
assert.equal(auditStudyUnitV53({source,summaryCapLetters:100},'summary',unsafe).ok,false);
const scopedSource='La legge non permette questa azione; il giudice permette una diversa azione.';
const scopedWrong='La legge permette questa azione; il giudice vieta una diversa azione.';
const scopedAudit=auditFidelity(scopedSource,scopedWrong);
assert.ok(scopedAudit.missingProtected.length||scopedAudit.qualifierMismatches.length,
 'a misplaced prohibition is NOT equivalent');
const normalNegation=auditFidelity('La norma non è valida.','La norma è valida.');
assert.ok(normalNegation.missingProtected.length>0,
 'regular negation is never neutralised as a deontic equivalent');
const legal=auditFidelity('L’articolo 10 della legge tutela i diritti nel 2021.',
 'La legge tutela i diritti.');
assert.ok(legal.missingProtected.some(x=>x.kind==='date-number'),
 'date/number omission remains protected');
const exception=auditFidelity('La regola vale salvo queste eccezioni.',
 'La regola vale senza queste eccezioni.');
assert.ok(exception.missingProtected.some(x=>x.kind==='qualifier'),
 'exception omission remains protected');
const hint=repairFocusForUnitV56({source,summaryCapLetters:100},'summary',unsafe);
assert.ok(hint.missingProtected.some(x=>x.value==='non'));
assert.equal(hint.maxSummaryLetters,100);
assert.equal(hint.actualLetters,studyLetters(unsafe));

const oldDb=globalThis.indexedDB,oldFetch=globalThis.fetch;
globalThis.indexedDB=fakeIndexedDB;
const base='argomento '.repeat(20).trim();
const broken='La legge non permette questa azione. '+base;
const paragraphs=[{original:broken,sourcePageStart:1,sourcePageEnd:1},
 {original:base,sourcePageStart:2,sourcePageEnd:2}];
const book={title:'Studio pagine complete LAB56',
 studyPillarV38:'studybook-progressive-v38-1',
 canonicalBookMap:{originalFingerprint:'f'.repeat(64),pageCount:2,uncertain:[],
  pages:[1,2].map(i=>({physicalPage:i,sourceStatus:'verified'}))},
 chapters:[{title:'Capitolo',pageStart:1,pageEnd:2,paragraphs}]};
let calls=0,receivedHint=false;
const snapshots=[];
globalThis.fetch=async(url,options)=>{
 assert.ok(String(url).endsWith('/api/editions/bulk/v51'));
 calls++;
 const request=JSON.parse(options.body);
 const firstHint=request.repairDrafts?.find(x=>x.id==='0:0')?.repairFocus;
 if(firstHint?.missingProtected?.some(x=>x.value==='non'))receivedHint=true;
 const count=request.level==='summary'?8:20*(1-Number(request.level)/100);
 // Page 1 is genuinely wrong, "non" omitted. Page 2 is fully faithful.
 const parts=request.units.map(u=>({id:u.id,
  text:u.id==='0:0'?'La legge permette questa azione. '+base:
    'argomento '.repeat(count).trim()}));
 return new Response(JSON.stringify({engine:'ai',version:'integral-v51',
  level:request.level,parts}),
  {status:200,headers:{'Content-Type':'application/json'}});
};
try{
 const final=await generateIntegralEditionsV51(book,{onProgress:x=>snapshots.push(x)});
 assert.equal(final.status,'quality-review','failing page remains subject to review');
 assert.equal(final.complete,false,'never claim the book complete');
 assert.equal(final.verifiedChunkVariants,6,'five reductions and summary for page 2 saved');
 assert.equal(final.totalChunkVariants,12);
 assert.equal(final.stagedRows[0][0].verified.summary,false);
 assert.equal(final.stagedRows[0][1].verified.summary,true);
 assert.equal(final.publishedThroughPage.summary,0,
  'do not publish page 2 ahead of incomplete original page 1');
 assert.ok(final.diagnostics.deferredPages.length>=6);
 assert.ok(final.diagnostics.deferredPages.some(x=>x.pages.includes(1)));
 assert.ok(!final.diagnostics.deferredPages.some(x=>x.pages.includes(2)),
  'page 2 is NOT blocked by missing protected on page 1');
 assert.equal(receivedHint,true,'Gemini receives the actual missing clause focus');
 assert.ok(calls<32,'bounded retry, no infinite paragraph loop');
 const resumed=await generateIntegralEditionsV51({...book,editionsV36:final});
 assert.equal(resumed.verifiedChunkVariants,6,'all verified parts survive later attempts');
 assert.equal(resumed.stagedRows[0][1].verified['10'],true);
}finally{
 globalThis.fetch=oldFetch;
 if(oldDb===undefined)delete globalThis.indexedDB;
 else globalThis.indexedDB=oldDb;
}
console.log('LAB56 PASS: scoped prohibition meaning verified; negation/date/reference omitted fail; page 1 deferred while page 2 and all six levels persist.');
