// One permanent Gemini explanation per book and displayed page; no expiry.
const DB='studybook-ai-simple-pages',STORE='pages';
function openDb(){return new Promise((resolve,reject)=>{
  if(!globalThis.indexedDB){reject(Error('Archivio persistente non disponibile.'));return;}
  const request=indexedDB.open(DB,1);
  request.onupgradeneeded=()=>{
    const db=request.result;
    if(!db.objectStoreNames.contains(STORE)){
      db.createObjectStore(STORE,{keyPath:'key'}).createIndex('byBook','bookId',{unique:false});
    }
  };
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(request.error||Error('Errore apertura archivio.'));
});}
async function run(mode,action){const db=await openDb();return new Promise((resolve,reject)=>{
  let result;
  try{
    const tx=db.transaction(STORE,mode);
    result=action(tx.objectStore(STORE));
    tx.oncomplete=()=>{db.close();resolve(result?.result);};
    tx.onerror=()=>{db.close();reject(tx.error||Error('Errore archivio.'));};
    tx.onabort=()=>{db.close();reject(tx.error||Error('Operazione interrotta.'));};
  }catch(error){db.close();reject(error);}
});}
const clean=x=>String(x||'').trim();
export function simplePageKeyV50(bookId,label){
  if(!clean(bookId)||!clean(label))throw Error('Identità del libro o della pagina mancante.');
  return JSON.stringify([clean(bookId),clean(label)]);
}
export async function readSimplePageV50(bookId,label){
  if(!bookId||!label)return null;
  return (await run('readonly',s=>s.get(simplePageKeyV50(bookId,label))))||null;
}
export async function saveSimplePageV50({bookId,label,text,bookTitle='',incompleteSource=false}){
  const key=simplePageKeyV50(bookId,label);
  if(!clean(text))throw Error('Spiegazione non valida.');
  const record={key,bookId:clean(bookId),label:clean(label),text:clean(text),
    bookTitle:clean(bookTitle),savedAt:new Date().toISOString(),
    incompleteSource:Boolean(incompleteSource),source:'gemini-manual'};
  // Atomic put: only a successfully generated answer overwrites the old one.
  await run('readwrite',s=>s.put(record));
  return record;
}
export async function listSimplePagesV50(bookId){
  if(!bookId)return [];
  const items=await run('readonly',s=>s.index('byBook').getAll(clean(bookId)));
  return (items||[]).sort((a,b)=>a.label.localeCompare(b.label,'it',{numeric:true}));
}
export async function deleteSimplePagesForBookV50(bookId){
  if(!bookId)return;
  const db=await openDb();return new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE,'readwrite'),store=tx.objectStore(STORE);
    const cursor=store.index('byBook').openKeyCursor(clean(bookId));
    cursor.onsuccess=()=>{const c=cursor.result;if(c){store.delete(c.primaryKey);c.continue();}};
    tx.oncomplete=()=>{db.close();resolve();};
    tx.onerror=()=>{db.close();reject(tx.error);};
    tx.onabort=()=>{db.close();reject(tx.error);};
  });
}
