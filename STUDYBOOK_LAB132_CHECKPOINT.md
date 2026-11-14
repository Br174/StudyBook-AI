# StudyBook AI — MotorLab LAB132 checkpoint
Data: 14 novembre 2026
Stato: sorgenti LAB132 aggiornati su ramo isolato; compilazione Android e test dispositivo **non ancora eseguiti**.

## Autorità e versione di partenza
- Repository: Br174/StudyBook-AI (privato).
- LAB131 base verificata: 70e6a6f61c098d4a97c5eb3d52990effb2fc2360.
- Ramo LAB132: trial/studybook-lab132-reformulation-library-20261114.
- MotorLab CORE e satellite: 2026.10.29-r40.
- Mantieni LAB131 e relativa APK installata intatte.

## Implementazioni LAB132
1. Root Libreria: sei categorie in griglia 3x2 — Originali, Scannerizzati, Riassunto al 50%, In parole semplici, Da rielaborare, Rielaborati; nessuna categoria per materia. I libri si visualizzano aprendo la categoria. «In parole semplici» usa la stessa libreria preesistente.
2. Pressione prolungata copertina: due secondi; preservate le azioni preesistenti del menu (rinomina, copertina, ripristino, rielabora, riesamina PDF originale, elimina).
3. Da Originali il libro apre i byte sorgente, anche quando ne esiste già una versione spiegata, con lettura, PDF, export e preparazione nuova elaborazione disponibili nelle schede preesistenti.
4. Nuovo Riformula nella lettura della pagina spiegata: chiamata volontaria singola al Worker /api/explained/v126 usando il testo originale certificato della stessa pagina, mappa di comprensione e obiettivo del 50%. Il vecchio testo rimane fino a «Tieni riformulazione»; «Riformula ancora» richiede una nuova chiamata sempre dall'originale, senza riutilizzare output precedente. Controllo semantico e quantitativo V126 prima dell'accettazione; 429/503 senza loop.
5. Registro IndexedDB separato: una versione approvata per pagina per bookId+fingerprint. Nuovi PDF generati solo su comando dell'utente assemblando l'edizione originale con le pagine accettate, conservati come snapshot Blob separati; i PDF vecchi rimangono invariati.
6. «Da rielaborare» mostra libri con modifiche accettate ancora da esportare; «Rielaborati» mostra PDF creati con apertura/scaricamento.
7. Firma, appId e Worker mantenuti; nessun servizio a pagamento aggiunto e nessun deploy del backend in questa LAB.

## QA e consegna
- Test offline aggiunto: scripts/test-lab132-reformulation.mjs.
- Preflight Codespaces: scripts/test-lab132-codespaces-preflight.mjs.
- Scudo360 e test LAB131/LAB130 ereditati dal build script.
- Build Codespaces: scripts/codespaces-lab132-autobuild.sh, task .vscode/tasks.json, con appId invariato it.studybook.ai.lab.trial111, signer originale SHA256 D7BB9315C9C4351872495478610C484725086E2BABBC04BEC65EC823455FBDCC, versionCode 2026113202, versione 0.3.132-prova.2.
- Compilazione, verifica firma e pubblicazione non ancora eseguite: l'applicazione di questo commit non dimostra la validità runtime o dei modelli Gemini. Prima di dichiarare APK pronta ottenere esito test e build Codespace e verificare la Release.
- Non avviare GitHub Actions o nuovi CodeSpaces. Riusare il Codespace esistente.

## Correzione recupero riformulazione LAB132 (approvata 14/11/2026)
- Intervento sulla stessa famiglia/ramo LAB132; non promuovere a produzione.
- Gestore unico src/lib/pageReformulationV132.js: se la proposta fallisce audit locale o Worker, massimo TRE richieste totali, con indicazioni mirate da errori V126/V125/V122; ripartenza sempre dal testo originale, non dalla proposta respinta.
- 429/503/HTTP/network/abort/protocol mismatch NON vengono ritentati in loop. Soglie di tolleranza private non vengono trasmesse al modello; obiettivo Gemini invariato 50%.
- Pagina 33 bis: richiede/aggiorna pagina fisica 33, UI indica la fonte e dopo approvazione ritorna alla prima pagina della fonte per gestire il reflow.
- Nessuna modifica a Worker, PDF esistenti, originali, firma, package o libreria.
- Nuovi test: scripts/test-lab132-recovery.mjs (integrati con test-lab132-reformulation.mjs), rete completamente simulata.
- STATO: modifiche sorgente su GitHub; test Android reale/Gemini live, compilazione APK+ZIP e prova su dispositivo ancora da verificare separatamente. Non dichiarare la correzione risolta prima di verifica reale.

## Release update-in-place LAB132 fix
- Correzione della riformulazione: versionCode aumentato da 2026113201 a **2026113202**, versionName 0.3.132-prova.2. Identità appId e certificato Android invariati, per aggiornamento sul telefono senza disinstallare.
- Rilascio precedente a46a7ff ancora valido come LAST_GOOD; nuovo APK deve derivare da HEAD successivo a ddeaed6016eb0514e24c46af6874cfbebf98e11b.
- Il Codespace esistente è l'unico ambiente di firma ammesso; GitHub Actions e nuovi Codespaces non avviati. Collaudo Android e compilazione ancora da verificare.

## LAB132.3 — Ultima direttiva: solo Riformula pagina singola
- Per la sola azione volontaria «Riformula», leggere la pagina FISICA originale intera (es.: 33 bis => originale 33). Inviare alla chiamata Gemini esistente i segmenti originali e le istruzioni didattiche già previste: una riscrittura semplice con riduzione-obiettivo 50%.
- All'arrivo della proposta, valutare SOLO la percentuale effettiva di riduzione, oltre ai requisiti tecnici minimi (pagina/segmenti corrispondenti, testo non vuoto, fingerprint corretto). NON usare i precedenti blocchi di fedeltà/grammatica/glossario per respingere questa proposta.
- Conservare soglia interna 40–60% (non trasmessa a Gemini). Se fuori soglia, nuova richiesta automatica dalla stessa pagina originale fino al risultato conforme, massimo 8 invocazioni per clic per evitare loop e consumo incontrollato della quota gratuita. 429/503/rete/protocollo fermano il ciclo.
- Il medesimo criterio deve valere su approvazione, rilettura e PDF, solo per le pagine Riformula con auditRevision lab132-single-page-length-only-v1. Vecchie pagine/revisioni conservano il vecchio audit. Riformula ancora => nuova richiesta dall'originale.
- Nessuna modifica alla pipeline di elaborazione del libro, ai livelli, ai dati originali, al Worker, al glossario generale o ad altre funzioni.
- Build Android preparata in Codespace esistente: versionCode 2026113203, versione 0.3.132-prova.3, package/firma invariati. Test Gemini reali e dispositivo ancora in sospeso.

## Direttiva conclusiva — Riformula solo MANUALE (14/11/2026)
- La modifica di LAB132.3 che prevedeva fino a otto tentativi automatici è stata ANNULLATA prima della compilazione. Una pressione su Riformula => esattamente UNA richiesta Gemini sulla pagina originale completa.
- Mostra sempre la proposta tecnicamente valida con percentuale effettiva anche se 30%, 65% o 70%. Obiettivo indicativo 50%, intervallo interno 40–60% solo a fini di indicazione visiva; non respingere il risultato per la sola lunghezza.
- SOLO l'utente può premere «Riformula ancora» per una seconda richiesta; ogni richiesta riparte da originale e istruzioni.
- Mantieni controllo tecnico formato e identità pagina, ma non richiedere verifiche di fedeltà, semantica, glossario; nessun automatismo, nessun cambio al processo del libro.
- La proposta resta separata e non sostituisce la pagina precedente prima della pressione «Tieni riformulazione».
- VersionCode preparato 2026113203 (non ancora pubblicato). Test/mock offline effettuati, test su Android e Gemini reale ANCORA da eseguire.
