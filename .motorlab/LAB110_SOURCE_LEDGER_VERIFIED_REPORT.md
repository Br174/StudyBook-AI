# StudyBook AI LAB110 / MotorLab r40 — inventario fonte, quote di proposizione e controllo dei rischi

**Data:** 10 novembre 2026  
**Ramo isolato:** `audit/studybook-source-ledger-v110-20261110`  
**Deriva da:** `lab/studybook-core-android-01-update-109-fact-first-pilot-20261110`, commit `3b63edaff2af542922c5df98e025dfe21b78ae0f`.  
**Stato:** ESPERIMENTO E VERIFICHE COMPLETATI, **NON PROMUOVIBILE AD APK**. Nessuna modifica al Worker pubblicato, LAB79 firmata, memoria utenti, dati, indice del PDF, bozza, checkpoint, MAIN o CORE MotorLab r40.

## Scopo

Verificare la proposta «inventariare i concetti originali prima della riduzione e conservarli nei sei livelli didattici», evitando una pianificazione Gemini separata per ogni pagina, e risolvere il 40% scientifico del LAB109 che falliva (24,37% e 10/8 righe).

### Architettura sviluppata sul VERO percorso Worker, solo in modalità opt-in

- `src/lib/studySourceLedgerV110.js`: un **inventario deterministico delle clausole originali**, con segnalazione di negazioni, condizioni, distinzioni, relazioni causali, numeri, possibilità e obblighi. Origine = testo di libro originale; nessuna AI, nessun prompt di pianificazione aggiuntivo. Inventario integrato in **una sola generazione Gemini** per gruppo. Doppio consenso tecnico `STUDYBOOK_SOURCE_LEDGER_V110=1` (ambiente) + richiesta `experimentV110=source-clause-ledger-40-guarded-v110`.
- `src/lib/studyClauseBudgetV110B.js`: variante che applica alle proposizioni quote MORBIDE ottenute da `largestRemainderV78`, con totale esattamente uguale al budget ufficiale `studyPageBudgetsV74`. Doppio consenso separato `STUDYBOOK_CLAUSE_BUDGET_V110B=1` + `experimentV110b=source-clause-soft-budget-40-optin-v110b`. Mai due piloti contemporanei.
- `api/editionsBulkV51.js`: realmente eseguito in GitHub CI, senza deploy; integrazione non attiva per LAB79. Respingere richieste senza flag, combinate, con budget alterato o sopra i limiti del pilot **prima** di qualsiasi Gemini. Mantieni una sola chiamata di GENERAZIONE per blocco; resta l'eventuale `countTokens` ausiliario esistente, non generativo. Formato `parts:[{id,text}]`, budget/geometry/checkpoint base invariati.
- `src/lib/studySourceRiskV110.js`: controlli di rischio legati a frasi realmente presenti nella fonte; fra gli altri, negazione eclissi/lunazione, influenza maree vs causalità, descrizione vs cause delle variazioni, prestito prima, regola interna, termine/conferma e registro chi/quando. Gli allarmi sono solo **codici non sensibili**, senza inviare testo originale nei metadati. **Nessun conteggio di allarmi a zero certifica semanticamente**. Per ogni output di prova `sourceRiskAuditV110.readyForStudy=false`, `semanticCertified=false`, `approvedForApp=false`.

**Vincolo dichiarato:** l'inventario è attualmente ricostruito deterministicamente **una volta per richiesta Worker**, non persistito una sola volta per libro. L'obiettivo «un inventario unico persistente per il libro» richiede riutilizzare il checkpoint client e un'impronta verificata, non è ancora implementato e NON va dichiarato completato. La modalità pilot è limitata al 40%, al massimo due gruppi e fonti brevi per evitare nuovi blocchi.

## Prove reali sul vero handler Worker (2 fonti sintetiche, NON il libro utente)

| Livello 40% | LAB109 (scienze) / LAB108 (procedura) | LAB110 inventario senza quota clausole | LAB110B con quota clausole | Righe LAB110B |
|---|---|---|---|---|
| Scienze | 24,37% (10/8 righe) | **48,25%** (7/8, fuori fascia) | **42,24%**, in fascia | **7/8** |
| Procedura | 36,48% (9/9, dopo correzione locale LAB108) | **33,18%** (10/9, fuori fascia) | **39,31%**, in fascia | **8/9** |

- LAB110: **2/2 risposte reali Gemini, 0/2** conformi a percentuale+righe.
- LAB110B: **2/2 risposte reali Gemini, 2/2** conformi a percentuale+righe.
- 4 generazioni totali Gemini LAB110/110B con chiave gratuita preesistente. Nessun errore HTTP429/503, nessun fallback a pagamento, nessun deploy e nessuna APK.
- **Semantica:** NON PROMOSSA. Scienze LAB110B ha omesso «non avvengono a ogni lunazione», non esplicita che un dato isolato non prova una spiegazione, lascia vaga la distinzione fra descrizione e cause delle variazioni. Procedura LAB110B non esplicita «titolo prima del prestito», «confermare la restituzione» e «chi riceve il libro». Le regole a espressioni regolari producono anche falsi positivi sui sinonimi: i valori 5/9 e 2/8 del primo controllo sono soltanto indicatori, non un conteggio certo di concetti persi.
- **Zero certificazioni didattiche.** Le due conformità matematiche della variante B non bastano per il libro né per la pubblicazione.

Evidenze:
- Contratto Worker LAB110 + regressione LAB79/LAB109 PASS: https://github.com/Br174/StudyBook-AI/actions/runs/42740632218
- Gemini LAB110: https://github.com/Br174/StudyBook-AI/actions/runs/42740899921; `audit/reports/lab110-real-worker-ledger.json`
- Contratto Worker LAB110B PASS: https://github.com/Br174/StudyBook-AI/actions/runs/42741412867
- Gemini LAB110B: https://github.com/Br174/StudyBook-AI/actions/runs/42741559577; `audit/reports/lab110b-real-worker-clause-budget.json`
- Rischi e 3 mutazioni mirate, con verifica effettivo Worker e selezione disattivata: https://github.com/Br174/StudyBook-AI/actions/runs/42742193417

## Decisione MotorLab / Scudo360

1. **Mantenere la LAB110B in ricerca isolata:** mostra migliore controllo quantitativo, ma ha perso dettagli didattici. Non integrare in un APK finché il controllo semantico non è reale, robusto e la qualità non è verificata sul libro reale.
2. **Accettazione della singola pagina solo con doppio vincolo:** conteggio e griglia dal motore originale, più tutte le proposizioni essenziali verificate, con controlli separati e nessuna approvazione ottenuta da euristiche insufficienti. Se impossibile, salvare come bozza non conforme, senza tagliare automaticamente e senza rigenerazioni infinite.
3. **Passo sicuro successivo:** consolidare un inventario originale riutilizzabile tramite i checkpoint esistenti senza aumentare le chiamate di generazione; testare almeno sei livelli e pagine lunghe; confrontare sul percorso Android vero e con libro reale. Non introdurre seconda IA che lavori in background né servizi extra.
4. **Protezione:** LAB79 installata 0.3.575, firma Android, 264 bozze, PDF e libri dell'utente, Worker Cloudflare pubblicato, main e ultimo LAST_GOOD restano invariati.
5. **APK/ZIP:** NON creati/approvati. Nessun test sul dispositivo Android per LAB110 o prova fisica stampa A4. Nessun costo aggiuntivo: **€0**.

Verdetto conclusivo: risolta la distanza delle percentuali sui **due campioni 40%**, ma non risolta la fedeltà semantica; non dichiarare il generatore pronto, evitare ulteriori tentativi casuali di prompt e investire nell'affidabilità della copertura dei fatti e nella persistenza dell'inventario.
