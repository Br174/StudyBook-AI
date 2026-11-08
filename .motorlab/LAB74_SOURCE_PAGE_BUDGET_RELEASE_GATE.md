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

## Riesame reale MotorLab · 8 novembre 2026, ripresa rapida ⚡

- Ultima sorgente applicativa verificata Scudo360: `6f6231153fd3fe6dbacad93558f79cd840500116`; 4 contratti P1 su 4, run `42517894660`, esito SUCCESS.
- Test numerici sul codice migliorato: SUCCESS `42517630778`, incluse selezione pagine fuori margine, persistenza e non rigenerazione delle pagine conformi.
- Gemini reale, primo test su 6 varianti: run `42513535694`, **0/6 edizioni completamente conformi** per controllo singole pagine; il job Android firmato era su commit precedente `a4a407609e92d55e49b582bc09f5725a088efdeb`, NON contiene le correzioni aggiunte successivamente.
- Test reale con 50% e 20%, feedback letterale a livello di pagina su Worker QA isolato: run `42517037347`, 0/2 conformi.
- Secondo test reale con correzioni SOLO alle pagine fuori fascia, massimo due tentativi per pagina: run `42517630745`, 0/2 livelli completamente conformi; singola pagina del 50% rientrata (374 lettere su 706, fascia 318–388).
- Conclusione empirica: il conteggio delle lettere e la selezione delle pagine funzionano, ma il modello Gemini NON garantisce i target nonostante i feedback e due tentativi. NON PROMUOVERE LA LAB74 a LAST_GOOD o consegnarla come risolutiva.
- UAB-CORE legacy conserva una regressione di test separata `source-review-needed` versus `quality-review`, NON attribuire stato verde globale. Verificare il test originario senza disattivare la protezione della fonte.
- Prossimo confine sicuro: sviluppare una selezione di alternative che preservi il significato e rispetti l'intervallo numerico; non tagliare o aggiungere testo automaticamente. Eseguire prova con Gemini reale prima di firmare una NUOVA APK. Nessun upgrade o modello a pagamento.
