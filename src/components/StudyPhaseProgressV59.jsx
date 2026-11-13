import {EXPLAINED_POLICY_V122} from '../lib/explainedPolicyV122.js';
import {explainedProgressMessageV122} from '../lib/explainedGeneratorV122.js';
import {studyPhaseProgressV59} from '../lib/studyPhaseProgressV59.js';

// LAB59: exactly ONE progress graphic, selected by current work phase.
// The six rows are physical-page counts, never Gemini paragraphs or 714 jobs.
export default function StudyPhaseProgressV59({book=null,acquisition=null,generating=false,activeStatus=''}) {
 const editionState=book?.editionsV36;
 if(editionState?.version===EXPLAINED_POLICY_V122){
   const total=editionState.totalChunkVariants||0;
   const verified=Number.isInteger(book?.editionReadiness?.readyPages)
     ?book.editionReadiness.readyPages:(editionState.verifiedChunkVariants||0);
   const received=Math.min(total,Math.max(verified,editionState.draftUnitsSaved||0));
   const message=generating?activeStatus:explainedProgressMessageV122(editionState);
   return (
    <div className="sb-v122-page-progress" role="group" aria-label="Libro spiegato · avanzamento"
      style={{padding:'10px 12px',border:'1px solid #dce6f1',borderRadius:12}}>
      <div style={{display:'flex',justifyContent:'space-between',gap:8}}>
        <strong>Libro spiegato · unica versione</strong>
        <span>{received}/{total} pagine ricevute</span>
      </div>
      <div role="progressbar" aria-label="Pagine ricevute"
        aria-valuenow={received} aria-valuemin={0} aria-valuemax={total||1}
        className="sb-download-progress-track sb-ia-progress-track"
        style={{marginTop:8}}>
        <span style={{width:(total?Math.round(100*received/total):0)+'%'}}/>
      </div>
      <small>{verified}/{total} pagine conformi e studiabili sul telefono. Le altre restano in elaborazione.</small>
      {Number.isInteger(editionState?.diagnostics?.plannedRequests)&&
        editionState.diagnostics.plannedRequests>0&&
        <small style={{display:'block'}}>Richieste previste: {editionState.diagnostics.plannedRequests}</small>}
      {message && <p role="status">{message}</p>}
      {editionState?.qualityWarnings?.length>0&&
        <p role="status">Una o più pagine richiedono un controllo mirato individuale;
          la media del libro non sostituisce la verifica per pagina.</p>}
    </div>
   );
 }
 const progress=studyPhaseProgressV59(book,{acquisition});
 const traffic=book?.editionsV36?.diagnostics?.geminiTrafficV113;
 const measuredTraffic=traffic?.policy==='studybook-local-gemini-traffic-v113'?traffic:null;
 const labels={acquisition:'Fase 1 · Acquisizione',
   compression:'Fase 2 · Compressione',
   correction:'Fase 3 · Verifica e correzione',
   quality:'Fase 3 · Controllo qualità'};
 const row=(key,label,done,total,conformant=null)=>(
   <div key={key} className="sb-v59-page-row" style={{marginTop:10}}>
     <div style={{display:'flex',justifyContent:'space-between',gap:8,fontSize:13}}>
       <strong>{label}</strong>
       <span>{done}/{total} pagine {conformant!==null?'esaminate':'salvate'}</span>
     </div>
     {conformant!==null&&
       <small style={{display:'block',color:conformant===total?'#166534':'#a33a2a'}}>
         {conformant}/{total} pagine nei margini di lettere e righe
       </small>}
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
     :progress.levels.map(x=>row(x.id,x.label,x.completed,x.total,
       progress.phase==='quality'?x.conformant:null))}
   <small style={{display:'block',marginTop:8}}>
     {progress.phase==='acquisition'
       ?'Acquisizione del testo originale; nessuna compressione ancora avviata.'
       :progress.phase==='compression'
         ?'Bozze salvate per pagina. Prima Riassunto, poi 50%, 40%, 30%, 20% e 10%; nessuna correzione durante la creazione.'
         :progress.phase==='quality'
           ?'Tutte le pagine salvate sono state esaminate. Le pagine fuori margine NON sono considerate approvate: premi «Migliora percentuali e chiarezza» per la ricalibrazione mirata. Nessuna chiamata Gemini automatica. La fedeltà del significato richiede verifica separata.'
           :'Pagine controllate e approvate; si correggono soltanto quelle che ne hanno bisogno.'}
   </small>
   {progress.phase==='quality'&&
     <details style={{marginTop:10,fontSize:12}}>
       <summary>Avvisi qualità e riduzione effettiva</summary>
       <div style={{paddingTop:8}}>
         {progress.levels.map(x=>
           <p key={x.id} style={{margin:'5px 0'}}>
             <strong>{x.label}</strong>: {x.available}/{x.total} bozze salvate;
             {' '}{x.conformant}/{x.total} pagine entro i margini;
             {' '}{x.warnings} segnalazioni;
             {' '}riduzione misurata {Number.isFinite(x.actualReduction)
               ?x.actualReduction+'%':'non disponibile'}.
             {x.exactLength===false?' Lunghezza globale diversa dalla quota richiesta.':''}
           </p>)}
         <p>Controlli automatici indicativi: la fedeltà del significato non è certificata.
           Non vengono apportate modifiche ai testi.</p>
       </div>
     </details>}
   {measuredTraffic&&
     <details style={{marginTop:10,fontSize:12}}>
       <summary>Registro Gemini LAB113 · richieste effettivamente inviate</summary>
       <div style={{paddingTop:7}}>
         <strong>{measuredTraffic.dispatched}</strong> richieste inviate al Worker;
         {' '}{measuredTraffic.worker200} risposte HTTP 200;
         {' '}{measuredTraffic.http503} errori 503;
         {' '}{measuredTraffic.http429} errori 429.
         <p style={{margin:'5px 0'}}>
           {measuredTraffic.confirmedParts} risposte contenenti testo;
           {' '}tentativi provider dichiarati: {measuredTraffic.providerAttemptsReported||0};
           {' '}503 recuperati senza bloccare il libro: {measuredTraffic.provider503Recoveries||0};
           {' '}token in ingresso riportati: {measuredTraffic.inputTokensReported};
           {' '}token in uscita riportati: {measuredTraffic.outputTokensReported}.
         </p>
         {measuredTraffic.last&&
           <p style={{margin:'5px 0'}}>
             Ultimo blocco: {measuredTraffic.last.level},
             {' '}pagine {measuredTraffic.last.pageStart}–{measuredTraffic.last.pageEnd};
             {' '}{measuredTraffic.last.sourceChars} caratteri originali;
             {' '}risposta {measuredTraffic.last.http||'non disponibile'};
             {' '}durata {Math.round((measuredTraffic.last.elapsedMs||0)/1000)} s.
           </p>}
         <small>Conteggio locale cumulativo del libro. Una richiesta al Worker
           non prova sempre che Gemini abbia generato testo; nessun invio
           di telemetria esterna e nessuna chiamata aggiuntiva.</small>
       </div>
     </details>}
 </div>;
}
