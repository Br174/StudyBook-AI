import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import {coreAnchors,STUDY_ORDER,STUDY_PERCENTAGES,studyLetters,exactRetained,
  allocateExactLetterBudgets,inspectProgressiveEdition} from '../src/lib/studyPillarV38.js';
import {generateGeminiEditionsV36} from '../src/lib/generativeEditionsV36.js';
import {progressDiagnostic} from '../src/lib/geminiRecoveryV39.js';
import {clearGeminiPause} from '../src/lib/geminiQuotaControllerV36.js';

assert.deepEqual(STUDY_ORDER,['summary','50','40','30','20','10','0']);
assert.deepEqual(STUDY_PERCENTAGES,[10,20,30,40,50]);
const source='Piuttosto, il diritto distingue le regole. Distinzione tra obbligo e facoltà. Kant e Bobbio studiano l’ordinamento. L’articolo 12 tutela il diritto. L’ONU sostiene i diritti.';
const anchors=coreAnchors(source);
assert.ok(!anchors.includes('Piuttosto'),'Connector word must not be a mandatory name');
assert.ok(!anchors.includes('Distinzione'),'Generic sentence capital must not be a mandatory name');
assert.ok(anchors.includes('Kant')&&anchors.includes('Bobbio'),'Real co-mentioned thinkers stay protected');
assert.ok(anchors.includes('ONU'),'Named acronym stays protected');
assert.ok(anchors.some(v=>v.includes('12')),'Legal article stays protected');
assert.ok(inspectProgressiveEdition(source,'Diritto.','50').issues.some(v=>v.startsWith('exact-letters-target')));
for(const percentage of STUDY_PERCENTAGES){
  const chunks=[source,'La teoria studia norme e relazioni.'];
  const budget=allocateExactLetterBudgets(chunks,percentage);
  assert.equal(budget.reduce((a,b)=>a+b,0),
    exactRetained(chunks.reduce((a,b)=>a+studyLetters(b),0),percentage));
}

const first='Piuttosto, distinzione tra norme e diritti.';
const second='La teoria studia norme e relazioni.';
const third='Il diritto organizza le relazioni sociali.';
const book={canonicalBookMap:{originalFingerprint:'lab42-quality-part-one',
  uncertain:[],pages:[{physicalPage:1,sourceStatus:'verified'}]},
  chapters:[{title:'Filosofia del diritto',
    paragraphs:[first,second,third].map(original=>({original,sourcePageStart:1,sourcePageEnd:1}))}]};
const originalFetch=globalThis.fetch;
try{
  await clearGeminiPause();
  let failFirst=true,requests=[];
  globalThis.fetch=async(_url,options)=>{
    const request=JSON.parse(options.body);requests.push(request);
    const edition=failFirst&&request.source===first?'non valido.':request.source;
    return new Response(JSON.stringify({engine:'ai',sourceVersion:'original',
      editions:{[request.level]:edition}}),{status:200});
  };
  const partial=await generateGeminiEditionsV36(book,{paceMs:0});
  assert.equal(partial.complete,false,'Invalid draft cannot count as complete');
  assert.equal(partial.status,'partial','One invalid paragraph must not block the others');
  assert.equal(partial.execution.haltedOn,null);
  assert.equal(partial.verifiedChunkVariants,12,'Two later paragraphs must verify all six levels');
  assert.equal(partial.rows[0][0].verified.summary,false,'Bad summary must not be approved');
  assert.equal(partial.rows[0][1].verified.summary,true);
  assert.equal(partial.rows[0][2].verified.summary,true);
  assert.ok(partial.diagnostics.quality,'Store reason for user-visible diagnosis');
  assert.equal(requests.length,14,'Two invalid attempts plus 12 successful editions');
  assert.equal(progressDiagnostic(partial).kind,'QUALITA');
  failFirst=false;
  const before=requests.length;
  const resumed=await generateGeminiEditionsV36(book,{paceMs:0});
  assert.equal(resumed.complete,true,'Repair deferred part from its checkpoint');
  assert.equal(requests.length-before,6,'Request only previously unverified levels');
  assert.ok(requests[before].repairDraft,'Retain rejected draft for guided repair');
  const cached=requests.length;
  assert.equal((await generateGeminiEditionsV36(book,{paceMs:0})).complete,true);
  assert.equal(requests.length,cached,'No duplicate calls after complete checkpoint');

  const systemic={...book,canonicalBookMap:{...book.canonicalBookMap,
    originalFingerprint:'lab42-quality-circuit'}};
  requests=[];
  globalThis.fetch=async(_url,options)=>{
    const request=JSON.parse(options.body);requests.push(request);
    return new Response(JSON.stringify({engine:'ai',sourceVersion:'original',
      editions:{[request.level]:'non valido.'}}),{status:200});
  };
  const stopped=await generateGeminiEditionsV36(systemic,{paceMs:0});
  assert.equal(stopped.execution.haltedOn,'AI_QUALITY_REVIEW_REQUIRED');
  assert.equal(requests.length,6,'Never waste quota beyond three failed chunks');
  assert.equal(stopped.verifiedChunkVariants,0);
  assert.equal(progressDiagnostic(stopped).kind,'QUALITA');
  console.log('LAB42 PASS: contextual anchors, exact budgets, quality quarantine, durable continuation, checkpoint reuse and quota circuit');
}finally{
  globalThis.fetch=originalFetch;
  await clearGeminiPause();
}