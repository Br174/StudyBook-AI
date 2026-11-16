# StudyBook AI — MotorLab LAB138: qualità, blocchi e continuità del libro spiegato
Data: 2026-11-16. Stato: PATCH SORGENTI SALVATE / BUILD E COLLAUDO REALI PENDING.

## Evidenza del problema
- Screenshot del 16/11/2026 alle 17:51, Android LAB137: 44/44 originali letti localmente; 0/44 pagine spiegate conformi; 24/44 bozze Gemini ricevute; un HTTP 503; Gemini 3.1 Flash-Lite, 2 risposte su 3, 427 caratteri/sec.
- Codici: V126_PAGE_REDUCTION_OUT_OF_RANGE (24), V126_TRIVIAL_OR_ONE_LINE_BODY (22), V122_PROTECTED_MEANING_MISSING (10), V122_SEGMENT_ORDER_OR_COUNT (7), V122_CONDITION_OR_MODALITY_REVIEW (2). L'utente riferisce che dopo minuti la generazione non avanza e si blocca.
- LAB136 precedente: 9/44 conformi, 44/44 bozze, 5 errori 503. Il passaggio da 9 a 0 non dimostra da solo la cancellazione: può essere un nuovo record / riimportazione / ripreparazione Originali / diversa verifica. I difetti di codice che potevano causare il reset di stato sono stati individuati e trattati.
- Fonte Google: 503 è sovraccarico temporaneo separato dal 429, non risolvibile solo ingrandendo/riducendo il blocco. Mantieni backoff senza promesse di assenza assoluta di 503, nessuna spesa.

## Base, famiglia e protezioni
- Repo `Br174/StudyBook-AI`
- Ref isolato `trial/studybook-lab138-quality-yield-checkpoint-20261116`
- Baseline Android LAB137 verificata: `86c1eeb0adc23275b0d5bfd19650749aded1e4ec`, prerelease `studybook-trial137-codespaces-86c1eeb0adc2`, installata dall'utente.
- MotorLab r40 CORE/satellite verificato, coesiste con motore nativo.
- NON modificati LAB137 installata, main/MADRE, firma, dati originali, PDF, Libreria categorie, Riformula e «In parole semplici».
- `applicationId=it.studybook.ai.lab.trial111`, signer SHA256 `D7BB9315C9C4351872495478610C484725086E2BABBC04BEC65EC823455FBDCC`. Versione candidata `0.3.138-prova.1`, code `2026113801`.
- Zero servizi a pagamento, solo modello espressamente scelto `gemini-3.1-flash-lite`, no alternanza 3.5. Nessun nuovo Worker/nuove credenziali: solo aggiornamento del Worker di prova `studybook-ai-trial124` già esistente, con nuova route backward-compatible.

## Codice LAB138 realizzato
1. `src/lib/explainedStagesV126.js`: prompt V138 opt-in con spiegazione completa per segmento e targetSegmentUnits pari al 50% delle lettere/punteggiatura del singolo segmento; nessuna fascia interna comunicata a Gemini. Per pagine originali fino a 5 righe non vuote, eccezione percentuale secondo il pilastro approvato, solo per V138; il vecchio V126 non cambia.
2. `api/explainedV138.js` e `worker/index.js`: nuova route `/api/explained/v138`, stesso esecutore/provider/controllo V126, header `X-StudyBook-Quality-Strategy-Contract: lab138-targeted-reliable-pages-v1`. Il vecchio `/api/explained/v126` e `/api/reformulate/v132` restano disponibili.
3. `api/explainedV126.js`: per richieste provenienti dalla route V138 soltanto, usa il nuovo prompt e cancella il secondo invio immediato e occulto dopo un 503; il client programma retry tramite backoff. L'endpoint V126 precedente resta compatibile per le vecchie APK.
4. `src/lib/explainedGeneratorV126.js`: per onePass usa route V138. Riduce e PERSISTE il limite di qualità del prossimo blocco dopo risposte HTTP200 con meno del 25% di pagine accettate, anche se l'ultimo blocco era l'ultimo della coda; MAI ridurre solo per 503. I successivi retry selettivi rispettano il nuovo limite. Le pagine già conformi di identico fingerprint e struttura valida NON vengono retrocesse durante il cambio APK o nuovamente inviate a Gemini.
5. `src/lib/library.js`: indicizza fingerprint e conteggio bozze nel summary IndexedDB; `findBestExplainedCheckpointV138` esamina soltanto candidati probabili e riusa edizioni di sorgenti identiche, con confronto di impronta forte, mai per nome solo. Include il record corrente.
6. `src/AppV15.jsx`: da categoria Originali, quando esiste già l'edizione nel medesimo record, la riapre subito da IndexedDB SENZA ricreare 44 o 2000 pagine e poi riprende solo dalle pagine mancanti. Quando un PDF identico è reimportato, riusa le pagine/bozze dello stesso fingerprint anche da un precedente record. Se scade il cooldown resta a riposo fino alla prossima ora consentita, senza eludere backoff.
7. `scripts/test-lab138-quality-yield.mjs` e `npm run test:lab138`: test offline di route isolata, modello, risposta strutturata, 503 senza doppia chiamata, target per segmento, regola delle 5 righe, riuso fingerprint attuale/duplicato, protezione 1/44 verificata durante 503 e qualità batch.
8. `scripts/codespaces-lab138-worker.sh`: verifica prima contratti del Worker trial124, esegue test offline, wrangler dry-run e solo se autorizzato deploy nuova route; verifica i contratti v126/v138/riformula su due HEAD consecutivi; NO nuovo servizio/No Gemini in test.
9. `scripts/codespaces-lab138-build.sh`, `scripts/codespaces-lab138-autobuild.sh`, `scripts/codespaces-lab138-publish.sh`: compilazione isolata nel Codespace ESISTENTE `super eureka`, test LAB138/LAB137 precedenti, Scudo360, firma original certificate, SHA/ZIP, release GitHub senza Actions. Verificata staticamente e ricostruita la build dopo aver corretto una precedente duplicazione generata dalla sostituzione di testo.

## Verifiche ancora da eseguire (NON DICHIARARE PASS)
- `npm run test:lab138` e script test ereditati; `npm run build`; `bash -n` di shell script; Scudo360; Wrangler dry-run/deploy al SOLO trial124; prova HEAD in produzione di prova.
- Firma APK/ZIP, GitHub Release, installazione/upgrade e test Android: NON ESEGUITI. Nessun artefatto LAB138 ora scaricabile.
- La quota/free tier Gemini può ancora rispondere 503. Non garantire generazione di 2.000 pagine in minuti senza misure reali; pagina originale resta immediatamente leggibile anche senza provider. Non considerare «conforme» una bozza breve o con concetti mancanti.

## Handoff operativo sicuro
In Codespace esistente, senza nuovi ambienti/Actions, dopo che il branch remoto è aggiornato:
```bash
git fetch --no-tags origin "refs/heads/trial/studybook-lab138-quality-yield-checkpoint-20261116:refs/remotes/origin/trial/studybook-lab138-quality-yield-checkpoint-20261116" && (git switch trial/studybook-lab138-quality-yield-checkpoint-20261116 || git switch --track origin/trial/studybook-lab138-quality-yield-checkpoint-20261116) && git pull --ff-only origin trial/studybook-lab138-quality-yield-checkpoint-20261116 && bash scripts/codespaces-lab138-autobuild.sh
```
Non eliminare l'app, i dati o il libro. Se il ramo locale presenta modifiche non committate, il passaggio di ramo deve fallire in sicurezza, senza fare `git reset --hard`. Consegna link APK/ZIP SOLO dopo che GitHub Releases conferma artefatti della LAB138 e Scudo/firma verdi, poi collaudo diretto sul dispositivo.


## Addendum — root cause Originali -> Studio e verifica di retrocompatibilità
- È stato trovato nel codice un percorso deterministico che poteva azzerare il conteggio: aprendo la categoria Originali, l'app esegue `setStudyBook(null)`, ma l'edizione AI rimane nel medesimo record IndexedDB. Premendo di nuovo crea testo, `createStudyBook` avviava una nuova edizione a 0/N e un `saveLibraryBook` completo eliminava il checkpoint precedente. La prima versione del matcher LAB138 escludeva erroneamente proprio `libraryId`; ora il matcher include il record corrente.
- `prepareOriginalForStudy` controlla il record attivo PRIMA di ogni nuova preparazione e lo riapre in modo diretto se originalFingerprint corrisponde, poi richiama `resumeGeminiEditions(prior)` per le sole pagine mancanti. Questo vale anche per libri grandi ed evita `buildStudyBook` superfluo.
- `src/lib/explainedGeneratorV126.js` conserva le pagine già precedentemente verificate e strutturalmente integre per lo stesso fingerprint anche con nuova calibrazione quantitativa, proteggendo la progressione 9/44 contro la regressione a 0/44.
- Test negativo nel `scripts/test-lab138-quality-yield.mjs`: esclusione ID attivo fa perdere la corrispondenza e deve essere assente nel codice; controllo statica della scorciatoia Originali -> Studio; 1/44 previamente conforme conservata dopo un 503; legacy `/api/explained/v126` NON riceve targetSegmentUnits, mentre V138 sì.
- Gli script di build LAB138 sono stati ricostruiti da LAB137 con una sostituzione senza espansione JS delle sottostringhe shell `$'`. La dimensione verificata del nuovo build script è 25.855 byte (non 54.791), con una sola fase preflight V138.
- Commit più recente prima dell'addendum: `341a92521c6a31368a1d8efeaa6cbdcb4efe1e0a`; la release LAB138 non esiste ancora e non bisogna inventare APK/ZIP.
