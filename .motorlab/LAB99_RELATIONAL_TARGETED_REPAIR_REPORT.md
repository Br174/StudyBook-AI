# MotorLab StudyBook AI LAB99 — Guard relazionale e correzione mirata di una sola frase

**Data:** 9 novembre 2026. **Stato:** LAB isolata completata, matematica e correzioni locali verificate; **NON pronta per produzione**.
**Repository:** `Br174/StudyBook-AI`
**Ramo audit:** `audit/studybook-relational-targeted-repair-v99-20261109`
**CORE MotorLab:** `Br174/Chatgpt` release `2026.10.29-r40`; satellite locale `2026.10.29-r40`, `STATE=VERIFIED`. Nessun aggiornamento MotorLab necessario. La famiglia attiva dell'app è `motorlab/active-studybook-control` in modalità `control-only`; non modificata.
**Produzione, main, branch attiva applicativa, dati, Cloudflare, firma, APK, ZIP:** **NON modificati**.

## Obiettivo
Conservare la generazione normale a **una sola chiamata per pagina/livello**, senza checklist duplicata, e correggere **solo un periodo problematico**, in via eccezionale, se la verifica di StudyBook trova un fatto indispensabile mancante. Una frase sostituita deve conservare intatto tutto il resto del testo e rispettare la riduzione percentuale e la geometria della pagina. Se non supera i controlli, **rollback**, senza pubblicare un errore e senza lanciare in automatico una nuova elaborazione dell'intera pagina.

## Sviluppi implementati nella LAB
1. `scripts/lab99-relational-guard.mjs`: guard sperimentale a regole di compresenza nella stessa frase, sulle cinque fonti sintetiche. Copre fatti distinti (Luna + Sole nelle maree, eclissi e lunazioni, emoglobina/globuli rossi, libro prenotato/lettura incompleta, registro/chi/quando, regola interna 12, ecc.). **Limite importante:** la compresenza nella stessa frase non prova la correttezza logica delle relazioni, né garantisce sinonimi e parafrasi.
2. `scripts/lab99-targeted-sentence-patch.mjs`: sostituzione esatta di **un solo periodo**, nessun altro carattere alterato; confronto con originale; griglia 60 posizioni monospaziate; conteggio Unicode alfabetico e tolleranza ±5 punti; non introdurre nuovi allarmi rispetto all'originale; rollback se manca il fatto atteso, la banda, o aumenta la larghezza.
3. Quattro casi reali documentati in `audit/test-fixtures/lab99-sentence-repair-cases.json`. Due testi scientifici, uno medico, uno giuridico, tutti derivati dalle risposte salvate della LAB98.
4. Verifiche via GitHub Actions su ramo isolato, senza deployment né rilascio Android.

## Prove offline, senza consumo Gemini
Workflow: https://github.com/Br174/StudyBook-AI/actions/runs/42636642712
- **20.000** rimozioni deliberate di un periodo con relazione indispensabile, **20.000 segnalate**, **0 errori** nella prova riproducibile; cinque fonti originali con **0 falsi allarmi** da questo controllo.
- **21 relazioni** applicabili alle cinque fonti.
- **15 risposte storiche LAB98** rivalutate; il nuovo controllo mette in evidenza **3 risposte** che il vecchio guard mirato considerava prive di errori, ma dalle quali mancavano relazioni importanti.
- Quattro esempi manuali di fattibilità preparati come riferimenti, chiaramente **non attribuiti a Gemini**.
- La prima esecuzione offline ha individuato un errore nel controllore: «lo studente registri il titolo entro dieci giorni» veniva confuso con «il registro specifica chi e quando». Il controllo è stato corretto distinguendo il sostantivo «registro» dal verbo «registri», prima di interrogare Gemini.

Dati: `audit/reports/lab99-relational-offline.json`.

## Test reale Gemini, prima chiamata mirata
Workflow: https://github.com/Br174/StudyBook-AI/actions/runs/42636642712
- Modello `gemini-3.5-flash-lite` tramite chiave già presente nel progetto e quota gratuita; nessun costo o upgrade aggiuntivo.
- **4 richieste HTTP**, **4 risposte JSON valide**, **4 fatti recuperati**.
- **3/4** frasi sostituite rientrano subito in righe e fascia percentuale.
- **1/4** è respinta, non per assenza del fatto ma perché il nuovo testo contiene troppe lettere: procedura 40%, **34,43%** invece della fascia 35–45%.
- Nessuna delle quattro risposte è stata inserita nella produzione.

## Un solo retry mirato sul caso respinto
Workflow: https://github.com/Br174/StudyBook-AI/actions/runs/42637049580
- UNA richiesta aggiuntiva a Gemini, **non una riscrittura della pagina**. Il modello riceve soltanto il periodo originale, la propria prima frase troppo lunga e la quantità di lettere da risparmiare.
- Frase prodotta: «Se prenotato, va reso alla scadenza pur se la lettura non è finita.»
- La nuova frase rientra in **40,25%** di riduzione e **9/9** righe. Il vecchio controllo la respingeva perché non riconosceva «reso» come equivalente a «restituito».
- Il guard è stato aggiornato sul sinonimo; la verifica è stata ripetuta offline **senza alcuna nuova chiamata Gemini**. Nessun cambiamento al testo generato.

## Verifica finale offline di tutti i cinque output Gemini
Workflow: https://github.com/Br174/StudyBook-AI/actions/runs/42637369032
- **10.000** ulteriori casi sintetici di rimozione di relazioni: **10.000 individuati**, **0 errori**.
- **5** risposte Gemini totali (4 prime + 1 correzione opzionale), **4 casi distinti**, **4/4** fatti bersaglio recuperati con esiti numerici e geometrici entro fascia.
- **0 pagine** completamente approvate per studio: restano altre omissioni in contenuti non oggetto della specifica correzione.
- Dati: `audit/reports/lab99-final-offline-recheck.json`.

| Fonte e livello | Riduzione dopo la frase corretta | Righe | Fatto reinserito | Stato |
|---|---:|---:|---|---|
| Scienze 50% | **47,91%** | **7/7** | Sole e Luna nelle maree | Conforme solo per frase/conti |
| Medicina 20% | **19,23%** | **13/13** | Emoglobina nei globuli rossi | Conforme solo per frase/conti |
| Procedura 40% | **40,25%** | **9/9** | Libro prenotato va reso anche se lettura incompleta | Conforme solo per frase/conti |
| Scienze 40% | **36,89%** | **8/8** | Eclissi non a ogni lunazione | Conforme solo per frase/conti |

### Controllo qualitativo: perché restano non pronte
- **Scienze 50%:** ancora omesse le condizioni di allineamento per le eclissi, le osservazioni ripetibili e la distinzione fra descrizione e cause.
- **Medicina 20%:** «un singolo valore non basta» è più assoluto della fonte «non basta sempre»; «contesto» non è esplicitamente «contesto clinico».
- **Procedura 40%:** il registro ancora non precisa **chi** ha ricevuto il volume **e in quale giorno**. «Pur se» è comprensibile, ma «anche se» è più naturale per lo studio.
- **Scienze 40%:** manca il confronto fra descrizione e cause delle variazioni, e «dall'inclinazione asse» è grammaticalmente errato.

La revisione puntuale, senza falsa certificazione, è in `audit/reports/lab99-qualitative-review.json`.

## Diagnosi tecnica e decisione
Il metodo di **correzione chirurgica di un periodo** è promettente: consente di recuperare un fatto mancante senza rigenerare la pagina, preservando le altre frasi e misurando precisamente percentuali e righe. Su quattro esempi specifici, il primo tentativo Gemini ne recupera tre entro budget, e **una sola** seconda richiesta recupera il quarto. Questo NON prova che il metodo funzioni su libri grandi o altre materie.

Per una implementazione futura in StudyBook AI:
1. Una prima lettura crea un inventario *reale* dei fatti e delle relazioni per ogni pagina, una volta sola per tutte le sei versioni; questa fase automatica NON è ancora stata collaudata in LAB99.
2. Una generazione normale per pagina e livello, con testo sorgente, percentuale, linee e regole essenziali, senza checklist verbosa duplicata.
3. Verifica posteriore per righe, lettere e significato. **Nessuna singola regex o assenza di alert può garantire la fedeltà semantica**; servono controllo contestuale e casi limite, senza aumentare inutilmente i tempi.
4. Una correzione mirata soltanto se appare una perdita reale, massimo un secondo tentativo per il periodo e prova di non regressione. In caso di mancata conformità **non approvare la pagina**; mantenere testo sorgente e checkpoint.
5. Correzioni grafiche deterministiche sicure (apostrofi/accents) distinte dalla riparazione semantica, con verifica che lettere e geometria non cambino.
6. Prima di promuovere: esperimenti con PDF A4 font reale, pagine originali grandi, livelli 10/20/30/40/50/riassunto, automazione del ledger, costo/tempo per pagina e resilienza Gemini 429/503.

**Conclusione:** LAB99 completata e archiviata; **4/4** riparazioni locali matematicamente conformi dopo **5** chiamate Gemini totali, **zero** pagine pienamente certificate. Nessun APK/ZIP compilato, nessuna modifica alla produzione, nessun nuovo costo.
