// LAB122 isolated Worker route. One provider generation for a contiguous set of original pages.
// The strict 50% model target and the private 30-60 acceptance are deliberately separated.
import {modelInstructionV122,modelPayloadV122,auditExplainedPageV122,
 EXPLAINED_POLICY_V122} from '../src/lib/explainedPolicyV122.js';
const ENDPOINT='https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
const ALLOWED=new Set(['gemini-3.5-flash-lite','gemini-3.1-flash-lite']);
const MAX_SOURCE_CHARS=30000;
const fail=(res,status,code,message,extra={})=>res.status(status).json({code,error:message,...extra});
const SCHEMA={type:'json_schema',json_schema:{name:'studybook_explained_pages_v122',strict:true,
 schema:{type:'object',additionalProperties:false,properties:{
  pages:{type:'array',items:{type:'object',additionalProperties:false,properties:{
   id:{type:'string'},
   segments:{type:'array',items:{type:'object',additionalProperties:false,properties:{
    id:{type:'string'},text:{type:'string'}},required:['id','text']}},
   glossary:{type:'array',items:{type:'object',additionalProperties:false,properties:{
    term:{type:'string'},definition:{type:'string'}},required:['term','definition']}}
  },required:['id','segments','glossary']}}
 },required:['pages']}}};
function parseContent(value){
 if(typeof value!=='string'||value.length>500000)return null;
 try{return JSON.parse(value.trim().replace(/^\x60{3}(?:json)?\s*/iu,'').replace(/\s*\x60{3}$/u,''))}catch{return null}
}
export default async function handler(req,res){
 if(req.method!=='POST'){res.setHeader('Allow','POST');return fail(res,405,'METHOD_NOT_ALLOWED','Usare POST.');}
 const env=req.env||{},key=env.AI_API_KEY||env.GEMINI_API_KEY;
 if(!key)return fail(res,503,'AI_NOT_CONFIGURED','Il modello gratuito non è configurato.');
 const model=env.AI_MODEL||'gemini-3.5-flash-lite';
 if(!ALLOWED.has(model))return fail(res,503,'AI_MODEL_NOT_ALLOWLISTED','Modello non autorizzato.');
 const pages=req.body?.pages;
 if(req.body?.policy!==EXPLAINED_POLICY_V122||!Array.isArray(pages)||
    pages.length<1||pages.length>12)
  return fail(res,400,'V122_REQUEST_INVALID','Richiesta per pagine non valida.');
 const ids=new Set(),allSegmentIds=new Set();
 let length=0;
 for(const p of pages){
  if(!p||typeof p.id!=='string'||!/^(?:p[1-9]\d*)$/u.test(p.id)||
    ids.has(p.id)||!Array.isArray(p.segments)||p.segments.length<1||
    p.segments.length>70)return fail(res,400,'V122_PAGE_INVALID','Pagina non verificabile.');
  ids.add(p.id);
  for(const seg of p.segments){
   if(!seg||typeof seg.id!=='string'||typeof seg.source!=='string'||
      !seg.source.trim()||allSegmentIds.has(seg.id)||!seg.id.startsWith(p.id+'-s'))
    return fail(res,400,'V122_SOURCE_SEGMENT_INVALID','Unità della fonte non valida.');
   allSegmentIds.add(seg.id);length+=seg.source.length;
  }
 }
 if(length>MAX_SOURCE_CHARS)return fail(res,413,'V122_BLOCK_TOO_LARGE','Blocco da suddividere per pagine complete.');
 let safePayload;
 try{safePayload=modelPayloadV122(pages)}catch{
  return fail(res,422,'V122_SOURCE_PROTECTION_ERROR','Protezione della fonte non valida.');
 }
 const instructions=modelInstructionV122();
 const messages=[{role:'system',content:instructions},{role:'user',content:JSON.stringify(safePayload)}];
 const outputTokens=Math.min(36000,Math.max(4000,Math.ceil(length/1.4)+pages.length*700+2000));
 const timeout=Math.min(190000,Math.max(60000,Number(req.body.timeoutMs)||150000));
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);
 try{
  const response=await fetch(env.AI_API_URL||ENDPOINT,{
   method:'POST',signal:controller.signal,headers:{
    'Content-Type':'application/json',Authorization:'Bearer '+key},
   body:JSON.stringify({model,temperature:0.1,reasoning_effort:'low',
    max_tokens:outputTokens,response_format:SCHEMA,messages})
  });
  const result=await response.json().catch(()=>null);
  if(response.status===429||response.status===503){
   const after=response.headers.get('Retry-After');
   if(after&&/^\d{1,5}$/u.test(after))res.setHeader('Retry-After',after);
   return fail(res,response.status,response.status===429?'AI_QUOTA_LIMIT':'AI_TEMPORARY_OVERLOAD',
    'Limite del servizio gratuito: checkpoint conservati.',{retryAfterSeconds:after&&/^\d+$/u.test(after)?Number(after):null});
  }
  if(!response.ok)return fail(res,502,'AI_PROVIDER_REJECTED','Il provider non ha accettato la richiesta.');
  const finishReason=result?.choices?.[0]?.finish_reason||null;
  if(finishReason==='length')return fail(res,422,'V122_OUTPUT_TRUNCATED','Risposta interrotta: nessuna pagina del blocco pubblicata.');
  const parsed=parseContent(result?.choices?.[0]?.message?.content);
  if(!Array.isArray(parsed?.pages)||parsed.pages.length!==pages.length||
     parsed.pages.some((p,i)=>p?.id!==pages[i].id))
   return fail(res,422,'V122_PAGE_COUNT_OR_ORDER','Risposta incompleta o con pagine fuori ordine.');
  const audited=parsed.pages.map((p,i)=>{
   const review=auditExplainedPageV122(pages[i],p);
   return {...p,review};
  });
  return res.status(200).json({engine:'ai',version:EXPLAINED_POLICY_V122,
   pages:audited,model,finishReason,providerRequests:1,
   readyPages:audited.filter(p=>p.review.ready).length,
   semanticCertified:false,privateBandDisclosedToGemini:false});
 }catch(err){
  return fail(res,controller.signal.aborted?504:502,
   controller.signal.aborted?'AI_PROVIDER_TIMEOUT':'AI_PROVIDER_NETWORK',
   'Connessione Gemini interrotta: nessuna nuova versione pubblicata.');
 }finally{clearTimeout(timer);}
}
