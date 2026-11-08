# StudyBook AI LAB74 · gate di rilascio sperimentale

- Decisione utente: ridurre sulla base del numero di lettere originali per pagina, obiettivo centrale e tolleranza ±5 punti del testo originale. Per 100 lettere al 50%, 45–55 conservate.
- Branch isolato: `lab/studybook-core-android-01-update-74-page-letter-budgets-20261108`.
- MotorLab CORE: r40, satellite locale r40 verificato, nessun cambio versione in corso.
- Fonte originale, capitoli, numerazione, checkpoint, firma Android e package ID: invariati.
- Fonte dell'intervallo: `src/lib/studyRebalancePolicyV67.js`; pianificazione per pagine: `src/lib/studyPageBudgetsV74.js`.
- Client e Worker con handshake `lab74-page-letter-budget-plusminus5-v1`, Worker isolato `studybook-ai-lab74`.
- Conteggio alfabetico reale, distinto da parole e spazi. Il PDF rimane immutato.
- Test offline 6 livelli, 44 pagine, 674 unità, legacy checkpoint/network/manual rebalance: PASS, run 42512507722.
- Scudo360 r40: 4 P1/4, esecuzione e richiesta-mappa su SHA verificato, run 42513282399.
- Prova Gemini reale su tutte e sei le versioni: PENDING, controllata in workflow di rilascio; nessuna garanzia prima della misura.
- Rilascio: LAB sperimentale; nessuna promozione automatica a MADRE o LAST_GOOD.
- Non eliminare bozze, PDF o dati per installare una nuova APK, usare la firma già presente.
- Stop se la pipeline non conclude la firma e l'integrità del pacchetto.

Questo documento autorizza l'unico gate di build sperimentale previsto dal codice, senza
sostenere falsamente che Gemini rispetti sempre il budget alla prima risposta.
