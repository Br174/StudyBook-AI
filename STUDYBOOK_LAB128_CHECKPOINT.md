# StudyBook AI — LAB128 / MotorLab r40 / checkpoint 13 novembre 2026

## Problema reale osservato sul telefono
La LAB127 installata ha raggiunto **44/44 pagine comprese**, ma soltanto **8/44 pagine conformi e leggibili**. Lo screenshot mostra `HTTP 503 Gemini occupato`, che non è un difetto semantico del testo e non conta nei 5 tentativi di correzione. In LAB127 un 503 interrompe il blocco e imposta un cooldown ma, al risveglio, la stessa dimensione di richiesta può produrre nuovi 503. Il display precedente «44/44 pagine ricevute» era fuorviante.

## Ramo e protezioni
- Repo: `Br174/StudyBook-AI` (privato)
- Ramo LAB128: `trial/studybook-lab128-provider-overload-recovery-20261113`
- Base esattamente la LAB127 installata e pubblicata: `e2c7d2918f5fc5b08a98be562e6bfdf82068ad13`.
- MotorLab satellite `2026.10.29-r40`, CORE centrale stessa release.
- Prodotto/servizio di produzione, originale e dati Android invariati.
- Nessun modello a pagamento aggiunto, nessuna chiamata reale a Gemini nei test, nessun deploy Cloudflare necessario o eseguito.
- La LAB128 non è un cambio di modello: l'attuale failover gratuito condizionale 3.5 Flash Lite → 3.1 Flash Lite è conservato.

## Modifiche approvate e applicate
1. `src/lib/explainedProviderRecoveryV128.js`: cooldown esponenziale (90s→180s→360s… massimo 30min locali) rispettando un eventuale Retry-After più lungo fino a 172800s, distinguendo 503/429 da errori testuali. Nuovo limite blocchi 30k→15k→7,5k… minimo 2,5k su più 503. Recupero progressivo della taglia solo dopo più blocchi riusciti.
2. `src/lib/explainedGeneratorV126.js`: riuso integrale delle pagine verificate; stato `providerRecoveryV128` serializzato in `editionsV36` nei checkpoint; nessuna richiesta extra immediata su 503; la successiva pianificazione utilizza blocchi ridotti. Nessun 503 consuma il budget delle cinque correzioni di testo.
3. `src/lib/explainedProvisionalV128.js`: crea **solo in memoria** un derivato per PDF; per pagine non approvate usa testo originale con `V128_PENDING_PROVIDER_REWRITE` e `provisionalOriginal:true`. Non cambia `complete` originale, non perde bozze/checkpoint, non finge di avere riscritto le pagine.
4. `src/lib/explainedRepairV127.js`, `src/lib/explainedLayoutV122.js`, `src/lib/exportExplainedPdfV122.js`: aggiunti marcatori e relazione delle pagine mancanti al PDF provvisorio, nome `_Libro_spiegato_BOZZA_INCOMPLETA.pdf`. PDF completo precedente resta invariato per le pagine conformi o accettate con riserva.
5. `src/AppV15.jsx`, `src/components/AppScreens.jsx`: PDF provvisorio e download consentiti durante l'incompletezza del solo Libro spiegato. Le altre sei edizioni legacy mantengono i propri controlli.
6. `src/components/StudyPhaseProgressV59.jsx`: i numeri ora distinguono comprensione, spiegazione conforme, pagine con riserva e pagine ancora da spiegare. Indicatore della dimensione futura dopo 503.

## QA
- `scripts/test-lab128-503-recovery.mjs`: creato e provato in ambiente JS con mock HTTP/Gemini/PDF: PASS. Verifica checkpoint su 44 pagine, 503 ripetuti, 30k→15k, nessun duplicato di pagine approvate, ripresa finale, PDF provvisorio e finale, quote 429 distinte.
- `scripts/test-lab127-nonblocking-recovery.mjs`: suite precedente riprovata con il generatore LAB128 in ambiente JS simulato: PASS, compresa simulazione 2000 pagine. Worker della LAB127 resta invariato.
- `scripts/test-lab128-codespaces-preflight.mjs`: controllo delle impostazioni di ramo, firma, azioni e scripts: logica statica PASS; **`bash -n` nativo ancora da eseguire in Codespaces**.
- Esecuzione Node reale, build Vite/JSX, Scudo360, Gradle, certificato e APK/ZIP **non ancora eseguiti** nel presente contesto. Non rivendicare un rilascio non ancora creato.

## Preparazione Codespaces
- `scripts/codespaces-lab128-build.sh`, `scripts/codespaces-lab128-autobuild.sh`, `scripts/codespaces-lab128-publish.sh`, `scripts/codespaces-lab128-backend-and-build.sh`, `.vscode/tasks.json`.
- Procedura già collaudata LAB127 clonata e adattata: GitHub Actions non usato; Codespace `super eureka` esistente. Runtime Node 22/JDK 21/Android SDK esistente.
- Target Worker read-only `studybook-ai-trial124.brunoverlezza.workers.dev` con HEAD 405 e header `Phase-Contract=lab126` / `Recovery-Contract=lab127`; nessun deploy Cloudflare.
- Package: `it.studybook.ai.lab.trial111` come LAB127. Firma originale obbligatoria SHA-256 `D7BB9315C9C4351872495478610C484725086E2BABBC04BEC65EC823455FBDCC`.
- Versione LAB128: `versionCode=2026112801`, `versionName=0.3.128-prova.1`, più alta della LAB127 `2026112701`.
- Artefatti attesi soltanto dopo build: `APK-LAB128/StudyBook-AI-TRIAL-128.apk`, `APK-LAB128/StudyBook-AI-TRIAL-128.zip` e release GitHub `studybook-trial128-codespaces-<SHA>`.
- Comando da Codespace esistente già autenticato (ramo LAB127 attivo):
```bash
git fetch origin && git switch --track origin/trial/studybook-lab128-provider-overload-recovery-20261113 && bash scripts/codespaces-lab128-backend-and-build.sh
```
- Preservare cartelle `APK-LAB125/`, `APK-LAB126/`, `APK-LAB127/` e `package-lock.json` locali non tracciati. Nessun `git clean`, `reset --hard`, disinstallazione o cancellazione dati.
- Non avviare la nuova build finché la riga di comando utente non conferma il nuovo ramo. Il gate shell è intenzionalmente bloccante su ramo/worker/signer/test falliti.

## Limiti onesti
Nessun algoritmo può produrre una spiegazione nuova mentre ogni chiamata al provider fallisce. Il backoff riduce il carico, la pianificazione di blocchi piccoli aumenta la probabilità di successo quando il provider torna disponibile, e il PDF provvisorio conserva l'accesso immediato al testo **non riscritto** con etichette esplicite. L'autoresume funziona in primo piano, soggetta alla sospensione Android. Il PDF definitivo resta soggetto a verifiche e/o riserve precedentemente approvate.
