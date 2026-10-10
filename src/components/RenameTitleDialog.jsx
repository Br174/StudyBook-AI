import { useState } from 'react';
import { sanitizeTitle } from '../lib/smartTitles.js';
import '../renameTitle.css';

export default function RenameTitleDialog({ label = 'Rinomina', current = '', suggestion = '', onSave, onClose }) {
  const [value, setValue] = useState(current);
  const clean = sanitizeTitle(value);
  async function save(event) {
    event.preventDefault();
    if (!clean) return;
    const success = await onSave(clean);
    if (success) onClose();
  }
  return (
    <div className="sb-title-overlay" role="presentation">
      <form className="sb-title-dialog" role="dialog" aria-modal="true" aria-label={label} onSubmit={save}>
        <h2>{label}</h2>
        <label htmlFor="sb-title-input">Nome</label>
        <input id="sb-title-input" value={value} onChange={e=>setValue(e.target.value)} maxLength={90} autoFocus required />
        {suggestion && suggestion !== current && <button type="button" className="sb-title-suggestion" onClick={()=>setValue(suggestion)}>✦ Titolo suggerito: {suggestion}</button>}
        <p>Il nome cambia senza eliminare immagini, testi, capitoli o dati del libro.</p>
        <div className="sb-title-actions">
          <button type="button" onClick={onClose}>Annulla</button>
          <button type="submit" disabled={!clean}>Salva nome</button>
        </div>
      </form>
    </div>
  );
}
