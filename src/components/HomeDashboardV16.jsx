import { useEffect, useMemo, useRef, useState } from 'react';
import { StudyIcon } from './StudyUiIcons.jsx';
import '../appShellV16.css';

const titleOf = name => String(name || 'Documento').replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
export function HomeDashboardV16({
  status, libraryItems = [], archivedScans = [], importing, generating,
  onScanner, onImport, onScannerArchive, onCategory, onRecentScan,
  onOpenOriginal, onContinueBook, onViewAll, documentData, fileName,
  scanContent, onCreateBook, progressPercent,
}) {
  const strip = useRef(null);
  const [photoUrls, setPhotoUrls] = useState({});
  const [position, setPosition] = useState(0);
  const recent = useMemo(() => {
    const records = [];
    for (const book of libraryItems) {
      if (book.metadata?.hasProcessed) records.push({ id: 'p-'+book.id, type:'processed', title:titleOf(book.fileName),date:book.updatedAt || '', data:book, pages:book.metadata?.pages || 0 });
      if (book.metadata?.hasOriginal) records.push({ id: 'o-'+book.id, type:'original', title:titleOf(book.fileName),date:book.updatedAt || '', data:book, pages:book.metadata?.pages || 0 });
    }
    for (const scan of archivedScans) if (scan?.id && scan.blob instanceof Blob) {
      records.push({ id:'s-'+scan.id, type:'scan', title:scan.pageTitle || scan.collection || 'Pagina scannerizzata',date:scan.createdAt || scan.updatedAt || '',data:scan,pages:1 });
    }
    return records.sort((a,b)=>b.date.localeCompare(a.date)).slice(0,16);
  },[libraryItems,archivedScans]);

  useEffect(()=>{
    const urls = {};
    for(const scan of archivedScans.slice(0,16)) if(scan?.id && scan.blob instanceof Blob) urls['s-'+scan.id] = URL.createObjectURL(scan.blob);
    setPhotoUrls(urls);
    return ()=>Object.values(urls).forEach(url=>URL.revokeObjectURL(url));
  },[archivedScans]);

  function open(item) {
    if(item.type === 'scan') onRecentScan([item.data.id]);
    else if(item.type === 'processed') onContinueBook(item.data);
    else if(item.type === 'original') onOpenOriginal(item.data);
  }

  const scansCount = archivedScans.length;
  const processedCount = libraryItems.filter(book=>book.metadata?.hasProcessed).length;
  const originalsCount = libraryItems.filter(book=>book.metadata?.hasOriginal).length;
  // LAB17: durante le scansioni, dedicare tutta l'area al documento:
  // il carosello Recenti (con le piccole anteprime a icona) non deve
  // invadere le informazioni o i comandi dello scanner.
  const scannerActive = Boolean(scanContent);
  return <section className={scannerActive ? 'sb-screen sb-home-screen sb-home-v16 sb-home-scanning' : 'sb-screen sb-home-screen sb-home-v16'}>
    <div className="sb-home-primary">
      <div className="sb-home-source-actions">
        <button onClick={onScanner} disabled={importing||generating}><StudyIcon name="scanner" size={25}/><strong>Scanner</strong></button>
        <button onClick={onImport} disabled={importing||generating}><StudyIcon name="book" size={25}/><strong>PDF / eBook</strong></button>
      </div>
      <div className="sb-home-library-actions">
        <button onClick={onScannerArchive}><StudyIcon name="scanner" size={22}/><strong>Scannerizzati</strong><small>{scansCount}</small></button>
        <button onClick={()=>onCategory('processed')}><StudyIcon name="document" size={22}/><strong>Elaborati</strong><small>{processedCount}</small></button>
        <button onClick={()=>onCategory('original')}><StudyIcon name="photo" size={22}/><strong>Versioni originali</strong><small>{originalsCount}</small></button>
      </div>
    </div>
    <div className="sb-home-workspace">
      {documentData && !generating && <div className="sb-process-card"><div><small>FONTE PRONTA</small><h3>{titleOf(fileName)}</h3><p>{documentData.chapters?.length || 0} capitoli</p></div><button onClick={onCreateBook}>Crea Testo di studio</button></div>}
      {generating && <p role="status">Elaborazione {progressPercent}% · {status}</p>}
      {scanContent}
      {!scanContent && !documentData && !generating && <div className="sb-home-placeholder"><StudyIcon name="document" size={44}/><strong>Qui presto nuove funzionalità</strong><p>Scannerizza, elabora e organizza i tuoi appunti in un unico posto.</p></div>}
    </div>
    {!scannerActive && <section className="sb-home-recent" aria-label="Recenti">
      <header><h2>Recenti</h2><button onClick={onViewAll}>Vedi tutti ›</button></header>
      {recent.length ? <>
        <div className="sb-home-recent-track" ref={strip} onScroll={e=>setPosition(Math.round(e.currentTarget.scrollLeft / 220))} role="region" aria-label="Scorri i documenti recenti da destra a sinistra" tabIndex={0}>
          {recent.map(item=><button className="sb-home-recent-card" key={item.id} onClick={()=>open(item)}>
            <span className="sb-home-recent-thumbnail">
              {item.type==='scan' && photoUrls[item.id] ? <img src={photoUrls[item.id]} loading="lazy" alt="Pagina fotografata"/> : <StudyIcon name={item.type==='processed'?'document':'book'} size={31}/>}
            </span>
            <span className="sb-home-recent-description"><strong>{item.title}</strong><small>{item.type==='scan'?'Scansione':item.type==='processed'?'Elaborato':'Versione originale'}</small><small>{item.date?.slice(0,10) || 'Senza data'}</small><small>{item.pages ? item.pages+' pagine' : 'Apri'}</small></span>
          </button>)}
        </div>
        <div className="sb-home-carousel-progress"><span>{Math.min(recent.length,position+1)} / {recent.length}</span><button onClick={()=>strip.current?.scrollBy({left:220,behavior:'smooth'})} aria-label="Avanti nei recenti">›</button></div>
      </> : <p className="sb-home-recent-empty">I tuoi contenuti recenti appariranno qui.</p>}
    </section>}
  </section>;
}
