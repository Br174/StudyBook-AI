import React,{useEffect,useMemo,useRef,useState} from 'react';
import {composeExplainedSheetsV122} from '../lib/explainedLayoutV122.js';
import {explainStudyPageOnDemandV49} from '../lib/pageSimpleV49.js';
import {readSimplePageV50,saveSimplePageV50} from '../lib/simplePagesStoreV50.js';
import {glossaryForExplainedPageV129} from '../lib/explainedMobileLayoutV129.js';
import {requestPageReformulationV132,applyApprovedReformulationsV132} from '../lib/pageReformulationV132.js';
import {readReformulationsV132,acceptReformulationV132} from '../lib/reformulationsStoreV132.js';
import './ExplainedReaderV122.css';

function RichText({value}){
 return <>{String(value||'').split(/(\\*\\*\\([^)\\n]+\\)\\*\\*)/gu).filter(Boolean).map((part,i)=>
  /^\\*\\*\\([^)\\n]+\\)\\*\\*$/u.test(part)?
   <strong key={i}>{part.slice(2,-2)}</strong>:<React.Fragment key={i}>{part}</React.Fragment>)}</>;
}

export default function ExplainedReaderV122({book,bookId='',bookTitle='',chapterIndex=0,onClose,onStudy,onReformulated}){
 const [accepted,setAccepted]=useState(null),[candidate,setCandidate]=useState(null);
 const [rewriteBusy,setRewriteBusy]=useState(false),[rewriteError,setRewriteError]=useState('');
 const [rewriteAttempt,setRewriteAttempt]=useState(0);
 const rewriteRequest=useRef(null);
 useEffect(()=>{
  let live=true;setAccepted(null);setCandidate(null);setRewriteError('');
  if(bookId)void readReformulationsV132(bookId).then(x=>{if(live)setAccepted(x);})
   .catch(e=>{if(live)setRewriteError(e.message);});
  return ()=>{live=false;};
 },[bookId,book?.canonicalBookMap?.originalFingerprint]);
 const readingBook=useMemo(()=>{
  try{return applyApprovedReformulationsV132(book,accepted);}
  catch{return book;} // source changed: preserve the verified original reader
 },[book,accepted]);
 const output=useMemo(()=>composeExplainedSheetsV122(readingBook),[readingBook]);
 const pages=output.pages;
 const [index,setIndex]=useState(0);
 const [simple,setSimple]=useState(null);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const activeRequest=useRef(null);
 const scrollRoot=useRef(null);
 const explanationRef=useRef(null);
 useEffect(()=>{
  const start=book?.chapters?.[chapterIndex]?.pageStart||1;
  const position=pages.findIndex(p=>p.sourcePage===start);
  setIndex(Math.max(0,position));
 },[chapterIndex,book?.canonicalBookMap?.originalFingerprint]);
 const page=pages[Math.min(index,Math.max(0,pages.length-1))];
 const glossary=useMemo(()=>glossaryForExplainedPageV129(page?.rows),[page]);
 useEffect(()=>{
  let active=true;
  setSimple(null);setError('');
  if(bookId&&page?.label)readSimplePageV50(bookId,page.label).then(x=>{
   if(active)setSimple(x);
  }).catch(()=>{});
  return ()=>{active=false;};
 },[bookId,page?.label]);
 useEffect(()=>()=>{
  activeRequest.current?.abort();
  rewriteRequest.current?.abort();
 },[]);
 async function rewritePage(){
  if(!page?.ready||!bookId||rewriteBusy||busy)return;
  rewriteRequest.current?.abort();
  const controller=new AbortController();
  rewriteRequest.current=controller;setRewriteBusy(true);setRewriteError('');
  setRewriteAttempt(0);setCandidate(null);
  try{
   const proposal=await requestPageReformulationV132(book,page.sourcePage,{
    signal:controller.signal,
    onAttempt:attempt=>{if(!controller.signal.aborted)setRewriteAttempt(attempt);}
   });
   if(!controller.signal.aborted)setCandidate(proposal);
  }catch(e){if(!controller.signal.aborted)setRewriteError(e.message||'Riformulazione non riuscita.');}
  finally{if(rewriteRequest.current===controller){rewriteRequest.current=null;setRewriteBusy(false);}}
 }
 async function acceptPage(){
  if(!candidate||rewriteBusy)return;
  setRewriteBusy(true);setRewriteError('');
  try{
   const next=await acceptReformulationV132(bookId,candidate);
   setAccepted(next);setCandidate(null);
   // A bis/tris continuation can disappear after reflow: return to the source page.
   const first=pages.findIndex(p=>p.sourcePage===candidate.sourcePage);
   if(first>=0)setIndex(first);
   onReformulated?.();
  }catch(e){setRewriteError(e.message||'Salvataggio non riuscito.');}
  finally{setRewriteBusy(false);}
 }
 function navigatePage(next){
  const value=Number(next);
  if(!Number.isInteger(value)||value<0||value>=pages.length||value===index)return;
  activeRequest.current?.abort();
  activeRequest.current=null;
  rewriteRequest.current?.abort();rewriteRequest.current=null;
  setRewriteBusy(false);setRewriteAttempt(0);setCandidate(null);setRewriteError('');
  setBusy(false);setError('');
  setIndex(value);
  scrollRoot.current?.scrollTo?.({top:0,behavior:'instant'});
 }
 async function explainAgain(){
  if(!page||busy)return;
  activeRequest.current?.abort();
  const controller=new AbortController();
  activeRequest.current=controller;setBusy(true);setError('');
  try{
   const blocks=page.rows.filter(x=>['paragraph','chapter-title','section-title'].includes(x.kind))
    .map(x=>({kind:x.kind,text:x.text,editionPending:false}));
   if(!blocks.length||!page.ready)throw Error('Questa pagina non è ancora verificata.');
   const result=await explainStudyPageOnDemandV49({
    kind:'text',label:page.label,sourcePage:page.sourcePage,blocks
   },{bookTitle,signal:controller.signal});
   const saved=await saveSimplePageV50({bookId,label:page.label,text:result.text,
    bookTitle,incompleteSource:false});
   if(!controller.signal.aborted){
    setSimple(saved);
    requestAnimationFrame(()=>explanationRef.current?.scrollIntoView?.({
     behavior:'smooth',block:'start'
    }));
   }
  }catch(e){if(!controller.signal.aborted)setError(e?.message||'Spiegazione non disponibile.');}
  finally{if(activeRequest.current===controller){activeRequest.current=null;setBusy(false);}}
 }
 if(!page)return <p role="status">La mappa delle pagine non è disponibile.</p>;
 return <section className="sb-explained-reader" ref={scrollRoot} aria-label="Libro spiegato">
  <header className="sb-explained-toolbar">
   <div className="sb-explained-toolbar-top">
    <button type="button" className="sb-explained-back" onClick={()=>onClose?.()}>← Torna al libro</button>
    <button type="button" className="sb-explained-simple" onClick={()=>void explainAgain()}
      disabled={!page.ready||busy||!bookId}
      title="Genera solo su richiesta; la spiegazione precedente resta memorizzata">
      {busy?'Gemini sta spiegando…':'In parole semplici'}
    </button>
   </div>
   <nav className="sb-explained-page-controls" aria-label="Navigazione pagine Libro spiegato">
    <button type="button" aria-label="Pagina precedente" disabled={index===0}
     onClick={()=>navigatePage(index-1)}>‹</button>
    <label className="sb-explained-page-select">Pagina
     <select value={index} aria-label="Scegli pagina" onChange={e=>navigatePage(Number(e.target.value))}>
      {pages.map((p,i)=><option value={i} key={p.label+'-'+i}>{p.label}</option>)}
     </select>
     <span className="sb-explained-page-total">di {pages.length}</span>
    </label>
    <button type="button" aria-label="Pagina successiva" disabled={index===pages.length-1}
     onClick={()=>navigatePage(index+1)}>›</button>
   </nav>
   {typeof onStudy==='function'&&<button type="button" className="sb-explained-study-link"
    onClick={()=>onStudy()}>Studia: carte, quiz e interrogazione</button>}
  </header>
  {!page.ready&&<p role="status" className="sb-explained-notice">
   {page.draft?'Bozza di Gemini da verificare. Il testo può contenere omissioni.':
    'Il testo elaborato di questa pagina non è ancora disponibile.'}</p>}
  <article className="sb-explained-sheet" aria-label={'Pagina '+page.label}>
   <header className="sb-explained-pagehead sb-rewrite-head">
    <span>Libro spiegato · Pagina {page.label}</span>
    <button type="button" disabled={!page.ready||!bookId||rewriteBusy||busy}
     onClick={()=>void rewritePage()}>{rewriteBusy?'Riformulo…':'Riformula'}</button>
   </header>
   <div className={'sb-explained-grid'+(glossary.length?'':' sb-explained-no-glossary')}>
    <div className="sb-explained-body">
     {page.rows.map((r,i)=><div key={page.label+'-'+i} className="sb-explained-paragraph">
      {r.kind==='chapter-title'?<h2>{r.text}</h2>:
       r.kind==='section-title'?<h3>{r.text}</h3>:
       <p><RichText value={r.text}/></p>}
     </div>)}
    </div>
    {glossary.length>0&&<aside className="sb-explained-sidebar"
      aria-label={'Glossario, in ordine dall’alto: pagina '+page.label}>
     <strong className="sb-explained-sidebar-title">Termini utili</strong>
     {glossary.map((n,i)=><div key={n.term+'-'+i} className="sb-explained-definition">
      <strong>{n.term}</strong><p>{n.definition}</p>
     </div>)}
    </aside>}
   </div>
   <footer>Pagina originale {page.sourcePage}
    {Number.isFinite(page.reduction)&&' · Riduzione '+page.reduction.toFixed(1)+'%'}
   </footer>
  </article>
  {(candidate||rewriteBusy||rewriteError)&&<section className="sb-rewrite-panel">
    <strong>Nuova riformulazione · Pagina {page.label}{String(page.label)!==String(page.sourcePage)?' (originale '+page.sourcePage+')':''}</strong>
    {rewriteBusy&&<p role="status">Gemini riformula dal testo originale. Tentativo {rewriteAttempt||1} di 3. La pagina salvata rimane invariata.</p>}
    {rewriteError&&<p role="alert">{rewriteError}</p>}
    {candidate&&<>
     <article className="sb-rewrite-preview">
      {candidate.segments.map(seg=><p key={seg.id}><RichText value={seg.text}/></p>)}
      {candidate.glossary?.length>0&&<details><summary>Termini utili</summary>
       {candidate.glossary.map((g,i)=><p key={i}><b>{g.term}</b>: {g.definition}</p>)}
      </details>}
      <small>Riduzione: {Number(candidate.review?.reduction||0).toFixed(1)}%</small>
     </article>
     <div className="sb-rewrite-buttons">
      <button type="button" disabled={rewriteBusy} onClick={()=>void acceptPage()}>Tieni riformulazione</button>
      <button type="button" disabled={rewriteBusy} onClick={()=>void rewritePage()}>Riformula ancora</button>
     </div>
    </>}
   </section>}
  <div className="sb-explained-extra" ref={explanationRef}>
   {error&&<p role="alert" className="sb-explained-notice">{error}</p>}
   {simple?.text&&<article aria-label={'Ulteriore spiegazione pagina '+page.label}>
    <strong>In parole semplici · Pagina {page.label}</strong>
    <p style={{whiteSpace:'pre-wrap'}}>{simple.text}</p>
   </article>}
  </div>
 </section>;
}
