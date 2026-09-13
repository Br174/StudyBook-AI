# StudyBook AI

StudyBook AI trasforma libri, documenti e fotografie di pagine in un nuovo testo di studio strutturato, fedele alla fonte e più semplice da comprendere.

## Pipeline

**Libro / PDF / DOCX / EPUB / TXT / fotografia → analisi → OCR se serve → struttura gerarchica → capitoli → sezioni → paragrafi → sintesi conservativa → DSA → controllo completezza → studio interattivo / export**

## Stato attuale · v1.0

La prima release completa include:

- importazione PDF, DOCX, EPUB, TXT, PNG, JPG/JPEG e WEBP;
- OCR automatico per fotografie e pagine PDF senza testo digitale sufficiente;
- scanner fotografico multipagina persistente, con riordino, correzione OCR, ripresa dopo chiusura e protezione dello spazio locale;
- riconoscimento gerarchico di Parte, Libro, Unità, Modulo, Capitolo, Sezione, Paragrafo e numerazioni annidate;
- esclusione automatica delle pagine di indice/sommario dal corpo del libro;
- riferimenti alle pagine e alle sezioni quando disponibili;
- tre livelli di sintesi: Approfondito, Studio e Ripasso;
- modalità DSA che conserva gli stessi concetti utili con formulazione più accessibile;
- elaborazione in batch per capitolo, parallelismo adattivo, retry controllati e checkpoint persistenti;
- suddivisione e ricomposizione sicura dei paragrafi eccezionalmente lunghi;
- fallback locale quando il provider AI non è disponibile;
- controllo di fedeltà su date, numeri, sigle, percentuali e formule;
- controllo finale di completezza capitolo per capitolo;
- parole chiave e parti salienti evidenziate con grassetto semantico;
- glossario contestuale ricavato dalla fonte, con definizioni brevi inline e definizioni più ampie in riquadri dedicati;
- modifica manuale e pulsante **Migliora con AI** sul singolo paragrafo;
- Libreria locale dei libri elaborati;
- esportazione PDF, DOCX, HTML, TXT e JSON;
- **Modalità Studio** a schermo intero per telefono e desktop;
- tocco su parola o selezione di frase con assistente di comprensione e sei azioni rapide;
- spiegazioni sempre scritte, lettura TTS opzionale e lettura automatica configurabile;
- cache persistente locale delle spiegazioni AI per 30 giorni, oltre alla cache della sessione;
- strumenti di studio source-grounded: **Flashcard, Quiz, Mappa concettuale e Interrogazione orale**;
- PWA installabile con manifest, service worker e prompt di installazione quando supportato dal browser.

## Scelta text-first

StudyBook AI non conserva immagini, grafici o fotografie nel libro elaborato. Le fotografie restano utili come sorgente OCR e, finché una raccolta scanner è incompleta, possono essere conservate localmente per permettere la ripresa del lavoro. Dopo la creazione e il salvataggio del libro finale, le immagini temporanee vengono eliminate.

Questa scelta riduce peso, memoria e complessità e concentra l'app sul suo obiettivo principale: **comprensione ed efficientamento del testo**. Tabelle leggibili, formule, dati numerici, didascalie e riferimenti testuali restano nel contenuto quando vengono estratti come testo.

## Filosofia della sintesi

StudyBook AI non crea un riassunto aggressivo. L'obiettivo è eliminare soprattutto ripetizioni, giri di parole, collegamenti retorici ed esempi realmente secondari, mantenendo ciò che serve a capire, ricordare o rispondere a una domanda d'esame.

Il testo generato resta vincolato alla fonte. Il controllo di completezza recupera dalla fonte le informazioni importanti che risultano mancanti invece di inventare nuovo contenuto. In caso di dubbio, il sistema privilegia la conservazione dell'informazione utile allo studio.

## Glossario e assistente di comprensione

Il glossario automatico segue una regola conservativa: un termine tecnico viene definito automaticamente solo quando il significato può essere ricavato dal testo del libro stesso.

Se il libro usa un termine specialistico senza spiegarlo abbastanza, l'utente può chiedere una spiegazione all'assistente. Quando la risposta usa conoscenza generale esterna alla fonte viene indicata esplicitamente come spiegazione aggiuntiva.

La Modalità Studio invia all'AI solo la selezione, il paragrafo e il contesto necessario di capitolo/sezione. Non invia l'intero libro per ogni domanda. Le risposte sono mostrate per iscritto e possono essere lette dal Text-to-Speech. Le risposte già generate vengono riutilizzate dalla cache locale quando ancora valide.

Il frontend usa:

- `/api/summarize` per la generazione delle sintesi e del glossario contestuale;
- `/api/refine` per il ricontrollo del singolo paragrafo;
- `/api/explain` per le spiegazioni interattive della Modalità Studio.

Per il provider AI servono variabili d'ambiente server-side:

- `AI_API_URL`
- `AI_API_KEY`
- `AI_MODEL`

Le chiavi non devono essere inserite nel frontend o nel repository.

## Libri molto lunghi

Per libri da centinaia di pagine il documento viene prima strutturato e poi inserito in una coda di elaborazione. I paragrafi molto lunghi vengono divisi in blocchi controllati; i batch restano nello stesso capitolo e vengono elaborati con parallelismo limitato. Dopo ogni ondata viene salvato un checkpoint nel browser.

Alla riapertura dello stesso documento, con lo stesso livello di sintesi, i paragrafi già completati possono essere riutilizzati. Anche l'OCR di PDF molto grandi e le raccolte scanner hanno sistemi di ripresa dedicati.

Il repository esegue in CI uno **stress test sintetico da 600 pagine** sulla pipeline testuale. Il test verifica gerarchia, esclusione dell'indice, ordine e intervalli pagina, ricostruzione senza perdita di paragrafi, glossario, fedeltà dei dati numerici, progresso monotono e limiti di tempo/memoria.

Questo risultato certifica la robustezza del percorso testuale sintetico, non equivale a una certificazione sul campo con un vero volume scannerizzato da 600 pagine e un provider AI remoto.

## PWA e uso sul telefono

La release v1.0 include manifest PWA, service worker e prompt di installazione. Le API AI restano sempre network-only: il service worker non mette in cache le chiamate `/api/`. Il guscio dell'app e le risorse statiche già visitate possono invece essere riutilizzati dal browser per rendere più stabile l'avvio.

L'installabilità effettiva dipende anche dal browser e dall'hosting HTTPS e va verificata sul dispositivo di destinazione.

## Verifica continua

Ogni push su `main` esegue automaticamente:

1. installazione delle dipendenze e controllo sintattico delle tre API AI;
2. test di resilienza AI e gestione dei paragrafi lunghi;
3. test checkpoint OCR e persistenza/protezione storage dello scanner;
4. test Flashcard/Quiz/Mappa/Interrogazione e modello della cache persistente delle spiegazioni;
5. test del guscio PWA;
6. stress test sintetico della pipeline testuale da 600 pagine;
7. build di produzione Vite.

Una regressione rilevata da questi controlli blocca la build prima che una versione venga considerata build-verificata.

## Validazione finale sul campo

Il codice della v1.0 è pensato come prima release completa. Prima di considerarla certificata nell'uso reale restano verifiche esterne al CI:

1. prova con un PDF digitale universitario ampio;
2. prova Android con un volume realmente scannerizzato/OCR e chiusura-ripresa dell'app;
3. verifica del provider AI e delle variabili server-side sull'hosting di produzione;
4. verifica dell'installazione PWA e dei flussi fotocamera/storage sul browser Android scelto.

Questi sono test di esercizio reale, non funzioni mancanti del codice.

## Repository madre

Questo repository è la base ufficiale del progetto. L'esperimento Replit resta separato e potrà essere confrontato in seguito senza sovrascrivere il progetto madre.
