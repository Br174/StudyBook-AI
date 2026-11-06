import React,{useMemo,useState,useEffect} from 'react';
import { composeMirrorPages,mirrorPageStatistics } from '../lib/libroSpecchioV35.js';
export default function MirrorReaderV35({book,chapterIndex=0}){
  const [index,setIndex]=useState(0);
  const output=useMemo(()=>composeMirrorPages(book?.canonicalBookMap,book),[book]);
  const pages=output.pages||[];
  useEffect(()=>{
    const target=book?.chapters?.[chapterIndex]?.pageStart||1;
    const found=pages.findIndex(p=>p.kind==='text'&&p.sourcePage===target);
    setIndex(Math.max(0,found));
  },[chapterIndex,book?.canonicalBookMap]);
  const page=pages[Math.min(index,pages.length-1)];
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
    <article className="sb-mirror-sheet">
      <header>Pagina {page.label}</header>
      {page.kind==='image'?<p>Figura originale {page.label}</p>:
        (page.blocks||[]).map((p,i)=>p.kind==='chapter-title'?<h2 key={i}>{p.text}</h2>:
          p.kind==='section-title'?<h3 key={i}>{p.text}</h3>:
          <p key={i}>{p.text}</p>)}
    </article>
  </div>;
}
