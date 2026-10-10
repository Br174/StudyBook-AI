import { useEffect, useMemo, useState } from 'react';
import { StudyIcon } from './StudyUiIcons.jsx';
import '../scannerArchive.css';

/* LAB11: archivio locale delle foto. Le anteprime sono URL temporanei,
   rilasciati quando si abbandona la schermata. Nessuna foto viene cancellata
   quando si rielabora o crea un libro. */
export default function ScannerArchive({ entries = [], busy = false, onRestore, onDelete, onBack }) {
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState([]);
  const [thumbs, setThumbs] = useState({});

  useEffect(() => {
    const refs = {};
    for (const entry of entries) {
      if (entry?.id && entry.blob instanceof Blob) refs[entry.id] = URL.createObjectURL(entry.blob);
    }
    setThumbs(refs);
    return () => { for (const ref of Object.values(refs)) URL.revokeObjectURL(ref); };
  }, [entries]);

  const groups = useMemo(() => {
    const map = new Map();
    for (const entry of entries) {
      const key = entry.collection || 'Appunti fotografati';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(entry);
    }
    return Array.from(map, ([label, photos]) => ({ label, photos }));
  }, [entries]);

  const toggle = (id) => setSelected(current => current.includes(id) ? current.filter(x=>x!==id) : [...current,id]);
  const restore = async (ids) => {
    if (!ids.length || busy) return;
    await onRestore(ids);
  };
  const remove = async (ids) => {
    if (!ids.length || busy) return;
    const plural = ids.length > 1;
    if (!window.confirm(plural ? `Eliminare definitivamente ${ids.length} fotografie dall'archivio?` : 'Eliminare definitivamente questa fotografia dall’archivio?')) return;
    const ok = await onDelete(ids);
    if (ok) setSelected(current => current.filter(x=>!ids.includes(x)));
  };

  return (
    <section className="sb-screen sb-scanner-archive" aria-label="Archivio delle scansioni">
      <header className="sb-archive-header">
        <span>IL TUO ARCHIVIO</span>
        <h1>Scannerizzati</h1>
        <p>{entries.length} {entries.length === 1 ? 'fotografia conservata' : 'fotografie conservate'} sul telefono. Tocca una fotografia per rielaborarla.</p>
      </header>
      <div className="sb-archive-toolbar">
        <button type="button" onClick={onBack}>← Torna alla Home</button>
        <button type="button" disabled={!entries.length || busy} onClick={() => { setSelectMode(value=>!value); setSelected([]); }}>{selectMode ? 'Annulla selezione' : 'Seleziona più pagine'}</button>
      </div>
      {!entries.length && <div className="sb-archive-empty"><StudyIcon name="photo" size={39}/><strong>Nessuna fotografia scannerizzata</strong><p>Usa Scanner per fotografare le pagine. Le nuove fotografie rimarranno disponibili qui anche dopo aver creato un libro.</p></div>}
      {groups.map(group => (
        <section className="sb-archive-group" key={group.label}>
          <h2>{group.label} <small>{group.photos.length} pagine</small></h2>
          <div className="sb-archive-grid">
            {group.photos.map((page, index) => (
              <article className="sb-archive-photo" key={page.id}>
                <button type="button" className="sb-archive-photo-open" disabled={busy} onClick={() => selectMode ? toggle(page.id) : restore([page.id])} aria-label={selectMode ? 'Seleziona fotografia ' + (index + 1) : 'Rielabora fotografia ' + (index + 1)}>
                  <img src={thumbs[page.id] || ''} alt={`Scansione ${index + 1}`} loading="lazy" />
                  {selectMode && <span className={selected.includes(page.id) ? 'sb-archive-check picked' : 'sb-archive-check'}>{selected.includes(page.id) ? '✓' : '+'}</span>}
                </button>
                <div className="sb-archive-photo-caption">
                  <strong>Pagina {index + 1}</strong>
                  <span>{page.text?.trim() ? 'OCR salvato' : 'OCR da eseguire'}</span>
                  {!selectMode && <button type="button" disabled={busy} onClick={() => remove([page.id])} aria-label="Elimina fotografia">Elimina</button>}
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
      {selectMode && entries.length > 0 && (
        <div className="sb-archive-selection" role="group" aria-label="Azioni sulle fotografie selezionate">
          <strong>{selected.length} selezionate</strong>
          <button type="button" disabled={!selected.length || busy} onClick={() => restore(selected)}>Rielabora selezionate</button>
          <button type="button" className="danger" disabled={!selected.length || busy} onClick={() => remove(selected)}>Elimina selezionate</button>
        </div>
      )}
    </section>
  );
}
