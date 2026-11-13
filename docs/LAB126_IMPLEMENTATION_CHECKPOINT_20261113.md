# LAB126 — Checkpoint implementazione: comprensione dell'intero libro prima della riscrittura

**13 novembre 2026 — ramo isolato:** \`trial/studybook-lab126-deep-content-recovery-20261113\`. **Stato:** codice implementato nel ramo LAB, verificato con simulazioni di controllo; NON collaudato con Gemini reale, non compilato in APK, non distribuito su Cloudflare. Nessun cambiamento a produzione, alla LAB125 installata, alla firma Android o al CORE MotorLab r40. Nessun costo aggiuntivo.

## Decisione definitiva dell'utente

La didattica **rimane quella preesistente**: Libro spiegato in parole semplici, concetti minimi e indispensabili, condizioni, negazioni, definizioni, rapporti logici, esempi necessari, formule e leggi inalterate, glossario, impaginazione e numerazione originali. Cambia soltanto il metodo di costruzione/compressione.

**Nuovo gate globale:** leggere e mappare **TUTTO il libro originale 1–N** prima di cominciare a comprimere una qualsiasi pagina. Per 44 o 2.000 pagine effettuare la lettura in blocchi del massimo volume sicuro consentito. Non alternare una pagina capita con una pagina già compressa. Solo quando tutte le mappe per pagina sono presenti e verificate iniziare la riscrittura delle pagine in ordine, usando sempre la fonte integrale e la mappa dei concetti. Ogni checkpoint conserva l'impronta della fonte e lo stato di comprensione; il singolo coordinatore di ripresa gestisce 429/503 e recupero. Pagine non conformi rimangono non studiabili e non esportabili.

**Compressione nuova:** niente righe, A4, font, larghezza carta o spazio bianco nella metrica. Contare LETTERE alfabetiche Unicode + PUNTEGGIATURA Unicode del corpo della pagina, senza spazi/a-capo, con quota indicativa finale pari al 50%. La fascia **40–60% resta privata** e si valuta sulla stessa metrica, pagina per pagina. Glossario e titoli fuori dal conteggio; numeri/riferimenti protetti didatticamente. Brevi estratti sotto soglia provvisoria di **250 unità**: semplificare senza imporre la compressione; soglia da calibrare con libri veri, mai dichiararla un valore scientificamente validato.

## Modifiche reali su GitHub

- \`src/lib/explainedStagesV126.js\`: schema della comprensione, prompt fase 1, convalida delle mappe, prompt fase 2 basato sul pilastro didattico LAB125, target lettere+punteggiatura e audit V126, istruzioni mirate per gli errori.
- \`api/explainedV126.js\` e \`worker/index.js\`: nuovo endpoint isolato \`POST /api/explained/v126\` con modalità distinte \`comprehend\` ed \`explain\`, risposte strutturate, limiti, fallback gratuito, gestione provider 429/503, rifiuto output incompleto. Nessun deploy.
- \`src/lib/explainedGeneratorV126.js\`: checkpoint progressivi della comprensione dell'intero volume, gate di 100% prima di una sola chiamata di riscrittura, blocchi a confini pagina, contesto globale limitato, riuso mappe validate alla ripresa, correzione mirata.
- \`src/AppV15.jsx\`, \`src/lib/explainedViewV122.js\`, \`src/components/StudyPhaseProgressV59.jsx\`, \`src/components/AppScreens.jsx\`, \`src/lib/studyAutoResumeV45.js\`, \`src/lib/explainedGeneratorV122.js\`: attivazione per nuovi libri della LAB126, vecchie pagine LAB122/125 conservate, fase di comprensione esplicita in UI, ripresa unica, lettura/stampa protetta, messaggi e risultati reali.
- \`scripts/test-lab126-whole-book-gate.mjs\`, \`package.json\`: test offline ripetibile con \`npm run test:lab126\`.

## Evidenze effettivamente eseguite in questa sessione

1. **8/8 file JavaScript controllati sintatticamente** tramite compilazione statica isolata V8 delle parti non JSX; per il test Node lo shebang è stato escluso dalla verifica sintattica (lo shebang resta valido in Node). **NON equivale a una compilazione Vite/Android**.
2. **Simulazione a 5 pagine**, modello/Worker sostituiti da stub: tre chiamate comprensione seguite da tre chiamate spiegazione; nessuna spiegazione prima del gate globale, checkpoint completato, nessuna duplicazione di chiamate su ripresa già completa. Simulazione passata.
3. **Simulazione avversaria a 44 pagine**, Worker risposte simulate: pagina 17 deliberatamente non compresa => **43/44** mappe, **0 richieste di compressione**; nuovo tentativo riprende soltanto pagina 17 con motivo dell'errore e poi passa **44/44** mappe e **44/44** pagine simulate. La simulazione ha consumato **9 chiamate simulate** complessive, NON chiamate vere Gemini. Gate e riuso PASS.
4. Controllo della metrica Unicode \`'A, B! 123'\` -> **4 unità** (2 lettere + 2 punteggiature). Output di una sola frase per una pagina lunga respinto per riduzione fuori soglia. Payload eliminato il vecchio target di sole lettere ed evita di divulgare la fascia privata.

**NON superati/non effettuati**: \`npm run test:lab126\` effettivamente avviato in Node nel Codespace; suite Scudo360 complete e build front-end; certificazione del Worker 126 con la vera chiave Gemini; test Android 44 pagine; misura reale di RPM/TPM/RPD/timeout, percentuali e fedeltà concettuale; PDF finale o APK/ZIP LAB126. Non dichiarare tali prove verdi. Il vecchio Worker remoto LAB124 non supporta l'endpoint V126: compilare la sola APK LAB126 senza disporre di un Worker LAB126 compatibile non produrrebbe un libro.

## Prossimo confine sicuro

Eseguire il test Node V126 su Codespace; correggere errori e integrare Scudo360 (senza toccare produzione). Verificare il nuovo endpoint soltanto in un ambiente di prova isolato esplicitamente autorizzato, accertare su PDF autentico di 44 pagine la nuova comprensione e le dimensioni per pagina prima di costruire APK+ZIP firmati. I test con mock **NON** dimostrano che Gemini rispetterà davvero il 50% e conserverà ogni concetto.
