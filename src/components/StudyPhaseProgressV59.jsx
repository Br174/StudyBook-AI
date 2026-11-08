import {studyPhaseProgressV59} from '../lib/studyPhaseProgressV59.js';

// LAB59: exactly ONE progress graphic, selected by current work phase.
// The six rows are physical-page counts, never Gemini paragraphs or 714 jobs.
export default function StudyPhaseProgressV59({book=null,acquisition=null}){
 const progress=studyPhaseProgressV59(book,{acquisition});
 const labels={acquisition:'Fase 1 · Acquisizione',
   compression:'Fase 2 · Compressione',
   correction:'Fase 3 · Verifica e correzione',
   quality:'Fase 3 · Controllo qualità'};
 const row=(key,label,done,total)=>(
   <div key={key} className="sb-v59-page-row" style={{marginTop:10}}>
     <div style={{display:'flex',justifyContent:'space-between',gap:8,fontSize:13}}>
       <strong>{label}</strong><span>{done}/{total} pagine</span>
     </div>
     <div className="sb-download-progress-track sb-ia-progress-track"
       role="progressbar" aria-label={label+': pagine completate'}
       aria-valuemin={0} aria-valuemax={total||100} aria-valuenow={done}
       style={{marginTop:5}}>
       <span style={{width:(total?Math.round(done/total*10000)/100:0)+'%'}} />
     </div>
   </div>
 );
 return <div className="sb-stage-progress-v59" role="group"
   aria-label={labels[progress.phase]}
   style={{border:'1px solid #dce6f1',borderRadius:12,padding:'10px 12px',margin:'8px 0'}}>
   <strong>{labels[progress.phase]}</strong>
   {progress.phase==='acquisition'
     ?row('source','Pagine originali',progress.acquired,progress.pageCount)
     :progress.levels.map(x=>row(x.id,x.label,x.completed,x.total))}
   <small style={{display:'block',marginTop:8}}>
     {progress.phase==='acquisition'
       ?'Acquisizione del testo originale; nessuna compressione ancora avviata.'
       :progress.phase==='compression'
         ?'Bozze salvate per pagina. Prima Riassunto, poi 50%, 40%, 30%, 20% e 10%; nessuna correzione durante la creazione.'
         :progress.phase==='quality'
           ?'Controllo locale completato senza chiamate Gemini. Gli avvisi non bloccano la lettura delle versioni complete e non certificano la correttezza semantica.'
           :'Pagine controllate e approvate; si correggono soltanto quelle che ne hanno bisogno.'}
   </small>
   {progress.phase==='quality'&&
     <details style={{marginTop:10,fontSize:12}}>
       <summary>Avvisi qualità e riduzione effettiva</summary>
       <div style={{paddingTop:8}}>
         {progress.levels.map(x=>
           <p key={x.id} style={{margin:'5px 0'}}>
             <strong>{x.label}</strong>: {x.available}/{x.total} pagine disponibili;
             {' '}{x.warnings} segnalazioni;
             {' '}riduzione misurata {Number.isFinite(x.actualReduction)
               ?x.actualReduction+'%':'non disponibile'}.
             {x.exactLength===false?' Lunghezza globale diversa dalla quota richiesta.':''}
           </p>)}
         <p>Controlli automatici indicativi: la fedeltà del significato non è certificata.
           Non vengono apportate modifiche ai testi.</p>
       </div>
     </details>}
 </div>;
}
