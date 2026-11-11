// LAB124: real deployed Worker smoke test with public synthetic text.
// Runs ONE free-tier page through Cloudflare, not just a direct Gemini key.
const url='https://studybook-ai-trial123.brunoverlezza.workers.dev/api/explained/v122';
const source='Una norma imperativa è una regola obbligatoria che non può essere eliminata da accordi tra privati. '.repeat(2).trim();
const request={policy:'lab122-one-explained-glossary-v1',
 pages:[{id:'p1',physicalPage:1,label:'1',segments:[{id:'p1-s0',source}]}],
 timeoutMs:115000};
const controller=new AbortController(),t=setTimeout(()=>controller.abort(),130000);
const started=Date.now();
try{
 const response=await fetch(url,{method:'POST',
  headers:{'Content-Type':'application/json','Origin':'http://localhost'},
  body:JSON.stringify(request),signal:controller.signal});
 const output=await response.json().catch(()=>({code:'NON_JSON'}));
 const meta={test:'LAB124_DEPLOYED_WORKER',status:response.status,
  code:output?.code||'OK',error:output?.error||'',
  contentType:response.headers.get('content-type'),
  cors:response.headers.get('access-control-allow-origin'),
  providerRequests:output?.providerRequests??null,
  model:output?.model??null,readyPages:output?.readyPages??null,
  resultCount:output?.pages?.length??0,
  reviewIssues:output?.pages?.[0]?.review?.issues||[],
  elapsedMs:Date.now()-started};
 console.log(JSON.stringify(meta));
 if(response.status!==200||meta.readyPages!==1)process.exitCode=1;
}catch(err){console.log(JSON.stringify({test:'LAB124_DEPLOYED_WORKER',error:err.name,
 elapsedMs:Date.now()-started}));process.exitCode=2;}finally{clearTimeout(t);}
