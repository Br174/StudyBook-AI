# StudyBook AI

StudyBook AI è un'app di studio assistita dall'intelligenza artificiale progettata per trasformare libri, documenti e fotografie di pagine in materiali di studio strutturati, chiari e accessibili.

## Obiettivo

Pipeline principale:

**Libro originale / fotografia → analisi completa → OCR se necessario → capitoli → paragrafi → riassunti didattici → modalità DSA → libro di studio → PDF pronto da scaricare**

## Stato attuale · v0.4

Già implementato:

- Importazione PDF e TXT
- Importazione immagini PNG, JPG/JPEG e WEBP
- Scanner con fotocamera integrata nell'app web
- Fotocamera posteriore preferita sui dispositivi mobili
- Fallback automatico alla fotocamera nativa del dispositivo quando la camera integrata non è disponibile
- Flusso automatico Scanner → OCR → riassunto → modalità DSA → PDF
- Estrazione del testo digitale dai PDF
- OCR automatico nel browser per le pagine PDF con testo insufficiente
- OCR automatico delle immagini e delle fotografie
- Riconoscimento iniziale di capitoli, sezioni e paragrafi
- Tre livelli di sintesi: Approfondito, Studio, Ripasso
- Modalità DSA con testo più arioso e leggibile
- Punti chiave, parole chiave e sezione “Da ricordare”
- Ricostruzione del libro di studio per capitoli e paragrafi
- Visualizzazione espandibile del testo originale
- Lettura vocale tramite Web Speech API
- Salvataggio locale dell'ultimo libro generato
- Esportazione PDF, DOCX, HTML, TXT e JSON
- PDF rilegato con copertina, indice, capitoli, riquadri “Da ricordare” e numerazione delle pagine
- Endpoint AI server-side con output strutturato e vincolo di fedeltà alla fonte
- Motore locale di sicurezza quando l'endpoint AI non è configurato o non risponde
- Controllo automatico della build con GitHub Actions

## Scanner fotografico

Il pulsante **Scanner** apre la fotocamera direttamente nell'interfaccia quando il browser lo consente. L'utente inquadra la pagina del libro e preme **Scatta e crea PDF**. Da quel momento il flusso è automatico: la fotografia viene letta con OCR, trasformata in testo, organizzata, riassunta, adattata alla modalità DSA e ricostruita come libro di studio. Al termine compare il pulsante **Scarica PDF pronto**.

Su dispositivi o browser che non consentono l'anteprima diretta della fotocamera, StudyBook AI usa come fallback la fotocamera nativa tramite acquisizione immagine.

## OCR

L'OCR usa Tesseract.js nel browser e viene caricato solo quando serve. Nei PDF l'app prova prima a leggere il testo incorporato; le pagine con testo troppo scarso vengono renderizzate e riconosciute in italiano e inglese. Le pagine che non vengono recuperate restano indicate come “da verificare”, invece di essere considerate valide in silenzio.

## Motore AI

Il frontend prova l'endpoint `/api/summarize`. L'endpoint è già presente nel repository e richiede tre variabili d'ambiente sul servizio di pubblicazione:

- `AI_API_URL` — endpoint compatibile con il formato Chat Completions
- `AI_API_KEY` — chiave del provider
- `AI_MODEL` — identificativo del modello

Se una di queste variabili manca, l'app passa automaticamente alla modalità locale e lo dichiara nell'interfaccia.

## Affidabilità

Il motore deve usare soltanto il contenuto del documento caricato o della pagina fotografata. Nessuna informazione esterna deve essere inserita nel riassunto senza essere chiaramente separata dal contenuto originale.

L'endpoint AI tratta il testo del libro come contenuto e non come istruzione, limita i batch e valida la struttura della risposta. Se il provider non restituisce un risultato valido, la generazione non viene presentata come AI.

## Prossimi passaggi

1. Collegare un provider AI live in fase di pubblicazione e verificare i riassunti su libri reali.
2. Aggiungere scansione multipagina per fotografare più pagine consecutive e rilegarle in un unico PDF.
3. Rendere più robusto il riconoscimento di capitoli, sottocapitoli e riferimenti alle pagine.
4. Importare DOCX ed EPUB.
5. Aggiungere recupero/ripresa dei lavori lunghi e persistenza più completa.
6. Pubblicare la web app e trasformarla in PWA installabile.
7. Aggiungere strumenti di studio: domande, flashcard, quiz, mappe e modalità interrogazione.

## Repository madre

Questo repository è la versione madre ufficiale del progetto. L'esperimento Replit resta separato e potrà essere confrontato in seguito per recuperare eventuali parti utili senza sovrascrivere questa base.
