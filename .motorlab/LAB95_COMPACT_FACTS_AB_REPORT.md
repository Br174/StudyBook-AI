# MotorLab StudyBook AI · LAB95 · Fatti combinati in frasi concise, confronto A/B

**Data:** 9 novembre 2026
**Repository:** Br174/StudyBook-AI
**Ramo LAB isolato:** audit/studybook-compact-combined-facts-v95-20261109
**Stato:** prova reale conclusa fino al limite Gemini HTTP 429. Nessuna modifica dell'APK o dell'app in uso.

## Obiettivo
Correggere il problema osservato nelle LAB93/94: consegnando una checklist di fatti atomici a Gemini si rischia che il modello trasformi ogni fatto in una nuova frase, producendo troppo testo. L'obiettivo dell'utente rimane: prima comprensione unica, concetti completi, limiti proporzionali e flessibili, righe consecutive condivise, **STOP quando il pensiero è completo**, nessuna frase riempitiva, e riduzione conforme entro ±5 punti percentuali per pagine originali oltre 5 righe.

## Test di fattibilità verificati senza Gemini
Due esempi umani, **non generati da Gemini**, sono stati validati sul medesimo motore deterministico e sulla checklist:
- Scienze 20%: 599 → 498 lettere alfabetiche, riduzione **16,86%**, 11 righe su 11, zero fatti atomici segnalati mancanti.
- Medicina 20%: 728 → 609 lettere alfabetiche, riduzione **16,35%**, 13 righe su 13, zero fatti atomici segnalati mancanti.

Questi esempi dimostrano l'esistenza di soluzioni *sui testi sintetici specifici*, non che il modello sappia produrle autonomamente. La verifica lessicale non equivale alla prova definitiva del significato.

## Prompt Gemini testati
A. **Fonte + quote proporzionali morbide**: richiesta di comprimere periodi e condividere righe, senza una checklist separata.
B. **Fonte + vincoli semantici in italiano**: identico prompt, più una checklist di fatti imprescindibili in italiano con esplicita istruzione a **unire più fatti in periodi compatti**, senza ricopiare le frasi.

Nessun riferimento umano pronto è stato passato al modello; i due testi di riferimento sono rimasti soltanto per validazione indipendente.

## Esiti Gemini reali
- Programmate 11 chiamate per confronti A/B; effettivamente 8 richieste, 7 risposte utilizzabili. La chiamata ottava ha ricevuto **HTTP429** e la prova si è fermata; nessun tentativo dopo il blocco.
- **0** contaminazioni con parole inglesi rilevate.
- Su tutte le 7 risposte di pagine lunghe: **3/7** rispettano simultaneamente righe e percentuale; manca però QA di testo completato.
- Metodo A: **1/4** entro griglia+percentuale; B: **2/3**. Confronto sui soli tre casi con A e B: A **1/3** e B **2/3**. Campione limitatissimo; non prova statistica, né dichiarazione che B è universalmente superiore.
- **0/7** output approvati automaticamente per l'app. Una risposta scientifica A è promettente, ma necessita verifica e rifinitura stilistica.

| Materia | Livello | A: riduzione / righe | B: riduzione / righe | Fascia & griglia |
|---|---:|---:|---:|---|
| Scienze | 20% | 23,71%, 10/11 | 15,36%, 11/11 | Entrambe entro i limiti, ma B ha apostrofi/accents errati |
| Medicina | 20% | 32,69%, 11/13 | 7,69%, 14/13 | Nessuna delle due conforme |
| Procedura | 20% | 12,26%, 12/11 | 17,92%, 11/11 | B matematicamente conforme ma con condizione normativa ambigua |
| Storia | 20% | 13,73%, 12/12 | non completato (429) | A lievemente oltre la soglia per eccesso di lunghezza |

## QA semantico
- **Scienze B:** «poiche», «l altra», «dall inclinazione», «percio» senza accenti/apostrofi. Non va stampato così. Scienze A è più corretta nel linguaggio, ma la sintassi finale può migliorare.
- **Procedura B:** la frase «altrimenti resta valida la data iniziale» potrebbe riferirsi al libro già prenotato anziché alla **mancanza di conferma scritta**. L'ambiguità è didatticamente grave pur in un testo numericamente corretto.
- **Medicina A:** ha perso pressione parziale, globuli rossi, esplicitazione di consumo ossigeno e produzione anidride carbonica.
- **Medicina B:** mantiene molti dettagli ma eccede il budget di lettere e di una riga.
- **Procedura A:** il registro perde chi/da quando, oltre a essere troppo lungo.
- **Storia A:** «origine» può sostituire «provenienza» ed è un possibile falso positivo del controllo regex; il testo è poco oltre la fascia ma non perde necessariamente concetti essenziali.

L'analisi dettagliata, una voce per risposta, si trova in `audit/reports/lab95-manual-quality-review.json`.

## Miglioramento deciso, non ancora certificato
La formula B aiuta a ricordare fatti essenziali, ma non garantisce i risultati. Il prossimo prompt **C** da collaudare quando la quota gratuita lo consente dovrebbe:
1. usare l'italiano originale per un elenco *minimale* di vincoli indispensabili, più breve delle descrizioni full-sentence;
2. riconoscere almeno le dipendenze logiche **«se ... senza conferma ... resta...»** per non attribuire la conseguenza alla condizione sbagliata;
3. richiedere accenti e apostrofi italiani corretti e rigettare quelli assenti, senza una riscrittura automatica intera;
4. per il 20% chiedere conservazione di dettagli fondamentali e supporto senza trasformare ciascun fatto in una frase a sé;
5. confermare matematicamente il budget e la qualità dopo una sola generazione. Le differenze minime (es. 0,5–1 riga) si valutano didatticamente; mai nascondere la percentuale.
6. testare successivamente la segmentazione automatica da vero PDF e la larghezza reale del font su A4: ad oggi soltanto benchmark sintetici a righe virtuali da 60 celle.

**Non sono stati compilati APK o ZIP e non è stata modificata alcuna release app. Nessun costo aggiuntivo.**

## Prove
- Workflow GitHub Actions: https://github.com/Br174/StudyBook-AI/actions/runs/42627102828
- Riferimenti manuali non Gemini: `audit/test-fixtures/lab94-golden-20-percent-manual.json`
- Audit numerico offline: `audit/reports/lab95-compact-clause-offline.json`
- Resoconto delle 7 risposte reali: `audit/reports/lab95-compact-clause-ab-real.json`
- Revisione qualitativa di ogni risposta: `audit/reports/lab95-manual-quality-review.json`
