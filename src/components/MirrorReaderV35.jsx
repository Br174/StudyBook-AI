import React,{useMemo,useState,useEffect} from 'react';
import './MirrorReaderV35.css';
import { composeMirrorPages,mirrorPageStatistics } from '../lib/libroSpecchioV35.js';
import { renderMirrorImage } from '../lib/visualMirrorV35.js';
export default function MirrorReaderV35({book,originalFile,chapterIndex=0,variant='study'}){
  const [index,setIndex]=useState(0);
  const [picture,setPicture]=useState(null);
  const [pictureUrl,setPictureUrl]=useState('');
  const [pictureError,setPictureError]=useState('');
  const [pictureBusy,setPictureBusy]=useState(false);
  const output=useMemo(()=>composeMirrorPages(book?.canonicalBookMap,book,{variant,maxLines:40}),[book]);
  const pages=output.pages||[];
  useEffect(()=>{
    const target=book?.chapters?.[chapterIndex]?.pageStart||1;
    const found=pages.findIndex(p=>p.kind==='text'&&p.sourcePage===target);
    setIndex(Math.max(0,found));
  },[chapterIndex,book?.canonicalBookMap]);
  const page=pages[Math.min(index,pages.length-1)];
  useEffect(()=>{setPicture(null);setPictureUrl('');setPictureError('');},[index]);
  const pageTextRows=pages.filter(p=>p.kind==='text'&&p.sourcePage===page?.sourcePage);
  const pageTotals=mirrorPageStatistics(pageTextRows.reduce((total,row)=>({
    originalWords:total.originalWords+(row.originalWords||0),
    resultWords:total.resultWords+(row.resultWords||0),
    originalLetters:total.originalLetters+(row.originalLetters||0),
    resultLetters:total.resultLetters+(row.resultLetters||0),
    originalLines:total.originalLines+(row.originalLines||0),
    resultLines:total.resultLines+(row.resultLines||0),
  }),{}));
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
          <p key={i}>{p.text}</p>)}
        </div>
        <footer className="sb-mirror-statistics">
          <strong>Pagina originale {page.sourcePage}</strong>
          <span>Parole: {pageTotals.originalWords} → {pageTotals.editedWords} · Risparmiate: {pageTotals.wordsSaved}</span>
          <span>Lettere risparmiate: {pageTotals.lettersSaved} · Righe: {pageTotals.linesSaved}</span>
          <span>Riduzione effettiva: {pageTotals.achievedPercent}%</span>
          <small>Righe calcolate nella composizione StudyBook, non certificate sul PDF originale.</small>
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
