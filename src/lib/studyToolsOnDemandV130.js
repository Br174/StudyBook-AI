// LAB130 — one explicit tap = one bounded Gemini study request.
// No synthetic local fallback. Last successful result persisted until Rigenera.
import {apiEndpoint} from './apiEndpoint.js';
import {STUDY_TOOLS_CONTRACT_V130,compactV130,
 studyToolPayloadV130,auditStudyToolItemsV130} from './studyToolsV130Policy.js';
const DB_NAME='StudyBook-StudyTools-V130',STORE='decks',memory=new Map();
const MAX_ITEMS_BYTES=45000;
const MAX_TEXT=13500;
export function buildStudyToolSourceV130(book,{scope='page',chapterIndex=0,
 paragraphIndex=0}={}){
 const chapters=Array.isArray(book?.chapters)?book.chapters:[];
 const chapter=chapters[chapterIndex]||{};
 const reference=(ch,p,i)=>({
  title:compactV130(p?.sourceSection||ch?.title||'').slice(0,120),
  page:String(p?.sourcePageStart||ch.pageStart||i+1),
  text:String(p?.original||'')
 });
 let raw=[];
 if(scope==='page'){
  const p=chapter?.paragraphs?.[Math.max(0,paragraphIndex)];
  if(p)raw=[reference(chapter,p,Math.max(0,paragraphIndex))];
 }else if(scope==='chapter'){
  raw=(chapter?.paragraphs||[]).map((p,i)=>reference(chapter,p,i));
 }else{
  // Sampling 2000 pages must NOT normalize/read every chapter body on a tap.
  // Keep only tiny references, then inspect the selected original passages.
  const references=[];
  for(const ch of chapters){
   for(const [i,p] of (ch?.paragraphs||[]).entries()){
    if(typeof p?.original==='string'&&p.original.length>=35)
     references.push({ch,p,i});
   }
  }
  if(references.length<=18)raw=references.map(({ch,p,i})=>reference(ch,p,i));
  else{
   const selected=new Set();
   for(let k=0;k<18;k++)
    selected.add(Math.floor(k*(references.length-1)/17));
   raw=[...selected].map(i=>{
    const x=references[i];return reference(x.ch,x.p,x.i);
   });
  }
  var allAvailable=references.length;
 }
 const total=scope==='book'?allAvailable:raw.length;
 const eligible=raw.filter(p=>p.text.length>=35);
 let budget=MAX_TEXT;const passages=[];
 for(const item of eligible){
  if(budget<35)break;
  const text=compactV130(item.text.slice(0,budget));
  if(text.length<35)continue;
  passages.push({...item,text});budget-=text.length;
 }
 return {passages,
  sampled:passages.length<total||
   eligible.some((p,i)=>p.text.length>passages[i]?.text?.length),
  available:total,title:chapter?.title||''};
}
function hash(value){
 let h=2166136261;
 for(const letter of String(value||'')){
  h^=letter.charCodeAt(0);
  h=Math.imul(h,16777619)>>>0;
 }
 return h.toString(16).padStart(8,'0');
}
export function studyToolCacheKeyV130(bookId,tool,scope,passages){
 const fingerprint=(passages||[]).map(p=>p.page+':'+p.text.length+':'+p.text).join('\u0000');
 return [STUDY_TOOLS_CONTRACT_V130,
  String(bookId||'temporary').replace(/[^a-z0-9_-]/gi,'').slice(0,90),
  tool,scope,hash(fingerprint),fingerprint.length].join('|');
}
async function database(){
 if(typeof indexedDB==='undefined')return null;
 return new Promise(resolve=>{
  try{
   const request=indexedDB.open(DB_NAME,1);
   request.onupgradeneeded=()=>request.result.createObjectStore(STORE);
   request.onsuccess=()=>resolve(request.result);
   request.onerror=()=>resolve(null);
   request.onblocked=()=>resolve(null);
  }catch{resolve(null)}
 });
}
async function storeOperation(key,writeValue){
 const db=await database();
 if(!db)return null;
 return new Promise(resolve=>{
  try{
   const tx=db.transaction(STORE,writeValue?'readwrite':'readonly');
   const req=writeValue?tx.objectStore(STORE).put(writeValue,key):
    tx.objectStore(STORE).get(key);
   req.onsuccess=()=>resolve(writeValue||req.result||null);
   req.onerror=()=>resolve(null);
   tx.oncomplete=()=>db.close();
   tx.onerror=()=>db.close();
  }catch{try{db.close()}catch{}resolve(null)}
 });
}
export async function savedStudyToolsV130(key){
 if(memory.has(key))return memory.get(key);
 const stored=await storeOperation(key);
 if(stored?.contract===STUDY_TOOLS_CONTRACT_V130&&Array.isArray(stored.items)){
  memory.set(key,stored);return stored;
 }
 return null;
}
export async function saveStudyToolsV130(key,record){
 const encoded=JSON.stringify(record);
 if(encoded.length>MAX_ITEMS_BYTES)throw Error('Schede troppo grandi da salvare.');
 memory.set(key,record);
 await storeOperation(key,record);
 return record;
}
export async function generateStudyToolsV130({tool,scope,chapterTitle,
 passages,sampled=false,signal}){
 const input=studyToolPayloadV130({tool,scope,chapterTitle,passages,sampled});
 if(!input.ok)throw Object.assign(new Error(
  'Seleziona un paragrafo originale abbastanza completo da studiare.'),{code:input.code});
 const response=await fetch(apiEndpoint('/api/study-tools/v130'),{
  method:'POST',headers:{'Content-Type':'application/json'},
  signal,body:JSON.stringify(input)
 });
 const payload=await response.json().catch(()=>null);
 if(!response.ok){
  const err=new Error(payload?.error||'Gemini non disponibile per questa attività.');
  err.code=payload?.code||'HTTP_'+response.status;
  err.status=response.status;
  err.retryAfterSeconds=payload?.retryAfterSeconds||null;
  throw err;
 }
 if(payload?.contract!==STUDY_TOOLS_CONTRACT_V130||payload.tool!==tool)
  throw new Error('Worker dello studio non compatibile: nessuna scheda salvata.');
 const audit=auditStudyToolItemsV130(tool,
  // The server returns display-normalized shapes, so validate the original evidence
  // against exactly the same source again before accepting local persistence.
  (payload.items||[]).map(item=>tool==='flashcards'?
   {...item,question:item.front,answer:item.back}:item),input.passages);
 if(!audit.items.length)throw new Error(
  'Gemini non ha prodotto domande verificabili da questo testo.');
 return {contract:STUDY_TOOLS_CONTRACT_V130,tool,
  items:audit.items,createdAt:Date.now(),model:payload.model||'Gemini gratuito',
  sampled:input.sampled,sourceChars:input.sourceChars,
  note:'Generato da Gemini; evidenze testuali verificate, non certificazione semantica.'};
}
