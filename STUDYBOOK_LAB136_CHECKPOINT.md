# StudyBook AI — MotorLab LAB136 (16 novembre 2026)
Stato: MODIFICHE SORGENTI REGISTRATE; QA NODE/SCUDO, WORKER DEPLOY, APK, ZIP, COLLAUDO ANDROID ANCORA PENDING.

## Continuità e identità
- App: StudyBook AI, famiglia di prova Android LAB132/LAB135.
- Ramo fonte esatto: `trial/studybook-lab136-speed-quality-draft-recovery-20261116`.
- Base immutata della famiglia: `c6f948c8e74bb343e3c134859fac1b7c5ab3f8e6` (LAB135).
- MotorLab CORE/locale: `2026.10.29-r40`, verificato.
- Identità aggiornata proposta: applicationId `it.studybook.ai.lab.trial111`, firma SHA256 `D7BB9315C9C4351872495478610C484725086E2BABBC04BEC65EC823455FBDCC`, versionCode `2026113601`, versione `0.3.136-prova.1`. Da verificare su APK reale, non presumere firma eseguita.
- LAST_GOOD: LAB132/LAB135 non modificati. Non utilizzare main, vecchi ramo LAB79, vecchia famiglia Android o generare un nuovo certificato.
- Modello generativo automatico: soltanto Gemini 3.1 Flash-Lite, nessun nuovo servizio o costo.
- Worker target esistente: `studybook-ai-trial124.brunoverlezza.workers.dev`; MAI produzione.

## Approvazione e diagnosi
Bruno ha approvato il piano per risolvere lentezza e fermate: preservare originale, Libreria, PDF, Riformula manuale, checkpoint, qualità, firma, niente servizi a pagamento. Screenshot su Prova 132: 44/44 originali letti, 3/44 spiegazioni conformi; 40 errori V126_PAGE_REDUCTION_OUT_OF_RANGE, 37 TRIVIAL_OR_ONE_LINE, 17 segment ordine, 14 protected meaning, 14 immutable; Gemini HTTP503. Il codice precedente imponeva `draft=false` e risalvava l'intero oggetto libro nel checkpoint a ogni blocco.

## Modifiche isolate presenti nel ramo
1. `src/lib/explainedLayoutV122.js`: la bozza con segmenti completi è visibile nel solo lettore, marcata bozza; mai dichiarata conforme, azioni Riformula e «In parole semplici» disattivate fino alla verifica; export PDF definitivo rimane bloccato con `requireComplete`.
2. `src/lib/library.js`: `bookStudyCheckpoints` conserva soltanto `editionV36` aggiornata, non il PDF/parsed source/entire studyBook ogni volta. `getLibraryBook` ricompone con `books`; i vecchi checkpoint `studyBook` restano leggibili.
3. `src/lib/explainedGeneratorV126.js`: blocchi futuri più piccoli solo quando un HTTP 200 ha resa di qualità scadente; nessuna riduzione del budget HTTP503 e nessuna rigenerazione delle pagine conformi. Se due correzioni non migliorano il testo preservato, interrompe i tentativi ridondanti e conserva esplicitamente una pagina con riserva, senza accreditarla come conforme.
4. `src/lib/explainedStagesV126.js`: migliorata istruzione one-pass V135 per spiegazioni più sviluppate per segmento, con target 50% visibile al modello ma tolleranza 40–60 NON rivelata. Non modifica il pulsante Riformula.
5. `api/explainedV126.js`: contratto HEAD `X-StudyBook-Quality-Contract: lab136-balanced-page-v1`, oltre agli header precedenti. Nessuna modifica alla scelta fissa Gemini 3.1.
6. Test `scripts/test-lab136-reliability.mjs` e compatibilità `test-lab127-nonblocking-recovery.mjs`; `npm run test:lab136` registrato in package.json.
7. `src/lib/explainedRepairV127.js`: se una bozza strutturalmente corretta è in realtà uno slogan/una riga con meno del minimo di lettere utili (nelle pagine non brevi), la pagina CON RISERVA ripiega sul testo originale, non sul testo AI inadeguato. Nuova asserzione negativa nello script test LAB136.

## QA da eseguire — non dichiarati superati
- `npm run test:lab136`, test LAB132/131/130/135, Node syntax, `npm run build`, Scudo360: NON ESEGUITI; solo lettura/confronto statico GitHub.
- Mock Gemini 44 e 2.000 pagine, recupero DB legacy, HTTTP503, rate, pagine/riserve, niente duplicazioni: inclusi nel nuovo script, NON ESEGUITI.
- Convalida Google Gemini dal telefono e benchmark reale: NON ESEGUITI.
- Deploy del solo Worker trial124 con il prompt LAB136: NON ESEGUITO.
- APK e ZIP firmati verificati, Release: NON DISPONIBILI.

## Script esistenti dedicati (senza modificare LAB132)
- `scripts/codespaces-lab136-worker.sh`: test locale, wrangler dry-run, deploy SOLO al worker trial124 già esistente, doppio HEAD sul contratto LAB136.
- `scripts/codespaces-lab136-build.sh`: controllo contratti, compilazione e test Scudo360, Android appId/cert/versionCode invarianti, APK ZIP con SHA256.
- `scripts/codespaces-lab136-publish.sh`: GitHub Releases prerelease immutabile, zero Actions.
- `scripts/codespaces-lab136-autobuild.sh`: orchestratore nel Codespace GIÀ ESISTENTE, senza nuovo Codespace/Actions, riusa SDK e signer in locale e copia APK/ZIP nel workspace.

## Blocco reale e prossimo passo
- Browser TinyFish del profilo GitHub esistente NON OPERATIVO: saldo tool insufficiente. NESSUN pagamento/upgrade autorizzato o richiesto, vincolo €0.
- GitHub Actions non è una scorciatoia verificata; la compilazione deve usare il Codespace esistente per recuperare il signer originale.
- Per lanciare in Codespace già esistente, soltanto quando il terminale autenticato è nuovamente accessibile: passare senza perdita di modifiche al ramo LAB136, `git pull --ff-only`, quindi `bash scripts/codespaces-lab136-autobuild.sh`.
- Non dichiarare completato finché non sono verdi i test, il contratto Worker è stato effettivamente dispiegato/verificato, la APK firmata e lo ZIP controllato.
- Prossima chat: ricaricare questo checkpoint e lo HEAD LIVE, non ripartire dal vecchio registro LAB23.


## Diagnosi e correzione compilazione Codespaces — 16/11/2026, 14:33 Italia
- Screenshot del terminale del Codespace esistente: build LAB136 interrotta in fase `test`, file `scripts/test-lab127-nonblocking-recovery.mjs:107`; risultato effettivo cicli correzione per p5 `[0,1,2,3,4,5]` anziché `[0,1,2]`; nessuna APK LAB136 risultante da questo tentativo.
- Root cause verificata sul codice: `repairAttemptV127` crea uno stato nuovo limitato a `initial`, `corrections`, `lastCode`, quindi la precedente implementazione `markAttempt` cancellava `stagnantV136` PRIMA di leggerne il valore: ogni retry ripartiva da 1 e non si raggiungeva la soglia 2.
- Fix `src/lib/explainedGeneratorV126.js`: memorizza `priorRepair` prima di `markAttempt`, recupera la streak precedente e preserva `stagnantV136` nel checkpoint. Non modifica il numero massimo generale di 5 correzioni, i criteri di fedeltà né il comportamento 503.
- Aggiornati `scripts/test-lab127-nonblocking-recovery.mjs` e `scripts/test-lab136-reliability.mjs` per richiedere esattamente una generazione e due correzioni su bozza identica, e persistenza contatore 2.
- Modifiche su GitHub, test da rieseguire nel Codespace; nessuna esecuzione di Node/Scudo/Gradle dichiarata da ChatGPT. Comando nel terminale GIÀ aperto sul ramo LAB136: `git pull --ff-only && bash scripts/codespaces-lab136-autobuild.sh`.
- Consegnare APK/ZIP esclusivamente dopo tutti i controlli e firma verificata; non riusare i file parziali della build fallita.
