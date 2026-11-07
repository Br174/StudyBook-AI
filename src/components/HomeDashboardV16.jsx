import { useEffect, useMemo, useRef, useState } from 'react';
import { StudyIcon } from './StudyUiIcons.jsx';
import '../appShellV16.css';
import {bookAcquisitionProgressV46} from '../lib/bookAcquisitionV46.js';

const titleOf = name => String(name || 'Documento').replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
export function HomeDashboardV16({
  status, libraryItems = [], archivedScans = [], importing, generating,
  onScanner, onImport, onScannerArchive, onCategory, onRecentScan,
  onOpenOriginal, onContinueBook, onViewAll, documentData, fileName,
  scanContent, onCreateBook, progressPercent, workPhase='idle',homeAction='create',
  resumeCandidate = null, resumeBusy = false, onResumeProcessing = () => {},
  onManualRecovery = () => {}, iaProgress = null, geminiStalled = false,
  currentBookId='',acquisitionProgress=null,
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
  const progressBookId=importing?acquisitionProgress?.id:
    (generating?currentBookId:(resumeCandidate?.id||currentBookId));
  const progressBook=libraryItems.find(item=>item.id===progressBookId);
  const physical=bookAcquisitionProgressV46(progressBook?.metadata,
    importing&&acquisitionProgress?.id===progressBookId?acquisitionProgress:null);
  const activeTitle=(importing||generating)?titleOf(fileName):
    titleOf(resumeCandidate?.fileName||fileName);
  const coverUrl=progressBook?.coverCustom||progressBook?.coverOriginal||
    progressBook?.coverAI||progressBook?.coverUrl||null;
  const scannerActive = Boolean(scanContent);
  // IA variants are NOT PDF pages. Never display acquisition 100% as IA completion.
  const iaTotal = Math.max(0,Number(iaProgress?.total||resumeCandidate?.total||0));
  const iaDone = Math.min(iaTotal,Math.max(0,Number(iaProgress?.done??resumeCandidate?.done??0)));
  const iaPercent = iaTotal ? Math.round((iaDone / iaTotal)*10000)/100 : null;
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
      {documentData && !generating && (homeAction==='create'||homeAction==='open') &&
        <div className="sb-process-card">
          <div><small>{homeAction==='open'?'LIBRO PRONTO':'FONTE PRONTA'}</small><h3>{titleOf(fileName)}</h3>
            <p>{documentData.chapters?.length || 0} capitoli</p></div>
          <button type="button" onClick={onCreateBook}>{homeAction==='open'?'Apri libro di studio':'Crea Testo di studio'}</button>
        </div>}
      {generating && <p role="status">
        {workPhase==='preparing'
          ? 'Preparazione del documento, non ancora elaborazione IA · '+status
          : 'Elaborazione Gemini in corso · '+status}
      </p>}
      {(importing || generating || resumeCandidate) && <div className="sb-resume-panel sb-resume-panel-v46" role="region" aria-label="Pagine del libro e stato elaborazione">
        <div className="sb-download-book-row">
          <span className="sb-download-book-cover">
            {coverUrl?<img src={coverUrl} alt={'Copertina di '+activeTitle}/>:
              <StudyIcon name="book" size={31}/>}
          </span>
          <div className="sb-download-book-content">
            <strong>{activeTitle}</strong>
            <small>Pagine totali: {physical.total||'in rilevamento'}</small>
            <small>Pagine scaricate: {physical.total?physical.acquired+' / '+physical.total:'in rilevamento'}</small>
            <div className="sb-download-percent-label">
              <span>Scaricamento</span>
              <b>{physical.percent===null?'–':physical.percent+'%'}</b>
            </div>
            <div className="sb-download-progress-track" role="progressbar"
              aria-valuemin={0} aria-valuemax={100} aria-valuenow={physical.percent??0}
              aria-label="Avanzamento delle pagine acquisite">
              <span style={{width:(physical.percent??0)+'%'}}/>
            </div>
            {!importing && <div className="sb-ia-inline-progress" aria-label="Avanzamento effettivo dell'elaborazione Gemini">
              <strong>Studio IA: {iaTotal ? iaDone+' / '+iaTotal+' parti verificate' : 'verifica checkpoint'}</strong>
              <div className="sb-download-percent-label"><span>Elaborazione IA</span><b>{iaPercent===null?'–':iaPercent.toLocaleString('it-IT',{maximumFractionDigits:2})+'%'}</b></div>
              <div className="sb-download-progress-track sb-ia-progress-track" role="progressbar"
                aria-valuenow={iaPercent??0} aria-valuemin={0} aria-valuemax={100} aria-label="Percentuale delle parti IA verificate">
                <span style={{width:(iaPercent??0)+'%'}}/>
              </div>
              <small>{geminiStalled?'Richiesta senza avanzamenti: recupero manuale disponibile':generating?'Gemini sta elaborando o attendendo il provider':'Checkpoint salvati: ripresa disponibile'}</small>
            </div>}
          </div>
        </div>
        {!importing && <div className="sb-resume-ia-details">
          <small>{generating
            ? (workPhase==='preparing'?'Sto preparando la struttura del libro.'
              :'Elaborazione Gemini in corso; le pagine originali restano disponibili.')
            :resumeCandidate?.total>0
              ? String(resumeCandidate.done||0)+' / '+resumeCandidate.total+' parti IA conservate'
              :'Verifica dei checkpoint IA conservati'}</small>
          {!generating&&resumeCandidate?.diagnostic?.description &&
            <small role="status">{resumeCandidate.diagnostic.description}</small>}
        </div>}
        {!importing && <div className="sb-resume-action-row">
          <button type="button" onClick={onResumeProcessing} disabled={resumeBusy}>
            Apri libro in elaborazione
          </button>
          <button type="button" className="sb-resume-manual" onClick={onManualRecovery}
            disabled={resumeBusy||(generating&&workPhase==='preparing')}>
            {resumeBusy?'Verifica in corso…':geminiStalled?'↻ Recupera richiesta bloccata':'↻ Verifica e riprendi'}
          </button>
        </div>
      </div>}
      {scanContent}
      {!scanContent && !documentData && !generating && !resumeCandidate && <div className="sb-home-placeholder"><StudyIcon name="document" size={44}/><strong>Qui presto nuove funzionalità</strong><p>Scannerizza, elabora e organizza i tuoi appunti in un unico posto.</p></div>}
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
