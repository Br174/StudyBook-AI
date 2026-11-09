# MotorLab StudyBook AI LAB80 · Contenitore elastico · prova reale Gemini
Data: 9 novembre 2026. Stato: TEST ISOLATO COMPLETATO, NON INTEGRATO.

## Autorità e provenienza
- Repo: Br174/StudyBook-AI.
- Ref di test: audit/studybook-elastic-container-v80-20261109.
- Sorgente workflow: commit 7edd2d621a92c8ed270538de7f32f6d7512c151a.
- Workflow GitHub: https://github.com/Br174/StudyBook-AI/actions/runs/42569321693 (SUCCESS).
- Artifact: StudyBook-LAB80-ElasticContainer-RealGemini, ID 13652576808.
- Risultati JSON grezzi: audit/reports/lab80-container-real-gemini.json.
- Modello usato: gemini-3.5-flash-lite su chiave preesistente. 12 richieste completate, zero arresti per quota. Nessuna nuova chiave, nessun servizio a pagamento deliberatamente attivato.
- Produzione, PDF, APK, firma, dati, ramo principale, LAST_GOOD e motore nativo non modificati.

## Protocollo
- Stesse 2 fonti sintetiche già usate in LAB79, stesso modello Gemini, stessi obiettivi e margini, due modalità per fonte/livello.
- 3 riduzioni richieste: 10%, 30%, 50%. 6 coppie reali complete.
- Fascia ±2 punti percentuali sulla riduzione delle lettere alfabetiche Unicode NFC, senza spazi/cifre/punteggiatura.
- Diretto: Gemini scrive un solo testo con budget.
- Contenitore: Gemini produce 3 formulazioni per ciascun concetto; un selettore combinatorio locale sceglie una per concetto, verificando la somma delle lettere e proteggendo formalmente le cifre.
- Prova del contenitore impossibile: correttamente rifiutata.
- IMPORTANTISSIMO: non è una certificazione di fedeltà didattica; il controllo dei fatti è solo parziale e numerico.

## Risultati per coppia
| Testo | Riduzione | Fascia ammessa | Diretto | Contenitore |
|---|---:|---:|---:|---:|
| Scienze, 599 lettere | 10% | 528–551 | 459, FUORI | 547, OK |
| Procedura, 636 lettere | 10% | 560–585 | 649, FUORI | 572, OK |
| Scienze, 599 lettere | 30% | 408–431 | 406, FUORI | 419, OK |
| Procedura, 636 lettere | 30% | 433–457 | 445, OK | 439, OK |
| Scienze, 599 lettere | 50% | 288–311 | 292, OK | NESSUNA combinazione |
| Procedura, 636 lettere | 50% | 306–330 | 389, FUORI | NESSUNA combinazione |

- Diretto: 2/6 numericamente conformi.
- Contenitore: 4/6 numericamente conformi.
- Ibridazione post-hoc (prima diretto, poi contenitore SOLO se fuori fascia): fino a 5/6 matematicamente conformi con questi output già generati; non è un nuovo test live.
- Il risultato 5/6 NON certifica la completezza concettuale.

## Motivi delle due impossibilità del contenitore al 50%
- Scienze: anche concatenando le alternative più brevi per i 5 concetti si ottengono 360 lettere, sopra il massimo di 311.
- Procedura: le 7 alternative più brevi sommano 458 lettere, sopra il massimo di 330.
- Si tratta di assenza di combinazioni nel set prodotto, NON di errore aritmetico del contenitore.
- Occorrono formulazioni più sintetiche realmente fedeli, eventuale fusione di concetti compatibili o segnalazione trasparente di impossibilità; non si eliminano concetti per forzare la quota.

## Prestazioni e limiti
- Tempo medio di risposta Gemini: diretto 2.004 ms, contenitore 2.339 ms (+16,7%, campione troppo piccolo per inferenza generale).
- Token di output medi: diretto 126, contenitore 589 (circa 4,7 volte).
- Selezione locale del contenitore: circa 1,7–15,1 millisecondi; il costo prestazionale è soprattutto nella generazione di alternative.
- Evitare l'errore statistico: nel JSON grezzo, la metrica meanErrorLetters per il contenitore include due record SENZA SOLUZIONE con lettere=0 e non deve essere interpretata come errore reale delle soluzioni. Per le 4 combinazioni valide l'errore medio assoluto è 3,5 lettere.
- Una semplice euristica segnala talvolta la mancanza di cifre quando Gemini le scrive in lettere (2024→duemilaventiquattro, 12→dodici): è un falso positivo potenziale, non necessariamente una perdita concettuale.
- Alcuni testi numericamente conformi potrebbero omettere dettagli essenziali. Occorre valutazione semantica indipendente su pagine reali.

## Decisione
- Metodo PROMETTENTE come correzione mirata dopo prima generazione diretta.
- NON APPROVATO per attivazione in produzione; non basta 4/6 e il 50% fallisce in entrambi i casi del contenitore.
- Prossima prova proposta: ottenere alternative più corte MA fedeli per il 50%, preservare legami didattici e misurare durata/tokens su testi più lunghi, senza ampliare quote o introdurre servizi a pagamento.
