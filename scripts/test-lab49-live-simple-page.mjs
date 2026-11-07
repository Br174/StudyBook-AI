import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import handler from '../api/pageSimpleV49.js';
import {verifiedPageTextV49,explainStudyPageOnDemandV49} from '../src/lib/pageSimpleV49.js';
import {buildCanonicalBookMap,composeMirrorPages} from '../src/lib/libroSpecchioV35.js';

const originalText='La dottrina della validità delle norme si distingue dalla sociologia della loro effettività.';
const studyText='La validità delle norme e il loro funzionamento concreto sono due cose diverse.';
const bookSource=buildCanonicalBookMap({pages:[{pageNumber:1,text:originalText,status:'verified'}],
  chapters:[{title:'Capitolo primo',pageStart:1,pageEnd:1,sections:[],paragraphs:[originalText]}],
  originalFingerprint:'d'.repeat(64),pdfPageCount:1});
const studyBook={chapters:[{title:'Capitolo primo',pageStart:1,pageEnd:1,sections:[],
  paragraphs:[{original:originalText,summary:studyText,
    simpleSummary:'QUESTO TESTO ERA PREGENERATO E NON DEVE ESSERE USATO.',
    sourcePageStart:1,sourcePageEnd:1}]}]};
const sheet=composeMirrorPages(bookSource,studyBook,{variant:'study'}).pages[0];
assert.match(verifiedPageTextV49(sheet).text,/validità delle norme/);
assert.doesNotMatch(verifiedPageTextV49(sheet).text,/QUESTO TESTO ERA PREGENERATO/);
assert.equal(verifiedPageTextV49({kind:'image',blocks:[]}).text,'');
assert.equal(verifiedPageTextV49({kind:'text',blocks:[
  {kind:'paragraph',text:'Senza verifica',editionPending:true}
]}).text,'');
assert.equal(verifiedPageTextV49({kind:'text',blocks:[
  {kind:'paragraph',text:'Testo verificato',editionPending:false},
  {kind:'paragraph',text:'NON VERIFICATO',editionPending:true}
]}).text,'Testo verificato');

let calls=0,request=null;
const originalFetch=globalThis.fetch;
globalThis.fetch=async(url,opts)=>{
  calls++;request={url,options:opts,payload:JSON.parse(opts.body)};
  return new Response(JSON.stringify({explanation:'Queste due cose sono diverse. La prima indica se la regola è valida. La seconda indica se le persone la seguono.',engine:'gemini-live'}),
    {status:200,headers:{'content-type':'application/json'}});
};
try {
  assert.equal(calls,0,'Without tapping no Gemini calls may start');
  const result=await explainStudyPageOnDemandV49(sheet,{bookTitle:'Filosofia del diritto'});
  assert.equal(calls,1,'One explicit tap makes one request');
  assert.equal(request.url,'/api/page-simple/v49');
  assert.ok(request.payload.pageText.includes('La validità delle norme'));
  assert.equal(request.payload.pageLabel,'1');
  assert.equal(result.engine,'gemini-live');
}finally{globalThis.fetch=originalFetch;}

function mockRes(){
  return {statusCode:200,headers:{},body:null,
    setHeader(k,v){this.headers[k]=v;return this;},
    status(k){this.statusCode=k;return this;},
    json(o){this.body=o;return this;}};
}
const noBody=mockRes();
await handler({method:'POST',body:{},env:{}},noBody);
assert.equal(noBody.statusCode,400,'Empty page never calls Gemini');
const large=mockRes();
await handler({method:'POST',body:{pageText:'a'.repeat(12001)},env:{}},large);
assert.equal(large.statusCode,413,'Never silently truncate a long source page');
const wrongMethod=mockRes();
await handler({method:'GET',body:{},env:{}},wrongMethod);
assert.equal(wrongMethod.statusCode,405);

const fakeKey='MOCK_SECRET_NEVER_VISIBLE';
const req={method:'POST',body:{pageText:studyText,pageLabel:'1',
  bookTitle:'Libro'},env:{AI_API_KEY:fakeKey,AI_MODEL:'gemini-3.5-flash-lite'}};
globalThis.fetch=async(_url,opts)=>{
  calls++;request={headers:opts.headers,body:JSON.parse(opts.body)};
  return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({
    explanation:'La regola può essere valida anche quando non viene applicata. In parole comuni, una cosa è ciò che dovrebbe valere, un’altra è ciò che succede davvero.',
  })}}]}),{status:200,headers:{'content-type':'application/json'}});
};
try{
  const res=mockRes();
  await handler(req,res);
  assert.equal(res.statusCode,200);
  assert.equal(res.body.onDemand,true);
  assert.equal(res.body.engine,'gemini-live');
  assert.ok(request.body.messages[0].content.includes('Non riassumere'));
  assert.ok(request.body.messages[0].content.includes('NON imporre limiti di lunghezza'));
  assert.equal(request.body.model,'gemini-3.5-flash-lite');
  assert.equal(request.headers.Authorization,'Bearer '+fakeKey);
  assert.ok(!JSON.stringify(res.body).includes(fakeKey));
  assert.ok(!JSON.stringify(request.body).includes(fakeKey));
  const failures=[429,503];
  for(const status of failures){
    let called=0;
    globalThis.fetch=async()=>{called++;return new Response(JSON.stringify({
      error:{message:status===429?'Resource exhausted per-minute quota':'Backend overloaded'},
    }),{status,headers:{'content-type':'application/json'}});};
    const response=mockRes();
    await handler(req,response);
    assert.equal(response.statusCode,status);
    assert.equal(called,1,'A 429/503 never makes duplicate Gemini calls');
    assert.ok(response.body.quota?.retryAt);
  }
}finally{globalThis.fetch=originalFetch;}

const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const mode=source('src/components/StudyMode.jsx');
const reader=source('src/components/MirrorReaderV35.jsx');
const worker=source('worker/index.js');
const exported=source('src/lib/exportMirrorV35.js');
assert.ok(mode.includes('setSimpleRequestToken(n=>n+1)'));
assert.ok(reader.includes('simpleRequestToken'));
assert.ok(reader.includes('explainStudyPageOnDemandV49'));
assert.ok(reader.includes("variant:'study'"),'Page layout must not select pre-generated simple version');
assert.ok(reader.includes('onPageChange?.()'));
assert.ok(worker.includes("'/api/page-simple/v49'"));
assert.ok(!exported.includes('pageSimpleV49'),'Printed books never embed transient explanations');
console.log('LAB49_PASS: explicit tap only, exactly selected verified page, no pre-generation, long explanation, 429/503 single-shot, no print mutation');
