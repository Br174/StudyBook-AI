# MotorLab StudyBook AI — LAB89: preassegnazione proporzionale dei concetti, risultati verificati

**Data:** 9 novembre 2026
**Stato:** TEST REALI COMPLETATI FINO AL LIMITE GEMINI 429; **NON APPROVATO PER PRODUZIONE**.
**Repo:** `Br174/StudyBook-AI`; ramo isolato `audit/studybook-proportional-semantic-grid-v89-20261109`.
**MotorLab:** CORE centrale e satellite locale r40 verificati e allineati; motore nativo dell'app invariato.

## Scopo
Testare la regola approvata dall'utente: prima della scrittura del testo di studio, la prima lettura identifica concetti di lunghezza e complessità diverse e StudyBook riserva preventivamente uno spazio PROPORZIONALE e misurabile per ciascun concetto. Gemini riceve il piano completo in una sola chiamata per livello e pagina. Nessuna riscrittura automatica del finale. Il testo generato deve preservare tutti i concetti essenziali, i termini specialistici del 10/20%, la pagina originale e la larghezza fissa.

**Limite metodologico importante:** nei cinque testi del benchmark la prima segmentazione semantica è stata **fornita manualmente** nella fixture. Questi test misurano assegnazione righe + generazione, non la capacità di ricavare autonomamente i concetti da un PDF.

## Fonti e test pianificati
- Scienze (599 lettere; 4 unità semantiche; rotazione, stagioni, maree/eclissi, metodo scientifico).
- Procedura giuridica simulata (636 lettere; 4 unità; prestito, proroga, libro prenotato, registro).
- Storia/concetto sbilanciato (670 lettere; concetti 539, 43, 47, 41 lettere, per provare il peso del concetto lungo).
- Medicina didattica (4 concetti su respirazione, alveoli, emoglobina e valutazione clinica): scenario preparato, **nessuna generazione** per saturazione quota.
- Pagina breve giuridica di 4 righe con contesto dell'articolo precedente: test predisposto, **prima chiamata bloccata da HTTP429**.

Per ciascun testo sei livelli: Riassunto 65%, 50%, 40%, 30%, 20%, 10%. Il modello era `gemini-3.5-flash-lite` con il segreto GitHub già disponibile. Limite richieste 33, arresto immediato su HTTP429, un solo retry su 503 transitorio, nessun pagamento.

## Test matematici eseguiti
- **30 combinazioni fixture** (5 fonti x 6 livelli), tutte allocabili.
- **9.000 configurazioni sintetiche randomizzate e riproducibili**: 8.640 allocabili, 360 dichiarate non fattibili perché troppe unità semantiche rispetto alle righe minime disponibili; **zero errori di invariante**.
- Controllo simbolico importante: pesi [9,0,0,0] con 10 righe totali -> **[7,1,1,1]**.
- Algoritmo: vincoli minimi di una riga per concetto, ripartizione proporzionale dell'eccedenza con resti maggiori, peso da lunghezza sorgente e importanza relativa. Righe totali e numero minimo per concetto garantiti da codice, senza Gemini.
- La media LAB84 resta 46,346 lettere e 11,502 spazi per riga virtuale da 60 posizioni. Non è una regola sulla quantità fissa di parole.

Evidenza: `audit/reports/lab89-offline-allocation-stress.json`.
Workflow matematico ripetuto e riuscito: https://github.com/Br174/StudyBook-AI/actions/runs/42601560355

## Prove Gemini REALI
- **18 tentativi HTTP**, **15 risposte complete** per 15 casi; due errori HTTP503 transitori recuperati e un HTTP429 che ha fermato la prova.
- Fonte scientifica 6/6 livelli, procedura 6/6, storia sbilanciata 3/6; pagina breve e medicina non completate.
- **5/15** risultati entro le righe SEPARATE di ciascun concetto.
- **8/15** entro la fascia percentuale ±5 punti della pagina.
- **2/15** entro entrambi i vincoli simultaneamente.
- **1/15** supera anche i controlli lessicali/semantici **automatici preliminari**, ma **nessuno è stato certificato per uso didattico**: la lettura ha individuato omissioni o incertezze anche in output quantitativamente corretti.
- **Nessun risultato è stato copiato nell'app.**

### Risultati delle sei riduzioni per le due fonti comparabili
| Versione | Scienze: riduzione ottenuta | Righe per concetto e % entrambe? | Procedura: riduzione ottenuta | Righe per concetto e % entrambe? |
|---|---:|:---:|---:|:---:|
| Riassunto 65% | 60,77% | NO | 66,04% | NO |
| 50% | 51,92% | NO | 44,81% | NO |
| 40% | 38,23% | NO | 37,58% | NO |
| 30% | 50,92% | NO | 33,18% | NO |
| 20% | −1,67% (testo allungato) | NO | 23,27% | SÌ, **solo numericamente** |
| 10% | −6,51% (testo allungato) | NO | 29,09% | NO |

### Il caso reale che funziona meglio
Storia con un concetto lungo e tre brevi, riduzione richiesta 40%:
- Piano preventivo: **[6,1,1,1] righe** (9 in totale).
- Testo generato per concetto: **[5,1,1,1] righe** (8 in totale).
- Riduzione effettiva **44,48%**, entro la fascia 35–45%, griglia rispettata.
- Nessun termine sentinella assente nei controlli automatici.
- La verifica qualitativa rileva che il concetto grande ha perso dettagli sul confronto delle diverse testimonianze e sul segnalare ciò che rimane incerto. Quindi **non ancora certificato didatticamente**.

## Scoperta successiva, senza ulteriori chiamate Gemini: condividere l'ultima riga
La precedente prova attribuiva righe ESCLUSIVE a ogni concetto. Questa separazione ha prodotto sprechi: anche quando un concetto finiva a metà di una riga, il successivo partiva su un'altra riga intera.
È stato eseguito un **nuovo controllo deterministico sui 15 testi reali immutati**, facendo continuare il concetto successivo nello spazio rimasto nella stessa riga, mantenendo ordine, caratteri, parole e confini della pagina:
- **5/15** intere pagine entravano nella griglia originale a righe per-concetto, **10/15** entrano nella griglia di pagina facendo condividere le righe.
- **2/15** rispettavano anche la percentuale con la suddivisione originale; **7/15** rispettano griglia dell'intera pagina + percentuale dopo la nuova disposizione.
- **19 righe complessive recuperate**. Numero di lettere e testo invariati in **15/15**.
- **Attenzione metodologica:** il nuovo test **rilassa i limiti esclusivi delle singole sezioni**. Dimostra il vantaggio del limite rigido dell'intera pagina con righe condivise, NON che i budget per-concetto iniziali fossero tutti rispettati. Non risolve gli errori semantici o le riduzioni troppo aggressive.

Evidenza: `audit/reports/lab89-shared-line-repacking.json`.

## Terzo esperimento offline: budget PREVENTIVO per celle di carattere
- Invece di riservare una riga intera per ogni concetto, una variante assegna alla singola unità un **minimo di 60 celle** e distribuisce le celle rimanenti proporzionalmente alla lunghezza originale e all'importanza.
- Applicata retroattivamente, senza generare altri testi, a 15 risultati: **3/15** rispettano le quote celle assegnate e la fascia percentuale; **10/15** non superano semplicemente il totale di celle della pagina. La differenza conferma che serve una politica di condivisione/redistribuzione degli spazi, non soltanto quote individuali rigide.
- Questa variante è un'analisi controfattuale **non testata come prompt Gemini**, quindi non ha prova di efficacia generativa.
Evidenza: `audit/reports/lab89-cell-budget-counterfactual.json`.

## Confronto corretto con LAB86
Su **nove** combinazioni testo+livello comuni a LAB86 e LAB89:
- LAB86 con il semplice limite righe dell'intera pagina: **6/9** rispettavano righe+percentuale, ma alcuni contenevano errori didattici.
- LAB89 con quote ESCLUSIVE righe/concetto: **0/9**.
- LAB89 con riposizionamento a righe CONDIVISE: **4/9**.
**Quindi il nuovo metodo, nella sua implementazione rigida iniziale, NON ha ancora superato il precedente.** L'aspetto promettente è la distribuzione proporzionale a livello concettuale combinata con la capacità fisica condivisa, da testare con un nuovo prompt.

## Errori didattici riscontrati
- Scienze: omissioni sulla non dipendenza delle stagioni dalla distanza, sulle eclissi non presenti a ogni lunazione; apostrofi e accenti errati in più versioni; 10% e 20% talvolta **allungano** il testo.
- Procedura: il riassunto perde conferma scritta e restituzione anche del libro non finito; alcune versioni producono accenti scorretti.
- Numeri `12`/«dodici» e `2024`/«duemilaventiquattro» possono essere equivalenti: controlli a stringa esatta causano falsi allarmi. Serve normalizzazione numerica e analisi semantica.
- Il solo successo geometrico/matematico NON autorizza pubblicazione dei testi.
Evidenza del controllo qualitativo: `audit/reports/lab89-qualitative-spotcheck.json`.

## Decisione e prossimo design da sottoporre a prova reale
La **precomprensione e la proporzionalità dei concetti restano valide come architettura**, ma la griglia di singole righe esclusive è troppo restrittiva. La variante successiva dovrebbe:
1. identificare concetti e minimi semantici nella prima lettura dell'intero libro, senza spostare testi fra pagine;
2. allocare **quote proporzionali in celle** di carattere, con riserva minima per definizioni/condizioni/negazioni essenziali e possibile condivisione di una riga fra due concetti, mantenendo fisso il numero massimo di righe dell'intera pagina;
3. passare a Gemini **un unico piano preventivo** (nessuna riscrittura automatica finale come default), con per-concetto limiti espressi in posizioni occupate e lettere indicative;
4. misurare dopo l'unica risposta tramite codice indipendente: **numero fisico righe, lettere Unicode effettive, completezza concettuale, termini tecnici, cifre equivalenti, errori di apostrofo/ortografia**;
5. respingere overflow, invenzioni e omissioni senza ritagliare testo o alterare il font; mantenere ±5pp sulle pagine >5 righe e semplificare sempre le pagine brevi;
6. preservare «In parole semplici» esclusivamente su pressione dell'utente, in tutte le sei versioni.
Una vera prova A4/font proporzionale richiede una misura grafica indipendente dei glifi: il test corrente è su **60 celle monospaziate virtuali**.

**Blocco:** provider HTTP429. Nessuna ulteriore chiamata è stata tentata dopo il blocco. **Nessuna modifica** a main, all'app, ai dati, agli artefatti Android o alla firma; nessuna richiesta di pagamento.
