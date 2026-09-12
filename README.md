# StudyBook AI

StudyBook AI è un'app di studio assistita dall'intelligenza artificiale progettata per trasformare libri e documenti in materiali di studio strutturati, chiari e accessibili.

## Obiettivo

Pipeline principale:

**Libro originale → analisi completa → OCR se necessario → capitoli → paragrafi → riassunti didattici → modalità DSA → libro di studio → esportazione**

## Stato attuale · v0.3

Già implementato:

- Importazione PDF e TXT
- Importazione immagini PNG, JPG/JPEG e WEBP
- Estrazione del testo digitale dai PDF
- OCR automatico nel browser per le pagine PDF con testo insufficiente
- OCR automatico delle immagini
- Riconoscimento iniziale di capitoli, sezioni e paragrafi
- Tre livelli di sintesi: Approfondito, Studio, Ripasso
- Modalità DSA con testo più arioso e leggibile
- Punti chiave, parole chiave e sezione “Da ricordare”
- Ricostruzione del libro di studio per capitoli e paragrafi
- Visualizzazione espandibile del testo originale
- Lettura vocale tramite Web Speech API
- Salvataggio locale dell'ultimo libro generato
- Esportazione PDF, DOCX, HTML, TXT e JSON
- Endpoint AI server-side con output strutturato e vincolo di fedeltà alla fonte
- Motore locale di sicurezza quando l'endpoint AI non è configurato o non risponde
- Controllo automatico della build con GitHub Actions

## OCR

L'OCR usa Tesseract.js nel browser e viene caricato solo quando serve. Nei PDF l'app prova prima a leggere il testo incorporato; le pagine con testo troppo scarso vengono renderizzate e riconosciute in italiano e inglese. Le pagine che non vengono recuperate restano indicate come “da verificare”, invece di essere considerate valide in silenzio.

## Motore AI

Il frontend prova l'endpoint `/api/summarize`. L'endpoint è già presente nel repository e richiede tre variabili d'ambiente sul servizio di pubblicazione:

- `AI_API_URL` — endpoint compatibile con il formato Chat Completions
- `AI_API_KEY` — chiave del provider
- `AI_MODEL` — identificativo del modello

Se una di queste variabili manca, l'app passa automaticamente alla modalità locale e lo dichiara nell'interfaccia.

## Affidabilità

Il motore deve usare soltanto il contenuto del documento caricato. Nessuna informazione esterna deve essere inserita nel riassunto senza essere chiaramente separata dal contenuto originale.

L'endpoint AI tratta il testo del libro come contenuto e non come istruzione, limita i batch e valida la struttura della risposta. Se il provider non restituisce un risultato valido, la generazione non viene presentata come AI.

## Prossimi passaggi

1. Collegare un provider AI live in fase di pubblicazione e verificare i riassunti su libri reali.
2. Rendere più robusto il riconoscimento di capitoli, sottocapitoli e riferimenti alle pagine.
3. Importare DOCX ed EPUB.
4. Aggiungere recupero/ripresa dei lavori lunghi e persistenza più completa.
5. Pubblicare la web app e trasformarla in PWA installabile.
6. Aggiungere strumenti di studio: domande, flashcard, quiz, mappe e modalità interrogazione.

## Repository madre

Questo repository è la versione madre ufficiale del progetto. L'esperimento Replit resta separato e potrà essere confrontato in seguito per recuperare eventuali parti utili senza sovrascrivere questa base.
