# StudyBook AI

StudyBook AI trasforma libri, documenti e fotografie di pagine in un nuovo testo di studio strutturato, fedele alla fonte e più semplice da comprendere.

## Pipeline

**Libro / PDF / DOCX / EPUB / TXT / fotografia → analisi → OCR se serve → struttura gerarchica → capitoli → sezioni → paragrafi → sintesi conservativa → DSA → controllo completezza → studio interattivo / export**

## Stato attuale · v0.11

Il progetto madre include:

- importazione PDF, DOCX, EPUB, TXT, PNG, JPG/JPEG e WEBP;
- OCR automatico per fotografie e pagine PDF senza testo digitale sufficiente;
- scanner fotografico multipagina con riordino e correzione OCR;
- riconoscimento gerarchico di Parte, Libro, Unità, Modulo, Capitolo, Sezione, Paragrafo e numerazioni annidate;
- rilevamento dell'indice/sommario per ridurre i falsi capitoli;
- riferimenti alle pagine e alle sezioni quando disponibili;
- tre livelli di sintesi: Approfondito, Studio e Ripasso;
- modalità DSA senza perdita intenzionale dei concetti;
- elaborazione in batch per capitolo, parallelismo adattivo e checkpoint persistenti;
- fallback locale se il provider AI non è disponibile;
- controllo di fedeltà su date, numeri, sigle, percentuali e formule;
- controllo finale di completezza capitolo per capitolo;
- parole chiave e parti salienti evidenziate per facilitare il colpo d'occhio;
- modifica manuale e pulsante **Migliora con AI** sul singolo paragrafo;
- Libreria locale dei libri elaborati;
- esportazione PDF, DOCX, HTML, TXT e JSON;
- nuova **Modalità Studio** a schermo intero, pensata anche per il telefono;
- tocco su una parola o selezione di una frase per aprire l'assistente di comprensione;
- azioni rapide: **Spiegami semplice**, **Che significa?**, **Fammi un esempio**, **Perché è importante?**, **Cosa devo ricordare?**, **Domanda d'esame**;
- campo libero per chiedere altro sul passaggio selezionato;
- spiegazioni sempre scritte, con pulsante **Ascolta** e opzione di lettura automatica;
- separazione esplicita tra spiegazioni ricavate dalla fonte e spiegazioni aggiuntive basate su conoscenza generale.

## Scelta text-first

Dalla v0.11 StudyBook AI non conserva più immagini, grafici o fotografie nel libro elaborato. Le fotografie restano utili come sorgente OCR, ma dopo l'estrazione il progetto salva il testo, non il materiale visuale.

Questa scelta riduce peso, memoria e complessità e concentra l'app sul suo obiettivo principale: **comprensione ed efficientamento del testo**. Tabelle leggibili, formule, dati numerici, didascalie e riferimenti testuali restano nel contenuto quando vengono estratti come testo.

## Filosofia della sintesi

StudyBook AI non deve creare un riassunto aggressivo. L'obiettivo è eliminare soprattutto ripetizioni, giri di parole, collegamenti retorici ed esempi realmente secondari, mantenendo ciò che serve a capire, ricordare o rispondere a una domanda d'esame.

Il testo generato resta vincolato alla fonte. Il controllo di completezza recupera dalla fonte le informazioni importanti che risultano mancanti invece di inventare nuovo contenuto.

## Libri molto lunghi

Per libri da centinaia di pagine il documento viene prima strutturato e poi inserito in una coda di elaborazione. I paragrafi molto lunghi vengono divisi in blocchi controllati; i batch restano nello stesso capitolo e vengono elaborati con parallelismo limitato. Dopo ogni ondata viene salvato un checkpoint nel browser.

Alla riapertura dello stesso documento, con lo stesso livello di sintesi, i paragrafi già completati possono essere riutilizzati. L'architettura è pensata anche per libri molto grandi, ma il comportamento su un libro reale di circa 500–600 pagine deve ancora essere sottoposto a stress test completo prima di considerarlo certificato.

## Assistente di comprensione

La Modalità Studio invia all'AI solo il testo selezionato, il paragrafo originale, la sintesi e il contesto di capitolo/sezione. Non invia l'intero libro per ogni domanda.

Le risposte vengono mostrate per iscritto e possono essere lette dal Text-to-Speech. Le risposte già richieste nella stessa sessione vengono memorizzate in cache per ridurre attese inutili.

Il frontend usa:

- `/api/summarize` per la generazione dei riassunti;
- `/api/refine` per il ricontrollo del singolo paragrafo;
- `/api/explain` per le spiegazioni interattive della Modalità Studio.

Per il provider AI servono variabili d'ambiente server-side:

- `AI_API_URL`
- `AI_API_KEY`
- `AI_MODEL`

Le chiavi non devono essere inserite nel frontend.

## Prossimi passi

1. Stress test controllato fino alla fascia 500–600 pagine.
2. Glossario intelligente: definizioni brevissime inline e spiegazioni più lunghe in un riquadro dedicato.
3. Portare il grassetto semantico anche negli export PDF/DOCX/HTML.
4. Rafforzare il controllo qualità strutturale e semantico sui libri reali.
5. Pubblicare la web app e trasformarla in PWA installabile.
6. Aggiungere strumenti di studio: flashcard, quiz, mappe e modalità interrogazione.

## Repository madre

Questo repository è la base ufficiale del progetto. L'esperimento Replit resta separato e potrà essere confrontato in seguito senza sovrascrivere il progetto madre.
