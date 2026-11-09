# StudyBook AI / MotorLab LAB107 — calibrazione inversa con verifica delle soglie

Data: 10 novembre 2026. **Ramo di ricerca isolato**: `audit/studybook-inverse-calibration-v107-20261110`.
Base: `audit/studybook-single-call-standard-v106-20261109`, commit `1596ef5e047bcc37c0a9438528da05d7d125ffb2`.

## Scopo approvato
Verificare l'intuizione di Bruno: i risultati quantitativi delle sei edizioni sono progressivi ma eccessivamente sintetici. Provare se una soglia interna inversa possa correggere l'effettivo contenuto, senza *rinominare* una riduzione sbagliata e senza cambiare la politica didattica.

## Dati osservati (LAB79, 44 pagine × 6 versioni, aggregati)
| Livello | Riduzione visualizzata nella LAB79 | Riduzione desiderata | Stimata richiesta interna inversa |
|---|---:|---:|---:|
| Riassunto (politica app LAB79 60%) | 87,1% | 60% | 17,68% |
| 50% | 84,0% | 50% | 12,85% |
| 40% | 76,7% | 40% | Non supportato: sotto il minimo osservato 44,1% |
| 30% | 75,4% | 30% | Non supportato |
| 20% | 64,8% | 20% | Non supportato |
| 10% | 44,1% | 10% | Non supportato |

L'inversione usa *interpolazione lineare tra misure*, non estrapolazione inventata. Le stime 17,68 e 12,85 **NON** sono nuove risposte Gemini, non garantiscono ripetibilità né sono input automaticamente integrati nel prompt. Il dato è una media osservata su un libro, non una curva universale pagina per pagina.

## Seconda strategia sperimentale: «lettere da conservare»
Il modulo `src/lib/studyInverseCalibrationV107.js` riceve direttamente i budget **ufficiali preesistenti** di `studyPageBudgetsV74.js`: `originalLetters`, `targetLetters`, `minLetters`, `maxLetters`, `reductionPercent`. Non crea un secondo calcolatore dei budget e non sostituisce il motore nativo. Restituisce una istruzione preparatoria che specifica le lettere **da conservare**, protegge fonte, pagine, negazioni, definizioni, fatti e tutti i concetti. Per il 10–20% prescrive una *riscrittura conservativa*, non una sintesi telegrafica. Mai completare righe con contenuto inutile.

Risultato = reale percentuale misurata da testo, non etichetta richiesta. `classifyMeasuredResultV107` NON approva un testo solo perché è nella fascia: controlla anche la griglia e richiede una conferma semantica esterna. L'esenzione per fonti fino a cinque righe non equivale a dichiarare qualità didattica.

**Riassunto:** la LAB79 e l'app usavano il 60%; le specifiche sperimentali LAB97–106 usano il 65%. Entrambe restano esplicite e distinte; nessuna conversione automatica in produzione.

## Evidenza offline
Script: `scripts/test-lab107-inverse-calibration.mjs`.
Verifiche: andamento monotono aggregato; interpolazione entro dominio; negazione dell'estrapolazione per target 10–40; fedeltà al budget sorgente; conservazione delle due politiche Riassunto; rilevazione della non conformità anche per un risultato del 44,1%; impossibilità di proclamare qualità dal solo numero; esenzione pagine brevi; rifiuto di dati fonte e budget diversi.

Una copia di laboratorio locale ha superato **64 asserzioni offline**. Il risultato del workflow GitHub (se eseguito) deve essere controllato separatamente prima di dichiarare la verifica del commit.

## Stato e confini
- Stato: **LAB DI RICERCA**, non APK, non promozione né integrazione al percorso Android.
- Gemini chiamate nuove in questa LAB: **0**.
- Test end-to-end con Gemini su pagine nuove: **NON ESEGUITI**.
- Test Android con lo stesso percorso dell'APK: **NON ESEGUITI**.
- Controlli didattici indipendenti: **NON ESEGUITI**.
- Produzione, app LAB79, certificato Android, checkpoint, vecchie bozze, database, Worker, chiavi e CORE MotorLab: **nessuna modifica**.
- Prossimo passo sicuro: una prova limitata con 2–3 pagine autentiche di diversa lunghezza e sei livelli tramite vera richiesta Gemini, conservando originali e hash; confrontare banda ±5, righe, negazioni, fatti ed eccezioni. Promozione solo dopo risultati provati, senza disinstallazione e senza costi aggiuntivi.

**Decisione:** NON fare un semplice scambio delle etichette: la media può sembrare precisa mentre il contenuto rimane tagliato. Preservare i pilastri didattici e gli incumbent migliori LAB103/104.
