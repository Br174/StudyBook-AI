import { useMemo, useRef, useState } from 'react';
import { ACCESSIBILITY_PRESETS } from '../lib/accessibility.js';
import { StudyIcon } from './StudyUiIcons.jsx';
import '../appShellV16.css';

function stripExtension(value = '') {
  return String(value || 'StudyBook').replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() || 'StudyBook';
}

function BookCover({ item, view = 'processed', onOpen, onDeleteRequest }) {
  const [deleteArmed, setDeleteArmed] = useState(false);
  const holdTimer = useRef(null);
  const suppressClick = useRef(false);
  const title = stripExtension(item.fileName);
  const subject = item.subject || 'Altro';
  const pages = item.metadata?.pages || 0;
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
      setDeleteArmed(true);
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
        <div className="sb-cover" data-subject={subject}>
          <span>{view === 'original' ? 'ORIGINALE' : 'STUDYBOOK'}</span>
          <strong>{title}</strong>
          <small>{subject}</small>
        </div>
        <div className="sb-book-meta">
          <strong>{title}</strong>
          <span>{pages ? `${pages} pagine` : (item.metadata?.chapters ? `${item.metadata.chapters} capitoli` : subject)}</span>
        </div>
      </button>
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
  status, importing, generating, libraryItems, onImport, onScanner, onOpenBook, onContinueBook, documentData,
  fileName, onCreateBook, progressPercent, scanContent = null,
}) {
  const recent = libraryItems.slice(0, 3);
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
          <button type="button" onClick={onImport} disabled={importing || generating}><span className="sb-source-icon"><StudyIcon name="photo" size={25} /></span><strong>Foto</strong></button>
          <button type="button" onClick={onImport} disabled={importing || generating}><span className="sb-source-icon"><StudyIcon name="document" size={25} /></span><strong>Documento</strong></button>
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

export function LibraryScreen({ items, onOpenBook, onDeleteBook }) {
  const [area, setArea] = useState('subjects');
  const [view, setView] = useState('processed');
  const [subject, setSubject] = useState('Tutte');
  const [sort, setSort] = useState('recent');
  const [deleteCandidate, setDeleteCandidate] = useState(null);
  const subjects = useMemo(() => ['Tutte', ...new Set(items.map((item) => item.subject || 'Altro'))].slice(0, 8), [items]);
  const collections = useMemo(() => [...new Set(items.flatMap((item) => item.collections || []))], [items]);

  const filtered = useMemo(() => {
    let output = [...items];
    if (area === 'favorites') output = output.filter((item) => item.favorite);
    if (area === 'subjects' && subject !== 'Tutte') output = output.filter((item) => (item.subject || 'Altro') === subject);
    if (sort === 'az') output.sort((a, b) => stripExtension(a.fileName).localeCompare(stripExtension(b.fileName), 'it'));
    else output.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    return output;
  }, [items, area, subject, sort]);

  return (
    <section className="sb-screen sb-library-screen">
      <header className="sb-library-head">
        <div><small>LA TUA RACCOLTA</small><h1>Libreria</h1></div>
        <div className="sb-library-tools"><button type="button" aria-label="Cerca">⌕</button></div>
      </header>

      <div className="sb-segmented">
        <button className={view === 'processed' ? 'active' : ''} onClick={() => setView('processed')}>Elaborati</button>
        <button className={view === 'original' ? 'active' : ''} onClick={() => setView('original')}>Originali</button>
      </div>

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
          {filtered.map((item) => <BookCover key={item.id} item={item} view={view} onOpen={onOpenBook} onDeleteRequest={setDeleteCandidate} />)}
        </div>
      ) : <div className="sb-empty-library">Nessun libro in questa sezione.</div>}

      {deleteCandidate && (
        <div className="sb-confirm-overlay" role="dialog" aria-modal="true" aria-label="Conferma eliminazione">
          <div className="sb-confirm-dialog">
            <div className="sb-confirm-icon">!</div>
            <h2>Eliminare definitivamente?</h2>
            <p><strong>{stripExtension(deleteCandidate.fileName)}</strong> verrà rimosso da questa Libreria. L’operazione non può essere annullata.</p>
            <div className="sb-confirm-actions">
              <button type="button" onClick={() => setDeleteCandidate(null)}>Annulla</button>
              <button type="button" className="danger" onClick={async () => { await onDeleteBook(deleteCandidate.id); setDeleteCandidate(null); }}>Sì, elimina</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export function StudioScreen({ studyBook, fileName, onRead, onStudy, onExport }) {
  const [exportVariant, setExportVariant] = useState('study');
  const [exportOpen, setExportOpen] = useState(false);
  if (!studyBook) {
    return <section className="sb-screen"><div className="sb-empty-library"><h2>Nessun libro aperto</h2><p>Apri una copertina dalla Libreria oppure crea un nuovo libro.</p></div></section>;
  }
  const fidelity = studyBook.quality?.fidelityGate;
  return (
    <section className="sb-screen sb-studio-screen">
      <header className="sb-screen-head compact">
        <div>
          <small>LIBRO APERTO</small>
          <h1>Il tuo libro di studio</h1>
        </div>
      </header>

      <section className="sb-open-book-workspace" aria-label="Libro aperto">
        <div className="sb-open-book-overview">
          <div className="sb-open-book-cover">
            <span>STUDYBOOK</span>
            <strong>Libro di studio</strong>
          </div>
          <div className="sb-open-book-copy">
            <small>STAI LAVORANDO SU</small>
            <h2>{stripExtension(fileName)}</h2>
            <p>Leggi, studia o porta con te il contenuto elaborato di questo libro.</p>
          </div>
        </div>
        <div className="sb-book-quick-actions">
          <button type="button" onClick={onRead}><span className="sb-action-icon"><StudyIcon name="book" size={25} /></span><strong>Leggi sul telefono</strong></button>
          <button type="button" onClick={() => onExport('pdf', 'study')}><span className="sb-action-icon"><StudyIcon name="pdf" size={25} /></span><strong>Leggi in PDF</strong></button>
          <button type="button" onClick={onStudy}><span className="sb-action-icon"><StudyIcon name="graduate" size={25} /></span><strong>Studia sul telefono</strong></button>
          <button type="button" className={exportOpen ? 'active' : ''} aria-expanded={exportOpen} onClick={() => setExportOpen((value) => !value)}><span className="sb-action-icon"><StudyIcon name="download" size={25} /></span><strong>Scarica libro</strong></button>
        </div>
      </section>

      {exportOpen && (
        <article className="sb-export-card">
          <div className="sb-export-head">
            <div><small>ESPORTA</small><h2>Scarica libro</h2><p className="sb-export-description">Scegli la versione del libro e il formato da scaricare o stampare.</p></div>
            <div className="sb-export-variant">
              <button type="button" className={exportVariant === 'study' ? 'active' : ''} onClick={() => setExportVariant('study')}>Testo di studio</button>
              <button type="button" className={exportVariant === 'simple' ? 'active' : ''} onClick={() => setExportVariant('simple')}>In parole semplici</button>
              <button type="button" className={exportVariant === 'both' ? 'active' : ''} onClick={() => setExportVariant('both')}>Due versioni complete</button>
            </div>
          </div>
          <div className="sb-export-formats">
            <button type="button" onClick={() => onExport('pdf', exportVariant)}>PDF</button>
            <button type="button" onClick={() => onExport('docx', exportVariant)}>DOCX</button>
            <button type="button" onClick={() => onExport('html', exportVariant)}>HTML</button>
            <button type="button" onClick={() => onExport('epub', exportVariant)}>EPUB</button>
            <button type="button" onClick={() => onExport('odt', exportVariant)}>ODT</button>
            <button type="button" onClick={() => onExport('rtf', exportVariant)}>RTF</button>
            <button type="button" onClick={() => onExport('md', exportVariant)}>Markdown</button>
            <button type="button" onClick={() => onExport('print', exportVariant)}>Stampa</button>
            <button type="button" onClick={() => onExport('txt', exportVariant)} disabled={exportVariant === 'both'}>TXT</button>
            <button type="button" onClick={() => onExport('json', exportVariant)}>JSON dati</button>
          </div>
          <p>«Due versioni complete» include prima tutto il testo di studio, poi tutto il libro in parole semplici nello stesso documento. L’originale resta separato nella Libreria.</p>
        </article>
      )}

      <article className="sb-quality-card">
        <h2>Controllo del libro</h2>
        <div><span>Capitoli</span><strong>{studyBook.chapters?.length || 0}</strong><StudyIcon name="book" size={19} /></div>
        <div><span>Unità concettuali</span><strong>{fidelity?.conceptUnits || '—'}</strong><StudyIcon name="units" size={19} /></div>
        <div><span>Copertura media</span><strong>{Number.isFinite(fidelity?.averageCoveragePercent) ? `${fidelity.averageCoveragePercent}%` : '—'}</strong><StudyIcon name="coverage" size={19} /></div>
        <div><span>Compressione</span><strong>{Number.isFinite(fidelity?.compressionPercent) ? `${fidelity.compressionPercent}%` : '—'}</strong><StudyIcon name="compression" size={19} /></div>
      </article>
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
