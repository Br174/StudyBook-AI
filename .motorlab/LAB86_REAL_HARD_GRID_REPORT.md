# MotorLab StudyBook AI · LAB86 · Righe fisse e bloccate: rapporto di collaudo Gemini

**Data:** 9 novembre 2026
**Stato:** PROVA GEMINI REALE PARZIALE, miglioramento numerico misurato, **NON pronta per produzione**.
**Repo:** `Br174/StudyBook-AI` · ramo isolato `audit/studybook-hard-grid-lines-v86-20261109`.

## 1. Obiettivo in base al chiarimento dell'utente
Il numero di righe e la larghezza devono essere vincoli reali del programma, non indicazioni orientative.
- Prima della generazione definire **60 celle monospaziate per riga** e il massimo numero di righe per ogni riduzione.
- Il limite non si allarga dopo la risposta Gemini; una risposta che trabocca è **respinta**, mai tagliata, mai trasferita ad altra pagina.
- La media empirica LAB84 (46,346 lettere, 11,502 spazi a riga, di cui 3,658 extra per giustificazione) determina la **stima iniziale di righe**, non la quantità effettiva di lettere.
- Fissare anche il controllo indipendente della riduzione ±5 punti percentuali.
- Fonte sintetica scienze 599 lettere, procedura scolastica simulata 636 lettere; stessi testi e sei livelli della LAB85.
- Terza pagina brevissima (≤5 righe) prevista in script ma non raggiunta a causa del provider HTTP 503.
- **Importante:** prova su **celle astratte monospaziate**, NON un PDF A4 con font proporzionale. Per il PDF reale va misurata la larghezza grafica del testo con font e dimensione bloccati.
- `In parole semplici` non viene pre-generato, resta pulsante on-demand in ogni livello.

## 2. Esecuzione reale Gemini
- Esecuzione: https://github.com/Br174/StudyBook-AI/actions/runs/42596428756
- Script: `scripts/test-lab86-hard-grid-lines.mjs`
- Risposte complete: **9** su 18 casi pianificati.
- Richieste HTTP a Gemini: **13**; errori HTTP 503 ai tentativi 2, 9, 12, 13. Dopo due 503 consecutive sulla prova procedura 30%, stop di sicurezza. **Nessuna escalation di quota né pagamento.**
- JSON raw con le risposte originali: `audit/reports/lab86-six-levels-real-gemini.json`.
- Audit comparativo semantico: `audit/reports/lab86-hard-grid-semantic-review.json`.
- Sintassi Node validata dalla CI, evidenza preservata sul ramo audit.
- La CI ha conclusione `failure` **per interruzione volontaria su errore provider 503**, non per il controllo sintattico o una modifica dell'app.

## 3. Risultati reali a confronto: nuove risposte vs LAB85

| Fonte | Livello | Righe limite | Righe Gemini impaginate | Riduzione reale | Griglia | ±5pp | Entrambi |
|---|---:|---:|---:|---:|:---:|:---:|:---:|
| Scienze | 40% | 8 | 8 | 37,90% | Sì | Sì | **Sì** |
| Scienze | 65% | 5 | 6 | 53,59% | **No** | **No** | No |
| Scienze | 50% | 6 | 6 | 51,75% | Sì | Sì | **Sì** |
| Scienze | 30% | 9 | 9 | 34,56% | Sì | Sì | **Sì** |
| Scienze | 20% | 10 | 10 | 19,20% | Sì | Sì | **Sì** |
| Scienze | 10% | 12 | 10 | 20,70% | Sì | **No** | No |
| Procedura | 40% | 8 | 8 | 44,81% | Sì | Sì | **Sì** |
| Procedura | 65% | 5 | 6 | 62,42% | **No** | Sì | No |
| Procedura | 50% | 7 | 7 | 50,00% | Sì | Sì | **Sì** |

**Nuova LAB86:** 7/9 geometricamente conformi, 7/9 matematicamente conformi, **6/9 entrambe**.
**Precedente LAB85 sugli stessi nove casi:** soltanto **2/9** conformi simultaneamente (scienze 30% e scienze 10%).
- Miglioramento osservato 2/9 → 6/9 (+4 casi), campione piccolo e non prova statistica definitiva.
- I due riassunti al 65% sono ancora troppo lunghi per la griglia: non sono stati accettati.
- La versione scienze 10% occupa poche righe, ma riduce del **20,70%**, fuori intervallo 5–15%. Ciò dimostra che **il solo numero delle righe non garantisce la percentuale**.

## 4. La qualità didattica cambia la valutazione
**ATTENZIONE:** i 6/9 appena citati sono solo **geometria + matematica**. Non sono 6 testi didatticamente approvati.

Problemi rilevati nella lettura dei testi:
- **Scienze 50%:** Gemini ha scritto `dipen-\ndono`, spezzando una parola, e `La rivoluzione e il Sole durano un anno`, formulazione scientificamente errata. Il test soddisfa griglia e ±5pp ma **DEVE ESSERE RESPINTO nel QA didattico**.
- **Scienze 10%:** il riferimento alla «luce solare» come fattore delle maree è fuorviante: il testo originale attribuisce il ruolo a Luna e Sole, non alla luce. È inoltre fuori banda.
- **Scienze 40%:** almeno una grafia difettosa (`dall asse`), e la condizione che l'eclissi non accade ad ogni lunazione non è esplicitata.
- **Procedura 40%:** manca il riferimento alla **regola n. 12**; anche la regola di restituzione del libro prenotato pur non avendo completato la lettura è stata omessa.
- **Procedura 50%:** manca l'eccezione sulla restituzione del libro non ancora letto; il registro perde dettagli su chi e quando.
- **Procedura 65%:** oltre alla riga di troppo, mancano riferimenti fondamentali, incluso il registro.
- **Scienze 20%:** lettura preliminare senza evidenti alterazioni principali; resta da sottoporre a verifica semantica indipendente.

Questo è un controllo preliminare, NON una prova esaustiva di fedeltà dei testi.

## 5. Dove risiede il problema e come correggerlo
- **Vincolo geometrico:** va gestito da codice deterministico, capace di dire SÌ/NO dopo aver misurato le righe. Funziona nell'audit: respinge le risposte 6/5 righe.
- **Conteggio lettere:** resta indipendente dalla geometria, perché la densità di lettere per riga varia. La scienza al 10% è la dimostrazione (10 righe ≤12, riduzione 20,70% anziché 10%).
- **Testo semantico:** serve un gate separato su parole spezzate, grafia, fatti, date, numeri, negazioni, definizioni, condizioni ed eccezioni.
- **Correzione mirata:** quando la risposta è fuori griglia o fuori fascia o manca un concetto, farla riscrivere con budget limitato e senza falsificare il passaggio; se il servizio risponde 429/503, checkpoint e stop secondo policy senza retry storm.
- **Pagine brevissime 1–5 righe:** semplificazione sempre, percentuali libere, contesto tra pagine per sola lettura senza spostamento.
- **PDF tipografico reale:** per un font proporzionale 60 caratteri non equivalgono a una larghezza fisica fissa. La prossima implementazione dovrà usare la metrica del font effettivo a dimensione invariabile, non solo il numero di caratteri.

## 6. Limiti e sicurezza
- Test su **due brevi fonti sintetiche**, non su un libro completo reale di molte pagine. Il terzo test di continuità pagina non è stato eseguito con Gemini per 503.
- Il modello Gemini `gemini-3.5-flash-lite` è stato chiamato con la configurazione già presente in GitHub Actions, senza nuove spese.
- Nessuna compilazione APK/ZIP, nessun aggiornamento dell'app installata, produzione e `main` invariati da questo esperimento.
- Tutto salvato sul ramo LAB isolato; non promuovere il metodo in produzione sulla base di questi risultati.

## Verdetto
**Il vincolo fisso per numero massimo di righe è efficace come filtro:** migliora la conformità numerica osservata (2/9 → 6/9 sugli stessi casi), ma non è una soluzione autonoma. Per dichiarare il metodo pronto servono **tre condizioni simultanee: pagina contenuta nella griglia, percentuale corretta, contenuti didattici corretti**.
