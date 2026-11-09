# MotorLab / StudyBook AI — Audit di parità tra LAB97–104 e APK LAB77 reale

**Data:** 9 novembre 2026, dopo le schermate del libro *Filosofia del diritto appunti+sbobine*, 44 pagine. **Verdetto: NON PARI, BLOCCARE NUOVE PROMOZIONI APK CHE DICHIARANO DI RIPRODURRE I RISULTATI BEST-OF FINO A UN NUOVO COLLAUDO E2E.**

Fonte primaria esaminata: archivio originale `StudyBook-AI-LAB-77-AGGIORNAMENTO.apk` SHA-256 `03ba13de10eb0f38e521cfcb3fe41b4fce37a09e92bf5aceedf6ae5aa9835670` e `StudyBook-AI-LAB-77-AGGIORNAMENTO-SORGENTI.zip` SHA-256 `d55c804cfb8af14595ba88af1386fc89a211da90a02adb86d09bcd7f320ca57c`. Il JS distribuito include `lab76-best-of-quantitative-and-source-fidelity-v1`, `best-of-source-percent-off-target`, `best-of-virtual-grid-warning`, e la URL del Worker LAB76; non si tratta di un vecchio APK senza il modulo, **ma di un modulo incompleto e non vincolante per la generazione**. Il backend isolato ha ricevuto il deploy dalla pipeline LAB76; il sorgente server va comunque verificato in ogni futura nuova build/deploy, non soltanto il banner di versione.

## Esito reale mostrato dall'utente: tutte le sei versioni NON conformi
| Livello | Intervallo accettato in APK | Riduzione visualizzata | Stato |
|---|---|---|---|
| Riassunto | 55–65% (target applicativo 60) | 83,1% | FAIL |
| 50% | 45–55% | 83,4% | FAIL |
| 40% | 35–45% | 81,9% | FAIL |
| 30% | 25–35% | 76,1% | FAIL |
| 20% | 15–25% | 75,7% | FAIL |
| 10% | 5–15% | 68,4% | FAIL |

Questi sono i valori visualizzati, non una nuova lettura della memoria IndexedDB del telefono. Non attribuire con certezza la causa a token, troncamento o origine OCR senza logging delle metriche del blocco.

## Parità: che cosa era stato effettivamente portato

| Elemento del metodo migliore | LAB92/97/98/99 originale | APK LAB77 reale | Risultato |
|---|---|---|---|
| Conteggio lettere alfabetiche Unicode, esclusi spazi/cifre/punteggiatura | `lab92-stop-complete-engine.mjs` `letters`, `budget` | `studyPillarV38.js`, `studyPageBudgetsV74.js` | PRESENTE |
| Tolleranza ±5 punti e budget ancorato a ogni pagina/range originale | `budget`, `evaluate` | `pageLetterBudgetsV74`, `pageLetterReviewV74` | PRESENTE come calcolo/controllo |
| 60 celle fisse, parole intere, impacchettamento nelle righe e limite esplicito per risposta | LAB97 prompt: «al massimo N righe da 60 posizioni … senza andare a capo»; LAB98 prompt: «Massimo N righe di 60 caratteri monospaziati» | `rowsBestOfV76(text,maxCells=60)` calcola **dopo la generazione**. La funzione `editionBestOfInstructionV76(level,sourceLetters,phase)` **non riceve targetCap** e **non dice al modello il numero massimo di righe o larghezza di 60 celle**. `api/editionsBulkV51.js` richiama esattamente `editionBestOfInstructionV76(level,sourceLetters,phase)`. | **MANCANTE NELLA GENERAZIONE** |
| Geometria teorica: spazi naturali, spazi di giustificazione, segni, cifre; previsione delle righe | LAB92 `AVG={letters:46.346,naturalSpaces:7.844,justifySpaces:3.658,punctuation:1.966,digits:0.186}` e `expectedNaturalChars` | `studyBestOfV76.js` usa solo 46.346 per capienza delle righe nella **diagnostica**, non trasferisce le altre quote alla richiesta Gemini | **SOLO CONTROLLI PARZIALI** |
| Ripartizione di lettere per sezioni/contenuti tramite «largest remainder» e priorità, mantenendo i fatti | LAB92 `largest()`, `goalPerConcept`; studi di prova, non produzione | `integralPlannerV51.js` distribuisce quote per unità/sorgente e gruppi di pagina, non usa `largest` con pesi dei concetti `importance` né i `goalPerConcept` LAB92 | **NON È LA STESSA ALLOCAZIONE** |
| Prompts conservativi per 10–20, moderati 30–40, sintesi 50/Riassunto | LAB97/98 `instructions` e `makePrompt` | `editionBestOfInstructionV76` richiama modalità corrispondenti; messaggio più breve | **PRESENTE COME IDEA, NON IDENTITÀ DI PROMPT** |
| Limiti basati su fonte e lunghezza letterale dell'intero libro | LAB92 su una pagina campione per prova | `planNaturalBlocksV51`: blocchi più grandi sicuri, protezione pagina/paragrafo, per livello | **PRESENTE**, ma carico 44p/119 paragrafi non confrontabile automaticamente con 1p di benchmark |
| Controllo dei fatti dopo generazione, no checklist verbosa nel prompt | LAB101/103/104 controlli editoriali e regole | `inspectBestOfV76`, `auditFidelity` e regex circoscritte | **PARZIALE, NON CERTIFICAZIONE SEMANTICA** |
| Gate di accettazione che impedisca a testo fuori fascia di risultare completato | LAB92 `evaluate().strictCombined`; benchmark rosso se fuori | `studyQualityV66.js` usa `row.verified[level]=Boolean(saved&&persistent)` e `full` dipende dalla presenza dei testi, mentre `reductionCompliant` e `bestOfV76` sono metriche/advisory. Dunque un testo presente ma non conforme può essere dichiarato completo e visibile con warning. | **MANCANTE NELL'ACCETTAZIONE** |
| Test reale che produca risposte NUOVE tramite il percorso APK/Worker | LAB97/98 fanno `fetch` a Gemini e misurano nuove risposte | `scripts/test-lab76-best-of.mjs` contiene `const cases=[...]` con **4 testi golden già redatti** e NON contiene richiesta Gemini `fetch`. Le alterazioni controllate sono valide test unitari del guard, ma non un test end-to-end di generazione. | **MAI ESEGUITO COME PARITY E2E** |
| Sei versioni dello STESSO libro reale con soglie e fedeltà, più checkpoint e tempi | Non dimostrato dalle singole fixture | 44p reali: 0/6 entro soglia | **FAIL NEL COLLAUDO UTENTE** |

## Fatti verificabili aggiuntivi

- `scripts/lab92-stop-complete-engine.mjs` è un modulo **solo ricerca** con 60 posizioni, spaces/justify estimates, allocazione `largest` per concetto e `wrap`.
- `scripts/test-lab97-level-specific-gemini.mjs` e `scripts/test-lab98-real-gemini.mjs` specificano in prompt la capienza **in righe**; l'APK LAB77 no.
- `src/lib/studyBestOfV76.js` contiene `rowsBestOfV76`, ma viene usato in `inspectBestOfV76` **dopo** che le bozze sono state generate, e non distribuisce pacchetti di testo durante `generateDraftFirstV57`.
- `api/editionsBulkV51.js` riceve `pageBudgetsV74` e ne verifica la coerenza matematicamente prima della chiamata: presente, ma Gemini può ignorare la quota. La risposta server registra `lengthReview`, `pageReviewV74`, `finishReason`, `outputTokenLimit`. Non blocca per forza l'uso della bozza non conforme.
- `src/lib/studyQualityV66.js` calcola `reductionCompliant`, `bestOfV76` e segnala avvisi, ma il suo segnale `full` non significa «matematicamente e semanticamente approvato».
- La storia dei «sei campioni numericamente migliori» LAB103 seleziona **168 risposte di pagine diverse**. Il prompt LAB97 real test è differente dalla stringa LAB76, e 168 benchmark archiviati non dimostrano che Gemini produrrà sempre quelle percentuali su un blocco 44p.
- Il file APK è stato ispezionato: in `assets/public/assets/index-DZO2kbMM.js` sono presenti i nomi delle verifiche, la stringa `46.346` e il backend LAB76. **La presenza del codice non significa che il controllo sia un gate o che la correzione sia stata applicata**.

## Root cause: che cosa sappiamo e che cosa NON sappiamo

**Dimostrato:** `LAB97/98 best prompt + LAB92 row/spacing/section planner != LAB76/77 production generation`; lo script LAB76 usa output preconfezionati; la pipeline di pubblicazione non applica come gate la conformità finale. Ciò è sufficiente a spiegare un falso verde di TEST vs un'APK non conforme e l'impossibilità di garantire la fedeltà quantitativa.

**Non ancora dimostrato:** il motivo specifico per cui Gemini ha prodotto 68–83% di riduzione (output cap, finish_reason=length, saturazione contesto, cambiato modello, mismatch delle fonti o comportamento di compressione). Occorrono da una sessione reale `sourceLetters, outputLetters, targetLetters, finishReason, outputTokenLimit, outputTokensUsed, inputTokens, pageReviewV74, generatedParts/expectedParts`, codice modello, conteggio chiamate e tempi per blocco. Non stampare testo integrale né chiavi nei log.

## Gate obbligatori prima della prossima APK

1. **Prima la parità del metodo:** singolo componente canonico di budget lettere, capienza fissa 60 celle, max righe e metodo di confezionamento; usarlo SIA nel prompt effettivo al Worker (dati concreti per ogni pagina/gruppo) SIA nel verificatore, non solo in quattro fixture.
2. **Non adottare piccoli blocchi:** mantenere `planNaturalBlocksV51` con blocco massimo naturale sicuro, ma calibrare output effettivo e residuo token; non confondere un 503 con 413.
3. **Non fare false pubblicazioni:** distinguere `BOZZA PRESENTE`, `NUMERICAMENTE CONFORME`, `SEMANTICAMENTE VERIFICATA`; non promuovere testo fuori margine a versione di studio completata, conservarlo nel checkpoint e permettere correzioni mirate.
4. **Test end-to-end del percorso reale:** lo stesso software della futura APK deve invocare il Worker, con risposte Gemini NUOVE, sulle SEI riduzioni dello STESSO libro sorgente, rispettando banda e righe; testare libro realistico di almeno 44p e pagina testuale densa, senza spese extra. Zero colori verdi da testo golden preconfezionato.
5. **Confronto manuale source-backed dei fatti:** titoli, capitoli, negazioni, condizioni, cause, numeri, citazioni, non solo parola chiave. Documentare perché un caso è verde.
6. **Release separata:** firmare una nuova LAB soltanto quando c'è un run E2E verde, checksum/versione/code dell'APK e Worker verificati; NON cancellare o ricalcolare i checkpoint esistenti; lasciare LAB76/77 disponibili come evidenza e LAST_GOOD intatto.

**Nessuna modifica a codice produzione, APK, worker o dati è richiesta per questo audit; il ramo è separato, esclusivamente documentale.**
