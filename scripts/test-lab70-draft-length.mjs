// LAB70 isolated free-tier Worker contract. Offline mock: NO Gemini quota spent.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import handler,{editionDraftInstructionV70,STUDY_DRAFT_PROTOCOL_V70 as protocolFromApi} from '../api/editionsBulkV51.js';
import {STUDY_TARGET_V67} from '../src/lib/studyRebalancePolicyV67.js';
import {STUDY_DRAFT_PROTOCOL_V70,verifyStudyDraftResponseV70} from '../src/lib/studyDraftProtocolV70.js';
import {studyLetters,exactRetained} from '../src/lib/studyPillarV38.js';

const source=('Il diritto organizza la vita sociale, collega fatti e regole e distingue condizioni ed eccezioni. ').repeat(18);
const sourceLetters=studyLetters(source);
const levels=['summary','50','40','30','20','10'];
assert.equal(protocolFromApi,STUDY_DRAFT_PROTOCOL_V70);
assert.equal(STUDY_DRAFT_PROTOCOL_V70,'lab70-draft-length-v1');
const originalFetch=globalThis.fetch;
const outputs=[];
function responseFor(){
 const headers=new Map();
 return {statusCode:200,payload:null,headers,
  setHeader(k,v){headers.set(k,v);return this;},
  status(value){this.statusCode=value;return this;},
  json(payload){this.payload=payload;return this;}};
}
function trimLetters(source,count){
 const matches=[...source.matchAll(/\p{L}/gu)];
 if(count<=0)return '.';
 return source.slice(0,(matches[Math.min(count,matches.length)-1]?.index??0)+1);
}
try{
 for(const level of levels){
  const policy=STUDY_TARGET_V67[level];
  const wanted=level==='summary'?Math.round(sourceLetters*.40):
   exactRetained(sourceLetters,Number(level));
  const cap=exactRetained(sourceLetters,50);
  const instructions=editionDraftInstructionV70(level,'draft-v70',wanted,cap,sourceLetters);
  assert.ok(instructions.includes(String(sourceLetters)+' lettere'));
  assert.ok(instructions.includes(String(wanted)+' lettere'));
  assert.ok(instructions.includes('LETTERE DA ELIMINARE'));
  assert.ok(instructions.includes('Non inventare'));
  assert.ok(instructions.includes('stesso id'));
  let providerCalls=0,tokenCalls=0;
  globalThis.fetch=async(url,init)=>{
   if(String(url).includes(':countTokens')){
    tokenCalls++;return new Response(JSON.stringify({totalTokens:2000}),{status:200});
   }
   providerCalls++;
   const request=JSON.parse(init.body);
   assert.equal(request.messages[0].content,instructions);
   const received=JSON.parse(request.messages[1].content);
   assert.equal(received.units[0].source,source);
   return new Response(JSON.stringify({
    choices:[{finish_reason:'stop',message:{content:JSON.stringify({
     parts:[{id:'0:0',text:trimLetters(source,wanted)}]
    })}}],usage:{completion_tokens:500}
   }),{status:200,headers:{'Content-Type':'application/json'}});
  };
  const req={method:'POST',env:{AI_API_KEY:'TEST_KEY_NOT_REAL',AI_MODEL:'gemini-3.5-flash-lite'},
   body:{phase:'draft-v70',draftProtocol:STUDY_DRAFT_PROTOCOL_V70,
    level,bookTitle:'Test 44 pagine',maxOutputTokens:6000,
    targetLetters:level==='summary'?null:wanted,
    summaryCapLetters:level==='summary'?cap:null,
    units:[{id:'0:0',source,pageStart:1,pageEnd:1}]}};
  const res=responseFor();
  await handler(req,res);
  assert.equal(res.statusCode,200);
  assert.equal(res.headers.get('X-StudyBook-Draft-Protocol'),STUDY_DRAFT_PROTOCOL_V70);
  assert.equal(res.payload.draftProtocol,STUDY_DRAFT_PROTOCOL_V70);
  assert.equal(res.payload.lengthReview.sourceLetters,sourceLetters);
  assert.equal(res.payload.lengthReview.observedLetters,wanted);
  assert.ok(res.payload.lengthReview.achievedReduction>=policy.min);
  assert.ok(res.payload.lengthReview.achievedReduction<=policy.max);
  assert.equal(verifyStudyDraftResponseV70(res.payload,sourceLetters,level).ok,true);
  assert.equal(providerCalls,1);
  assert.equal(tokenCalls,1);
  outputs.push(level+':'+res.payload.lengthReview.achievedReduction+'%');
 }
 const stale=verifyStudyDraftResponseV70({level:'10',lengthReview:{sourceLetters}},sourceLetters,'10');
 assert.equal(stale.ok,false);
 assert.equal(stale.code,'AI_DRAFT_BACKEND_VERSION_MISMATCH');
 const badRes=responseFor();
 await handler({method:'POST',env:{AI_API_KEY:'TEST_KEY_NOT_REAL'},
  body:{phase:'draft-v70',draftProtocol:'old-version',level:'10',targetLetters:123,
    units:[{id:'0:0',source,pageStart:1,pageEnd:1}]}},badRes);
 assert.equal(badRes.statusCode,409);
 assert.equal(badRes.payload.code,'AI_DRAFT_PROTOCOL_MISMATCH');
 const requestSource=readFileSync(new URL('../src/lib/draftFirstV57.js',import.meta.url),'utf8');
 const rebalanceSource=readFileSync(new URL('../src/lib/studyRebalanceV67.js',import.meta.url),'utf8');
 const workflow=readFileSync(new URL('../.github/workflows/android-apk.yml',import.meta.url),'utf8');
 assert.ok(requestSource.includes("phase:isNewDraft?'draft-v70':phase"));
 assert.ok(requestSource.includes('verifyStudyDraftResponseV70'));
 assert.ok(rebalanceSource.includes("'recalibrate-v70':'repair-v70'"));
 assert.ok(workflow.includes('studybook-ai-lab70.brunoverlezza.workers.dev'));
 console.log('LAB70 PASS: 6/6 source-length bands, 6 isolated model-call mocks, stale-worker rejection, versioned repairs, original text unchanged. '+outputs.join(', '));
}finally{globalThis.fetch=originalFetch;}
