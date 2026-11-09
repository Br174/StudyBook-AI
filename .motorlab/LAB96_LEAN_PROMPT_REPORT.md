# MotorLab StudyBook AI, LAB96 — Gemini con istruzioni minime, checklist nascosta

**Data:** 9 novembre 2026
**Ramo verificato:** `audit/studybook-lean-source-only-v96-20261109`
**Workflow reale:** https://github.com/Br174/StudyBook-AI/actions/runs/42628912993
**Esito:** test eseguito con successo, **NON pronto per promozione nell'app**.

## Scopo
Dopo LAB93–95, provare a rimuovere dal prompt Gemini la checklist di fatti ripetitiva. Il motore riceve solo il testo originale (le unità semantiche vengono unite senza interruzioni), obiettivo lettere, fascia ±5 punti, massimo righe da 60 celle e regole essenziali: conserva fatti, non aggiungere parole per riempire la riga, fermati quando il pensiero è completo. **Soltanto dopo** la generazione il verificatore locale controlla il ledger interno di fatti (64 voci su cinque fonti). Questo esperimento non crea automaticamente il ledger a partire da un PDF reale.

## Collegamento MotorLab
CORE `Br174/Chatgpt` release `2026.10.29-r40`, satellite locale `Br174/StudyBook-AI` release `2026.10.29-r40` in stato VERIFIED; nessun aggiornamento di release necessario.

## Prove matematiche
- **6.000** configurazioni seminate con sorgenti e riduzioni, **zero errori**;
- **6.000** simulazioni di rimozione evidente di informazioni individuate, **zero errori** in questo tipo di attacco semplice;
- Due riferimenti **scritti manualmente**, non Gemini: 20% scienze 16,86%, 11/11 righe, e 20% medicina 16,35%, 13/13 righe, entrambi con copertura lessicale della checklist;
- **15** risposte LAB92 e **7** risposte LAB95 rianalizzate senza modificarne il testo.
- **Importante:** le regex che trovano parole non provano necessariamente il significato e possono produrre falsi positivi, anche su formulazioni valide.

Dati: `audit/reports/lab96-offline.json`.

## Test Gemini reali
- Modello con segreto gratuito già disponibile: `gemini-3.5-flash-lite`.
- **12 richieste HTTP**, **12 risposte JSON valide**, nessun 429/503; limite preventivo 12 tentativi rispettato.
- **11 pagine lunghe:** **11/11** nei limiti della griglia; **2/11** nella fascia ±5 punti; **2/11** dentro entrambe.
- **Una pagina breve:** 3/5 righe, esente dall'obbligo di riduzione.
- **0/11** pagine lunghe senza segnalazioni sulla checklist semantica; controllo di lettura individua omissioni reali e false segnalazioni automatiche.
- **Nessuna versione promossa a produzione**, nessun APK compilato.

### Tabella dei risultati

| Fonte | Obiettivo | Riduzione reale | Righe usate/capienza | Fascia e righe |
|---|---:|---:|---:|:---:|
| Scienze | 20% | 32,39% | 9/11 | NO |
| Medicina | 20% | 34,34% | 10/13 | NO |
| Procedura | 20% | 35,53% | 9/11 | NO |
| Storia | 20% | 32,54% | 10/12 | NO |
| Breve giuridico | 20% | 18,06% | 3/5 | ESENTE DALLA BANDA |
| Scienze | 50% | **50,08%** | 7/7 | **SÌ SOLO NUMERI** |
| Medicina | 50% | **52,88%** | 8/8 | **SÌ SOLO NUMERI** |
| Procedura | 50% | 56,45% | 6/7 | NO |
| Scienze | 10% | 29,88% | 9/12 | NO |
| Medicina | 10% | 22,39% | 12/15 | NO |
| Scienze | 30% | 40,07% | 8/10 | NO |
| Procedura | 40% | 54,25% | 7/9 | NO |

### Problemi didattici confermati
- **Scienze 50%**, pur centrando il 50,08%, omette che le stagioni *non* dipendono dalla distanza dal Sole, che le eclissi *non* avvengono a ogni lunazione e che un singolo risultato non basta.
- **Medicina 50%**, pur centrando il 52,88%, omette la pressione **parziale**, la produzione/consumo di gas durante lo sforzo e cautele diagnostiche fondamentali.
- **Procedura 20%** omette il riferimento preciso alla **regola 12**.
- **Storia 20%** tralascia esplicitamente le **cause** degli eventi; il verificatore ha segnalato anche la definizione della fonte secondaria, che invece era espressa correttamente nella frase italiana.
- **Breve giuridico 20%** usa «la scadenza preclude il deposito», che rispetta il concetto anche se la regex per la decadenza non lo riconosce: **falso positivo**.
- **Medicina 20%** esprime il percorso inverso della CO₂ e il maggiore consumo/produzione di gas senza le esatte parole della regex, creando **falsi positivi**; omette invece i globuli rossi.
- **Scienze 10%** resta troppo corta e omette la condizione delle eclissi non a ogni lunazione.

Rilettura dei 12 testi: `audit/reports/lab96-qualitative-review.json`.

## Confronto LAB95 → LAB96
**LAB95** includeva 7 risposte al 20% ottenute con checklist italiana ripetuta nel prompt: tutte erano più lunghe del testo originale, con **0/7** conformi a righe e percentuale.

**LAB96** produce 12/12 risposte valide e **11/11** pagine lunghe entro la griglia fisica. Ma il nuovo prompt risulta **troppo aggressivo nella sintesi**: il 20% diventa 32–36% di riduzione e il 10% arriva al 22–30%. Quindi ha risolto il superamento delle righe, **non** la corretta percentuale e fedeltà.

Le prove su campioni diversi e tempi diversi non consentono un confronto statistico generale: è un'osservazione sperimentale su pochi casi.

## Prossimo esperimento consigliato: modalità differenziate, senza checklist duplicata
1. **10% e 20%: editing conservativo**. Partire dalle frasi originali e chiedere di *eliminare soltanto ripetizioni e giri di parole*, mantenendo esplicitamente tutte le proposizioni e dettagli. Non formulare la richiesta come «riassumi» né aggiungere al prompt un secondo elenco completo dei fatti.
2. **30%–40%: riscrittura moderata**, ancora source-only, ma con un limite più forte ai tagli di negazioni/condizioni.
3. **50% e riassunto:** compressione più marcata, controllata da ledger successivo; non permettere la perdita di un fatto centrale solo per raggiungere un numero.
4. **Misurazione deterministica:** lettere Unicode, righe virtuali, parole non spezzate; registrare lo scostamento reale anche in casi eccezionalmente più corti senza inventare riempitivi.
5. **Checklist dopo generazione**, preferibilmente con analisi di relazioni/negazioni e normalizzazione dei numeri, non solo regex stringa; la verifica lessicale genera falsi positivi e alcuni falsi negativi.
6. **Un solo passaggio generativo per pagina e livello** come percorso standard, con conservazione e revisione limitata solo per vere perdite di contenuto.
7. **Non ancora pronta:** la successiva vera prova PDF/A4 a font fisso, la prima lettura automatica dell'intero libro e la resilienza a quota 429/503 richiedono test separati.

**Verdetto:** miglioramento netto di layout e contenimento, ma **nessun testo LAB96 certificato**. L'app, i dati, la firma Android, la produzione e la branch main restano invariati; nessun costo o servizio aggiuntivo richiesto.
