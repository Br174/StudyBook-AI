# StudyBook AI

StudyBook AI trasforma libri, documenti e fotografie di pagine in un nuovo testo di studio strutturato, fedele alla fonte e più semplice da comprendere.

## Pipeline

**Libro / PDF / DOCX / EPUB / TXT / fotografia → analisi → OCR se serve → struttura gerarchica → capitoli → sezioni → paragrafi → sintesi conservativa → DSA → controllo completezza → studio interattivo / export**

## Stato attuale · v0.15

Il progetto madre include:

- importazione PDF, DOCX, EPUB, TXT, PNG, JPG/JPEG e WEBP;
- OCR automatico per fotografie e pagine PDF senza testo digitale sufficiente;
- scanner fotografico multipagina con riordino e correzione OCR;
- riconoscimento gerarchico di Parte, Libro, Unità, Modulo, Capitolo, Sezione, Paragrafo e numerazioni annidate;
- parser gerarchico v10 che esclude le pagine di indice/sommario dal corpo del libro per ridurre i falsi capitoli;
- riferimenti alle pagine e alle sezioni quando disponibili;
- tre livelli di sintesi: Approfondito, Studio e Ripasso;
- modalità DSA senza perdita intenzionale dei concetti;
- elaborazione in batch per capitolo, parallelismo adattivo e checkpoint persistenti;
- fallback locale se il provider AI non è disponibile;
- controllo di fedeltà su date, numeri, sigle, percentuali e formule;
- controllo finale di completezza capitolo per capitolo;
- parole chiave e parti salienti evidenziate per facilitare il colpo d'occhio;
- glossario contestuale ricavato dalla fonte: definizioni molto brevi inline tra parentesi e definizioni più ampie in un riquadro laterale;
- termini del glossario cliccabili in Modalità Studio, con apertura immediata della definizione già ricavata dal libro senza una nuova chiamata AI;
- modifica manuale e pulsante **Migliora con AI** sul singolo paragrafo;
- Libreria locale dei libri elaborati;
- esportazione PDF, DOCX, HTML, TXT e JSON;
- grassetto semantico e glossario contestuale anche negli export PDF, DOCX e HTML, con disposizione laterale quando il formato lo consente;
- nuova **Modalità Studio** a schermo intero, pensata anche per il telefono;
- tocco su una parola o selezione di una frase per aprire l'assistente di comprensione;
- azioni rapide: **Spiegami semplice**, **Che significa?**, **Fammi un esempio**, **Perché è importante?**, **Cosa devo ricordare?**, **Domanda d'esame**;
- campo libero per chiedere altro sul passaggio selezionato;
- spiegazioni sempre scritte, con pulsante **Ascolta** e opzione di lettura automatica;
- separazione esplicita tra definizioni ricavate dalla fonte e spiegazioni aggiuntive basate su conoscenza generale.

## Scelta text-first

Dalla v0.11 StudyBook AI non conserva più immagini, grafici o fotografie nel libro elaborato. Le fotografie restano utili come sorgente OCR, ma dopo l'estrazione il progetto salva il testo, non il materiale visuale.

Questa scelta riduce peso, memoria e complessità e concentra l'app sul suo obiettivo principale: **comprensione ed efficientamento del testo**. Tabelle leggibili, formule, dati numerici, didascalie e riferimenti testuali restano nel contenuto quando vengono estratti come testo.

## Filosofia della sintesi

StudyBook AI non deve creare un riassunto aggressivo. L'obiettivo è eliminare soprattutto ripetizioni, giri di parole, collegamenti retorici ed esempi realmente secondari, mantenendo ciò che serve a capire, ricordare o rispondere a una domanda d'esame.

Il testo generato resta vincolato alla fonte. Il controllo di completezza recupera dalla fonte le informazioni importanti che risultano mancanti invece di inventare nuovo contenuto.

## Glossario contestuale

Il glossario automatico segue una regola conservativa: un termine tecnico viene definito automaticamente solo quando il significato può essere ricavato dal testo del libro stesso.

Se la definizione è molto breve viene mostrata direttamente tra parentesi alla prima occorrenza utile. Se richiede una frase più ampia viene mostrata in un riquadro laterale associato al passaggio. In Modalità Studio il termine resta cliccabile e apre subito la definizione già disponibile.

Se il libro usa un termine specialistico senza spiegarlo abbastanza, StudyBook AI non inventa una definizione nel glossario. L'utente può comunque toccare il termine e chiedere una spiegazione all'assistente; quando la risposta usa conoscenza generale esterna alla fonte viene indicata come spiegazione aggiuntiva.

## Libri molto lunghi

Per libri da centinaia di pagine il documento viene prima strutturato e poi inserito in una coda di elaborazione. I paragrafi molto lunghi vengono divisi in blocchi controllati; i batch restano nello stesso capitolo e vengono elaborati con parallelismo limitato. Dopo ogni ondata viene salvato un checkpoint nel browser.

Alla riapertura dello stesso documento, con lo stesso livello di sintesi, i paragrafi già completati possono essere riutilizzati.

Il repository esegue ora in CI uno **stress test sintetico da 600 pagine** sulla pipeline testuale. Il test corrente genera 80 capitoli, 240 sezioni e 600 paragrafi, verifica l'esclusione dell'indice, l'ordine e gli intervalli pagina, la conservazione dei marcatori di contenuto, la ricostruzione senza perdita di paragrafi, il glossario contestuale, la fedeltà dei dati numerici, il progresso monotono e limiti di tempo/memoria. Sul runner GitHub del test di riferimento la pipeline locale ha completato il parsing in circa 103 ms e la ricostruzione in circa 506 ms, con circa 9,9 MB di crescita heap.

Questo risultato certifica la **robustezza del percorso testuale sintetico** nella fascia 600 pagine, non un libro reale completo con OCR e provider AI remoto. La prova reale su un volume grande, soprattutto se scansionato, resta un test distinto da eseguire prima di dichiarare certificazione completa sul campo.

## Assistente di comprensione

La Modalità Studio invia all'AI solo il testo selezionato, il paragrafo originale, la sintesi e il contesto di capitolo/sezione. Non invia l'intero libro per ogni domanda.

Le risposte vengono mostrate per iscritto e possono essere lette dal Text-to-Speech. Le risposte già richieste nella stessa sessione vengono memorizzate in cache per ridurre attese inutili.

Il frontend usa:

- `/api/summarize` per la generazione dei riassunti e del glossario contestuale ricavato dalla fonte;
- `/api/refine` per il ricontrollo del singolo paragrafo;
- `/api/explain` per le spiegazioni interattive della Modalità Studio.

Per il provider AI servono variabili d'ambiente server-side:

- `AI_API_URL`
- `AI_API_KEY`
- `AI_MODEL`

Le chiavi non devono essere inserite nel frontend.

## Verifica continua

Ogni push su `main` esegue automaticamente:

1. installazione delle dipendenze;
2. controllo sintattico delle API AI;
3. stress test sintetico della pipeline testuale da 600 pagine;
4. build di produzione Vite.

In questo modo una regressione su gerarchia, perdita di paragrafi, fedeltà minima o prestazioni di base blocca la build prima di essere considerata valida.

## Prossimi passi

1. Test reale con un volume ampio, includendo un caso PDF digitale e un caso OCR/scansione.
2. Rafforzare i retry controllati dei batch AI e la gestione dei singoli blocchi eccezionalmente lunghi.
3. Rifinire la Modalità Studio e la gestione persistente delle spiegazioni salvate.
4. Ridurre ulteriormente il peso iniziale della web app con caricamento differito dei moduli pesanti di OCR/export.
5. Pubblicare la web app e trasformarla in PWA installabile.
6. Aggiungere strumenti di studio: flashcard, quiz, mappe e modalità interrogazione.

## Repository madre

Questo repository è la base ufficiale del progetto. L'esperimento Replit resta separato e potrà essere confrontato in seguito senza sovrascrivere il progetto madre.


### Scanner persistente v0.14

Le raccolte scanner multipagina incomplete vengono salvate localmente in IndexedDB: foto sorgente, ordine delle pagine e testo OCR possono essere ripristinati dopo la chiusura dell'app. Le foto servono solo a completare l'OCR della raccolta e non vengono incorporate nel libro di studio finale. Le sessioni scanner locali scadono dopo 30 giorni.


### Protezione spazio scanner v0.15

Le fotografie delle raccolte scanner vengono ottimizzate prima del salvataggio locale: StudyBook AI riduce in modo conservativo la risoluzione e usa JPEG ad alta qualità quando questo produce un risparmio reale, mantenendo una dimensione adatta all’OCR. L’app controlla inoltre la quota di archiviazione concessa dal browser/app, segnala i livelli di attenzione e blocca una nuova pagina solo quando manca il margine minimo necessario per salvarla in sicurezza.

Quando una raccolta scanner è stata trasformata con successo in un libro e il libro è stato salvato nella Libreria, le fotografie temporanee della raccolta vengono cancellate automaticamente; nel libro finale resta il testo, non l’archivio fotografico.
