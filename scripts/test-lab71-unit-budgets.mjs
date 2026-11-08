// LAB71 offline, no provider quota: 44 complete pages, 6 graduated editions.
// Fail closed on missing source budgets and wrong Worker protocol.
import assert from 'node:assert/strict';
import handler,{editionDraftInstructionV71} from '../api/editionsBulkV51.js';
import {buildUnitBudgetsV71,STUDY_DRAFT_PROTOCOL_V71,verifyStudyDraftResponseV71}
  from '../src/lib/studyDraftProtocolV71.js';
import {STUDY_TARGET_V67} from '../src/lib/studyRebalancePolicyV67.js';
import {studyLetters,percentReduced} from '../src/lib/studyPillarV38.js';
import {readFileSync} from 'node:fs';
const levels=['summary','50','40','30','20','10'];
const source=('La filosofia del diritto studia la relazione fra regole, giustizia, autorità e persone. '+
 'Ogni norma ha condizioni, eccezioni, presupposti ed effetti che devono essere spiegati. ').repeat(6);
const sources=Array.from({length:44},(_,i)=>({id:'0:'+i,source,
  pageStart:i+1,pageEnd:i+1,chapterTitle:'Diritto',sectionTitle:'Sezione '+i}));
const sourceLetters=sources.reduce((n,u)=>n+studyLetters(u.source),0);
const trimToLetters=(text,target)=>{
 const letters=[...text.matchAll(/\p{L}/gu)];
 if(target<=0)return '';
 return text.slice(0,(letters[Math.min(target,letters.length)-1]?.index||0)+1);
};
const mockRes=()=>{
 const headers=new Map();
 return {statusCode:200,data:null,headers,
  setHeader(k,v){headers.set(k,v);return this},
  status(code){this.statusCode=code;return this},
  json(value){this.data=value;return this}
 };
};
const originalFetch=globalThis.fetch;
try{
 let modelCalls=0;
 for(const level of levels){
  const band=STUDY_TARGET_V67[level];
  const budgets=buildUnitBudgetsV71(sources,level);
  const target=level==='summary'?null:Math.round(sourceLetters*(1-Number(level)/100));
  const cap=level==='summary'?Math.round(sourceLetters*.40):null;
  const lengths=sources.map(u=>budgets[u.id].summaryTargetLetters??budgets[u.id].targetLetters);
  const samplePrompt=editionDraftInstructionV71(level,'draft-v71',target,cap,sourceLetters);
  assert.match(samplePrompt,/quote INDICATIVE/);
  assert.match(samplePrompt,/LETTERE ORIGINALI/);
  assert.match(samplePrompt,/10% conserva circa 9 righe su 10/);
  let officialTokenCalls=0;
  globalThis.fetch=async(url,options)=>{
    if(String(url).includes(':countTokens')){
      officialTokenCalls++;return new Response(JSON.stringify({totalTokens:21000}),{status:200});
    }
    modelCalls++;
    const body=JSON.parse(options.body);
    const payload=JSON.parse(body.messages[1].content);
    assert.equal(payload.units.length,44);
    assert.equal(payload.units[0].source,source);
    assert.equal(payload.units[0].sourceLetters,studyLetters(source));
    assert.equal(payload.units[0].minLetters,budgets[sources[0].id].minLetters);
    assert.equal(payload.units[0].maxLetters,budgets[sources[0].id].maxLetters);
    assert.equal(payload.units[0].targetLetters,budgets[sources[0].id].targetLetters);
    return new Response(JSON.stringify({choices:[{finish_reason:'stop',
      message:{content:JSON.stringify({parts:sources.map((u,i)=>({
        id:u.id,text:trimToLetters(u.source,lengths[i])
      }))})}}],usage:{completion_tokens:4100}}),{status:200});
  };
  const request={method:'POST',
    env:{AI_API_KEY:'OFFLINE_MOCK_KEY',AI_MODEL:'gemini-3.5-flash-lite'},
    body:{phase:'draft-v71',draftProtocol:STUDY_DRAFT_PROTOCOL_V71,
      bookTitle:'44 pagine',level,targetLetters:target,summaryCapLetters:cap,
      unitBudgets:budgets,maxOutputTokens:50000,units:sources}};
  const result=mockRes();
  await handler(request,result);
  assert.equal(result.statusCode,200,'LAB71 draft '+level);
  assert.equal(result.headers.get('X-StudyBook-Draft-Protocol'),'lab72-canonical-range-observability-v1');
  assert.equal(result.data.parts.length,44);
  assert.equal(result.data.draftProtocol,STUDY_DRAFT_PROTOCOL_V71);
  assert.equal(result.data.lengthReview.sourceLetters,sourceLetters);
  assert.equal(verifyStudyDraftResponseV71(result.data,sourceLetters,level).ok,true);
  const measured=percentReduced(sourceLetters,
    result.data.parts.reduce((n,p)=>n+studyLetters(p.text),0));
  assert.ok(measured>=band.min&&measured<=band.max,
    '44-page '+level+' resulting reduction '+measured+' outside range');
  assert.equal(officialTokenCalls,1);
 }
 assert.equal(modelCalls,6);

 const budgets=buildUnitBudgetsV71(sources,'10');
 const bad=structuredClone(budgets);
 bad['0:0'].sourceLetters--;
 const fail=mockRes();
 await handler({method:'POST',env:{AI_API_KEY:'OFFLINE_MOCK_KEY'},
   body:{phase:'draft-v71',draftProtocol:STUDY_DRAFT_PROTOCOL_V71,
     level:'10',targetLetters:Math.round(sourceLetters*.9),
     units:sources,unitBudgets:bad}},fail);
 assert.equal(fail.statusCode,400);
 assert.equal(fail.data.code,'AI_DRAFT_BUDGET_MISMATCH');
 const stale=verifyStudyDraftResponseV71({draftProtocol:'lab70-draft-length-v1',
  level:'10',lengthReview:{sourceLetters}},sourceLetters,'10');
 assert.equal(stale.ok,false);
 const previous=trimToLetters(source,Math.round(studyLetters(source)*.24));
 const feedback=editionDraftInstructionV71('10','repair-v71',Math.round(studyLetters(source)*.9),
    null,studyLetters(source),{observedLetters:studyLetters(previous),
    desiredLetters:Math.round(studyLetters(source)*.9),
    gapLetters:Math.round(studyLetters(source)*.9)-studyLetters(previous)});
 assert.match(feedback,/MANCANO [0-9]+ lettere utili/);

 const app=readFileSync(new URL('../src/lib/draftFirstV57.js',import.meta.url),'utf8');
 const repair=readFileSync(new URL('../src/lib/studyRebalanceV67.js',import.meta.url),'utf8');
 const workflow=readFileSync(new URL('../.github/workflows/android-apk.yml',import.meta.url),'utf8');
 assert.match(app,/phase:isNewDraft\?'draft-v72'/);
 assert.match(app,/buildUnitBudgetsV71\(block,level\)/);
 assert.match(repair,/phase:previousParts.length\?'repair-v72':'recalibrate-v72'/);
 assert.match(workflow,/studybook-ai-lab71\.brunoverlezza\.workers\.dev/);
 console.log('LAB71 PASS: 44 physical pages x 6 editions; per-unit length budget; numerical tolerance; source intact; protocol rejection; targeted length feedback; 0 real Gemini requests');
}finally{globalThis.fetch=originalFetch}
