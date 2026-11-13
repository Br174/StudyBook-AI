// LAB126 isolated two-phase Gemini endpoint. No deployment without a separate verified gate.
import {
 EXPLAINED_POLICY_V126,comprehensionInstructionV126,comprehensionPayloadV126,
 auditComprehensionV126,lessonInstructionV126,lessonPayloadV126,auditExplainedPageV126
} from '../src/lib/explainedStagesV126.js';
import {normalizeExplainedAnchorsV122} from '../src/lib/explainedPolicyV122.js';
import {invoke503FailoverV114} from '../src/lib/study503FailoverV114.js';

const ENDPOINT='https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
const ALLOWED=new Set(['gemini-3.5-flash-lite','gemini-3.1-flash-lite']);
const MAX_SOURCE_CHARS=42000;
const fail=(res,status,code,error,extra={})=>res.status(status).json({code,error,...extra});
const string={type:'string'};
const conceptSegment={type:'object',additionalProperties:false,
 properties:{id:string,concepts:{type:'array',items:string}},required:['id','concepts']};
const understandingPage={type:'object',additionalProperties:false,
 properties:{id:string,segments:{type:'array',items:conceptSegment},
 connections:{type:'array',items:string}},required:['id','segments','connections']};
const explainedSegment={type:'object',additionalProperties:false,
 properties:{id:string,text:string},required:['id','text']};
const glossaryEntry={type:'object',additionalProperties:false,
 properties:{term:string,definition:string},required:['term','definition']};
const explainedPage={type:'object',additionalProperties:false,
 properties:{id:string,segments:{type:'array',items:explainedSegment},
 glossary:{type:'array',items:glossaryEntry}},required:['id','segments','glossary']};
function schemaFor(phase){
 return {type:'json_schema',json_schema:{
  name:phase==='comprehend'?'studybook_lab126_comprehension':'studybook_lab126_explained',
  strict:true,schema:{type:'object',additionalProperties:false,
   properties:{pages:{type:'array',items:phase==='comprehend'?understandingPage:explainedPage}},
   required:['pages']}}};
}
function parseContent(value){
 if(typeof value!=='string'||value.length>800000)return null;
 try{return JSON.parse(value.trim().replace(/^\x60{3}(?:json)?\s*/iu,'')
  .replace(/\s*\x60{3}$/u,''))}catch{return null}
}
export default async function handler(req,res){
 res.setHeader('X-StudyBook-Phase-Contract','lab126');
 if(req.method!=='POST'){res.setHeader('Allow','POST');
  return fail(res,405,'METHOD_NOT_ALLOWED','Usare POST.');}
 const env=req.env||{},key=env.AI_API_KEY||env.GEMINI_API_KEY;
 if(!key)return fail(res,503,'AI_NOT_CONFIGURED','Gemini gratuito non configurato.');
 const model=env.AI_MODEL||'gemini-3.5-flash-lite';
 if(!ALLOWED.has(model))return fail(res,503,'AI_MODEL_NOT_ALLOWLISTED','Modello non consentito.');
 const {policy,phase,pages,bookContext}=req.body||{};
 if(policy!==EXPLAINED_POLICY_V126||!['comprehend','explain'].includes(phase)||
    !Array.isArray(pages)||pages.length<1||pages.length>72)
  return fail(res,400,'V126_REQUEST_INVALID','Protocollo LAB126 non valido.');
 const seenPages=new Set(),seenSegments=new Set();
 let sourceLength=0;
 for(const page of pages){
  if(!page||typeof page.id!=='string'||!/^p[1-9]\d*$/u.test(page.id)||
    seenPages.has(page.id)||!Array.isArray(page.segments)||!page.segments.length||
    page.segments.length>70)
   return fail(res,400,'V126_SOURCE_PAGE_INVALID','Fonte pagina non valida.');
  seenPages.add(page.id);
  for(const segment of page.segments){
   if(!segment||typeof segment.id!=='string'||!segment.id.startsWith(page.id+'-s')||
      seenSegments.has(segment.id)||typeof segment.source!=='string'||
      !segment.source.trim())
    return fail(res,400,'V126_SOURCE_SEGMENT_INVALID','Fonte segmento non valida.');
   seenSegments.add(segment.id);sourceLength+=segment.source.length;
  }
  if(phase==='explain'&&!auditComprehensionV126(page,page.comprehension).ready)
   return fail(res,422,'V126_COMPREHENSION_REQUIRED','Comprensione della pagina non verificata.');
 }
 if(sourceLength>MAX_SOURCE_CHARS)
  return fail(res,413,'V126_BLOCK_TOO_LARGE','Blocco troppo grande per il Worker.');
 if(phase==='explain'&&(!Array.isArray(bookContext)||bookContext.length>100||
   bookContext.some(x=>typeof x!=='string'||x.length>500)))
  return fail(res,422,'V126_CONTEXT_INVALID','Raccordi libro non verificabili.');
 const input=phase==='comprehend'
  ?comprehensionPayloadV126(pages)
  :lessonPayloadV126(pages,pages.map(p=>p.comprehension),bookContext);
 const messages=[{role:'system',content:phase==='comprehend'
   ?comprehensionInstructionV126():lessonInstructionV126()},
  {role:'user',content:JSON.stringify(input)}];
 const outputTokens=Math.min(36000,Math.max(4000,
  Math.ceil(sourceLength*(phase==='comprehend'?0.8:0.82))+
  pages.length*500+2000));
 const timeout=Math.min(190000,Math.max(60000,Number(req.body.timeoutMs)||150000));
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);
 try{
  const invoke=async selectedModel=>{
   const response=await fetch(env.AI_API_URL||ENDPOINT,{
    method:'POST',signal:controller.signal,headers:{
     'Content-Type':'application/json',Authorization:'Bearer '+key},
    body:JSON.stringify({model:selectedModel,temperature:0.1,reasoning_effort:'low',
     max_tokens:outputTokens,response_format:schemaFor(phase),messages})
   });
   return {response,payload:await response.json().catch(()=>null)};
  };
  const first=Date.now();
  const outcome=await invoke503FailoverV114({
   enabled:env.STUDYBOOK_LAB123_503_FAILOVER==='1',
   primaryModel:model,invoke,signal:controller.signal,deadlineMs:first+timeout
  });
  const upstream=outcome.response,result=outcome.payload;
  if(upstream.status===429||upstream.status===503){
   const after=upstream.headers?.get?.('Retry-After')||null;
   if(after&&/^\d{1,5}$/u.test(after))res.setHeader('Retry-After',after);
   return fail(res,upstream.status,upstream.status===429?'AI_QUOTA_LIMIT':'AI_TEMPORARY_OVERLOAD',
    'Gemini temporaneamente non disponibile. Checkpoint conservati.',{
      retryAfterSeconds:after&&/^\d+$/u.test(after)?Number(after):null,
      providerRequests:outcome.attempts});
  }
  if(!upstream.ok)return fail(res,502,'AI_PROVIDER_REJECTED','Risposta Gemini non accettata.');
  if(result?.choices?.[0]?.finish_reason==='length')
   return fail(res,422,'V126_OUTPUT_TRUNCATED','Output interrotto, nessuna pagina del blocco approvata.');
  const parsed=parseContent(result?.choices?.[0]?.message?.content);
  if(!Array.isArray(parsed?.pages)||parsed.pages.length!==pages.length||
     parsed.pages.some((p,i)=>p?.id!==pages[i].id))
   return fail(res,422,'V126_PAGE_COUNT_OR_ORDER','Pagine incomplete o fuori ordine.');
  const audited=parsed.pages.map((p,i)=>{
   if(phase==='comprehend')
    return {...p,review:auditComprehensionV126(pages[i],p)};
   const normalized=normalizeExplainedAnchorsV122(p);
   return {...normalized,review:auditExplainedPageV126(pages[i],normalized,pages[i].comprehension)};
  });
  return res.status(200).json({engine:'ai',version:EXPLAINED_POLICY_V126,
   phase,pages:audited,model:outcome.model,providerRequests:outcome.attempts,
   validated:audited.filter(p=>p.review.ready).length,
   semanticCertified:false,privateBandDisclosedToGemini:false});
 }catch{
  return fail(res,controller.signal.aborted?504:502,
   controller.signal.aborted?'AI_PROVIDER_TIMEOUT':'AI_PROVIDER_NETWORK',
   'Connessione Gemini interrotta, checkpoint salvati.');
 }finally{clearTimeout(timer);}
}