// LAB132: store accepted page edits and immutable PDF snapshots separately.
// IndexedDB only; no cloud charge, and NEVER mutate the original studyBook.
const NAME='studybook-ai-reformulations-v132';
const STATE='states',DOCS='pdfs';
function open() {
 return new Promise((resolve,reject)=>{
  if(!globalThis.indexedDB)return reject(Error('Archivio locale non disponibile.'));
  const request=indexedDB.open(NAME,1);
  request.onupgradeneeded=()=>{
   const db=request.result;
   if(!db.objectStoreNames.contains(STATE))db.createObjectStore(STATE,{keyPath:'id'});
   if(!db.objectStoreNames.contains(DOCS)){
    const store=db.createObjectStore(DOCS,{keyPath:'id'});
    store.createIndex('bookId','bookId');
   }
  };
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(request.error||Error('Archivio riformulazioni non disponibile.'));
 });
}
async function transact(name,mode,act){
 const db=await open();
 try{return await new Promise((resolve,reject)=>{
  const tx=db.transaction(name,mode),store=tx.objectStore(name);
  let req;
  try{req=act(store)}catch(e){tx.abort();reject(e);return;}
  tx.oncomplete=()=>resolve(req?.result);
  tx.onerror=()=>reject(tx.error||Error('Salvataggio non riuscito.'));
  tx.onabort=()=>reject(tx.error||Error('Operazione annullata.'));
 });}finally{db.close();}
}
const blank=(id,fingerprint)=>({id,sourceFingerprint:fingerprint,
 revision:0,exportedRevision:0,accepted:{},updatedAt:null});
export async function readReformulationsV132(bookId) {
 if(!bookId)return null;
 return (await transact(STATE,'readonly',s=>s.get(bookId)))||null;
}
export async function acceptReformulationV132(bookId,answer) {
 if(!bookId||!answer?.sourceFingerprint||!Number.isInteger(answer.sourcePage)||
    answer.sourcePage<1||!answer.review?.ready||!answer.segments?.length)
  throw Error('Riformulazione non verificata: nessuna modifica salvata.');
 const existing=await readReformulationsV132(bookId);
 if(existing?.sourceFingerprint&&existing.sourceFingerprint!==answer.sourceFingerprint)
  throw Error('La fonte originale è cambiata; non sovrascrivo le riformulazioni salvate.');
 const current=existing||blank(bookId,answer.sourceFingerprint);
 const next={...current,revision:current.revision+1,updatedAt:new Date().toISOString(),
  accepted:{...current.accepted,[String(answer.sourcePage)]:{
   ...answer,approvedAt:new Date().toISOString()
  }}};
 await transact(STATE,'readwrite',s=>s.put(next));
 return next;
}
export async function storeReworkedPdfV132(bookId,sourceFingerprint,revision,document){
 if(!(document?.blob instanceof Blob)||!document.blob.size||revision<1)
  throw Error('PDF non valido: nessuna nuova versione pubblicata.');
 const state=await readReformulationsV132(bookId);
 if(!state||state.sourceFingerprint!==sourceFingerprint||state.revision!==revision)
  throw Error('Le riformulazioni sono cambiate: ricreare il PDF dalla versione aggiornata.');
 const now=new Date().toISOString();
 const id=bookId+'-'+revision+'-'+Date.now();
 const entry={id,bookId,sourceFingerprint,revision,fileName:document.fileName,
  pages:document.sourcePages,acceptedCount:Object.keys(state.accepted).length,
  createdAt:now,blob:document.blob};
 await transact(DOCS,'readwrite',s=>s.put(entry));
 await transact(STATE,'readwrite',s=>s.put({...state,exportedRevision:revision,updatedAt:now}));
 return entry;
}
export async function readReworkedPdfV132(id){
 return (await transact(DOCS,'readonly',s=>s.get(id)))||null;
}
export async function catalogReformulationsV132(bookIds=[]){
 const valid=new Set(bookIds);
 if(!valid.size)return {states:{},pdfs:[]};
 const db=await open();
 try{
  const getAll=name=>new Promise((resolve,reject)=>{
   const r=db.transaction(name,'readonly').objectStore(name).getAll();
   r.onsuccess=()=>resolve(r.result||[]);r.onerror=()=>reject(r.error);
  });
  const [states,pdfs]=await Promise.all([getAll(STATE),getAll(DOCS)]);
  return {states:Object.fromEntries(states.filter(s=>valid.has(s.id)).map(s=>[s.id,{
   revision:s.revision,exportedRevision:s.exportedRevision,
   acceptedCount:Object.keys(s.accepted||{}).length,
   updatedAt:s.updatedAt
  }])),pdfs:pdfs.filter(p=>valid.has(p.bookId)).map(({blob,...p})=>p)
   .sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)))};
 }finally{db.close();}
}
export async function deleteReformulationsV132(bookId){
 const db=await open();
 try {
  const docs=await new Promise((resolve,reject)=>{
   const r=db.transaction(DOCS,'readonly').objectStore(DOCS).index('bookId').getAllKeys(bookId);
   r.onsuccess=()=>resolve(r.result||[]);r.onerror=()=>reject(r.error);
  });
  await new Promise((resolve,reject)=>{
   const tx=db.transaction([STATE,DOCS],'readwrite');
   tx.objectStore(STATE).delete(bookId);
   for(const key of docs)tx.objectStore(DOCS).delete(key);
   tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
  });
 }finally{db.close();}
}
