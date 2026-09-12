# StudyBook AI

StudyBook AI trasforma libri, documenti e fotografie di pagine in un nuovo libro di studio strutturato, fedele alla fonte e più semplice da studiare.

## Pipeline

**Libro / PDF / DOCX / EPUB / TXT / fotografia → analisi → OCR se serve → struttura gerarchica → capitoli → sezioni → paragrafi → sintesi conservativa → DSA → controllo completezza → ricostruzione → PDF/DOCX/HTML/TXT/JSON**

## Stato attuale · v0.10

Il progetto madre include:

- importazione PDF, DOCX, EPUB, TXT, PNG, JPG/JPEG e WEBP;
- OCR automatico per fotografie e pagine PDF senza testo digitale sufficiente;
- scanner fotografico multipagina con cartellina, riordino, eliminazione e correzione manuale del testo OCR;
- riconoscimento gerarchico di Parte, Libro, Unità, Modulo, Capitolo, Sezione, Paragrafo e numerazioni come `1`, `1.2`, `1.2.3`, numeri romani e lettere;
- rilevamento dell'indice/sommario per ridurre i falsi capitoli;
- conservazione dei riferimenti alle pagine e alle sezioni quando disponibili;
- tre livelli di sintesi: Approfondito, Studio e Ripasso;
- modalità DSA che conserva i concetti ma cambia la forma espositiva;
- modifica manuale del testo originale e dei riassunti;
- pulsante **Migliora con AI** sul singolo paragrafo;
- elaborazione in batch che non attraversano i confini dei capitoli;
- parallelismo adattivo: normalmente 3 gruppi, fino a 4 quando il servizio è stabile, riduzione automatica in caso di errori;
- checkpoint persistenti e ripresa dei lavori lunghi senza ricominciare dal primo paragrafo;
- fallback locale se l'AI non è disponibile;
- controllo di fedeltà su date, numeri, sigle, percentuali e formule;
- controllo finale di completezza capitolo per capitolo: le frasi della fonte che sembrano didatticamente essenziali e non risultano coperte vengono recuperate direttamente dalla fonte, senza inventare contenuto;
- punti chiave, parole chiave e sezione “Da ricordare”;
- esportazione PDF, DOCX, HTML, TXT e JSON e funzione Stampa;
- PDF di studio con copertina, indice, capitoli, numerazione e modalità DSA;
- build automatica con GitHub Actions.

## Filosofia della sintesi

StudyBook AI non deve creare un riassunto aggressivo. L'obiettivo è eliminare soprattutto ripetizioni, giri di parole, collegamenti retorici ed esempi realmente secondari, mantenendo ciò che serve a capire, ricordare o rispondere a una domanda d'esame.

Il testo generato resta vincolato alla fonte. Il controllo di completezza lavora localmente e, quando recupera un'informazione, reinserisce la frase della fonte invece di produrre una nuova affermazione.

## Libri molto lunghi

Per libri da centinaia di pagine il documento viene prima strutturato e poi inserito in una coda di elaborazione. I paragrafi molto lunghi vengono divisi in blocchi controllati; i batch restano nello stesso capitolo e vengono elaborati con parallelismo limitato. Dopo ogni ondata viene salvato un checkpoint nel browser.

Alla riapertura dello stesso documento, con lo stesso livello di sintesi, i paragrafi già completati possono essere riutilizzati. Al termine, un controllo di completezza viene eseguito capitolo per capitolo prima della ricostruzione finale.

L'architettura è progettata per documenti molto grandi, ma il comportamento su un libro reale di circa 600 pagine va ancora sottoposto a uno stress test completo prima di considerarlo certificato.

## Motore AI

Il frontend usa `/api/summarize` e `/api/refine`. Per il provider AI servono variabili d'ambiente server-side:

- `AI_API_URL`
- `AI_API_KEY`
- `AI_MODEL`

Le chiavi non devono essere inserite nel frontend. Se il provider non è configurato o fallisce, StudyBook AI continua con il motore locale di sicurezza e lo dichiara nell'interfaccia.

## Prossimi passi

1. Stress test controllato con libri sintetici e reali di grandi dimensioni, fino alla fascia 500–600 pagine.
2. Rafforzare ulteriormente i controlli di qualità strutturale e semantica senza rendere i riassunti troppo lunghi.
3. Rendere più visibile nell'interfaccia lo stato dei checkpoint, dei capitoli completati e dei controlli di qualità.
4. Completare e rifinire la Libreria persistente dei libri elaborati.
5. Pubblicare la web app e trasformarla in PWA installabile.
6. Aggiungere strumenti di studio: domande, flashcard, quiz, mappe, glossario e modalità interrogazione.

## Repository madre

Questo repository è la base ufficiale del progetto. L'esperimento Replit resta separato e potrà essere confrontato in seguito senza sovrascrivere il progetto madre.
