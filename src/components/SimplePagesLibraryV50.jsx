import {useEffect,useState} from 'react';
import {listSimplePagesV50} from '../lib/simplePagesStoreV50.js';
import {exportSavedSimplePagesPdfV50} from '../lib/exportSimplePagesV50.js';
export default function SimplePagesLibraryV50({items=[]}){
  const [books,setBooks]=useState([]),[selected,setSelected]=useState('');
  const [pages,setPages]=useState([]),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  useEffect(()=>{
    let active=true;
    void Promise.all(items.map(async b=>({id:b.id,title:b.fileName||'StudyBook',count:(await listSimplePagesV50(b.id)).length})))
      .then(list=>{if(active)setBooks(list.filter(x=>x.count));})
      .catch(e=>{if(active)setError(e.message);});
    return ()=>{active=false;};
  },[items]);
  useEffect(()=>{
    let active=true;setPages([]);setError('');
    if(selected)void listSimplePagesV50(selected).then(rows=>{if(active)setPages(rows);})
      .catch(e=>{if(active)setError(e.message);});
    return ()=>{active=false;};
  },[selected]);
  const selectedBook=books.find(b=>b.id===selected);
  async function pdf(selectedPages){
    setBusy(true);setError('');
    try{await exportSavedSimplePagesPdfV50(selectedBook?.title||'StudyBook',selectedPages);}
    catch(e){setError(e.message||'Esportazione non riuscita.');}
    finally{setBusy(false);}
  }
  return <section className="sb-simple-library" aria-label="Archivio In parole semplici">
    {!selected?<><h2>In parole semplici</h2>
      <p>Una sola spiegazione conservata per pagina, sempre l'ultima completata.</p>
      {books.length?books.map(b=><button type="button" className="sb-simple-library-item" key={b.id}
        onClick={()=>setSelected(b.id)}><strong>{b.title}</strong><span>{b.count} pagine salvate ›</span></button>)
        :<p>Nessuna pagina salvata. Apri un libro e premi «In parole semplici».</p>}
    </>:<>
      <button type="button" className="sb-simple-library-back" onClick={()=>setSelected('')}>← Torna ai libri</button>
      <h2>{selectedBook?.title||'Libro'} · In parole semplici</h2>
      {pages.length>0&&<button type="button" className="sb-simple-library-export" disabled={busy}
        onClick={()=>void pdf(pages)}>Esporta tutte le pagine in PDF</button>}
      {pages.map(p=><details className="sb-simple-library-page" key={p.key}>
        <summary>Pagina {p.label} · {new Date(p.savedAt).toLocaleDateString('it-IT')}</summary>
        <article style={{whiteSpace:'pre-wrap'}}>{p.text}</article>
        <button type="button" disabled={busy} onClick={()=>void pdf([p])}>PDF di questa pagina</button>
      </details>)}
    </>}
    {error&&<p role="alert" className="sb-simple-live-error">{error}</p>}
  </section>;
}
