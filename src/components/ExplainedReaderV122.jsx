import React,{useEffect,useMemo,useRef,useState} from 'react';
import {composeExplainedSheetsV122} from '../lib/explainedLayoutV122.js';
import {explainStudyPageOnDemandV49} from '../lib/pageSimpleV49.js';
import {readSimplePageV50,saveSimplePageV50} from '../lib/simplePagesStoreV50.js';
import './ExplainedReaderV122.css';

function RichText({value}){
 return <>{String(value||'').split(/(\*\*\([^)\n]+\)\*\*)/gu).filter(Boolean).map((part,i)=>
  /^\*\*\([^)\n]+\)\*\*$/u.test(part)?
   <strong key={i}>{part.slice(2,-2)}</strong>:<React.Fragment key={i}>{part}</React.Fragment>)}</>;
}
export default function ExplainedReaderV122({book,bookId='',bookTitle='',chapterIndex=0,onClose}){
 const output=useMemo(()=>composeExplainedSheetsV122(book),[book]);
 const pages=output.pages;
 const [index,setIndex]=useState(0);
 const [simple,setSimple]=useState(null);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const activeRequest=useRef(null);
 useEffect(()=>{
  const start=book?.chapters?.[chapterIndex]?.pageStart||1;
  const position=pages.findIndex(p=>p.sourcePage===start);
  setIndex(Math.max(0,position));
 },[chapterIndex,book?.canonicalBookMap?.originalFingerprint]);
 const page=pages[Math.min(index,Math.max(0,pages.length-1))];
 useEffect(()=>{
  let active=true;setSimple(null);setError('');
  if(bookId&&page?.label)readSimplePageV50(bookId,page.label).then(x=>{
   if(active)setSimple(x);
  }).catch(()=>{});
  return ()=>{active=false;};
 },[bookId,page?.label]);
 useEffect(()=>()=>activeRequest.current?.abort(),[]);
 async function explainAgain(){
  if(!page||busy)return;
  activeRequest.current?.abort();
  const controller=new AbortController();
  activeRequest.current=controller;setBusy(true);setError('');
  try{
   const text=page.rows.filter(x=>['paragraph','chapter-title','section-title'].includes(x.kind))
     .map(x=>x.text).filter(Boolean);
   if(!text.length||!page.ready)throw Error('Questa pagina non è ancora verificata.');
   const result=await explainStudyPageOnDemandV49({
    kind:'text',label:page.label,sourcePage:page.sourcePage,
    blocks:page.rows.filter(x=>['paragraph','chapter-title','section-title'].includes(x.kind))
      .map(x=>({kind:x.kind,text:x.text,editionPending:false}))
   },{bookTitle,signal:controller.signal});
   const saved=await saveSimplePageV50({bookId,label:page.label,text:result.text,
     bookTitle,incompleteSource:false});
   if(!controller.signal.aborted)setSimple(saved);
  }catch(e){if(!controller.signal.aborted)setError(e?.message||'Spiegazione non disponibile.');}
  finally{if(activeRequest.current===controller){activeRequest.current=null;setBusy(false);}}
 }
 if(!page)return <p role="status">La mappa delle pagine non è disponibile.</p>;
 return <section className="sb-explained-reader" aria-label="Libro spiegato">
  <div className="sb-explained-toolbar">
   <button type="button" onClick={()=>onClose?.()}>← Torna al libro</button>
   <label>Pagina <select value={index} onChange={e=>setIndex(Number(e.target.value))}>
    {pages.map((p,i)=><option value={i} key={p.label+'-'+i}>{p.label}</option>)}
   </select></label>
   <button type="button" disabled={index===0} onClick={()=>setIndex(Math.max(0,index-1))}>‹</button>
   <button type="button" disabled={index===pages.length-1} onClick={()=>setIndex(Math.min(pages.length-1,index+1))}>›</button>
  </div>
  {!page.ready&&<p role="status" className="sb-explained-notice">
   Pagina {page.label} non ancora verificata. Il testo originale rimane conservato.</p>}
  <article className="sb-explained-sheet" aria-label={'Pagina '+page.label}
   style={{aspectRatio:page.widthMm+' / '+page.heightMm}}>
   <header className="sb-explained-pagehead">Libro spiegato · Pagina {page.label}</header>
   <div className="sb-explained-grid">
    {page.rows.map((r,i)=><React.Fragment key={page.label+'-'+i}>
      <div className="sb-explained-body sb-explained-row-body">
       {r.kind==='chapter-title'?<h2>{r.text}</h2>:
        r.kind==='section-title'?<h3>{r.text}</h3>:
        <p><RichText value={r.text}/></p>}
      </div>
      <aside className="sb-explained-sidebar sb-explained-row-aside"
       aria-label={'Termini spiegati accanto al testo: pagina '+page.label}>
       {(r.notes||[]).map((n,j)=><div key={j} className="sb-explained-definition">
        <strong>{n.term}</strong><p>{n.definition}</p>
       </div>)}
      </aside>
    </React.Fragment>)}
   </div>
   <footer>Pagina originale {page.sourcePage}
    {Number.isFinite(page.reduction)&&' · Riduzione '+page.reduction.toFixed(1)+'%'}
   </footer>
  </article>
  <div className="sb-explained-extra">
   <button type="button" onClick={()=>void explainAgain()} disabled={!page.ready||busy||!bookId}>
    {busy?'Gemini sta spiegando la pagina…':'In parole semplici · Spiega ancora'}
   </button>
   {error&&<p role="alert">{error}</p>}
   {simple?.text&&<article aria-label={'Ulteriore spiegazione pagina '+page.label}>
    <strong>Spiegazione su richiesta · Pagina {page.label}</strong>
    <p style={{whiteSpace:'pre-wrap'}}>{simple.text}</p>
   </article>}
  </div>
 </section>;
}
