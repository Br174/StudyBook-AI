
# MotorLab StudyBook AI · LAB85 · Sei livelli con righe calibrate · Gemini reale
Data prova: 9 novembre 2026
**STATO: PROVA REALE PARZIALE CON BLOCCO QUOTA 429, NON APPROVATA PER PRODUZIONE**

## Identità
- Repo `Br174/StudyBook-AI`; ramo `audit/studybook-six-levels-lines-v85-20261109`.
- CI real: https://github.com/Br174/StudyBook-AI/actions/runs/42593896225
- JSON completo con testi e misure: `audit/reports/lab85-six-levels-real-gemini.json`.
- Script: `scripts/test-lab85-six-levels-virtual-lines.mjs`.
- Modello: `gemini-3.5-flash-lite` con credenziale già configurata, nessun nuovo servizio.
- Limite massimo previsto: 18 casi e 19 tentativi HTTP complessivi. Eseguiti **16 tentativi**, **14 risposte complete**. Una richiesta 503 recuperata da unico ritentativo; poi stop al primo **429**.
- Interrotto durante la pagina brevissima al 40%. Non sono stati provati il 40%, 30%, 20% e 10% di quella pagina.
- Produzione, main, firma, APK, dati utenti, PDF, Worker di produzione, LAST_GOOD **immutati**.

## Protocollo
- Due fonti sintetiche già usate nella LAB80: `procedura` (636 lettere) e `scienze` (599 lettere), sei livelli per ciascuna, quindi 12 prove comparative complete.
- Terza fonte di pagina breve giuridica (155 lettere originali, 4 righe virtuali), con contesto delle pagine adiacenti SOLO di lettura; due versioni completate.
- Per la pagina oltre 5 righe: target 65/50/40/30/20/10% di **riduzione** delle lettere, tolleranza ±5 punti percentuali.
- Fonte originale sola pagina, contatore Unicode NFC alfabetico; spazi, cifre e segni non contano.
- Previsione righe: lettere target / **46,346**, con riga di 60 posizioni, media **11,502 spazi** di cui **7,844 naturali** e **3,658 di giustificazione**, più 1,966 segni e 0,186 cifre (dati LAB84).
- Gemini ha generato linguaggio naturale. Il programma ha spezzato **dopo** la risposta in righe senza spezzare parole. Le righe complete possono essere giustificate deterministicamente a 60 posizioni distribuendo spazi; l'ultima rimane più corta. Ciò non corregge il numero di lettere prodotte.
- Sei livelli didattici, lessico specialistico protetto 10/20 e progressivamente semplificato agli altri livelli.
- `In parole semplici` **non invocato** né precalcolato; deve restare on-demand su qualsiasi riduzione e salvare ultima versione per pagina.

## Risultati dodici prove su pagine di oltre cinque righe
| Fonte | Versione | Riduzione effettiva | Entro ±5 punti | Cifre della fonte assenti in formato identico |
|---|---|---:|:---:|---|
| procedura | Riassunto finale | 58,33% | NO | 12 |
| procedura | 50% | 47,48% | SÌ | 12 |
| procedura | 40% | 33,49% | NO | 12 |
| procedura | 30% | 29,72% | SÌ | nessuno |
| procedura | 20% | 15,72% | SÌ | 12 |
| procedura | 10% | 15,57% | NO | nessuno |
| scienze | Riassunto finale | 57,26% | NO | nessuno |
| scienze | 50% | 39,23% | NO | nessuno |
| scienze | 40% | 20,20% | NO | nessuno |
| scienze | 30% | 31,72% | SÌ | nessuno |
| scienze | 20% | 20,70% | SÌ | nessuno |
| scienze | 10% | 14,52% | SÌ | nessuno |

**6/12 entro la fascia matematica** (3/6 procedura, 3/6 scienze). Livelli:
- 65%: 0/2 in fascia.
- 50%: 1/2 in fascia.
- 40%: 0/2 in fascia.
- 30%: 2/2 in fascia.
- 20%: 2/2 in fascia.
- 10%: 1/2 in fascia.

- 65%: 0/2 in fascia (58,33%; 57,26%) e rischio di omissioni.
- 50%: 1/2 (47,48%; 39,23%).
- 40%: 0/2 (33,49%; 20,20%).
- 30%: 2/2 (29,72%; 31,72%).
- 20%: 2/2 (15,72%; 20,70%).
- 10%: 1/2 (15,57%; 14,52%), la procedura supera la soglia di 0,57 punti percentuali.
- Con controllo meccanico più severo che richiede le cifre identiche, solo **4/12** passano entrambi i filtri. Ma attenzione: 
  `12` scritto `dodici` o `15` scritto `quindici` è **numericamente equivalente**, quindi un avviso di cifra mancante NON implica automaticamente perdita concettuale.
- Invece, nelle versioni di procedura 65% e 40% manca il riferimento alla regola n. 12: non compare neppure scritto in lettere. Sono omissioni effettive del riferimento.
- Esempi di altre omissioni didattiche visibili: procedura 50% non conserva chiaramente il vincolo di conferma scritta della proroga; scienze 65% tralascia alcuni legami/spiegazioni; altri livelli rischiano di perdere eccezioni o informazioni importanti.
- Nei quattro casi completi 10/20% della procedura e delle scienze tutti i termini sentinella richiesti sono presenti (4/4), ma **questo non certifica la fedeltà didattica**.

## Pagina breve con continuità
Fonte: «Il termine perentorio per depositare le osservazioni è di 15 giorni dalla notifica. Se scade, la parte perde la possibilità di depositarle; resta però il diritto di conoscere la motivazione.» (155 lettere, 4 righe virtuali).
| Versione | Riduzione effettiva | Lettere finali | Termine sentinella mancante |
|---|---:|---:|---|
| Riassunto finale | -6,45% | 165 | nessuno |
| 50% | 8,39% | 142 | termine perentorio |

- Per pagine <=5 righe **la percentuale è libera**, ma la comprensibilità e la tutela semantica rimangono obbligatorie.
- Riassunto 65% ha addirittura **allungato** il testo del 6,45% (riduzione −6,45%). Valutare se la riformulazione aggiunga necessarie spiegazioni o introduca tecnicismi.
- Nella versione 50% il termine «termine perentorio» non appare, mentre l'effetto giuridico della decadenza viene espresso. La sostituzione va valutata da revisione didattica.
- La cifra 15 diventa «quindici» in entrambi: segnalazione meccanica ma sostanza equivalente.
- Nei due output della pagina breve non emergono segnali testuali di copia dalla pagina precedente/successiva, ma questa assenza non è una certificazione di fedeltà pagina-per-pagina.

## Verifica OFFLINE di giustificazione post-output
Sono state prese le 14 risposte prodotte realmente da Gemini e, **senza chiamare un modello**, si è applicata una semplice distribuzione degli spazi residui fra le parole:
- In **14/14 testi**, tutte le righe complete sono state portate a **60 posizioni**; l'ultima riga rimane naturalmente più corta.
- **14/14 testi** preservano esattamente il numero di lettere alfabetiche.
- Nessuna parola spezzata e nessuna informazione alterata dalla sola giustificazione.
- Questo è un test deterministico successivo, **NON** significa che Gemini abbia prodotto direttamente le righe identiche, né che la percentuale sia rientrata.

## Decisione
**La misura di 11,502 spazi/46,346 lettere per riga è utile come guida di impaginazione e di primo target, ma NON garantisce la riduzione corretta.**
- NON integrare ancora in produzione: solo il 50% delle prove complete supera la fascia numerica, e ci sono omissioni di riferimenti.
- Conservare la regola 1–5 righe con semplificazione obbligatoria e tolleranza libera.
- Separare la semplificazione di base delle sei edizioni dalla funzione on-demand «In parole semplici».
- Per migliorare: generazione una volta, conteggio matematico post-output, correzione mirata **solo** sulle pagine fuori fascia senza eliminare informazioni, e QA su definizioni, eccezioni, date/numeri e provenienza pagina.
- In qualunque eventuale nuovo collaudo rispettare il limite 429 e la quota gratuita. Non sono stati attivati retry automatici dopo il 429, né funzioni di monitoraggio o pubblicazione.
