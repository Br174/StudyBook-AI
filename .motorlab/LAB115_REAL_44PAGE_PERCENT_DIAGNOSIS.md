# StudyBook AI LAB115 · Diagnosi post-prova LAB114 delle sei percentuali
Data screenshot: 2026-11-10, 18:50–18:51 (Europe/Rome). MotorLab CORE/satellite r40. Ramo SOLO di audit, nessuna variazione APK/Worker, 0 chiamate Gemini.

## Evidenza del telefono reale
Libro: `Filosofia del diritto appunti+sbobine`, 44 pagine originali. Screenshot utente della Prova114:
| Livello | Riduzione promessa (%) | Riduzione misurata (%) | Pagine pass lettere e righe |
|---|---:|---:|---:|
| Riassunto | 60 | 86,2 | 0/44 |
| 50% | 50 | 87,7 | 3/44 |
| 40% | 40 | 84,2 | 0/44 |
| 30% | 30 | 76,5 | 0/44 |
| 20% | 20 | 48,0 | 4/44 |
| 10% | 10 | 39,1 | 1/44 |
**Totale: 8/264 (circa 3,03%) pagine-versione simultaneamente conformi a lettere e righe; 264/264 esaminate, non 264/264 approvate semanticamente.** Al 50% la riduzione 87,7 è perfino MAGGIORE del Riassunto 86,2: invertito l'ordine desiderato. I numeri reali sono del testo scritto, non dei limiti pubblicati, e non devono essere rietichettati. La prova visiva non certifica i concetti effettivi: necessaria verifica del testo rispetto al PDF.

## Diagnosi di codice riscontrata (rilascio LAB114)
1. `src/lib/studyPageBudgetsV74.js` e `src/lib/studyRebalancePolicyV67.js` calcolano l'obiettivo ufficiale percentuale da lettere Unicode ORIGINALI, ±5 punti. `src/lib/studyLeanPercentV111.js` lo fornisce al modello per ogni pagina/gruppo. Il budget nominale NON manca.
2. `api/editionsBulkV51.js` genera attraverso un unico prompt/risposta JSON con `parts`; calcola `lengthReview` e `pageLetterReviewV74` ma salva un risultato strutturalmente valido anche quando `withinBand=false`. `src/lib/studyDraftProtocolV74.js` verifica che `withinBand` sia BOOLEAN, non che debba essere TRUE. Si tratta di una politica dichiarata: preservare le bozze nel primo passaggio, non un falso pass.
3. `src/lib/draftFirstV57.js` per la sola variante LAB111 e sue evoluzioni, quando tutti i draft esistono, va direttamente a `finalizeStudyQualityV66` SENZA auto-ricalibrazione Gemini. Quindi non esiste un meccanismo che imponga un budget alla prima generazione; il modello può uscire enormemente più corto.
4. `src/lib/studyQualityV66.js` fa la valutazione di lettere e righe senza alterare il contenuto. Se 264/264 esaminati ma le fasce non sono rispettate, `full=false`, `status=quality-notes` e `complete=false`. Spiega «Diagnosi elaborazione: stato non conclusivo» e anteprima parziale. Questo non implica necessariamente pagine mancanti.
5. Le sei elaborazioni sono indipendenti, quindi un errore di compressione su ogni livello può invertire la gradualità. La sola calibrazione delle etichette non rimette nel libro le informazioni tagliate e non garantisce livello 10 quasi esteso.
6. Il modulo LAB114 è un **recupero HTTP503**, non corregge né dichiara di correggere la percentuale; completare 264 esami dimostra una evoluzione del progresso ma non la qualità.

## Esperimenti passati, evitare ripetizioni
`.motorlab/LAB107_INVERSE_CALIBRATION_REPORT.md` sul ramo `audit/studybook-inverse-calibration-v107-20261110` ha provato davvero 12 risposte Gemini (due piccoli campioni di 599/636 lettere), con 5/12 numeriche+righe; inversione della curva NON affidabile tra livelli o pagine. `.motorlab/LAB108_SOURCE_PRESERVING_REPORT.md` sul ramo `audit/studybook-source-preserving-calibration-v108-20261110`: strategie COPY_EDIT/ANCHORED_SECTIONS: 5/12 pass al primo giro, un best-of con correzioni letterali mirate arriva a 5/6 combinazioni su due campioni, ma il caso scienze 40% non passa e zero certificazioni semantiche. Non spacciare quei test mono-pagina per prova su questo PDF 44 pagine.

## Direzione di correzione, NON ancora implementata
Occorre cambiare il **prodotto della chiamata Gemini** e il contratto del writer, anziché aggiungere timer o filtri che rilevano errori. Candidato da verificare in LAB separate e misurate: produzione ancorata alla fonte originale mediante piccole istruzioni di modifica o riscrittura locale, ricomposizione coerente nel software con conteggio deterministico delle LETTERE; conservazione dei concetti/negazioni, mai filler né troncamento per raggiungere quote; per 10/20 conservare più originale che nelle sintesi, per 30/40/50/summary maggior rielaborazione con budget di contenuto. Un solo passaggio generativo per blocco naturale dove possibile, QA a valle, bozze e testo originale immutabili; se un libro non rispetta una banda, rifiutare la promozione, mostrare la misura vera e non far partire ricalibrazione globale automatica.
Prima test locali senza Gemini, poi pochi test Gemini reali su campioni differenziati e confronto su PDF autentico solo se accessibile e autorizzato, dunque APK TEST soltanto dopo risultati concreti di tutti e sei i livelli. NON promettere 100% conformità/zero chiamate ulteriori; gestire fallimento come tale.
## Stato
Audit completo dalle schermate e dai sorgenti. **Nessuna modifica al programma, nessuna APK nuova, niente reset dati, nessun servizio a pagamento, nessuna correzione Gemini avviata.**
