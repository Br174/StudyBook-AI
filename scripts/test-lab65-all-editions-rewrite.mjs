// LAB65: all six editions must be rewritten by Gemini, never merely trimmed.
// No real Gemini key, no Cloudflare deploy, zero paid API calls.
import assert from 'node:assert/strict';
import {indexedDB as fakeIndexedDB} from 'fake-indexeddb';
import {editionRewriteInstructionV65} from '../api/editionsBulkV51.js';
import {rewriteQualityV65} from '../src/lib/rewriteQualityV65.js';
import {generateDraftFirstV57} from '../src/lib/draftFirstV57.js';
import {clearGeminiPause} from '../src/lib/geminiQuotaControllerV36.js';
import {clearGeminiCadenceForTestV58} from '../src/lib/geminiCadenceV58.js';
const levels=['summary','50','40','30','20','10'];
const source='La sociologia del diritto studia le relazioni tra le norme e le persone nella società. Esamina come i comportamenti dei cittadini cambiano la concreta applicazione delle regole, mentre le disposizioni giuridiche condizionano le scelte individuali. La teoria generale del diritto analizza la validità delle norme e il funzionamento dell’ordinamento. Per comprendere il fenomeno giuridico si devono distinguere gli obblighi, gli effetti delle regole e le reazioni che le stesse suscitano nella vita quotidiana.';
const rewrite='La vita sociale e le regole giuridiche si influenzano reciprocamente. La sociologia osserva come le persone reagiscono al diritto e come queste reazioni incidono sulla sua applicazione. La teoria generale si occupa invece delle norme, della loro validità e della struttura dell’ordinamento. Per capirlo è importante distinguere obblighi, conseguenze delle disposizioni e risposte dei cittadini.';
assert.ok(rewriteQualityV65(source,source,'summary').needsRewrite);
assert.ok(!rewriteQualityV65(source,rewrite,'summary').needsRewrite);
for(const level of levels){
 const p=editionRewriteInstructionV65(level,'draft',level==='summary'?null:500,300);
 assert.ok(/RISCRIVI|riscrivi/.test(p),'requires semantic rewriting at '+level);
 assert.ok(/testo originale|TESTO ORIGINALE/.test(p));
 assert.ok(p.includes('parts {id,text}'));
 assert.ok(rewriteQualityV65(source,source,level).needsRewrite,
  'reject scissors at every level '+level);
 const q=editionRewriteInstructionV65(level,'rewrite',500,300);
 assert.ok(q.includes('RISCRITTURA MIRATA'));
 assert.ok(!q.includes('FASE CREAZIONE:'));
 const repair=editionRewriteInstructionV65(level,'repair',500,300);
 assert.ok(repair.includes('RISCRITTURA')||repair.includes('RISCRIVI'));
}
const tiny='L’articolo 10 vieta la cessione.';
assert.equal(rewriteQualityV65(tiny,tiny,'summary').needsRewrite,false,
 'do not demand fake synonyms in very short protected legal clauses');
const oldDB=globalThis.indexedDB,oldFetch=globalThis.fetch;
globalThis.indexedDB=fakeIndexedDB;
try{
 await clearGeminiPause();await clearGeminiCadenceForTestV58();
 const repeated='argomento '.repeat(20).trim();
 const paragraphs=Array.from({length:44},(_,i)=>({
  original:i===0?source:repeated,sourcePageStart:i+1,sourcePageEnd:i+1
 }));
 const draftRowsV57=[paragraphs.map((p,i)=>({editions:
  Object.fromEntries(levels.map(level=>[level,
   i===0?p.original:'argomento '.repeat(level==='summary'?8:
     Math.round(20*(1-Number(level)/100))).trim()]))}))];
 const approvedPages=new Set([3,4,6,7,8,10,11,12,14,15,16,17,22,24,34,44]);
 const stagedRows=[paragraphs.map((p,i)=>({editions:
  Object.fromEntries(levels.map(level=>[level,
    level==='summary'&&approvedPages.has(i+1)?
      draftRowsV57[0][i].editions.summary:null])),
  verified:Object.fromEntries(levels.map(level=>[level,
    level==='summary'&&approvedPages.has(i+1)]))
 }))];
 const fp='a'.repeat(64);
 const previous={sourceFingerprint:fp,phase:'review',
  status:'quality-review',draftComplete:true,
  draftRowsV57,stagedRows,
  repairAttemptsV57:{'summary:1-1':3},
  diagnostics:{qualityRecoveryV62:{policy:'focused-v62',resetOnce:true}},
  checkpointPersistent:true};
 const book={title:'Filosofia del diritto',studyPillarV38:'studybook-progressive-v38-1',
  canonicalBookMap:{originalFingerprint:fp,pageCount:44,uncertain:[],
   pages:Array.from({length:44},(_,i)=>({physicalPage:i+1,sourceStatus:'verified'}))},
  chapters:[{title:'Filosofia',pageStart:1,pageEnd:44,paragraphs}],
  editionsV36:previous};
 const events=[];
 globalThis.fetch=async(_url,options)=>{
   const req=JSON.parse(options.body);events.push(req);
   return new Response(JSON.stringify({engine:'ai',version:'integral-v51',
    level:req.level,parts:req.units.map(u=>({id:u.id,
     text:u.pageStart===1?rewrite:'argomento '.repeat(8).trim()}))}),
     {status:200,headers:{'Content-Type':'application/json'}});
 };
 const result=await generateDraftFirstV57(book);
 assert.ok(events.length>0);
 assert.equal(events[0].phase,'rewrite','one-time migration must use real rewrite phase');
 assert.equal(events[0].level,'summary','strict edition precedence');
 assert.ok(events.every(x=>x.phase!=='draft'),'no 264-draft regeneration');
 assert.equal(result.draftUnitsSaved,44*6,'preserve all existing drafts');
 assert.equal(result.stagedRows[0][2].verified.summary,true,
  'already approved pages are not discarded on migration');
 assert.equal(result.diagnostics.rewritePolicyV65.policy,'semantic-rewrite-v65');
 assert.ok(result.diagnostics.rewritePolicyV65.rearmedPages>=1);
 assert.equal(result.draftRowsV57[0][0].editions.summary,rewrite,
  'the old near-copy is replaced by a different Gemini-generated text');
 assert.equal(result.complete,false,'no false book completion without exact checks');
 console.log('LAB65 PASS: all six prompts require rewriting, copying detected with legal-term exception, existing checkpoint 264 drafts retained, 16 approved pages preserved, first targeted real rewrite called without reimport.');
}finally{
 globalThis.fetch=oldFetch;await clearGeminiPause();
 await clearGeminiCadenceForTestV58();
 if(oldDB===undefined)delete globalThis.indexedDB;
 else globalThis.indexedDB=oldDB;
}
