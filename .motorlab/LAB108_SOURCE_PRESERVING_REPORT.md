# StudyBook AI | MotorLab LAB108 — Soglie inverse e generazione conservativa, verdetto reale

**Data:** 10 novembre 2026. **Stato:** esperimento isolato completato; **NON** implementato nel percorso Android/Worker; nessuna APK compilata. Motore MotorLab `r40` coesiste con il motore nativo StudyBook.

**Branch isolato:** `audit/studybook-source-preserving-calibration-v108-20261110` (deriva dal checkpoint LAB107). Non cambiare il codice installato, MAIN, LAST_GOOD, firma, database, dati utente, PDF originale, 264 bozze LAB79, key/Worker o politiche di produzione.

## Obiettivo e diagnosi

Bruno ha osservato una progressione ordinata delle percentuali, ma LAB107 ha dimostrato che l'inversione diretta della curva aggregata non si trasferisce in modo affidabile alla singola pagina. La LAB108 prova perciò due formulazioni diverse per gli obiettivi più problematici `10%`, `20%`, `40%`, mantenendo `sourceLetterBudgetV74` quale unico proprietario del budget ufficiale e `localSourcePatchV106` quale proprietario delle correzioni letterali ancorate alla fonte.

Metodi sperimentali: `COPY_EDIT` (riscrittura dell'originale con interventi minimi) e `ANCHORED_SECTIONS` (quote morbide per frasi originali con una sola risposta finale). Sono A/B indipendenti, non due richieste obbligatorie per il normale uso dell'app.

## Evidenza reale con Gemini

- <https://github.com/Br174/StudyBook-AI/actions/runs/42722719067> — **SUCCESS**: test offline + **12/12** generazioni realmente ricevute da Gemini, con chiave gratuita già esistente, nessun HTTP429/503 e nessun servizio aggiuntivo a pagamento. Percentuale E griglia rispettate in **5/12 risposte**: `COPY_EDIT` 2/6, `ANCHORED_SECTIONS` 3/6.
- <https://github.com/Br174/StudyBook-AI/actions/runs/42723300931> — **SUCCESS**: una correzione letterale locale per procedura/20% e **2/2** ulteriori tentativi reali Gemini per scienze/40%. Entrambi gli output scienze/40% rimangono **NON conformi**: 49,25% e 48,41% anziché 35–45%, con ulteriori rischi semantici.
- <https://github.com/Br174/StudyBook-AI/actions/runs/42723616095> — **SUCCESS**: **tre correzioni letterali offline** (procedura 10%, 20%, 40%), nessuna chiamata Gemini aggiuntiva, fonte originale e bozze immutate, mantenendo percentuale e griglia entro i limiti.

Report grezzi completi:
`audit/reports/lab108-real-source-preserving.json`;
`audit/reports/lab108-science40-targeted.json`;
`audit/reports/lab108-local-source-patch.json`;
`audit/reports/lab108-three-local-literal-patches.json`.

## Migliori risultati trovati (NON una nuova generazione multipagina già funzionante)

| Fonte | Livello | Versione scelta | Riduzione effettiva | Righe virtuali | Allarmi lessicali preliminari | Numeri+righe |
|---|---|---|---:|---:|---:|---|
| Scienze | 10% | COPY_EDIT, nessuna correzione | **11,52%** | 12/12 | 0 | SI |
| Scienze | 20% | COPY_EDIT, nessuna correzione | **19,87%** | 11/11 | 1 | SI |
| Scienze | 40% | Nessuna delle 4 prove | 31,55% (miglior candidata numerica iniziale) | 9/8 | 1 | **NO** |
| Procedura | 10% | ANCHORED_SECTIONS + sostituzione letterale fonte `regola` -> `regola interna` | **5,19%** | 13/13 | 0 | SI |
| Procedura | 20% | COPY_EDIT + sostituzione letterale fonte `norma` -> `regola interna` | **24,37%** | 11/11 | 0 | SI |
| Procedura | 40% | ANCHORED_SECTIONS + sostituzione letterale fonte `regola` -> `regola interna` | **36,48%** | 9/9 | 0 | SI |

**Massimo ottenuto selezionando uno dei due esperimenti e correggendo solo frasi ancorate alla fonte: 5/6 combinazioni pagina-livello numericamente conformi**; NON significa 5/6 rigenerazioni affidabili al primo tentativo. La scienza al 40% resta bloccata. Le tre correzioni letterali sono dimostrazioni di singoli casi con un operatore selettivo già esistente, non un generatore generalizzato e non una modifica alle bozze utente.

## Controlli di fedeltà

Gli avvisi del `semanticGuard` sono **euristiche**, non certificati. Scienze 20% usa «Un risultato isolato non prova una spiegazione», una formula che può essere semanticamente compatibile con l'originale ma viene segnalata dal controllo lessicale; non nascondere il rischio. Altri casi possono perdere distinzioni che il controllo non rileva. Su scienze 40% alcune risposte omettevano la negazione sulle eclissi, la relazione scientifica o il qualificatore della causa delle stagioni. **Zero pagine professionalmente/semanticamente certificate.**

Nessun taglio meccanico alla fine della frase, nessuna migrazione su altra pagina, nessun cambio font, nessuna modifica all'originale e nessun 'successo' costruito sostituendo le etichette. Se il 40% non è fattibile preservando i fatti, deve essere segnalato non conforme.

## Verifica del percorso APK

Esame in sola lettura: nel vero ramo LAB79 `src/lib/draftFirstV57.js` invia `/api/editions/bulk/v51`; il Worker `worker/index.js` delega ad `api/editionsBulkV51.js`. Questo esperimento non modifica né la costruzione reale del prompt lato Worker né i controller di ripresa `studyRebalanceV67.js`. La LAB106 singola chiamata resta solo di ricerca. Non è stato eseguito test end-to-end con lo stesso percorso dell'app né test Android sulla LAB108.

**GATE DI PROMOZIONE APK: BLOCCATO.** Il numero dei test passati non autorizza a installare un generatore non fedele. LAB79 version 0.3.575 con firma precedente rimane baseline Android installabile e immutata.

## Prossimo confine sicuro

1. Evitare altri tentativi casuali di prompt; impiegare ora un controllo orientato ai fatti inderogabili per la pagina 40% scientifica, e cercare una versione fedele entro letter budget e righe, senza creare una seconda macchina di controllo né un secondo scheduler.
2. Integrare nel punto responsabile **Worker + Android** solo il metodo dimostrato su campioni e verificare che non vengano attivati prompt legacy concorrenti, retries nascosti o scritture prima della qualità.
3. Validare tutte e sei le edizioni con più generi e sullo stesso percorso dell'APK, includendo il PDF reale, contenuti e pagina di provenienza, 429 e ripresa senza perdere bozze. Compilare APK+ZIP soltanto quando attendibili, con aggiornamento sopra LAB79 senza disinstallare.

**Costo aggiuntivo pagato:** €0. **Richieste Gemini aggiuntive di LAB108:** 14, su chiave già autorizzata. **Avanzamento di ricerca:** collaudo terminato, release non pronta.
