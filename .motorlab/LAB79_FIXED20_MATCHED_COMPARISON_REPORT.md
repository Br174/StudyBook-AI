# MotorLab StudyBook LAB79 · verifica marcatori ogni 20 lettere · 8 novembre 2026

## Stato e autorità
- Prova approvata dall'utente: ripetere il marcatore ogni 20 lettere su più testi e cinque livelli, confrontandolo con una generazione non marcata.
- CORE MotorLab `2026.10.29-r40`; satellite locale r40; nessun cambio di release.
- Ramo isolato: `audit/studybook-fixed20-repeat-v79-20261108`.
- GitHub Actions run: https://github.com/Br174/StudyBook-AI/actions/runs/42532374734
- Fonte immutabile del run: `2bc387b39334a6b426de3be30aa9598eb834cd44`.
- Rapporto strutturato originale: artifact `StudyBook-LAB79-Fixed20-Matched-Comparison` (ID 13637218938). Conservare il rapporto e citare questo run.
- App StudyBook Android installata, firma, PDF, checkpoint, dati, LAST_GOOD, MADRE e API attive: non modificati. YALPS e contenitori digitali sospesi.

## Protocollo
- Gemini gratuito già configurato su un Worker QA autonomo `studybook-ai-fixed20-v79-qa`; 30 richieste previste come limite assoluto; arresto obbligatorio su HTTP 429/503.
- Tre fonti sintetiche (scienze 599 lettere originali; procedura 636; storia 648); livelli 10%, 20%, 30%, 40%, 50%.
- Stesso testo, stessi budget derivati dalla fonte, stesso modello e stessa introduzione didattica per ogni coppia. La differenza è **solo** l'istruzione del marcatore ogni 20 lettere rispetto al controllo senza marcatori.
- I numeri tra ⟦...⟧ sono rimossi e ignorati dal contatore locale Unicode; non vanno rimossi numeri reali della fonte.
- Controlli offline `test-lab79-matched-control-offline.mjs`, `test-lab78-marker-offline.mjs`, `test-lab77-numbering-offline.mjs`, budget fonte LAB74 e selezione pagine LAB74: superati. Build QA e deploy isolato: superati.

## Esito reale
- 18 richieste HTTP; 15 risposte Gemini utilizzabili, 7 coppie complete e una risposta isolata non confrontabile. 2 HTTP 404 iniziali da propagazione del Worker e un HTTP 429 finale di quota. Il workflow risulta FAILED perché confronto integrale incompleto per quota, non perché il codice di test numerico sia fallito.
- **7 coppie valide**: controllo non numerato **4/7** pagine nella fascia ±5%; con marcatore ogni 20 lettere **1/7**.
- Deviazione assoluta media dal target: controllo **37,6 lettere**; marcatore **79,4 lettere**.
- Tempo medio per risposta: controllo **1.148 ms**; marcatore **1.537 ms**.
- Token medi generati: controllo **129**; marcatore **258**.
- Nessuna fra le 7 risposte marcate ha una sequenza numerica completamente esatta. In un caso i marcatori hanno sintassi difettosa. Le euristiche di fedeltà hanno prodotto rispettivamente 11 e 14 avvisi nei due gruppi; NON sono un audit semantico completo.

## Livelli coperti in coppie valide
| Riduzione | Coppie | Controllo corretto | Marcatori corretti |
|---|---:|---:|---:|
| 10% | 1 | 1 | 0 |
| 20% | 2 | 0 | 0 |
| 30% | 2 | 2 | 0 |
| 40% | 1 | 0 | 0 |
| 50% | 1 | 1 | 1 |

## Decisione sperimentale
La prova **non supporta** l'attivazione del metodo `fixed20` in produzione. Un risultato positivo in LAB78 su una pagina non è stato replicato con stabilità nella LAB79. La numerazione generata direttamente da Gemini non fornisce un contatore affidabile e ha richiesto più token e tempo.

Limiti: campione piccolo, run parziale interrotto dal limite gratuito, input sintetici e controlli di fedeltà soltanto euristici. Non chiamare il controllo 4/7 «soluzione definitiva», né trarre conclusioni statistiche generali dal solo campione.

Possibile via successiva, **non autorizzata automaticamente**: analizzare budget/qualità dei testi generati senza marcatori, oppure testare checkpoint verificati esterni con un numero contenuto di chiamate; YALPS e contenitori rimangono esplicitamente sospesi finché l'utente non decide diversamente.
