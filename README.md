# StudyBook AI

StudyBook AI è un'app di studio assistita dall'intelligenza artificiale progettata per trasformare libri e documenti in materiali di studio strutturati, chiari e accessibili.

## Obiettivo

Pipeline principale:

**Libro originale → analisi completa → capitoli → paragrafi → riassunti didattici → modalità DSA → libro di studio → esportazione**

## Stato attuale · v0.2

Già implementato:

- Importazione PDF e TXT
- Estrazione del testo dai PDF
- Riconoscimento automatico iniziale di capitoli e paragrafi
- Segnalazione delle pagine con poco testo che potrebbero richiedere OCR
- Tre livelli di sintesi: Approfondito, Studio, Ripasso
- Modalità DSA con testo più arioso e leggibile
- Punti chiave, parole chiave e sezione “Da ricordare”
- Ricostruzione del libro di studio per capitoli e paragrafi
- Visualizzazione espandibile del testo originale
- Lettura vocale tramite Web Speech API
- Salvataggio locale dell'ultimo libro generato
- Esportazione PDF, DOCX, HTML, TXT e JSON
- Motore locale di sicurezza quando l'endpoint AI non è ancora configurato

## Affidabilità

Il motore deve usare soltanto il contenuto del documento caricato. Nessuna informazione esterna deve essere inserita nel riassunto senza essere chiaramente separata dal contenuto originale.

Quando l'endpoint AI non è disponibile, StudyBook AI non finge di aver usato un modello: passa a una sintesi locale estrattiva e la segnala chiaramente nell'interfaccia.

## Prossimi passaggi

1. Collegamento di un endpoint AI server-side con output strutturato e vincolo di fedeltà alla fonte.
2. OCR reale per PDF scansionati e immagini.
3. Miglioramento del riconoscimento di capitoli, sottocapitoli e riferimenti alle pagine.
4. Importazione DOCX ed EPUB.
5. Test automatici e controllo build continuo.
6. Pubblicazione web e successiva versione installabile/PWA.

## Repository madre

Questo repository è la versione madre ufficiale del progetto. L'esperimento Replit resta separato e potrà essere confrontato in seguito per recuperare eventuali parti utili senza sovrascrivere questa base.
