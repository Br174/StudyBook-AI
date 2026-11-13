# StudyBook AI — LAB125: collaudo e checkpoint MotorLab
**Data:** 13 novembre 2026
**Ramo LAB isolato:** `trial/studybook-lab125-full-regression-didactics-20261113`
**Stato:** correzioni salvate e test deterministici superati; INTEGRAZIONE LIVE NON CERTIFICATA. Nessuna APK compilata né Worker pubblicato; zero nuove chiamate a Gemini e zero costi aggiuntivi.

## Test e prove eseguite
- **LAB125 hardening: 51/51**. Test diretti sul codice sorgente GitHub con Worker/Gemini simulati: riduzione 40–60% individuale su pagine >5 righe, semplificazione pagine corte, testo/grammatica di base, pianificazione blocchi, stima token JSON, recupero pagina 17 con altre 43 pagine preservate, 429/503, pausa Retry-After, pagina originale bianca, lettura progressiva, PDF incompleto respinto, vecchio checkpoint globale LAB124 invalidato per lettura ed export.
- **LAB125 didattica: 35/35**. Matrice avversariale su concetti del PDF: Hart, Kelsen, validità/efficacia, sanzione/precetto, teorie, può/deve, negazioni, eccezioni, riferimenti normativi plurali, definizioni di glossario contraddittorie e pagine brevi. Prove con uscite appositamente manipolate: NON misurano l'accuratezza di Gemini reale.
- **Regressione LAB122 precedente: 15/15**, rieseguita con gli stessi moduli LAB125: glossario, segmenti, formule, citazioni, struttura, Worker simulato, checkpoint.
- **101/101 asserzioni passate**, con sovrapposizioni fra suite. Risultato valido solo per i casi testati, non garanzia di assenza assoluta di errori.

## PDF originale controllato davvero
File: `Filosofia del diritto appunti+sbobine.pdf`. SHA-256 `bfd3681c48a23f45595bde3cfed8e9e1275194fa00255e27245e9f548d4904db`.
- 44 pagine, 387,5 KiB; 116.779 caratteri testuali e 95.691 lettere.
- 43 pagine oltre cinque righe; pagina 44 con tre righe, semplificazione obbligatoria senza fascia percentuale.
- Sette estrazioni PyMuPDF, mediana circa 67 ms **solo nel container**, non misura di performance Android.
- Su testo originale i blocchi candidati a 40k sono **1–16, 17–30 e 31–44** (preflight numerico con stima overhead JSON e un segmento/pagina), non sono risposte Gemini reali. La segmentazione effettiva dell'app può cambiare il numero.
- Studio di carico locale su testo sintetico fino a 2.000 pagine: nessuna pagina persa, preflight ottimizzato tramite cache. Non è un collaudo del modello su un autentico libro di 2.000 pagine.

## Correzioni nel ramo LAB125
1. Limiti trasporto candidata: 40.000 caratteri nel planner e 42.000 nel Worker di test. Input JSON serializzato stimato localmente e output previsto, pagine fisiche mai spezzate. Profilo resta **CANDIDATE** sino al test reale del provider.
2. Gemini vede solo l'obiettivo del 50%; banda di ammissione privata 40–60% **per singola pagina** con più di cinque righe, confronto su conteggi interi esatti.
3. Pagine ≤5 righe: riscrittura in parole semplici obbligatoria, niente vincolo percentuale. Pagine originali senza testo conservate nella numerazione.
4. Fedeltà: rilevazione mirata di inversioni concettuali, autori, negazioni, obblighi/facoltà, fonti e false definizioni; controllo grammaticale prudente di accenti/punteggiatura/caratteri corrotti. Le verifiche lessicali non devono respingere automaticamente vere parafrasi.
5. Checkpoint: rigenerazione soltanto delle pagine non conformi, ripresa tramite unico scheduler; 429/503 rispettano i limiti gratuiti senza raffiche o riduzione arbitraria dei blocchi; approvazioni già salvate non sono rigenerate.
6. **Studio progressivo Android** delle pagine pronte anche dopo una pagina in correzione. **PDF, scarico, stampa** disponibili soltanto con tutte le pagine conformi.
7. Sicurezza sulla migrazione: vecchi flag LAB124 `ready/complete` vengono rivalutati **localmente**, per impedire export/lettura fuori fascia; nessuna chiamata Gemini in tale controllo.
8. Stato e avvisi di qualità mostrati **per pagina**; niente dichiarazione di certificazione semantica assoluta.

## Gate ancora APERTI prima di una APK
- Nessuna generazione **Gemini reale** delle 44 pagine: non sono verificati token effettivamente consumati, quota gratuita, durata, JSON completo e qualità dell'output.
- Worker online precedentemente risultato non allineato: GET `/api/explained/v122` -> HTTP 404, mentre il codice del ramo dovrebbe rispondere 405 per GET. Non è stato effettuato deployment né verificato un POST end-to-end.
- Nessuna compilazione nativa Android / test fisico dell'APK, ripresa dopo sospensione/riavvio né render e stampa del PDF completo prodotto da Gemini.
- Un audit euristico non prova che ogni frase o ogni voce del glossario sia semanticamente corretta: occorre prova sul materiale **generato**, non solo su esempi avversariali predefiniti.
- Vincoli €0, firma e package originali, ramo LAB124 e APK installata invariati.

**Decisione MotorLab:** non compilare APK finché i gate richiesti non sono stati chiusi con evidenza. Le suite deterministiche verdi NON vanno indicate come collaudo finale completo.