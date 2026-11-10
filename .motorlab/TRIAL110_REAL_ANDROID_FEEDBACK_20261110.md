# MotorLab StudyBook AI — TRIAL110, riscontro Android reale del 10 novembre 2026

**Origine:** sette schermate mostrate in chat dall'utente sullo smartphone Android (non caricate su GitHub).  
**Versione provata:** StudyBook AI Prova 110, applicazione separata da LAB79, rilascio sperimentale `studybook-trial110-4af1e3744a9b`, firma e build verificate https://github.com/Br174/StudyBook-AI/actions/runs/42773471194.  
**Libro:** `Filosofia del diritto appunti+sbobine`, 44 pagine, sei livelli (264 pagine-versione).  
**Esito:** FALLIMENTO SUL LIBRO REALE. Non considerare chiusa LAB110B sulla base dei due campioni sintetici.

| Livello | Obiettivo | Riduzione reale visibile | Pagine conformi (lettere e righe) |
|---|---:|---:|---:|
| Riassunto | circa 60% | 87,4% | 1/44 |
| 50% | 50% | 87,8% | 0/44 |
| 40% | 40% | non visibile nella schermata | 0/44 |
| 30% | 30% | 72,6% | 0/44 |
| 20% | 20% | 63,1% | 0/44 |
| 10% | 10% | 38,4% | 0/44 |

**Totale:** 1/264 pagine-versione entro entrambi i margini. 44/44 esaminate significa soltanto controllo QA terminato, non testo corretto o didatticamente approvato; `nessuna chiamata Gemini automatica` è esplicitamente mostrata.

## Diagnosi confermata da codice TRIAL110
1. In `src/lib/draftFirstV57.js`, l'esperimento `experimentV110b` viene aggiunto SOLO se `VITE_STUDYBOOK_TRIAL_110B==='1'` e `level==='40'`; nessun miglioramento sperimentale è previsto nei restanti cinque livelli. Si deve evitare di attribuire la loro generazione a LAB110B.
2. Il client tenta `buildSourceLedgerV110(block,studyGeometryPlanV78(block,level))` e **cattura qualunque eccezione senza registrarne il motivo**, facendo fallback al generatore ordinario. L'assenza di metadati di provenienza impedisce di verificare dallo screenshot se il 40% ha mai raggiunto il pilota.
3. In `src/lib/studySourceLedgerV110.js`, limiti: max 2 gruppi/pagine per richiesta, max 4 unità per gruppo, max 2600 lettere fonte per gruppo, max 18 frasi per gruppo, max 380 caratteri per clausola. I blocchi naturali grandi di un libro reale possono superare questi limiti: il fallback è per design, non un errore Cloudflare. Non provato *quanti* blocchi specifici di questo libro abbiano superato i limiti, perché non abbiamo i metadati degli ID di richiesta né i 44 testi originali.
4. La base `planNaturalBlocksV51` forma grandi blocchi entro limiti token, senza ridurli in pagine piccole per l'esperimento. Nessun percorso LAB110B per Riassunto, 50/30/20/10.
5. `sourceRiskAuditV110` è postflight warning e non verifica semantica certificata: un testo numericamente conforme può comunque omettere fatti.
6. La schermata Android Settings mostra `StudyBook AI LAB 0.3.575`, dati 0 B, ossia la **vecchia LAB79**, non l'app `StudyBook AI Prova 110`; non prova che i dati dell'app trial siano stati cancellati. NON chiedere al cliente di cancellare libri/checkpoint.

## Prossima correzione richiesta prima di una nuova APK
- Aggiungere un registro **locale non sensibile e persistente** per ogni generazione: versione, livello, gruppo/pagine, `LAB110B_TENTATA`, `LAB110B_UTILIZZATA`, motivo di `FALLBACK`, id richiesta, status Worker, uso di cache/checkpoint, percentuale reale e righe; senza salvare segreti e senza dichiarare certificazione semantica.
- Conservare i grandi blocchi per il motore base, ma progettare un pilota scalabile per 44 pagine senza frantumazione cieca né costo aggiuntivo: suddivisione/pianificazione da valutare solo ai confini di pagina/chapter, grandezza controllata, richiamo solo se autorizzato, nessun loop automatico.
- Test positivo su prima pagina del 40% con prova che il flag giunge al Worker, e test di fallback con codici distinti; solo dopo ampliare a tutte e sei le versioni, verificare percentuali e testi originali (negazioni, condizioni, date, soggetti e distinzioni).
- **Non premere “Migliora percentuali e chiarezza” per tutti e sei i livelli** senza prima fissare l'instradamento: spreca quota gratuita e può rigenerare moltissimo testo.
- Non cambiare relabel delle percentuali: 87,8% di riduzione rimane 87,8% anche se il pulsante viene rinominato.
- APK test attuale, LAB79 installata, Worker LAB79, MAIN, LAST_GOOD e progetto CORE MotorLab restano invariati.

**Conclusione:** l'installabilità è dimostrata, non l'efficacia didattica né l'attivazione su 44 pagine del pilota LAB110B. Il passo prioritario non è un altro prompt casuale né una diversa soglia visiva, ma **provenienza verificabile, applicazione reale del metodo e copertura dei concetti**.
