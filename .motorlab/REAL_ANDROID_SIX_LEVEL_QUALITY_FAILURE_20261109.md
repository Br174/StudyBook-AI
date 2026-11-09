# MotorLab · StudyBook AI · Fallimento reale delle sei percentuali, 2026-11-09

**Stato:** BLOCCO DI QUALITÀ. L'APK LAB77 è stata compilata e installata, ma **non è idonea per certificare le riduzioni del libro reale**. Questa è un'indagine QA, non una release, né una nuova generazione Gemini. Niente modifiche a Worker, APK, appId, dati utente, LAST_GOOD o CORE per creare nuova software.

## Evidenza osservata su telefono

L'utente ha presentato **sei screenshot ore 20:12 Europe/Rome del 9 novembre 2026**, dalla StudyBook LAB su Android, libro di 44 pagine «Filosofia del diritto appunti+sbobine». I sei valori mostrati sono:

| Livello app | Intervallo approvato | Riduzione reale mostrata | In fascia |
|---|---:|---:|---:|
| Riassunto (policy app 60%) | 55–65% | 83,1% | NO |
| 50% | 45–55% | 83,4% | NO |
| 40% | 35–45% | 81,9% | NO |
| 30% | 25–35% | 76,1% | NO |
| 20% | 15–25% | 75,7% | NO |
| 10% | 5–15% | 68,4% | NO |

**Tasso di conformità reale = 0/6, non "quasi tutte verdi".** Tutti i testi sono molto più corti degli obiettivi, con differenza sistematica. Gli screenshot mostrano «Fuori obiettivo: testo da ricalibrare» e il comando «Migliora percentuali e chiarezza»; la correzione non è ancora stata effettuata. **Non è stata verificata la fedeltà semantica di questi testi al libro**, poiché qui non sono disponibili testo originale e sei output.

## Causa dimostrata n. 1: i test verdi controllavano un altro problema

- `scripts/test-lab76-best-of.mjs` contiene quattro coppie **fisse** di brevi testi fonte e output già verificati nelle LAB103/104. Misura che `inspectBestOfV76` ritrovi le percentuali previste, non che il Worker Gemini produca autonomamente tali output.
- `scripts/test-lab77-503-throughput-recovery.mjs` sostituisce fetch con un mock che restituisce testo sintetico; prova checkpoint e ripresa dopo 503, **non** la qualità reale su un PDF di diritto.
- Le sei percentuali d'archivio LAB103 erano **campioni migliori selezionati** da 168 risposte storiche e da fonti diverse, non la percentuale di successi su un libro nuovo. LAB105 aveva già documentato appena 3/12 nuovi output all'interno dei limiti.
- Pertanto i test verdi non autorizzavano l'affermazione «il nuovo APK riprodurrà le sei riduzioni esatte». In futuro **niente verde di qualità** se il percorso reale con Gemini, la stessa dimensione dei blocchi, un libro nuovo e il conteggio finale non supera il controllo.

## Causa dimostrata n. 2: l'app considera completa una generazione fuori soglia

- `src/lib/studyQualityV66.js`: `row.verified[level]=Boolean(saved&&persistent)` usa la presenza del testo come *availability bridge*. `full` richiede che ogni pagina abbia testo e checkpoint, **non** che `levels[level].reductionCompliant` sia vero. `complete=Boolean(full&&previousState.draftComplete)`.
- Il testo è pubblicabile/leggibile come bozza con avviso; il semaforo globale di "completo" non distingue le sei versioni matematicamente conformi da quelle con riduzioni 68–83%.
- I controlli `sourceLetterBudgetV74`, `pageLetterReviewV74` e `measureEditionLengthV72` **calcolano correttamente** i limiti; nella creazione attuale il superamento produce avvisi dopo la bozza, non una condizione per un esito didattico valido.
- Per riparare bisogna **separare** `generationCompleted` da `qualityApproved`, conservando in modo immutabile bozze e checkpoint; non promuovere automaticamente e non ri-generare in ciclo.

## Ipotesi ancora da dimostrare: perché Gemini ha prodotto 68–83% anziché i target

1. **Sotto-generazione da parte del modello** sul lungo testo di diritto, anche se il prompt riporta un budget numerico.
2. **Limite di output o finish_reason='length'**: la richiesta usa `maxOutputTokens` calcolati con `Math.ceil(chars*ratio/1.5)+block.length*115+1800`, con cap di 50.000. Solo i metadati reali di ogni risposta possono distinguere taglio del token budget da una risposta terminata volontariamente.
3. **Differenze di contesto** tra testi campione brevissimi e blocchi reali di decine di pagine.
4. **Mappe delle fonti**: verificate in generale, ma serve il vero input/output di questa elaborazione per escludere perdita di testo a monte.

Le informazioni per verificare sono già parzialmente registrate nei checkpoint `diagnostics.lengthChecksV72[level].last` (input/output token, originalLetters, outputLetters, finishReason, modello), ma sono **locali al telefono**, non presenti in questa indagine. Non indovinare la causa specifica senza quei dati. Non riutilizzare le stesse pagine con diverse chiamate Gemini senza un limite e una ragione misurata.

## Piano di uscita: gate di rilascio che non può più dare un falso verde

1. Conservare LAB77 installata e originali: **NON disinstallare, NON cancellare la libreria, NON usare "Migliora percentuali" prima di salvare l'evidenza**. Evitare di consumare quota per un test non controllato.
2. Estrarre/mostrare in modo protetto gli indicatori `finishReason`, `outputTokensUsed`, `outputTokenLimit`, `inputTokens`, `sourceLetters`, `outputLetters`, per ogni livello e per ogni blocco. Mai includere chiavi o contenuto sensibile nei log.
3. Aggiornare test e UI con stati separati: BOZZA_GENERATA, QUANTITATIVAMENTE_NON_CONFORME, REQUIRES_SEMANTIC_REVIEW, VALIDATA; non chiamare `complete` una risposta solo perché tutte le parti sono state ricevute. **Non bloccare lo studio delle bozze già salvate, ma etichettarle chiaramente come non validate.** Non farle passare in output didattico certificato.
4. Prevedere una tecnica di generazione che realmente produca entro ±5 **su dati freschi**, con contenuto e qualità non inferiori alla fonte; misurare prova di tutte le sei versioni, non "best-of" selezionati.
5. Continuare a preservare i blocchi massimi sicuri LAB58 finché non viene misurata una reale limitazione di output; un 503 da solo non è motivo per tagliare blocchi.
6. Gate E2E su **almeno un libro realistico comparabile e un secondo libro differente**: modello reale, API reale, Worker sperimentale, stesso codice APK, tutte le sei percentuali, pagine/righi, checkpoint e verifica fatti ad originale. Una fallita = test qualità FAIL. Due libri non provano generalizzazione universale ma smascherano i falsi verdi presenti.
7. Solo dopo prova reale e protezione didattica compilare una APK nuova. In caso di fallimento presentare numeri rossi, non una build definita riuscita solo perché firmata.

**Responsabilità:** la decisione di usare golden examples + codice euristico per dichiarare pronta la LAB76/77 era insufficiente. La verifica e l'affidabilità sui contenuti del telefono devono avere precedenza sulle prove offline. Questo documento fissa un BUG DI RILASCIO da non dimenticare nella prossima chat.
