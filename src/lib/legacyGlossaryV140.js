// LAB140 legacy-page glossary, generated ONLY on explicit reader button tap.
// IndexedDB persists 1 compact glossary per book, source page and current
// explained text; the automatic 50% generation never calls this module.
import {apiEndpoint} from './apiEndpoint.js';
const DB='studybook-ai-legacy-glossary-v140',STORE='entries';
function textHash(text){
 let hash=2166136261;
 const s=String(text||'');
 for(let i=0;i<s.length;i++){hash^=s.charCodeAt(i);
  hash=Math.imul(hash,16777619);}
 return (hash>>>0).toString(16).padStart(8,'0')+'-'+s.length;
}
export function glossaryCacheKeyV140(bookId,fingerprint,sourcePage,explainedText){
 if(!bookId||!/^[a-f0-9]{64}$/iu.test(String(fingerprint||''))||
    !Number.isInteger(Number(sourcePage))||Number(sourcePage)<1)
  throw Error('Identità libro non valida per il glossario.');
 return JSON.stringify([String(bookId),fingerprint,Number(sourcePage),
  textHash(explainedText)]);
}
function openDb(){
 return new Promise((resolve,reject)=>{
  if(!globalThis.indexedDB){reject(Error('Archivio glossario non disponibile.'));return;}
  const r=indexedDB.open(DB,1);
  r.onupgradeneeded=()=>{
   const db=r.result;
   if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE,{keyPath:'key'});
  };
  r.onsuccess=()=>resolve(r.result);
  r.onerror=()=>reject(r.error||Error('Archivio glossario non accessibile.'));
 });
}
async function withStore(mode,callback){
 const db=await openDb();
 return new Promise((resolve,reject)=>{
  try{
   const tx=db.transaction(STORE,mode),request=callback(tx.objectStore(STORE));
   tx.oncomplete=()=>{const value=request?.result;db.close();resolve(value);};
   tx.onerror=()=>{db.close();reject(tx.error||Error('Salvataggio glossario non riuscito.'));};
   tx.onabort=()=>{db.close();reject(tx.error||Error('Operazione glossario interrotta.'));};
  }catch(e){db.close();reject(e);}
 });
}
export async function readLegacyGlossaryV140(key){
 if(!key)return null;
 return (await withStore('readonly',store=>store.get(key)))||null;
}
export async function saveLegacyGlossaryV140(key,glossary){
 if(typeof key!=='string'||!Array.isArray(glossary))throw Error('Glossario non valido.');
 const entries=glossary.slice(0,4).map(x=>({
  term:String(x.term||'').trim(),definition:String(x.definition||'').trim()
 })).filter(x=>x.term&&x.definition);
 const record={key,glossary:entries,savedAt:new Date().toISOString()};
 await withStore('readwrite',store=>store.put(record));
 return record;
}
export async function requestLegacyGlossaryV140({originalText,explainedText,signal}={}){
 if(!String(originalText||'').trim()||!String(explainedText||'').trim())
  throw Error('Testo della pagina non disponibile.');
 const response=await fetch(apiEndpoint('/api/glossary/v140'),{
  method:'POST',signal,headers:{'Content-Type':'application/json'},
  body:JSON.stringify({originalText,explainedText})
 });
 const data=await response.json().catch(()=>null);
 if(!response.ok){
  if(response.status===429||response.status===503)
   throw Error('Gemini temporaneamente indisponibile: definizioni non modificate. Riprovi più tardi.');
  throw Error('Definizioni non disponibili. Il riassunto rimane invariato.');
 }
 if(!Array.isArray(data?.glossary))throw Error('Formato glossario non valido.');
 return data.glossary;
}
