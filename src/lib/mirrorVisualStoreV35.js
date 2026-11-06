// LAB35 durable, content-addressed original-PDF page visual catalog.
// Saves every inspected page including "0 figures" to avoid rescanning
// all pages after a crash, without storing any image bytes.
const DB='studybook-ai-mirror',VERSION=1,STORE='visual-pages';
function dbOpen(){
  return new Promise((resolve,reject)=>{
    if(!globalThis.indexedDB){reject(new Error('Archivio pagine non disponibile'));return;}
    const q=indexedDB.open(DB,VERSION);
    q.onupgradeneeded=()=>{const db=q.result;
      if(!db.objectStoreNames.contains(STORE)){
        const s=db.createObjectStore(STORE,{keyPath:'key'});
        s.createIndex('signature','signature');
      }
    };
    q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);
  });
}
const ask=r=>new Promise((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
export async function loadMirrorVisualPages(signature){
  let db;try{db=await dbOpen();const rows=await ask(
    db.transaction(STORE,'readonly').objectStore(STORE).index('signature').getAll(signature));
    return new Map((rows||[]).filter(r=>Number.isInteger(r.pageNumber)&&r.pageNumber>0
      &&Array.isArray(r.anchors)).map(r=>[r.pageNumber,r]));
  }catch{return new Map();}finally{db?.close();}
}
export async function saveMirrorVisualPage(signature,pageNumber,visual={}){
  let db;try{
    db=await dbOpen();
    await new Promise((resolve,reject)=>{
      const tx=db.transaction(STORE,'readwrite');
      tx.objectStore(STORE).put({
        key:signature+':'+pageNumber,signature,pageNumber,
        anchors:visual.anchors||[],review:visual.review||[],
        rasterCount:Number(visual.rasterCount||0),
        vectorCount:Number(visual.vectorCount||0),
        pageWidthPt:Number(visual.pageWidthPt||0),
        pageHeightPt:Number(visual.pageHeightPt||0),
        updatedAt:new Date().toISOString(),
      });
      tx.oncomplete=resolve;
      tx.onerror=()=>reject(tx.error||new Error('Pagina visiva non salvata'));
      tx.onabort=()=>reject(tx.error||new Error('Scrittura visiva annullata'));
    });
    return true;
  }catch{return false;}finally{db?.close();}
}
