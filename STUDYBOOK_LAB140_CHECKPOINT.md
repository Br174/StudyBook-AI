# StudyBook AI — MotorLab LAB140: glossario laterale e precisione del 50%
Data: 2026-11-16. Stato: SORGENTI LAB SALVATI; test eseguibili, Worker, APK e ZIP ANCORA DA ESEGUIRE.

## Richiesta utente e baseline
Il signor Bruno conferma che LAB139 è più veloce, ma tutte o molte le definizioni mancano nella barra laterale. Chiede di migliorare l'aderenza della percentuale al 50% senza perdere la velocità acquisita. Non ha chiesto di reintrodurre i vecchi controlli semantici, cambiare modello, servizio, firma o generare nuovamente pagine conformi.
- LAST_GOOD verificato via GitHub Releases: `studybook-trial139-codespaces-1f4ba6e0300f` sul commit `1f4ba6e0300f8cec91fe81c06a67fe1f97546535`.
- Nuovo ramo isolato: `trial/studybook-lab140-glossary-precision-20261116`. Nessuna modifica al ramo o APK precedente.
- MotorLab CORE e satellite locale verificati alla stessa release `2026.10.29-r40`.
- `applicationId=it.studybook.ai.lab.trial111`, firma SHA256 attesa `D7BB9315C9C4351872495478610C484725086E2BABBC04BEC65EC823455FBDCC`. Versione LAB140 candidata `0.3.140-prova.1`, `versionCode=2026114001`; firma/test reali non ancora eseguiti.
- Modello fisso `gemini-3.1-flash-lite`, Worker gratuito esistente `studybook-ai-trial124`, zero euro aggiuntivi, no nuovi servizi/Actions.

## Diagnosi provata nel codice
- `lessonInstructionOnePassV139()` contiene la direttiva precisa **"Lascia glossary vuoto"**. L'API consegnava quindi pagine con `glossary:[]`, e il lettore nascondeva completamente la sidebar.
- `composeExplainedSheetsV122()` associava le definizioni solo quando rilevava il marker `**(termine)**`. L'assenza del marker, anche quando la voce glossario esisteva, impediva la visualizzazione.
- V139 conservava una tolleranza interna 40–60% per pagina, inviando target 50 a Gemini. Restringere bruscamente l'accettazione avrebbe aumentato le chiamate/riparazioni, sacrificando la velocità.

## Interventi registrati nel ramo LAB140
1. `src/lib/explainedStagesV126.js`: `lessonInstructionOnePassV140()` richiede nella STESSA risposta Gemini la spiegazione e fino a 4 definizioni contestuali brevi, dei termini effettivamente presenti nel testo e nella fonte; no glossario separato automatico. Il prompt precisa che solo il corpo, senza definizioni laterali, deve avvicinarsi a `targetBodyUnits` e che i target di segmento distribuiscono la lunghezza. Non rivela il limite privato 40–60 e non altera le API legacy.
2. `src/lib/explainedQualityV140.js`: matcher Unicode per voci glossario anche senza marcatori speciali. Target scale empirico puro: usa output già ricevuto su pagine lunghe conformi per adattare di poco i successivi `targetBodyUnits` (range fattore 0.88–1.12) senza nessuna nuova chiamata, correzione delle pagine già conformi o secondo controllo semantico.
3. `api/explainedV140.js`, `api/explainedV126.js`, `worker/index.js`: nuova route opt-in `/api/explained/v140` nel Worker trial124, con contratto `X-StudyBook-Glossary-Contract: lab140-glossary-one-pass-precision-v1`. Provider, modello fisso, schema JSON, backoff veloce 503, limiti Gemini e validazione tecnica/di lunghezza V139 invariati. Old `/api/explained/v139`, `/v138`, `/v126` e Riformula disponibili, opt-in solo LAB140.
4. `src/lib/explainedGeneratorV126.js`, `src/AppV15.jsx`: opt-in `glossaryPrecisionV140:true`, trasferimento del fattore misurato alla prossima richiesta nello STESSO flusso, checkpoint persistente `lengthTargetScaleV140`, nessuna rigenerazione delle pagine conformi. Diagnostica `precisionV140` con deviazione media reale dal 50%, escludendo pagine fino a cinque righe.
5. `src/lib/explainedLayoutV122.js`: note/definizioni in colonna laterale anche quando termini nel corpo sono non marcati; associazione basata su confini di parola Unicode, prima ricorrenza della pagina, mai match di sottostringhe casuali. Non modifica il contenuto, il layout A4 o la larghezza delle colonne.
6. Per le vecchie pagine V139 già salvate con glossario vuoto: `api/glossaryV140.js`, `src/lib/legacyGlossaryV140.js`, `ExplainedReaderV122.jsx/css` offrono `Definisci termini` in barra laterale. **Solo sul tocco dell'utente**, singola breve chiamata Gemini 3.1, definizioni filtrate per termini effettivamente presenti nel testo e salvate separatamente in IndexedDB con chiave libro/impronta/pagina/versione del corpo. Nessuna richiesta automatica all'apertura, durante elaborazione di 44 o 2000 pagine, o al cambio pagina. Non modifica il riassunto e i checkpoint preesistenti. Endpoint manuale `/api/glossary/v140` con header `X-StudyBook-Glossary-Manual-Contract: lab140-glossary-manual-optional-v1`; backoff 429/503 rispettato, nessun retry nascosto.
7. `src/components/StudyPhaseProgressV59.jsx`: mostra deviazione media osservata dal 50% nelle pagine lunghe conformi, senza affermare controllo del significato.
8. `scripts/test-lab140-glossary-precision.mjs` e `npm run test:lab140`: test offline su glossario/limiti/marker, compattazione, scala adattiva, una sola chiamata per blocco, simulazione 44 pagine, 503 manuale senza ritentativi, cache locale, vecchi contratti e regressioni LAB139→136. Zero rete/chiavi reali.
9. `scripts/codespaces-lab140-worker.sh`: verifica legacy V126/V138/V139 e Riformula, test completi, Wrangler dry-run; soltanto deploy al Worker gratuito `trial124` già esistente, con verifica indipendente HEAD nuova route V140 e manuale ripetuta. `scripts/codespaces-lab140-build.sh`, `-autobuild.sh`, `-publish.sh`: nuovo branch, versione Android, Scudo360, stesso certificato, artefatti SHA e ZIP, GitHub Releases senza Actions.

## QA e distribuzione — ancora da eseguire
- Verifica statica presenza/coerenza dei 19 file modificati effettuata su GitHub (nessuna criticità nei controlli dichiarati).
- **Non certificati:** test Node, ESLint/Vite, test di compatibilità, Scudo360 reale, Worker `trial124` HEAD o deploy, firma Android, APK/ZIP, collaudo del libro reale, miglioramento quantitativo effettivo e prestazioni smartphone.
- L'aggiunta del glossario nella stessa risposta può produrre alcuni token di output in più; nessuna chiamata automatica aggiuntiva, ma NON dichiarare un benchmark cronometico identico prima del collaudo.
- Le pagine già completate con glossario `[]` non inventano definizioni: visualizzano il nuovo pulsante facoltativo, senza ritentare Gemini automaticamente.
- La fascia di accettazione rimane 40–60% interno, target 50% inviato al modello. La calibrazione mira ad avvicinarsi a 50%, non garantisce precisione aritmetica perfetta del modello gratuito.

## Handoff Codespace già autorizzato
Nel terminale esistente GitHub Codespaces `super eureka`, senza toccare LAB139 installata:
```bash
git fetch --no-tags origin "refs/heads/trial/studybook-lab140-glossary-precision-20261116:refs/remotes/origin/trial/studybook-lab140-glossary-precision-20261116" && (git switch trial/studybook-lab140-glossary-precision-20261116 || git switch --track origin/trial/studybook-lab140-glossary-precision-20261116) && git pull --ff-only origin trial/studybook-lab140-glossary-precision-20261116 && bash scripts/codespaces-lab140-autobuild.sh
```
Stop se branch sorgente inatteso, codice locale con modifiche conflittuali, Worker vecchio non conforme, test in errore, firma differente. Non lanciare nuovo Codespace, GitHub Actions, nuovi servizi Cloudflare, reset hard o cancellazione dei dati utente. Consegna APK/ZIP soltanto dopo conferma dalla vera release GitHub e firme verificate.
