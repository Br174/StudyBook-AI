import { useEffect, useMemo, useRef, useState } from 'react';
import { ACCESSIBILITY_PRESETS, readerCssVariables } from '../lib/accessibility.js';
import { StudyIcon } from './StudyUiIcons.jsx';
import RenameTitleDialog from './RenameTitleDialog.jsx';
import ScannerArchive from './ScannerArchive.jsx';
import '../appShellV16.css';

function stripExtension(value = '') {
  return String(value || 'StudyBook').replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() || 'StudyBook';
}

function BookCover({ item, view = 'processed', onOpen, onDeleteRequest, onRenameRequest, onBookActions }) {
  const [deleteArmed, setDeleteArmed] = useState(false);
  const holdTimer = useRef(null);
  const suppressClick = useRef(false);
  const title = stripExtension(item.fileName);
  const subject = item.subject || 'Altro';
  const pages = item.metadata?.pages || 0;
  // LAB18: le copertine reali restano prioritarie quando presenti;
  // in assenza di copertina usiamo un volume disegnato senza modificare il record.
  const coverUrl = item.coverCustom || item.coverOriginal || item.coverAI || item.coverUrl || item.metadata?.coverUrl || null;
  const available = view === 'original' ? item.metadata?.hasOriginal !== false : item.metadata?.hasProcessed !== false;

  function clearHold() {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = null;
  }

  function startHold() {
    clearHold();
    suppressClick.current = false;
    holdTimer.current = window.setTimeout(() => {
      suppressClick.current = true;
      if (onBookActions) onBookActions(item, view);
      else setDeleteArmed(true);
      try { navigator.vibrate?.(35); } catch { /* best effort */ }
    }, 520);
  }

  function openBook() {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    if (available) onOpen(item, view);
  }

  return (
    <div className={`sb-book-card-wrap ${deleteArmed ? 'delete-armed' : ''}`}>
      <button
        type="button"
        className="sb-book-card"
        onPointerDown={startHold}
        onPointerUp={clearHold}
        onPointerCancel={clearHold}
        onPointerLeave={clearHold}
        onContextMenu={(event) => event.preventDefault()}
        onClick={openBook}
        disabled={!available}
        aria-label={`${title}. Pressione prolungata per eliminare`}
      >
        <div className={coverUrl ? 'sb-cover sb-library-compact-cover has-image' : 'sb-cover sb-library-compact-cover'} data-subject={subject}>
          {coverUrl ? <img className="sb-library-cover-image" src={coverUrl} alt={'Copertina di ' + title} loading="lazy" decoding="async" /> : <>
            <span className="sb-cover-brand">{view === 'original' ? 'ORIGINALE' : 'STUDYBOOK'}</span>
            <strong className="sb-cover-title" title={title}>{title}</strong>
            <small className="sb-cover-subject">{subject}</small>
          </>}
        </div>
        <div className="sb-book-meta">
          <strong>{title}</strong>
          <span>{pages ? `${pages} pagine` : (item.metadata?.chapters ? `${item.metadata.chapters} capitoli` : subject)}</span>
        </div>
      </button>
      {view === 'processed' && onRenameRequest && (
        <button type="button" className="sb-library-rename" aria-label={'Rinomina ' + title} onClick={()=>onRenameRequest(item)}>✎ Rinomina</button>
      )}
      {deleteArmed && onDeleteRequest && (
        <button
          type="button"
          className="sb-book-delete"
          aria-label={`Elimina ${title}`}
          onClick={() => onDeleteRequest(item)}
        >×</button>
      )}
    </div>
  );
}

export function BottomNav({ active, onChange }) {
  const items = [
    ['home', 'home', 'Home'],
    ['library', 'library', 'Libreria'],
    ['studio', 'graduate', 'Studio'],
  ];
  return (
    <nav className="sb-bottom-nav" aria-label="Navigazione principale">
      {items.map(([id, icon, label]) => (
        <button type="button" key={id} className={active === id ? 'active' : ''} onClick={() => onChange(id)}>
          <span className="sb-nav-icon"><StudyIcon name={icon} size={20} /></span><small>{label}</small>
        </button>
      ))}
    </nav>
  );
}

export function HomeScreen({
  status, importing, generating, libraryItems, onImport, onScanner, onScannerArchive, onOpenOriginals, onOpenBook, onContinueBook, documentData,
  fileName, onCreateBook, progressPercent, scanContent = null,
}) {
  const recent = libraryItems.filter(item => item.metadata?.hasProcessed).slice(0, 3);
  const latest = recent[0];
  return (
    <section className="sb-screen sb-home-screen">
      <header className="sb-screen-head">
        <div><small>STUDYBOOK AI</small><h1>Studia meglio, senza perdere ciò che conta.</h1></div>
        <div className="sb-status">{status}</div>
      </header>

      <article className="sb-new-book-card">
        <div className="sb-new-book-copy">
          <span className="sb-round-plus">＋</span>
          <div><h2>Nuovo libro</h2><p>Importa una fonte o acquisisci le pagine e crea il tuo libro di studio.</p></div>
        </div>
        <div className="sb-source-grid">
          <button type="button" onClick={onScanner} disabled={importing || generating}><span className="sb-source-icon"><StudyIcon name="scanner" size={25} /></span><strong>Scanner</strong></button>
          <button type="button" onClick={onImport} disabled={importing || generating}><span className="sb-source-icon"><StudyIcon name="book" size={25} /></span><strong>PDF / eBook</strong></button>
          <button type="button" onClick={onScannerArchive} disabled={importing || generating}><span className="sb-source-icon"><StudyIcon name="photo" size={25} /></span><strong>Scannerizzati</strong></button>
          <button type="button" onClick={onOpenOriginals} disabled={importing || generating}><span className="sb-source-icon"><StudyIcon name="document" size={25} /></span><strong>Versione originale</strong></button>
        </div>
      </article>

      {documentData && (
        <article className="sb-process-card">
          <div>
            <small>FONTE PRONTA</small>
            <h3>{stripExtension(fileName)}</h3>
            <p>{documentData.chapters?.length || 0} capitoli · {documentData.structure?.pageCount || documentData.pages?.length || 0} pagine</p>
          </div>
          <button type="button" onClick={onCreateBook} disabled={generating}>
            {generating ? `Elaborazione ${progressPercent}%` : 'Crea Testo di studio'}
          </button>
        </article>
      )}

      {scanContent}

      {latest && (
        <button type="button" className="sb-continue-card" onClick={() => onContinueBook(latest)}>
          <span>Continua</span>
          <strong>{stripExtension(latest.fileName)}</strong>
          <small>{latest.subject || 'Libro di studio'} · aggiornato di recente</small>
          <b>›</b>
        </button>
      )}

      <div className="sb-section-row"><h2>Recenti</h2><span>{recent.length ? 'Tocca una copertina per aprire' : 'La tua libreria comparirà qui'}</span></div>
      {recent.length > 0 && (
        <div className="sb-recent-grid">
          {recent.map((item) => <BookCover key={item.id} item={item} onOpen={onOpenBook} />)}
        </div>
      )}
    </section>
  );
}

function ScanPhotoPreview({ blob, title }) {
  const [url,setUrl]=useState('');
  useEffect(()=>{
    if(!(blob instanceof Blob))return;
    const next=URL.createObjectURL(blob);setUrl(next);
    return ()=>URL.revokeObjectURL(next);
  },[blob]);
  return url ? <img src={url} alt={title} loading="lazy" decoding="async" /> : <StudyIcon name="photo" size={21}/>;
}

export function LibraryScreen({ items, onOpenBook, onDeleteBook, onRenameBook, onSetCoverFile, onGenerateCover, onResetCover, initialView = 'all', scannerProps = {}, onRefreshScans }) {
  const [area, setArea] = useState('subjects');
  const [view, setView] = useState(initialView);
  const [subject, setSubject] = useState('Tutte');
  const [sort, setSort] = useState('recent');
  const [deleteCandidate, setDeleteCandidate] = useState(null);
  const [renameCandidate, setRenameCandidate] = useState(null);
  const [actionCandidate, setActionCandidate] = useState(null);
  const [coverProcessing, setCoverProcessing] = useState('');
  const [coverMessage, setCoverMessage] = useState('');
  const coverFileInputRef = useRef(null);
  const coverFileTargetRef = useRef('');
  const [visibleScanCount, setVisibleScanCount] = useState(20);
  useEffect(() => { void onRefreshScans?.(); }, []);
  const subjects = useMemo(() => ['Tutte', ...new Set(items.map((item) => item.subject || 'Altro'))].slice(0, 8), [items]);
  const collections = useMemo(() => [...new Set(items.flatMap((item) => item.collections || []))], [items]);

  const filtered = useMemo(() => {
    let output = items.filter(item => view === 'all' || (view === 'processed' ? item.metadata?.hasProcessed : item.metadata?.hasOriginal));
    if (area === 'favorites') output = output.filter((item) => item.favorite);
    if (area === 'subjects' && subject !== 'Tutte') output = output.filter((item) => (item.subject || 'Altro') === subject);
    if (sort === 'az') output.sort((a, b) => stripExtension(a.fileName).localeCompare(stripExtension(b.fileName), 'it'));
    else output.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    return output;
  }, [items, area, subject, sort, view]);

  return (
    <section className="sb-screen sb-library-screen">
      <header className="sb-library-head">
        <div><small>LA TUA RACCOLTA</small><h1>Libreria</h1></div>
        <div className="sb-library-tools"><button type="button" aria-label="Cerca">⌕</button></div>
      </header>

      <div className="sb-segmented sb-library-categories" aria-label="Categorie della Libreria">
        {[
          ['scans', 'Scannerizzati'], ['processed', 'Modificati'], ['original', 'Originali'], ['all', 'Tutti'],
        ].map(([key, label]) => (
          <button key={key} type="button" className={view === key ? 'active' : ''}
            aria-pressed={view === key} onClick={() => { setView(key); if (key === 'scans') void onRefreshScans?.(); }}>
            {label}
          </button>
        ))}
      </div>
      {view === 'scans' ? <ScannerArchive {...scannerProps} onBack={() => setView('all')} backLabel="← Torna alla Libreria" /> : <>
      <div className="sb-library-modes">
        {[
          ['all','Tutti'],['subjects','Materie'],['collections','Raccolte'],['favorites','Preferiti'],['recent','Recenti'],
        ].map(([id,label]) => <button key={id} className={area === id ? 'active' : ''} onClick={() => setArea(id)}>{label}</button>)}
      </div>

      {area === 'subjects' && (
        <div className="sb-filter-strip">
          {subjects.map((item) => <button key={item} className={subject === item ? 'active' : ''} onClick={() => setSubject(item)}>{item}</button>)}
        </div>
      )}

      {area === 'collections' && (
        <div className="sb-collection-strip">
          {(collections.length ? collections : ['Esame gennaio','Da ripassare','Preferiti']).map((item) => <span key={item}>{item}</span>)}
        </div>
      )}

      <div className="sb-library-subhead">
        <span>Organizza per materia o raccolta</span>
        <select value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="recent">Ultima apertura</option>
          <option value="az">A–Z</option>
        </select>
      </div>

      {filtered.length ? (
        <div className="sb-library-grid">
          {filtered.map((item) => <BookCover key={item.id} item={item} view={view === 'all' ? (item.metadata?.hasProcessed ? 'processed' : 'original') : view} onOpen={onOpenBook} onDeleteRequest={item => setDeleteCandidate({ ...item, deleteView: view })} onRenameRequest={setRenameCandidate} onBookActions={item => { setActionCandidate(item); setCoverMessage(''); }} />)}
        </div>
      ) : <div className="sb-empty-library">Nessun libro in questa sezione.</div>}
      {view === 'all' && scannerProps.entries?.length > 0 && (
        <section className="sb-library-scans-compact" aria-label="Scansioni nella vista Tutti">
          <h2>Scannerizzati <small>{scannerProps.entries.length} fotografie</small></h2>
          {scannerProps.entries.slice(0, visibleScanCount).map(page => (
            <button key={page.id} type="button" disabled={scannerProps.busy}
              onClick={() => scannerProps.onRestore?.([page.id])}>
              <ScanPhotoPreview blob={page.blob} title={page.pageTitle || 'Scansione originale'} />
              <strong>{page.pageTitle || page.collection || 'Pagina scannerizzata'}</strong>
              <small>Rielabora →</small>
            </button>
          ))}
          {visibleScanCount < scannerProps.entries.length && (
            <button type="button" onClick={() => setVisibleScanCount(value => value + 20)}>Mostra altre scansioni</button>
          )}
          <button type="button" onClick={() => { setView('scans'); void onRefreshScans?.(); }}>Apri archivio Scannerizzati</button>
        </section>
      )}
      </>}

      <input ref={coverFileInputRef} type="file" accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp" hidden
        onChange={async event => {
          const file=event.target.files?.[0], id=coverFileTargetRef.current;
          event.target.value='';
          if(!file||!id||coverProcessing)return;
          setCoverProcessing(id);setCoverMessage('');
          try { const ok=await onSetCoverFile?.(id,file);setCoverMessage(ok?'Copertina scelta dal telefono e salvata.':'Impossibile salvare la copertina.');if(ok)setActionCandidate(null); }
          catch(error){setCoverMessage(error.message||'Impossibile leggere la fotografia.');}
          finally{setCoverProcessing('');}
        }} />
      {actionCandidate && (
        <div className="sb-confirm-overlay" role="presentation" onClick={event=>{if(event.target===event.currentTarget&&!coverProcessing)setActionCandidate(null);}}>
          <div className="sb-confirm-dialog sb-library-action-dialog" role="dialog" aria-modal="true" aria-label={'Azioni per '+stripExtension(actionCandidate.fileName)}>
            <h2>{stripExtension(actionCandidate.fileName)}</h2>
            <p>Gestisci il libro e la sua copertina senza modificare il file originale.</p>
            <div className="sb-library-action-list">
              <button type="button" disabled={Boolean(coverProcessing)} onClick={()=>{setRenameCandidate(actionCandidate);setActionCandidate(null);}}>✎ Rinomina libro</button>
              <button type="button" disabled={Boolean(coverProcessing)} onClick={()=>{coverFileTargetRef.current=actionCandidate.id;coverFileInputRef.current?.click();}}>▧ Scegli copertina dal telefono</button>
              <button type="button" disabled={Boolean(coverProcessing)||!onGenerateCover} onClick={async()=>{
                const id=actionCandidate.id;setCoverProcessing(id);setCoverMessage('');
                try{const ok=await onGenerateCover(id);setCoverMessage(ok?'Nuova copertina AI salvata.':'Impossibile creare la copertina AI ora.');if(ok)setActionCandidate(null);}
                catch(error){setCoverMessage(error.message||'Servizio AI non disponibile.');}
                finally{setCoverProcessing('');}
              }}>✦ {coverProcessing?'Creazione in corso…':'Crea / rigenera copertina AI'}</button>
              {(actionCandidate.coverOriginal||actionCandidate.coverCustom||actionCandidate.coverAI) && (
                <button type="button" disabled={Boolean(coverProcessing)} onClick={async()=>{
                  setCoverProcessing(actionCandidate.id);
                  try {const ok=await onResetCover?.(actionCandidate.id);setCoverMessage(ok?'Copertina originale ripristinata.':'Copertina originale non presente.');if(ok)setActionCandidate(null);}
                  finally{setCoverProcessing('');}
                }}>↺ Ripristina copertina originale</button>
              )}
              <button type="button" className="sb-library-action-danger" disabled={Boolean(coverProcessing)} onClick={()=>{setDeleteCandidate({...actionCandidate,deleteView:view});setActionCandidate(null);}}>× Elimina libro</button>
              <button type="button" className="sb-library-action-cancel" disabled={Boolean(coverProcessing)} onClick={()=>setActionCandidate(null)}>Chiudi</button>
            </div>
            {coverMessage&&<p role="status">{coverMessage}</p>}
          </div>
        </div>
      )}
      {renameCandidate && <RenameTitleDialog key={renameCandidate.id} label="Rinomina libro di studio" current={stripExtension(renameCandidate.fileName)} onClose={()=>setRenameCandidate(null)} onSave={name=>onRenameBook(renameCandidate.id,name)} />}
      {deleteCandidate && (
        <div className="sb-confirm-overlay" role="dialog" aria-modal="true" aria-label="Conferma eliminazione">
          <div className="sb-confirm-dialog">
            <div className="sb-confirm-icon">!</div>
            <h2>Eliminare definitivamente?</h2>
            <p><strong>{stripExtension(deleteCandidate.fileName)}</strong> {deleteCandidate.deleteView === 'all' ? 'e tutte le sue versioni verranno eliminate' : deleteCandidate.deleteView === 'processed' ? 'verrà rimossa solo la versione modificata' : 'verrà rimosso solo il file originale'}. L’operazione non può essere annullata.</p>
            <div className="sb-confirm-actions">
              <button type="button" onClick={() => setDeleteCandidate(null)}>Annulla</button>
              <button type="button" className="danger" onClick={async () => { await onDeleteBook(deleteCandidate.id, deleteCandidate.deleteView); setDeleteCandidate(null); }}>Sì, elimina</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/* LAB16: anteprima fotografica temporanea, originale archiviato non modificato. */
function ScannedBookPhoto({ blob }) {
  const [url,setUrl] = useState('');
  useEffect(() => {
    if (!(blob instanceof Blob)) { setUrl(''); return undefined; }
    const next=URL.createObjectURL(blob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  },[blob]);
  return url ? <img className="sb-scanned-book-cover-photo" src={url} alt="Fotografia reale della pagina scannerizzata" /> : null;
}

export function StudioScreen({ studyBook, fileName, onRead, onStudy, onExport, onRenameBook, isOriginalOnly = false, sourceData = null, onPrepareOriginal, generating = false, originalRecord = null, originalReading = false, onCloseOriginalReader, onOpenOriginalNative, availableOriginals = [], onChooseOriginal, onImportOriginal, accessibility, scannedPhoto = null }) {
  const [exportVariant, setExportVariant] = useState('study');
  const [exportOpen, setExportOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [prepareOpen, setPrepareOpen] = useState(false);
  if (!studyBook && !isOriginalOnly) {
    // LAB15 • Percorso diretto: se non esiste un originale selezionato,
    // la scelta rimane nella stessa schermata «Il tuo libro di studio».
    return (
      <section className="sb-screen sb-studio-screen">
        <header className="sb-screen-head compact"><div><small>LIBRO APERTO</small><h1>Il tuo libro di studio</h1></div></header>
        <article className="sb-open-book-workspace sb-original-picker">
          <h2>Scegli un libro originale</h2>
          <p>{availableOriginals.length ? 'Apri un libro già conservato, oppure importane uno nuovo.' : 'Non ci sono ancora libri originali nella Libreria. Importa un documento per cominciare.'}</p>
          {availableOriginals.slice(0, 12).map(item => (
            <button key={item.id} type="button" className="sb-original-picker-item" onClick={() => onChooseOriginal?.(item)}>
              <StudyIcon name="book" size={22} /><span>{stripExtension(item.original?.name || item.fileName)}</span><strong>Apri →</strong>
            </button>
          ))}
          <button type="button" className="sb-original-picker-import" onClick={onImportOriginal}>Importa PDF / eBook</button>
        </article>
      </section>
    );
  }
  const fidelity = studyBook?.quality?.fidelityGate;
  const sourceChapters = sourceData?.chapters || [];
  const canPrepare = sourceChapters.some(chapter => chapter.paragraphs?.length);
  return (
    <section className="sb-screen sb-studio-screen">
      <header className="sb-screen-head compact">
        <div>
          <small>LIBRO APERTO</small>
          <h1>Il tuo libro di studio</h1>
        </div>
      </header>

      {renameOpen && <RenameTitleDialog key={fileName} label="Rinomina libro di studio" current={stripExtension(fileName)} onClose={()=>setRenameOpen(false)} onSave={name=>onRenameBook(name)} />}
      <section className="sb-open-book-workspace" aria-label="Libro aperto">
        <div className="sb-open-book-overview">
          <div className={scannedPhoto ? 'sb-open-book-cover sb-scanned-book-cover' : 'sb-open-book-cover'}>
            {scannedPhoto ? <ScannedBookPhoto blob={scannedPhoto} /> : <>
              <span>{isOriginalOnly ? 'ORIGINALE' : 'STUDYBOOK'}</span>
              <strong>{isOriginalOnly ? 'Libro originale' : 'Libro di studio'}</strong>
            </>}
          </div>
          <div className="sb-open-book-copy">
            <small>STAI LAVORANDO SU</small>
            <h2>{stripExtension(fileName)}</h2>
            <button type="button" className="sb-studio-rename" onClick={()=>setRenameOpen(true)}>✎ Rinomina libro</button>
            <p>{isOriginalOnly ? 'Scegli come utilizzare il libro. Il file originale resta invariato; potrai decidere se creare un testo di studio.' : 'Leggi, studia o porta con te il contenuto elaborato di questo libro.'}</p>
          </div>
        </div>
        <div className="sb-book-quick-actions">
          <button type="button" onClick={onRead}><span className="sb-action-icon"><StudyIcon name="book" size={25} /></span><strong>Leggi sul telefono</strong></button>
          <button type="button" onClick={() => isOriginalOnly ? onExport('pdf', 'original') : onExport('pdf', 'study')}><span className="sb-action-icon"><StudyIcon name="pdf" size={25} /></span><strong>Leggi in PDF</strong></button>
          {isOriginalOnly
            ? <button type="button" onClick={() => setPrepareOpen(true)}><span className="sb-action-icon"><StudyIcon name="graduate" size={25} /></span><strong>Studia sul telefono</strong></button>
            : <button type="button" onClick={onStudy}><span className="sb-action-icon"><StudyIcon name="graduate" size={25} /></span><strong>Studia sul telefono</strong></button>}
          <button type="button" className={exportOpen ? 'active' : ''} aria-expanded={exportOpen} onClick={() => setExportOpen((value) => !value)}><span className="sb-action-icon"><StudyIcon name="download" size={25} /></span><strong>Scarica libro</strong></button>
        </div>
      </section>

      {isOriginalOnly && originalReading && originalRecord && (
        <OriginalInlineReader key={originalRecord.id} record={originalRecord} accessibility={accessibility}
          onClose={onCloseOriginalReader} onOpenNative={onOpenOriginalNative} />
      )}
      {isOriginalOnly && prepareOpen && (
        <article className="sb-export-card sb-original-study-consent" aria-label="Scelta di elaborazione">
          <div className="sb-export-head"><div><small>SCELTA LIBERA</small><h2>Preparare il testo di studio?</h2></div></div>
          <p>Puoi continuare a leggere o esportare il file originale senza modificarlo. Se scegli di preparare il testo di studio, StudyBook creerà una versione separata nella categoria Modificati.</p>
          {!canPrepare && <p>Il testo di questo originale non è ancora disponibile per l'elaborazione. Importa nuovamente il documento per completarne il riconoscimento.</p>}
          <div className="sb-original-study-decision">
            <button type="button" className="sb-original-secondary" onClick={() => setPrepareOpen(false)}>Non adesso</button>
            <button type="button" disabled={!canPrepare || generating} onClick={() => { setPrepareOpen(false); onPrepareOriginal?.(); }}>
              {generating ? 'Elaborazione…' : 'Prepara testo di studio'}
            </button>
          </div>
        </article>
      )}
      {exportOpen && (
        <article className="sb-export-card">
          <div className="sb-export-head">
            <div><small>ESPORTA</small><h2>Scarica libro</h2><p className="sb-export-description">{isOriginalOnly ? 'Scegli il formato: il file importato rimane invariato.' : 'Scegli la versione del libro e il formato da scaricare o stampare.'}</p></div>
            {!isOriginalOnly && <div className="sb-export-variant">
              <button type="button" className={exportVariant === 'study' ? 'active' : ''} onClick={() => setExportVariant('study')}>Testo di studio</button>
              <button type="button" className={exportVariant === 'simple' ? 'active' : ''} onClick={() => setExportVariant('simple')}>In parole semplici</button>
              <button type="button" className={exportVariant === 'both' ? 'active' : ''} onClick={() => setExportVariant('both')}>Due versioni complete</button>
            </div>}
          </div>
          <div className="sb-export-formats">
            {isOriginalOnly && <button type="button" onClick={() => onExport('original', 'original')}>Formato originale</button>}
            <button type="button" onClick={() => onExport('pdf', isOriginalOnly ? 'original' : exportVariant)}>PDF</button>
            <button type="button" onClick={() => onExport('docx', isOriginalOnly ? 'original' : exportVariant)}>DOCX</button>
            <button type="button" onClick={() => onExport('html', isOriginalOnly ? 'original' : exportVariant)}>HTML</button>
            <button type="button" onClick={() => onExport('epub', isOriginalOnly ? 'original' : exportVariant)}>EPUB</button>
            {!isOriginalOnly && <button type="button" onClick={() => onExport('odt', exportVariant)}>ODT</button>}
            {!isOriginalOnly && <button type="button" onClick={() => onExport('rtf', exportVariant)}>RTF</button>}
            {!isOriginalOnly && <button type="button" onClick={() => onExport('md', exportVariant)}>Markdown</button>}
            {!isOriginalOnly && <button type="button" onClick={() => onExport('print', exportVariant)}>Stampa</button>}
            <button type="button" onClick={() => onExport('txt', isOriginalOnly ? 'original' : exportVariant)} disabled={!isOriginalOnly && exportVariant === 'both'}>TXT</button>
            {!isOriginalOnly && <button type="button" onClick={() => onExport('json', exportVariant)}>JSON dati</button>}
          </div>
          {!isOriginalOnly && <p>«Due versioni complete» include prima tutto il testo di studio, poi tutto il libro in parole semplici nello stesso documento. L’originale resta separato nella Libreria.</p>}
        </article>
      )}

      {isOriginalOnly ? (
        <article className="sb-quality-card sb-original-preparation-info">
          <h2>Libro originale</h2>
          <div><span>Capitoli riconosciuti</span><strong>{sourceChapters.length}</strong><StudyIcon name="book" size={19} /></div>
          <div><span>Stato</span><strong>Non modificato</strong><StudyIcon name="document" size={19} /></div>
        </article>
      ) : <article className="sb-quality-card">
        <h2>Controllo del libro</h2>
        <div><span>Capitoli</span><strong>{studyBook.chapters?.length || 0}</strong><StudyIcon name="book" size={19} /></div>
        <div><span>Unità concettuali</span><strong>{fidelity?.conceptUnits || '—'}</strong><StudyIcon name="units" size={19} /></div>
        <div><span>Copertura media</span><strong>{Number.isFinite(fidelity?.averageCoveragePercent) ? `${fidelity.averageCoveragePercent}%` : '—'}</strong><StudyIcon name="coverage" size={19} /></div>
        <div><span>Compressione</span><strong>{Number.isFinite(fidelity?.compressionPercent) ? `${fidelity.compressionPercent}%` : '—'}</strong><StudyIcon name="compression" size={19} /></div>
      </article>}
    </section>
  );
}

function SettingRange({ label, value, min, max, step, suffix = '', onChange }) {
  return <label className="sb-setting-range"><span>{label}<b>{value}{suffix}</b></span><input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} /></label>;
}

export function SettingsScreen({ settings, onSettingsChange, profiles, activeProfileId, onProfileChange, onAddProfile }) {
  const [profileName, setProfileName] = useState('');
  const setRoot = (patch) => onSettingsChange({ ...settings, ...patch });
  const setPhone = (patch) => setRoot({ phone: { ...settings.phone, ...patch } });
  const setPrint = (patch) => setRoot({ print: { ...settings.print, ...patch } });

  return (
    <section className="sb-screen sb-settings-screen">
      <header className="sb-screen-head compact"><div><small>PREFERENZE</small><h1>Impostazioni</h1></div></header>

      <article className="sb-settings-card">
        <div className="sb-settings-card-title"><div><h2>Accessibilità e dislessia</h2><p>Preset immediato oppure regolazioni personali indipendenti.</p></div>
          <label className="sb-switch"><input type="checkbox" checked={settings.enabled} onChange={(e) => setRoot({ enabled: e.target.checked })}/><span /></label>
        </div>

        <div className="sb-preset-row">
          {Object.entries(ACCESSIBILITY_PRESETS).map(([id,preset]) => (
            <button type="button" key={id} className={settings.quickPreset === id ? 'active' : ''} onClick={() => onSettingsChange({ ...settings, enabled: true, quickPreset: id, phone: { ...preset.phone }, print: { ...preset.print } })}>{preset.label}</button>
          ))}
        </div>

        <label className="sb-advanced-toggle"><input type="checkbox" checked={settings.advancedEnabled} onChange={(e) => setRoot({ advancedEnabled: e.target.checked })}/> Personalizzazione avanzata</label>

        {settings.advancedEnabled && (
          <div className="sb-settings-columns">
            <div><h3>📱 Studio sul telefono</h3>
              <SettingRange label="Dimensione testo" value={Math.round(settings.phone.fontScale * 100)} min={85} max={160} step={5} suffix="%" onChange={(v) => setPhone({fontScale:v/100})}/>
              <SettingRange label="Interlinea" value={settings.phone.lineHeight} min={1.4} max={2.3} step={0.05} onChange={(v) => setPhone({lineHeight:v})}/>
              <SettingRange label="Spaziatura lettere" value={settings.phone.letterSpacing} min={0} max={0.08} step={0.005} onChange={(v) => setPhone({letterSpacing:v})}/>
              <SettingRange label="Spaziatura parole" value={settings.phone.wordSpacing} min={0} max={0.2} step={0.01} onChange={(v) => setPhone({wordSpacing:v})}/>
              <label>Sfondo<select value={settings.phone.background} onChange={(e)=>setPhone({background:e.target.value})}><option value="white">Bianco</option><option value="cream">Crema</option><option value="blue">Azzurro tenue</option><option value="gray">Grigio tenue</option></select></label>
              <label className="sb-check"><input type="checkbox" checked={settings.phone.readingGuide} onChange={(e)=>setPhone({readingGuide:e.target.checked})}/> Guida di lettura</label>
            </div>
            <div><h3>🖨️ Stampa ed esportazione</h3>
              <SettingRange label="Dimensione testo" value={Math.round(settings.print.fontScale * 100)} min={85} max={150} step={5} suffix="%" onChange={(v)=>setPrint({fontScale:v/100})}/>
              <SettingRange label="Interlinea" value={settings.print.lineHeight} min={1.3} max={2.2} step={0.05} onChange={(v)=>setPrint({lineHeight:v})}/>
              <SettingRange label="Margini" value={Math.round(settings.print.marginScale * 100)} min={85} max={140} step={5} suffix="%" onChange={(v)=>setPrint({marginScale:v/100})}/>
              <label>Sfondo<select value={settings.print.background} onChange={(e)=>setPrint({background:e.target.value})}><option value="white">Bianco</option><option value="cream">Crema</option><option value="blue">Azzurro tenue</option></select></label>
            </div>
          </div>
        )}
      </article>

      <article className="sb-settings-card">
        <h2>Profili</h2>
        <div className="sb-profile-row">
          {profiles.map((profile) => <button key={profile.id} className={profile.id === activeProfileId ? 'active' : ''} onClick={() => onProfileChange(profile.id)}>{profile.name}</button>)}
        </div>
        <div className="sb-add-profile"><input value={profileName} onChange={(e)=>setProfileName(e.target.value)} placeholder="Nuovo profilo"/><button onClick={() => { if(profileName.trim()){onAddProfile(profileName.trim());setProfileName('');} }}>＋ Aggiungi</button></div>
      </article>

      <article className="sb-settings-card">
        <h2>Cloud e backup</h2>
        <div className="sb-cloud-row"><div><strong>Google Drive</strong><span>Originali ed elaborati, con accesso Google</span></div><button type="button" disabled>Accedi con Google</button></div>
        <p className="sb-note">Il collegamento reale verrà attivato nel guscio Android; nessuna password Google verrà mai salvata dentro StudyBook.</p>
      </article>
    </section>
  );
}


/* LAB13 — I byte originali restano nell'archivio; qui si legge soltanto il testo
   importato, senza riassunti o interventi del motore di studio. */

/* LAB15 • Lettore originale integrato nella pagina Libro aperto.
   Nessuna vecchia schermata Versione originale: il blob in Libreria resta immutato. */
function OriginalInlineReader({ record, accessibility, onClose, onOpenNative }) {
  const [chapterIndex, setChapterIndex] = useState(0);
  const chapters = record?.sourceData?.chapters || [];
  const currentIndex = Math.min(chapterIndex, Math.max(0, chapters.length - 1));
  const chapter = chapters[currentIndex];
  return (
    <article className="sb-original-reading" style={readerCssVariables(accessibility)} aria-label="Lettura del libro originale">
      <h2>Leggi il libro originale</h2>
      {chapters.length ? <>
        <div className="sb-original-chapter-control">
          <label htmlFor="sb-original-chapter-inline">Capitolo originale</label>
          <select id="sb-original-chapter-inline" value={currentIndex} onChange={event => setChapterIndex(Number(event.target.value))}>
            {chapters.map((item, index) => <option key={index} value={index}>{item.title || 'Capitolo ' + (index + 1)}</option>)}
          </select>
        </div>
        <h2>{chapter?.title || 'Testo originale'}</h2>
        {(chapter?.paragraphs || []).map((paragraph, index) => (
          <p key={index}>{typeof paragraph === 'string' ? paragraph : String(paragraph?.original || paragraph?.text || '')}</p>
        ))}
        <div className="sb-original-chapter-nav">
          <button type="button" disabled={currentIndex === 0} onClick={() => setChapterIndex(index => Math.max(0, index - 1))}>← Precedente</button>
          <button type="button" disabled={currentIndex === chapters.length - 1} onClick={() => setChapterIndex(index => Math.min(chapters.length - 1, index + 1))}>Successivo →</button>
        </div>
        <p className="sb-original-notice">Testo estratto senza rielaborazioni. Per vedere l'impaginazione esatta, apri il file originale nel lettore del telefono.</p>
      </> : <p>Il testo di questo documento non è disponibile. Puoi aprire il file originale nel lettore del telefono.</p>}
      <button type="button" className="sb-original-secondary" onClick={onOpenNative}>Apri file originale nel lettore</button>
      <button type="button" className="sb-original-secondary" onClick={onClose}>Chiudi lettura</button>
    </article>
  );
}
