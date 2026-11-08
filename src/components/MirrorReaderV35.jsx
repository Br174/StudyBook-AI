import React,{useMemo,useState,useEffect,useRef} from 'react';
import './MirrorReaderV35.css';
import { composeMirrorPages,actualMirrorPageStatistics } from '../lib/libroSpecchioV35.js';
import { renderMirrorImage } from '../lib/visualMirrorV35.js';
import { explainStudyPageOnDemandV49 } from '../lib/pageSimpleV49.js';
import {readSimplePageV50,saveSimplePageV50} from '../lib/simplePagesStoreV50.js';
export default function MirrorReaderV35({book,originalFile,chapterIndex=0,variant='study',simpleRequestToken=0,bookTitle='',bookId='',onPageChange}){
  const [index,setIndex]=useState(0);
  const [picture,setPicture]=useState(null);
  const [pictureUrl,setPictureUrl]=useState('');
  const [pictureError,setPictureError]=useState('');
  const [pictureBusy,setPictureBusy]=useState(false);
  // LAB50: printed pages always use the verified study edition, never cached explanations.
  const output=useMemo(()=>composeMirrorPages(book?.canonicalBookMap,book,{variant:'study',maxLines:40}),[book]);
  const [simpleLive,setSimpleLive]=useState(null);
  const [saved,setSaved]=useState(null);
  const lastTap=useRef(0),inflight=useRef(new Map()),currentLabel=useRef('');
  const pages=output.pages||[];
  useEffect(()=>{
    const target=book?.chapters?.[chapterIndex]?.pageStart||1;
    const found=pages.findIndex(p=>p.kind==='text'&&p.sourcePage===target);
    setIndex(Math.max(0,found));
  },[chapterIndex]);
  const page=pages[Math.min(index,pages.length-1)];
  currentLabel.current=String(page?.label||'');
  useEffect(()=>{
    let active=true;
    setSimpleLive(null);setSaved(null);
    if(bookId&&page?.label)void readSimplePageV50(bookId,page.label)
      .then(record=>{if(active)setSaved(record);})
      .catch(error=>{if(active)setSimpleLive({label:page.label,status:'error',message:error.message});});
    return ()=>{active=false;};
  },[bookId,page?.label]);
  useEffect(()=>{
    // ONLY the manual button changes this token; switching pages never calls Gemini.
    if(variant!=='simple'||!simpleRequestToken||lastTap.current===simpleRequestToken)return;
    lastTap.current=simpleRequestToken;
    const requested=pages[Math.min(index,pages.length-1)];
    if(!requested)return;
    const label=String(requested.label||''),key=bookId+'::'+label;
    inflight.current.get(key)?.abort();
    const controller=new AbortController();
    inflight.current.set(key,controller);
    setSimpleLive({label,status:'loading'});
    void (async()=>{
      const result=await explainStudyPageOnDemandV49(requested,{bookTitle,signal:controller.signal});
      if(controller.signal.aborted)return;
      const record=await saveSimplePageV50({bookId,label,text:result.text,bookTitle,
        incompleteSource:result.incompleteSource});
      if(controller.signal.aborted)return;
      if(currentLabel.current===label)setSaved(record);
      setSimpleLive({label,status:'ready'});
    })().catch(error=>{
      if(!controller.signal.aborted)setSimpleLive({label,status:'error',
        message:error?.message||'Spiegazione non disponibile.'});
    }).finally(()=>{
      if(inflight.current.get(key)===controller)inflight.current.delete(key);
    });
  },[simpleRequestToken]);
  const navigatePage=next=>{
    setIndex(next);
    onPageChange?.();
  };
  useEffect(()=>{setPicture(null);setPictureUrl('');setPictureError('');},[index]);
  const savedSimple=saved?.label===page?.label?saved:null;
  const pageTotals=actualMirrorPageStatistics(
    book?.canonicalBookMap,book,pages,page?.sourcePage);
  async function showPicture(anchor){
    if(!anchor)return;
    setPicture(anchor);setPictureUrl('');setPictureError('');setPictureBusy(true);
    try {
      if(!originalFile)throw Error('Il PDF originale non è disponibile su questo dispositivo.');
      const url=await renderMirrorImage(originalFile,anchor);
      setPictureUrl(url);
    }catch(error){setPictureError(error?.message||'Figura non disponibile.');}
    finally{setPictureBusy(false);}
  }
  if(!page)return <p role="status">Struttura del libro ancora da verificare.</p>;
  return <div className="sb-mirror-reader">
    {book?.editionReadiness?.partial && <p role="status" className="sb-mirror-warning">ANTEPRIMA PARZIALE · Solo i paragrafi verificati da Gemini sono leggibili. Il libro definitivo non è ancora pubblicato.</p>}
    <nav className="sb-mirror-page-nav">
      <button onClick={()=>navigatePage(Math.max(0,index-1))} disabled={index===0}>←</button>
      <select value={index} onChange={e=>navigatePage(Number(e.target.value))}>
        {pages.map((p,i)=><option key={i} value={i}>Pagina {p.label}</option>)}
      </select>
      <button onClick={()=>navigatePage(Math.min(pages.length-1,index+1))}
        disabled={index>=pages.length-1}>→</button>
    </nav>
    {(output.audit?.problems?.length>0 || book.canonicalBookMap?.structuralStatus!=='source-mapped')&&
      <p className="sb-mirror-warning" role="status">
        La struttura del PDF richiede verifica. Il testo e le immagini originali sono conservati.
      </p>}
    <article className={'sb-mirror-sheet'+(page.kind==='image'?' sb-mirror-image-sheet':'')}
      style={{aspectRatio:(page.widthPt||595.28)+' / '+(page.heightPt||841.89)}}
      aria-label={'Pagina '+page.label}>
      <header className="sb-mirror-page-label">Pagina {page.label}</header>
      {page.kind==='image'?(
        <button className="sb-mirror-preview-button" onClick={()=>showPicture(page.anchor)}>
          {pictureUrl&&picture?.id===page.anchor?.id?
            <img src={pictureUrl} alt={'Immagine originale '+page.label}/>:
            <span>Apri l’immagine {page.imageNumber} del PDF originale</span>}
        </button>
      ):<>
        <div className="sb-mirror-content">
        {variant==='simple' && simpleLive?.label===page.label && simpleLive.status==='loading' &&
          <p role="status" className="sb-simple-live-loading">Gemini prepara la nuova spiegazione. La precedente resta salvata.</p>}
        {variant==='simple' && simpleLive?.label===page.label && simpleLive.status==='error' &&
          <p role="alert" className="sb-simple-live-error">{simpleLive.message} Nessun testo salvato è stato cancellato.</p>}
        {variant==='simple' && savedSimple ?
          <div className="sb-simple-live-answer" role="region" aria-label={'Spiegazione Gemini della pagina '+page.label}>
            <strong>In parole semplici · Pagina {page.label}</strong>
            {savedSimple.incompleteSource && <p role="status">Spiegazione dei soli paragrafi verificati in quel momento.</p>}
            <p style={{whiteSpace:'pre-wrap'}}>{savedSimple.text}</p>
          </div> : <>
            {variant==='simple' && <p className="sb-simple-live-loading">Nessuna spiegazione salvata. Premi «In parole semplici» per richiederla.</p>}
            {(page.blocks||[]).map((p,i)=>p.kind==='vertical-gap'?<div key={i} className="sb-mirror-source-gap" style={{height:Math.max(0,Number(p.lines)||0)*1.55+'em'}} aria-hidden="true"/>:p.kind==='chapter-title'?<h2 key={i}>{p.text}</h2>:
              p.kind==='section-title'?<h3 key={i}>{p.text}</h3>:
              p.kind==='image-ref'?<button className="sb-mirror-image-ref" key={i}
                onClick={()=>showPicture(book.canonicalBookMap?.visualAnchors?.find(a=>a.id===p.anchorId))}>
                (Immagine {p.imageNumber}) · pagina {p.sourcePage}/{p.imageNumber}
              </button>:
              <p key={i} className={p.editionPending?'sb-mirror-warning':undefined}>{p.text}</p>)}
          </>}
        </div>
        <footer className="sb-mirror-statistics">
          <strong>Pagina originale {page.sourcePage}</strong>
          {variant==='simple' ? <small>Spiegazione Gemini su richiesta, non e una nuova riduzione.
            Il PDF stampato e il testo di studio rimangono invariati.</small> : <>
          {pageTotals.measured ? <>
            <span>Lettere risparmiate: <b>{pageTotals.lettersSaved.toLocaleString('it-IT')}</b></span>
            <span>Righe risparmiate: <b>{pageTotals.linesSaved.toLocaleString('it-IT')}</b></span>
            <small>Righe equivalenti stimate con impaginazione fissa.</small>
          </> : <span>Statistiche non disponibili: verificare la corrispondenza con la pagina originale.</span>}</>}
        </footer>
      </>}
    </article>
    {picture&&<div className="sb-mirror-lightbox" role="dialog" aria-modal="true" aria-label="Immagine originale">
      <button onClick={()=>{setPicture(null);setPictureUrl('');setPictureError('')}}>Chiudi ×</button>
      {pictureBusy&&<p>Recupero la figura originale…</p>}
      {pictureError&&<p role="alert">{pictureError}</p>}
      {pictureUrl&&<img src={pictureUrl} alt={'Immagine '+picture.imageNumber+' della pagina '+picture.sourcePage}/>}
    </div>}
  </div>;
}
