import React,{useMemo,useState,useEffect} from 'react';
import './MirrorReaderV35.css';
import { composeMirrorPages,actualMirrorPageStatistics } from '../lib/libroSpecchioV35.js';
import { renderMirrorImage } from '../lib/visualMirrorV35.js';
export default function MirrorReaderV35({book,originalFile,chapterIndex=0,variant='study'}){
  const [index,setIndex]=useState(0);
  const [picture,setPicture]=useState(null);
  const [pictureUrl,setPictureUrl]=useState('');
  const [pictureError,setPictureError]=useState('');
  const [pictureBusy,setPictureBusy]=useState(false);
  const output=useMemo(()=>composeMirrorPages(book?.canonicalBookMap,book,{variant,maxLines:40}),[book,variant]);
  const pages=output.pages||[];
  useEffect(()=>{
    const target=book?.chapters?.[chapterIndex]?.pageStart||1;
    const found=pages.findIndex(p=>p.kind==='text'&&p.sourcePage===target);
    setIndex(Math.max(0,found));
  },[chapterIndex,book?.canonicalBookMap]);
  const page=pages[Math.min(index,pages.length-1)];
  useEffect(()=>{setPicture(null);setPictureUrl('');setPictureError('');},[index]);
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
      <button onClick={()=>setIndex(Math.max(0,index-1))} disabled={index===0}>←</button>
      <select value={index} onChange={e=>setIndex(Number(e.target.value))}>
        {pages.map((p,i)=><option key={i} value={i}>Pagina {p.label}</option>)}
      </select>
      <button onClick={()=>setIndex(Math.min(pages.length-1,index+1))}
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
        {(page.blocks||[]).map((p,i)=>p.kind==='chapter-title'?<h2 key={i}>{p.text}</h2>:
          p.kind==='section-title'?<h3 key={i}>{p.text}</h3>:
          p.kind==='image-ref'?<button className="sb-mirror-image-ref" key={i}
            onClick={()=>showPicture(book.canonicalBookMap?.visualAnchors?.find(a=>a.id===p.anchorId))}>
            (Immagine {p.imageNumber}) · pagina {p.sourcePage}/{p.imageNumber}
          </button>:
          <p key={i} className={p.editionPending?'sb-mirror-warning':undefined}>{p.text}</p>)}
        </div>
        <footer className="sb-mirror-statistics">
          <strong>Pagina originale {page.sourcePage}</strong>
          {pageTotals.measured ? <>
            <span>Parole: {pageTotals.originalWords} → {pageTotals.resultWords} · Risparmiate: {pageTotals.wordsSaved}</span>
            <span>Lettere: {pageTotals.originalLetters} → {pageTotals.resultLetters} · Risparmiate: {pageTotals.lettersSaved}</span>
            <span>Riduzione effettiva: {pageTotals.achievedPercent}%</span>
            <small>Confronto delle lettere realmente presenti nella pagina originale e nel testo visualizzato.</small>
          </> : <span>Statistiche non disponibili: verificare la corrispondenza con la pagina originale.</span>}
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
