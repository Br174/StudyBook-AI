import React,{useEffect,useMemo,useRef,useState} from 'react';
import {composeExplainedSheetsV122} from '../lib/explainedLayoutV122.js';
import {explainStudyPageOnDemandV49} from '../lib/pageSimpleV49.js';
import {readSimplePageV50,saveSimplePageV50} from '../lib/simplePagesStoreV50.js';
import {glossaryForExplainedPageV129} from '../lib/explainedMobileLayoutV129.js';
import {glossaryCacheKeyV140,readLegacyGlossaryV140,
 saveLegacyGlossaryV140,requestLegacyGlossaryV140} from '../lib/legacyGlossaryV140.js';
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
 const rewriteRequest=useRef(null);
 const rewriteVariant=useRef(0);
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
 const automaticGlossary=useMemo(()=>glossaryForExplainedPageV129(page?.rows),[page]);
 const [manualGlossary,setManualGlossary]=useState(null);
 const [glossaryBusy,setGlossaryBusy]=useState(false);
 const [glossaryError,setGlossaryError]=useState('');
 const glossaryRequest=useRef(null);
 const explainedFullText=useMemo(()=>(readingBook?.editionsV36?.pages?.[page?.sourcePage-1]?.segments||[])
  .map(part=>String(part.text||'')).join('\n'),[readingBook,page?.sourcePage]);
 const glossaryKey=useMemo(()=>{
  try{return glossaryCacheKeyV140(bookId,
    book?.canonicalBookMap?.originalFingerprint,page?.sourcePage,explainedFullText);}
  catch{return null;}
 },[bookId,book?.canonicalBookMap?.originalFingerprint,page?.sourcePage,explainedFullText]);
 const glossary=automaticGlossary.length?automaticGlossary:
  manualGlossary?.key===glossaryKey?manualGlossary.glossary||[]:[];
 useEffect(()=>{
  if(!glossaryKey||automaticGlossary.length){setManualGlossary(null);return;}
  let live=true;
  void readLegacyGlossaryV140(glossaryKey).then(saved=>{
   if(live)setManualGlossary(saved||null);
  }).catch(()=>{});
  return ()=>{live=false;};
 },[glossaryKey,automaticGlossary.length]);
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
  glossaryRequest.current?.abort();
 },[]);
 async function rewritePage(){
  if(!page?.ready||!bookId||rewriteBusy||busy)return;
  rewriteRequest.current?.abort();
  const controller=new AbortController();
  rewriteRequest.current=controller;setRewriteBusy(true);setRewriteError('');
  setCandidate(null);
  try{
   const proposal=await requestPageReformulationV132(book,page.sourcePage,{
    signal:controller.signal,variant:++rewriteVariant.current});
   if(!controller.signal.aborted)setCandidate(proposal);
  }catch(e){if(!controller.signal.aborted)setRewriteError(e.message||'Riformulazione non riuscita.');}
  finally{if(rewriteRequest.current===controller){rewriteRequest.current=null;setRewriteBusy(false);}}
 }
 function keepCurrentPage(){
  // Discard only the proposal. No change to book, accepted revisions or IndexedDB.
  setCandidate(null);setRewriteError('');
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
  glossaryRequest.current?.abort();glossaryRequest.current=null;
  setGlossaryBusy(false);setGlossaryError('');setManualGlossary(null);
  setRewriteBusy(false);setCandidate(null);setRewriteError('');
  setBusy(false);setError('');rewriteVariant.current=0;
  setIndex(value);
  scrollRoot.current?.scrollTo?.({top:0,behavior:'instant'});
 }
 async function defineLegacyTerms(){
  if(!page?.ready||!bookId||!glossaryKey||glossaryBusy)return;
  const originalText=String(book?.canonicalBookMap?.pages?.[page.sourcePage-1]?.text||'');
  if(!originalText.trim()||!explainedFullText.trim()){
   setGlossaryError('La pagina originale o spiegata non è disponibile.');return;
  }
  glossaryRequest.current?.abort();
  const controller=new AbortController();glossaryRequest.current=controller;
  setGlossaryBusy(true);setGlossaryError('');
  try{
   const items=await requestLegacyGlossaryV140({
    originalText,explainedText:explainedFullText,signal:controller.signal});
   if(controller.signal.aborted)return;
   const saved=await saveLegacyGlossaryV140(glossaryKey,items);
   if(!controller.signal.aborted){
    setManualGlossary(saved);
    if(!saved.glossary.length)setGlossaryError('Nessun termine tecnico riconosciuto in questa pagina.');
   }
  }catch(error){
   if(!controller.signal.aborted)
    setGlossaryError(error?.message||'Definizioni non disponibili.');
  }finally{
   if(glossaryRequest.current===controller){
    glossaryRequest.current=null;setGlossaryBusy(false);
   }
  }
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
 const showGlossarySidebar=glossary.length>0||Boolean(page.ready&&bookId);
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
   <div className={'sb-explained-grid'+(showGlossarySidebar?'':' sb-explained-no-glossary')}>
    <div className="sb-explained-body">
     {page.rows.map((r,i)=><div key={page.label+'-'+i} className="sb-explained-paragraph">
      {r.kind==='chapter-title'?<h2>{r.text}</h2>:
       r.kind==='section-title'?<h3>{r.text}</h3>:
       <p><RichText value={r.text}/></p>}
     </div>)}
    </div>
    {showGlossarySidebar&&<aside className="sb-explained-sidebar"
      aria-label={'Glossario, in ordine dall’alto: pagina '+page.label}>
     <strong className="sb-explained-sidebar-title">Termini utili</strong>
     {glossary.map((n,i)=><div key={n.term+'-'+i} className="sb-explained-definition">
      <strong>{n.term}</strong><p>{n.definition}</p>
     </div>)}
     {glossary.length===0&&<div className="sb-explained-glossary-request">
      <p>Questa pagina non ha definizioni salvate.</p>
      <button type="button" disabled={glossaryBusy}
       onClick={()=>void defineLegacyTerms()}>
       {glossaryBusy?'Definizioni in corso…':'Definisci termini'}
      </button>
      <small>Solo su richiesta. Il riassunto e la sua velocità restano invariati.</small>
     </div>}
     {glossaryError&&<small role="alert" className="sb-explained-glossary-error">{glossaryError}</small>}
    </aside>}
   </div>
   <footer>Pagina originale {page.sourcePage}
    {Number.isFinite(page.reduction)&&' · Riduzione '+page.reduction.toFixed(1)+'%'}
   </footer>
  </article>
  {(candidate||rewriteBusy||rewriteError)&&<section className="sb-rewrite-panel">
    <strong>Nuova riformulazione · Pagina {page.label}{String(page.label)!==String(page.sourcePage)?' (originale '+page.sourcePage+')':''}</strong>
    {rewriteBusy&&<p role="status">Gemini riformula la pagina originale. Una richiesta per ogni pressione; il testo salvato resta invariato.</p>}
    {rewriteError&&<p role="alert">{rewriteError}</p>}
    {candidate&&<>
     <article className="sb-rewrite-preview">
      {candidate.segments.map(seg=><p key={seg.id}><RichText value={seg.text}/></p>)}
      {candidate.glossary?.length>0&&<details><summary>Termini utili</summary>
       {candidate.glossary.map((g,i)=><p key={i}><b>{g.term}</b>: {g.definition}</p>)}
      </details>}
      <small>Riduzione effettiva: {Number(candidate.review?.reduction||0).toFixed(1)}% · Obiettivo circa 50%</small>
      {!candidate.review?.sizeCompliant&&<p role="status">La riduzione è distante dal 50%. Può premere «Riformula ancora» se preferisce una nuova proposta.</p>}
     </article>
     <div className="sb-rewrite-buttons">
      <button type="button" disabled={rewriteBusy} onClick={()=>void acceptPage()}>Tieni riformulazione</button>
      <button type="button" disabled={rewriteBusy} onClick={keepCurrentPage}>Tieni versione corrente</button>
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
