# StudyBook AI / MotorLab LAB109 · Verifica reale del percorso Worker e fattibilità scientifica 40%

Data: 10 novembre 2026. **Stato: ricerca/integrazione sperimentale completata, PROMOZIONE NEGATA**. Release MotorLab 2026.10.29-r40, satellite r40 verificato. Nessun cambio alla release CORE nel corso dell'operazione.

Ramo: `lab/studybook-core-android-01-update-109-fact-first-pilot-20261110` derivato dal **LAB79 firmato** `feb2b24d2476621f10edac1acc6d98c2154693e9`. Non dal MAIN generico e non dal ramo di ricerca LAB108: il percorso app resta corretto. Conservati contratto `studyDraftProtocolV74`, geometry `studyGeometryV78`, source-budget `studyPageBudgetsV74`, bozza / resume / audit / firma e dati; MAIN, Worker Cloudflare pubblicato e Android utente **NON modificati**.

## Scoperta storica per evitare ripetizioni

Il repository LAB99 aveva già un **output reale Gemini** per **scienze, 40%** con **378 lettere, 36,89% di riduzione e 8/8 righe** dopo una sola riparazione di frase. Relational guard senza avvisi, ma prova didattica **non approvata**: manca il concetto finale della fonte, ossia distinguere *descrizione del moto* e *cause delle variazioni osservate*. Non confondere numeri validi con fedeltà didattica. Evidenza: `audit/reports/lab99-gemini-sentence-repairs.json` e `audit/reports/lab99-final-offline-recheck.json` del ramo storico LAB99/V106.

## Modifica di codice sperimentale (non esposta ad Android)

- `src/lib/studyFactFirstV109.js` gestisce una sola istruzione alternativa per la riduzione 40%, con priorità dei fatti, delle negazioni, dei nessi e della distinzione fra descrizione e causa; **non aggiunge planner, prompt secondario o retry**.
- `api/editionsBulkV51.js` aggancia questa istruzione nel **vero handler Worker**, ma solo quando sono presenti contemporaneamente **`STUDYBOOK_FACT_FIRST_V109=1` nell'ambiente Worker** e la richiesta porta `experimentV109='studybook-source-fact-first-40-optin-v109'`. Nessuno dei clienti LAB79 installati trasmette l'opzione; senza doppio opt-in segue **identico il prompt LAB76**. Una richiesta che reclama il pilot ma senza permesso ottiene **409 prima di Gemini**, anziché una modifica silenziosa.
- Quantità e righe sempre misurate dal codice già esistente; output `semanticCertified:false, approvedForApp:false`. La sola chiamata modello resta unica per gruppo, ferma restando la normale chiamata ausiliaria `countTokens` già presente nel Worker.

## Test vero handler Worker (provider simulato soltanto nella prova di contratto)

**GitHub Actions PASS**: <https://github.com/Br174/StudyBook-AI/actions/runs/42738445137>. Script `scripts/test-lab109-worker-contract.mjs` chiama `api/editionsBulkV51.js` direttamente con richiesta autentica `draft-v74`, budgets e geometry reali LAB79. Verificati:
- nessuna modifica al client LAB79 privo di opzione;
- doppio opt-in e risposta che identifica il pilot;
- una sola generazione del modello; il `countTokens` separato non è una generazione;
- rifiuto di `pageBudgetsV74` falsificati **prima** della rete;
- rifiuto di richiesta pilot senza flag (**409**);
- ricalibrazione esplicita corretta senza scheduler extra;
- HTTP429 preservato senza dichiarare successo.

Il primo workflow ha fallito **solo** perché il runner non aveva le dipendenze Capacitor necessarie per lanciare gli esistenti test LAB79: i controlli del Worker erano già passati. Aggiunta installazione delle dipendenze di progetto e rieseguito con esito SUCCESS. Ciò non è un bug del generatore.

## VERA generazione Gemini sullo stesso codice Worker, senza deployment

**GitHub Actions SUCCESS**: <https://github.com/Br174/StudyBook-AI/actions/runs/42738701579>. Script `scripts/test-lab109-real-worker-science40.mjs`. Una sola generazione con Gemini **3.5 Flash Lite** e chiave gratuita già presente, tramite **l'effettivo handler `api/editionsBulkV51.js`** in GitHub CI. Non è una prova dal dispositivo Android o dal Worker di produzione.

- Fonte sintetica immutata: **599 lettere**.
- Obiettivo 40%: **359 lettere conservate**, limiti **330–389**, **8 righe virtuali da 60 celle**.
- Output reale: **453 lettere**, riduzione **24,37%**, **10/8 righe**.
- Risposta provider HTTP **200**, finishReason **stop**; nessuna quota HTTP429/503, nessun errore di trasporto.
- Controllo fonte preliminare: **8/9** relazioni rilevate; la distinzione fra descrizione e cause non era espressa integralmente nelle modalità attese. Alcuni errori ortografici come `poiche`, `laltra` restano. Nessuna certificazione didattica.
- Il controllore del Worker ha correttamente restituito **`inBand:false, fitsRows:false`**, senza occultare l'esito.

Evidenza completa, inclusa la risposta del modello: `audit/reports/lab109-real-worker-science40.json`.

## Prova decisiva di FATTIBILITÀ su una pagina (NON Gemini)

**GitHub Actions SUCCESS**: <https://github.com/Br174/StudyBook-AI/actions/runs/42739320123>. Script `scripts/test-lab109-semantic-feasibility.mjs`. La riscrittura è **MANUALMENTE COMPOSTA** da un autore come riferimento di laboratorio, poi misurata con il V78 reale e verificata da 9 controlli espliciti. **NON dichiararla output autonomo dell'AI.**

- **381 lettere** su 599, **36,39%** di riduzione, **8/8 righe** e fascia ±5 rispettata.
- **9/9** riferimenti concettuali individuati da controlli mirati: rotazione asse e luce/buio, rivoluzione annuale, stagioni non legate alla distanza, maree influenzate da Luna e Sole, eclissi e lunazione, metodo scientifico, ipotesi verificabili e osservazioni ripetibili, insufficienza di un risultato, distinzione descrizione/cause.
- **3/3** manomissioni artificiali (negazione eclissi, maree trasformate in causalità, perdita descrizione/cause) segnalate.
- I test sono euristici e di fattibilità; **non** una certificazione semantica professionale, **non** prove del generatore, **non** un PDF/A4 fisicamente collaudato.
- Evidenza: `audit/reports/lab109-manual-semantic-feasibility.json` e `audit/test-fixtures/lab109-worker-source.json`.

## Verdetto e sicurezze MotorLab

**Il target è matematicamente e didatticamente plausibile, ma NON è stato raggiunto dal nuovo generatore Gemini.** Nessuna ragione di cambiare le etichette 10–50 o introdurre un taglio automatico del testo; è necessaria una generazione realmente vincolata ai fatti con verifica per pagina e rollback se non supera.

- Dati personali, libri sul telefono, 264 bozze LAB79, checkpoint e `LAST_GOOD`: **intatti**.
- Nessuna modifica al Worker pubblicato, nessuna migrazione, nessun upgrade gratuito/pagamento.
- Workflow Android che partono in automatico sul ramo sperimentale vengono bloccati dal guard `Resolve LAB family identity`; **non** risultano APK/ZIP promuovibili, e non va aggirato Scudo360.
- **Gate APK/ZIP chiuso**. Non confondere test del Worker in CI con la verifica Android reale.
- Azione prioritaria: realizzare un inventario di proposizioni fondamentali verificato una sola volta per pagina/libro (senza ripetere checklist lunghe in ogni prompt), ricalibrazione *source-first* dei soli punti errati, scelta dell'output quantitativamente corretto solo se tutte le relazioni chiave sono presenti. Testare il metodo su più generi e con vero libro/Android prima della compilazione.
- Non avviare una cascata di Gemini per pagine fuori margine: al massimo una generazione principale, verifiche locali successive, revisione mirata e rollback. No costo aggiuntivo.
