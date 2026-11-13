# StudyBook AI — MotorLab LAB129 / checkpoint UI mobile (13 novembre 2026)

## Approvazione e perimetro
L'utente ha approvato espressamente il piano LAB129 per **A) ripristino flashcard, quiz, mappa, interrogazione nella vista Studia; B) eliminazione testo coperto e scroll incompleto; C) spostamento di «In parole semplici» in alto a destra; D) frecce/selettore pagina più ordinati; E) glossario dall'alto verso il basso a destra; F) grafica migliorata nelle viste Leggi e Studia sul telefono**.

## Contesto tecnico
- Repo privato: `Br174/StudyBook-AI`.
- Ramo isolato LAB129: `trial/studybook-lab129-mobile-reader-tools-layout-20261113`.
- Base esatta LAB128: `779d1d8d20162612d10cdc88fafb54019eb32b50`.
- MotorLab CORE e satellite release corrente verificata `2026.10.29-r40`.
- Ultima versione **installata e osservata**: LAB127, screenshot su telefono con pagina 2 e tasto «In parole semplici · Spiega ancora» in basso.
- LAB128 non aveva una nuova APK compilata in questa conversazione; LAB129 include tutti i cambiamenti LAB128 su HTTP503 già approvati, ma non modifica quelle sorgenti.
- Firma Android e package originali protetti: `it.studybook.ai.lab.trial111`, signer SHA-256 `D7BB9315C9C4351872495478610C484725086E2BABBC04BEC65EC823455FBDCC`. Versione LAB129 prevista `2026112901`, `0.3.129-prova.1`.

## Causa e correzioni
1. `src/AppV15.jsx`: il ramo LAB127 forzava `ExplainedReaderV122` sia per `studyEntryMode='reader'` sia per `'study'`. Ora la scelta `Studia sul telefono` apre il componente `StudyMode` già esistente: Flashcard, Quiz, Mappa e Interrogazione, generati **dal testo originale**, senza nuove chiamate Gemini né cambiamenti didattici.
2. `src/lib/explainedStudyToolsV129.js`: se l'importazione verificata non contiene capitoli/paragraph originali, costruisce **solo in memoria** una vista sintetica di capitoli per pagina usando esclusivamente il testo originale. Non modifica archivio, database o percentuali.
3. `src/components/ExplainedReaderV122.jsx`: nuovo header compatto, pulsante «In parole semplici» a destra in alto, frecce ai lati del selettore, link per aprire strumenti di studio, reset scroll sulla navigazione, ultima spiegazione memorizzata. La spiegazione on-demand viene generata **solo al clic** e può scorrere sotto la pagina.
4. `src/lib/explainedMobileLayoutV129.js`: raccoglie i termini di tutto il foglio in ordine dalla prima occorrenza, deduplica; la sidebar compare dall'alto e non è più accoppiata alle singole righe del testo.
5. `src/components/ExplainedReaderV122.css`: la pagina leggibile sul telefono ha altezza naturale `aspect-ratio:auto` e contenitore scrollabile, margini finali e safe-area; nessun CTA fluttuante copre testo o note; toolbar responsive.
6. `src/components/MirrorReaderV35.jsx/.css`: nel lettore precedente, sul telefono, via proporzioni A4 rigide e overflow del testo annidato; scroll unico fino al footer, frecce e selettore allineati, navigazione reset al top.
7. `src/components/StudyMode.jsx`, `src/studyMode.css`: ritornare alla lettura dalla schermata strumenti; quattro tab didattici visibili in griglia mobile, stage scrollabile con spazio finale sicuro.

## QA eseguito (senza quota Gemini)
- `scripts/test-lab129-mobile-reader.mjs`: **PASS** in esecuzione JavaScript con dipendenze isolate. Verifica Flashcard, Quiz, Orale e Mappa realmente derivati dal testo originale, fallback senza capitoli, assenza mutazione, glossario ordinato/deduplicato, route corretta delle viste e vincoli CSS anti-troncamento.
- `scripts/test-lab128-503-recovery.mjs`: **PASS** sul codice della LAB129 con mock provider/PDF, inclusi 503 adattivi, checkpoint, 44 pagine, PDF provvisorio.
- `scripts/test-lab127-nonblocking-recovery.mjs`: **PASS** sul ramo LAB129 con simulazioni 44/2000 pagine e cinque correzioni con riserva.
- Preflight statico `scripts/test-lab129-codespaces-preflight.mjs`: **PASS** nella verifica strutturale; **`bash -n` nativo non ancora eseguito**.
- Confronto GitHub LAB129 vs LAB128: **nessun diff** in `api/`, `src/lib/explainedGeneratorV126.js`, `src/lib/explainedLayoutV122.js`, `src/lib/exportExplainedPdfV122.js`, `src/lib/studyAutoResumeV45.js`.
- **DA VERIFICARE**: esecuzione nativa Node della suite con dipendenze complete, `vite build` JSX/CSS, Scudo360, Gradle+firma, APK e ZIP, lettura manuale Android, eventuale controllo della barra di navigazione del dispositivo e mantenimento dati dopo aggiornamento. Gli strumenti di simulazione non sostituiscono un collaudo UI sul dispositivo.

## Pipeline Codespaces LAB129
- Script preparati: `scripts/codespaces-lab129-build.sh`, `scripts/codespaces-lab129-autobuild.sh`, `scripts/codespaces-lab129-publish.sh`, `scripts/codespaces-lab129-backend-and-build.sh`, `.vscode/tasks.json`.
- `npm run test:lab129` esegue il nuovo controllo di UI e le suite LAB128/LAB127 più il preflight Codespaces.
- Worker trial già compatibile LAB127 (`https://studybook-ai-trial124.brunoverlezza.workers.dev`), check HEAD 405 + header `Phase-Contract=lab126` e `Recovery-Contract=lab127`, **nessun nuovo deploy Cloudflare**.
- Codespace già esistente `super eureka` (Android browser). Non creare altro Codespace o servizi a pagamento.
- Avvio sul terminale esistente, proteggendo modifiche tracciate e cartelle APK precedenti:
```bash
cd /workspaces/StudyBook-AI && git diff --quiet && git diff --cached --quiet && git fetch origin && (git switch trial/studybook-lab129-mobile-reader-tools-layout-20261113 || git switch --track origin/trial/studybook-lab129-mobile-reader-tools-layout-20261113) && git pull --ff-only && bash scripts/codespaces-lab129-backend-and-build.sh
```
- Nessun `git clean`, `reset --hard`, cancellazione database, cambio firma o migrazione prodotto.
- APK/ZIP attesi *soltanto dopo una build completata*: `APK-LAB129/StudyBook-AI-TRIAL-129.apk`, `APK-LAB129/StudyBook-AI-TRIAL-129.zip`; tag prerelease `studybook-trial129-codespaces-<SHA>`.

## Stato
**Codice e test simulati verificati su GitHub; APK LAB129 non ancora compilata.** Non rivendicare il ripristino come collaudato sul telefono fino all'installazione e alle prove delle viste Leggi/Studia, swipe/frecce, fondo pagina, sidebar e semplice on-demand. Zero costi aggiuntivi.
