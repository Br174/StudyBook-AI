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
- Build Codespaces: scripts/codespaces-lab132-autobuild.sh, task .vscode/tasks.json, con appId invariato it.studybook.ai.lab.trial111, signer originale SHA256 D7BB9315C9C4351872495478610C484725086E2BABBC04BEC65EC823455FBDCC, versionCode 2026113201, versione 0.3.132-prova.1.
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
