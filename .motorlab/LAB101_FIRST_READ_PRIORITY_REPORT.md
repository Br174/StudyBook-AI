# MotorLab StudyBook AI — LAB101 | Una sola lettura con gerarchia didattica dei fatti

**Data:** 9 novembre 2026. **Stato:** collaudo completato in ramo sperimentale, **NON pronto per produzione**.
**Repository:** `Br174/StudyBook-AI`
**Ramo LAB:** `audit/studybook-priority-first-read-v101-20261109`
**MotorLab CORE:** `Br174/Chatgpt` release `2026.10.29-r40`.
**Satellite locale:** `2026.10.29-r40`, `STATE=VERIFIED`; nessuna sincronizzazione necessaria.
**Ramo applicativo attivo:** `motorlab/active-studybook-control` in modalità `control-only`, non modificato.

## Scopo

La LAB100 ha ricavato 53 fatti dalla prima lettura di cinque pagine sintetiche, ma ha marcato **tutti i 53 come indispensabili**, rendendo difficoltosa una vera priorità per le riduzioni. La LAB101 verifica una **prima lettura unica** che estrae fatti E assegna in contemporanea tre priorità:

- **Fondamentale**: un fatto indipendente che conserva il nucleo concettuale, una definizione, una negazione, una relazione, una causa, una condizione o un obbligo. Deve sopravvivere a **tutti e sei i livelli** anche quando è espresso più sinteticamente.
- **Supporto**: una precisazione utile per capire un fondamentale. **Non significa automaticamente eliminabile**. Al 10%–20% va spiegata; con compressioni più forti si può esprimere più brevemente senza cancellare un altro concetto indipendente.
- **Contesto**: esempio o cornice introduttiva, registrata ma non obbligatoria in un riassunto minimo.

**Pilastro didattico invariato:** stesso nucleo concettuale nelle sei versioni, percentuali misurate sulle lettere alfabetiche Unicode, impaginazione originale e stop al pensiero completo senza riempimento di righe. La LAB101 non genera ancora i sei testi compressi.

## Prova automatizzata di un solo passaggio Gemini

GitHub Actions riuscita: https://github.com/Br174/StudyBook-AI/actions/runs/42642272224

- Modello già usato dal progetto: `gemini-3.5-flash-lite`, credenziale gratuita preesistente.
- **Cinque pagine** di prova già estratte dal PDF a monte (non PDF reali in questa LAB).
- **Sei richieste HTTP**: cinque inventari ottenuti, un HTTP 503 sulla pagina medica recuperato con un solo retry. Nessun HTTP 429; nessun servizio a pagamento aggiunto.
- **Cinque inventari strutturalmente validi**, con riferimento a ogni frase della fonte e citazioni letterali verificate.
- **56 fatti** invece dei 53 della LAB100, perché Gemini ha diviso alcune proposizioni in modo più dettagliato.
- **47 fondamentali, 7 di supporto, 2 di contesto**. Quattro pagine lunghe presentano una distinzione non banale; nella brevissima pagina giuridica è sensato che tutti e tre i fatti siano fondamentali.
- **30 piani** generati deterministicamente da cinque inventari (6 versioni per pagina), senza **ulteriori chiamate Gemini** per classificare o preparare i piani.
- Nessun testo finale di studio di sei livelli è stato creato in questa LAB; non confondere «piano pronto» con «riduzione pronta».

| Pagina | Fatti totali | Fondamentali | Supporto | Contesto | Piani |
|---|---:|---:|---:|---:|---:|
| Scienze | 12 | 11 | 1 | 0 | 6 |
| Procedura | 13 | 8 | 4 | 1 | 6 |
| Medicina | 15 | 13 | 1 | 1 | 6 |
| Storia | 13 | 12 | 1 | 0 | 6 |
| Giuridico breve | 3 | 3 | 0 | 0 | 6 |
| **Totale** | **56** | **47** | **7** | **2** | **30** |

Dati reali: `audit/reports/lab101-real-priorities.json`.

## Confronto a confronto «cieco» con il riferimento LAB100

Il riferimento `audit/test-fixtures/lab101-manual-priority-calibration.json` assegna manualmente una priorità ai 53 fatti LAB100. **Non è stato fornito al modello Gemini**, e non è una verità specialistica certificata.

Un allineamento per sovrapposizione di parole della citazione e della frase originale ha potuto abbinare **52** nuovi fatti a fatti LAB100. Su questi:
- **46** priorità concordanti;
- **6** discordanti;
- **1** fatto LAB100 non abbinato e **4** nuovi fatti non abbinati, perché la segmentazione della pagina è cambiata.

Questo è circa **88,5% di accordo tra classificazioni sugli abbinamenti disponibili**, NON 88,5% di precisione semantica certificata. Le divergenze possono dipendere da segmentazione o scelte editoriali, oltre che da veri errori di priorità.

### Il difetto più importante: quarto concetto della procedura

La quarta unità della fonte spiega che il registro identifica **chi ha ricevuto un libro e in quale giorno**. Gemini aveva attribuito l'etichetta «supporto» a questo fatto, e anche alle altre due informazioni del gruppo. Quindi **nessuno dei tre fatti del quarto concetto risultava fondamentale**. Se il 50% o il riassunto eliminasse gli elementi di supporto, potrebbe sparire l'intero concetto sulla funzione del registro.

Il nuovo controllo `scripts/lab101-concept-priority-gate.mjs` segnala:
1. `CONCEPT_HAS_SUPPORT_BUT_NO_FUNDAMENTAL` sul quarto concetto.
2. `SOURCE_MODAL_SENTENCE_WITHOUT_CORE` sul periodo con il registro e la sua negazione.
3. `MODAL_NEGATIVE_OR_CONDITION_DOWNGRADED` sul divieto di inserire opinioni personali.

Questi sono **allarmi di revisione**, non autorizzazioni a cambiare automaticamente i fatti.

## Intervento sperimentale di un solo metadato

GitHub Actions riuscita, senza Gemini: https://github.com/Br174/StudyBook-AI/actions/runs/42643511168

Un esempio **esplicitamente verificato editorialmente** ha modificato SOLO la priorità di `F11`, la frase sul registro, da `supporto` a `fondamentale`, **in una copia del solo inventario sperimentale**:
- Testo italiano dell'affermazione: **identico**.
- Citazione letterale originale: **identica**.
- Impronta del testo originale: **identica**.
- Hash dell'inventario per priorità: **rigenerato**, evitando di riutilizzare un piano obsoleto.
- Il quarto concetto ora contiene un fondamentale protetto in **tutti e sei i piani**.
- Allarmi sul gruppo ridotti da **tre a uno**; rimane la negazione relativa alle opinioni personali, che richiede revisione.
- **Zero** chiamate Gemini aggiuntive.

Evidenza: `audit/reports/lab101-local-priority-correction.json`.

## Controlli deterministici senza Gemini

1. Workflow LAB101: **24.000** scenari riproducibili sulla gerarchia, integrità della fonte, ID, citazioni, riuso dei sei piani e limiti del controllo.
   - I test includono anche **4.000 casi che dimostrano un limite reale**: una citazione può restare autentica mentre la proposizione associata viene falsificata. Questi casi sono registrati come vulnerabilità nota e **non rappresentano rifiuti corretti del testo falso**.
   - Zero errori nell'esecuzione del benchmark, ma non significa che siano state bloccate 24.000 falsificazioni.
2. Workflow LAB101b: https://github.com/Br174/StudyBook-AI/actions/runs/42643098050
   - **20.000** modifiche artificiali alle priorità e alle modalità: **20.000 allarmi individuati**, zero errori nei casi simulati.
   - Sulle cinque risposte reali, **un gruppo di concetti** chiaramente senza fondamentale e tre allarmi, tutti nella procedura.
3. Workflow LAB101c: https://github.com/Br174/StudyBook-AI/actions/runs/42643511168
   - Verificata una correzione esclusivamente nella priorità, nessun cambiamento nelle parole, hash coerente e propagazione identica a sei piani.

Dati:
- `audit/reports/lab101-priority-offline.json`
- `audit/reports/lab101-priority-risk-review.json`
- `audit/reports/lab101-local-priority-correction.json`

## Controllo qualitativo, pagine una per una

Rilettura: `audit/reports/lab101-qualitative-review.json`.

- **Scienze:** tutti i fatti centrali relativi a stagioni, eclissi, maree, metodo scientifico e insufficienza di un singolo risultato restano fondamentali. La spiegazione luce/buio è classificata di supporto. 12 priorità su 12 compatibili con il riferimento editoriale.
- **Medicina:** l'espansione del torace è fondamentale per Gemini ma di supporto nel riferimento. La differenza è soprattutto un giudizio di livello di dettaglio, non la prova di un falso medico. Il testo sulla diagnosi conserva la cautela «non sempre», ma va convalidato come affermazione completa prima dell'uso.
- **Storia:** i tipi di documenti sono di supporto, mentre lo scopo della ricerca e il contesto/conseguenze degli eventi sono fondamentali. Tre discrepanze rispetto al riferimento, non tutte necessariamente errori.
- **Procedura:** non è sicuro trattare la funzione «chi e quando» del registro come supporto; intervento di prova sopra. Altre classificazioni (per esempio la negazione sulle opinioni) richiedono giudizio.
- **Giuridico breve:** tutto fondamentale è una scelta plausibile; un sistema non deve forzare priorità artificiali solo per avere tre categorie in una pagina di due frasi.

## Cosa non è stato dimostrato

- **Non è stato testato** il riconoscimento automatico delle pagine di un vero PDF né la divisione in capitoli e contesto intero libro.
- **Non sono state generate** le sei versioni compresse per pagina; i trenta risultati sono piani, non pagine studiate.
- **Non è stata dimostrata** la fattibilità delle versioni più brevi quando esistono molti fatti fondamentali da preservare nella stessa pagina.
- L'abbinamento lessicale e le citazioni corrette non garantiscono equivalenza causale, negazioni, modalità o completezza.
- Le priorità non devono mai far sparire un concetto essenziale; il caso del registro ha mostrato esattamente perché serve un controllo per gruppo di concetti.
- Nessun test di effettiva impaginazione A4 a font proporzionale, di libri di centinaia di pagine, checkpoint Android, backoff Gemini, ripresa dopo crash, performance o firma APK.

## Prossima LAB consigliata, senza gonfiare i prompt

**LAB102: verificare come la stessa gerarchia si comporta sulle prime reali riduzioni per pagina** (10%, 20%, 30%, 40%, 50% e riassunto), inizialmente su piccoli campioni e senza costi aggiuntivi. Serve una verifica semantica source-backed che sappia giudicare negazioni e relazioni, non solo parole; le correzioni devono essere mirate come in LAB99. Mantenere la stessa fonte e lo stesso inventario per le sei versioni, evitando una nuova prima lettura per ciascuna.

**Decisione di release:** LAB101 dimostra la fattibilità tecnica della priorità in prima lettura; **non promuovere** la classificazione automatica non verificata nella produzione. La branch main, la famiglia Android e la firma sono immutate; nessun APK/ZIP costruito. Zero nuovi servizi a pagamento.
