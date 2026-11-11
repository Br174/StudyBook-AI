// LAB122 free-tier REAL provider proof. One invocation only, no secrets or content logged.
import assert from 'node:assert/strict';
import handler from '../api/explainedV122.js';
import {EXPLAINED_POLICY_V122,auditExplainedPageV122} from '../src/lib/explainedPolicyV122.js';
const key=process.env.AI_API_KEY||process.env.GEMINI_API_KEY;
if(!key)throw Error('V122_REAL_GEMINI_KEY_UNAVAILABLE');
const model='gemini-3.5-flash-lite';
const sentence='Una norma imperativa è una regola obbligatoria che non può essere eliminata da accordi tra privati.';
const source=[sentence,sentence].join(' ');
const page={id:'p1',segments:[{id:'p1-s0',source}]};
const req={method:'POST',env:{AI_API_KEY:key,AI_MODEL:model},
 body:{policy:EXPLAINED_POLICY_V122,pages:[page],timeoutMs:180000}};
let status=200,body=null;
const res={
 setHeader(){return res},
 status(v){status=v;return res},
 json(v){body=v;return res}
};
const started=Date.now();
await handler(req,res);
if(status!==200){
 console.error(JSON.stringify({test:'LAB122_REAL_MODEL',status,code:body?.code||'UNKNOWN',
  outcome:'blocked',elapsedMs:Date.now()-started,semanticCertified:false}));
 process.exitCode=1;
}else{
 assert.equal(body?.engine,'ai');
 assert.equal(body?.privateBandDisclosedToGemini,false);
 assert.equal(body?.pages?.length,1);
 assert.equal(body.pages[0].id,'p1');
 const review=auditExplainedPageV122(page,body.pages[0]);
 console.log(JSON.stringify({test:'LAB122_REAL_MODEL',status,model,elapsedMs:Date.now()-started,
  ready:review.ready,issues:review.issues,advisories:review.advisories,
  reduction:review.reduction,glossaryCount:review.glossaryCount,
  privateBandDisclosedToGemini:false,semanticCertified:false}));
 if(!review.ready)process.exitCode=2;
}
