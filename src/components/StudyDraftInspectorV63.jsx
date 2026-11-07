import {useMemo,useState} from 'react';
import {inspectStudyDraftPagesV63,STUDY_LEVELS_V63} from '../lib/studyDraftInspectorV63.js';
import './StudyDraftInspectorV63.css';

// Inspection-only. Does not mutate the studyBook or call a provider.
export default function StudyDraftInspectorV63({book,onClose}){
 const [level,setLevel]=useState('summary');
 const [filter,setFilter]=useState('all');
 const [wantedPage,setWantedPage]=useState(1);
 const report=useMemo(()=>inspectStudyDraftPagesV63(book,level),[book,level]);
 const visible=report.pages.filter(p=>filter==='approved'?p.approved:
  filter==='draft'?p.state==='draft'||p.state==='partial':
  filter==='missing'?p.state==='empty'||p.state==='unmapped':true);
 const selected=visible.find(x=>x.page===wantedPage)||visible[0]||null;
 const cursor=selected?visible.findIndex(x=>x.page===selected.page):-1;
 const stateLabel=x=>x.approved
   ?(x.publishedInReader?'Approvata e pubblicata':'Approvata, non ancora visibile nel lettore')
   :x.state==='partial'?'Verifica parziale, non pubblicabile'
   :x.state==='draft'?'Bozza generata, da verificare'
   :x.state==='empty'?'Testo non disponibile nel checkpoint'
   :'Pagina non mappata';
 return <article className="sb-draft-inspector-v63" aria-label="Controllo pagine elaborate, sola lettura">
  <header className="sb-draft-inspector-head-v63">
   <div><h3>Controlla pagine elaborate</h3>
    <p>Esamina i testi già presenti sul telefono. Nessuna nuova richiesta Gemini.</p></div>
   <button type="button" onClick={onClose} aria-label="Chiudi controllo pagine">✕</button>
  </header>
  <div className="sb-draft-inspector-fields-v63">
   <label>Versione
    <select value={level} onChange={e=>{setLevel(e.target.value);setWantedPage(1);}}>
     {STUDY_LEVELS_V63.map(x=><option key={x.id} value={x.id}>{x.label}</option>)}
    </select>
   </label>
   <label>Mostra
    <select value={filter} onChange={e=>{setFilter(e.target.value);setWantedPage(1);}}>
     <option value="all">Tutte le pagine</option>
     <option value="approved">Solo approvate</option>
     <option value="draft">Bozze e verifiche parziali</option>
     <option value="missing">Senza testo</option>
    </select>
   </label>
  </div>
  <div className="sb-draft-inspector-stats-v63">
   <span><b>{report.approved}/{report.total}</b> approvate</span>
   <span><b>{report.published}/{report.total}</b> visibili nel lettore</span>
   <span><b>{report.drafted}/{report.total}</b> con bozza salvata</span>
  </div>
  <p className="sb-draft-inspector-note-v63">Le pagine approvate possono essere sparse: il lettore normale le nasconde finché quelle precedenti non sono tutte approvate. Qui sono visibili senza cambiare il loro stato.</p>
  {visible.length>0
   ?<>
    <div className="sb-draft-inspector-page-grid-v63" role="group" aria-label="Pagine del libro">
     {visible.map(p=><button type="button" key={p.page}
       className={'sb-draft-inspector-page-v63'+(selected?.page===p.page?' selected':'')}
       aria-pressed={selected?.page===p.page}
       title={'Pagina '+p.page+': '+stateLabel(p)}
       onClick={()=>setWantedPage(p.page)}>
       {p.page}<span aria-hidden="true">{p.approved?'✓':p.partial?'◐':p.state==='draft'?'·':'–'}</span>
      </button>)}
    </div>
    <div className="sb-draft-inspector-nav-v63">
     <button type="button" disabled={cursor<=0}
      onClick={()=>setWantedPage(visible[cursor-1]?.page||1)}>← Precedente</button>
     <strong>Pagina {selected?.page}/{report.total}</strong>
     <button type="button" disabled={cursor<0||cursor>=visible.length-1}
      onClick={()=>setWantedPage(visible[cursor+1]?.page||report.total)}>Successiva →</button>
    </div>
    {selected&&<div className="sb-draft-inspector-reading-v63">
     <p className={'sb-draft-inspector-status-v63 '+selected.state}>
      <strong>{stateLabel(selected)}</strong>
      {selected.partial&&' · '+selected.acceptedUnits+'/'+selected.units+' parti della pagina approvate'}
     </p>
     <section>
      <h4>Testo originale</h4>
      <div className="sb-draft-inspector-text-v63">{selected.original||'Testo originale non disponibile nella mappatura.'}</div>
     </section>
     <section>
      <h4>Bozza Gemini salvata</h4>
      <div className="sb-draft-inspector-text-v63">{selected.draft||
       'Nessuna bozza disponibile per questa pagina e versione.'}</div>
     </section>
     <section>
      <h4>Testo approvato nel checkpoint</h4>
      <div className="sb-draft-inspector-text-v63">{selected.accepted||
       'Nessun testo approvato per questa pagina.'}</div>
     </section>
     {selected.sourceSpansPages&&
      <p className="sb-draft-inspector-note-v63">Alcune unità di testo attraversano più pagine originali. Il confronto mostra le unità associate, non un ritaglio della singola pagina.</p>}
    </div>}
   </>:<p>Nessuna pagina corrisponde a questo filtro.</p>}
  <p className="sb-draft-inspector-note-v63">
   «Approvata» significa che il checkpoint registra testo e verifica, non che
   sia stata ripetuta una verifica didattica con i controlli più recenti.
   I vecchi checkpoint non registrano da quale LAB proviene ogni pagina.
   {report.persisted?'':' La persistenza del checkpoint corrente non è confermata.'}
  </p>
 </article>;
}
