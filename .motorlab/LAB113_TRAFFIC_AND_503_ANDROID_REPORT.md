# StudyBook AI LAB113 · Diagnostica leggera e recupero 503 su Android
Data: 10 novembre 2026. **MotorLab CORE r40 e satellite r40 verificati**. Motore nativo StudyBook preservato.

## Scopo e principio
L'utente ha verificato che la LAB111 genera grandi blocchi naturali. L'obiettivo della LAB113 è contare **le richieste effettive** inviate dal telefono, riconoscere l'origine degli arresti 503, abbreviare soltanto le attese locali *stimate* non dichiarate dal provider e preservare i checkpoint. Non cambiare pianificatore, quote/percentuali, granularità dei blocchi, prompt Gemini o numero di generazioni. Non promettere assenza di 503, che possono essere causati da Google indipendentemente da dimensione/numero delle richieste.

## Implementazione
1. `src/lib/studyGeminiTrafficV113.js`: registro IndexedDB locale **per fingerprint del libro**, contatore cumulativo dei dispatch Android→Worker, risposte HTTP200/503/429, risposte con parti non vuote, ultimi 80 blocchi (livello, intervallo pagine, numero unità, caratteri originali, token stimati, token restituiti e tempo). **Non contiene testo originale, testi prodotti, chiavi, prompt o ID personali**. Sono possibili 2 scritture IndexedDB leggere per tentativo (invio, completamento), senza richieste esterne. Un evento 503 è contato come richiesta al Worker, non prova certa che Gemini abbia generato testo. Il contatore storico non si azzera alla riapertura dell'app.
2. `src/lib/draftFirstV57.js`: medesimo unico proprietario delle chiamate. Strumentazione nello specifico punto di `fetch(apiEndpoint('/api/editions/bulk/v51'))`, **dopo** le attese e i controlli quota. Il registro è subordinato a `VITE_STUDYBOOK_TRIAL_113=1`, e il suo fallimento non può bloccare il libro; snapshot diagnostico disponibile nel progresso. Nessun richiamo Gemini o scheduler aggiuntivo.
3. `src/components/StudyPhaseProgressV59.jsx`: pannello discreto espandibile «Registro Gemini LAB113». Contatori complessivi e ultimo blocco. La quantità di token in ingresso può essere una **stima conservativa**, non sempre un conteggio ufficiale del provider.
4. `src/lib/geminiQuotaControllerV36.js`: per **503 soltanto quando l'orario è stimato dall'app e la variante LAB113 è attiva**, sequenza locale limitata a **35, 51, 72, 103, 120 s**; vecchie pause stimate 503 della LAB111 sono ricondotte al limite di 120 s dall'originario `registeredAt` al successivo accesso. **NON accorcia mai i Retry-After/RetryInfo comunicati dal provider; NON modifica 429, TPM, RPM o limiti giornalieri**. Evita attese locali speculative di 6 minuti, ma non elimina gli overload reali.
5. `src/lib/geminiThroughputV77.js`: per la SOLA variante LAB113, la spaziatura recupero dopo 503 è 45–90 s invece di 90–180 s; altro pacing per i limiti misurati resta invariato, il flusso è sempre seriale e ha un unico proprietario.
6. Nessuna modifica alle API o al Worker, già separato `studybook-ai-trial111.brunoverlezza.workers.dev` e verificato con GET read-only 405. **Nessun deployment Cloudflare**, nessuna chiave rinnovata e nessun modello aggiuntivo.

## Test certificati e limiti delle prove
- **CI offline**: https://github.com/Br174/StudyBook-AI/actions/runs/42860612203 (**SUCCESS**): 25 asserzioni del registro su 2.004 dispatch simulati, archiviazione circolare 80 record, nessun testo/chiave in archivio, idempotenza; provider Retry-After 420 s preservato e 429 invariato. Pianificazione libri sintetici da 2.000 pagine come LAB111 (155 asserzioni), contratto Worker a sei livelli (85 asserzioni), Vite build, regressioni LAB79. **Zero nuove chiamate Gemini dei test**.
- **CI APK**: https://github.com/Br174/StudyBook-AI/actions/runs/42860892077 (**SUCCESS**): Scudo360, compilazione Gradle, firma originale pinned, verifiche identità/versione/ZIP, Worker esistente, artifact e release.
- **Rilascio**: https://github.com/Br174/StudyBook-AI/releases/tag/studybook-trial113-65eda2817940
- **Release source SHA immutabile**: `65eda2817940aab538a161409ecb29f9842eeb08`.
- **APK**: https://github.com/Br174/StudyBook-AI/releases/download/studybook-trial113-65eda2817940/StudyBook-AI-TRIAL-113.apk
- **ZIP**: https://github.com/Br174/StudyBook-AI/releases/download/studybook-trial113-65eda2817940/StudyBook-AI-TRIAL-113.zip
- **APK SHA256**: `664a1c634d1a8115f028199fa49207ff868365c416f4b10279aa14089ef9a809`, 5.737.507 byte.
- **ZIP SHA256**: `19cebd690c1c28b2f2b7d20566a38d03b1e3efa81ebc0498fad356c6576ad916`, 5.366.436 byte.
- **App ID**: `it.studybook.ai.lab.trial111`, **identico alla Prova111**, versioneName `0.3.113-prova`, versionCode `2026111301` > `2026111101`. **Aggiornamento in-place, senza cancellare le 88 pagine/264 in corso né gli altri dati**; signer originario validato. LAB79 e Prova110 sono app separate e intatte.
- Nessuna prova fisica del nuovo APK installato sullo smartphone dell'utente, nessun conteggio precedente delle sue richieste recuperabile: i nuovi contatori partono da zero per la funzione LAB113, ma i libri e le vecchie bozze rimangono. Non è un certificato di significato/percentuale di tutti i livelli; le anomalie quantitative restano un tema separato.

## Prossimo controllo utente
Installare LAB113 **sopra Prova111**, senza disinstallare e senza cancellare dati, aprire lo stesso libro, riprendere (senza avviare nuove rigenerazioni se non necessarie), espandere «Registro Gemini LAB113» e documentare numero richieste, intervallo pagine, HTTP e pause. I contatori iniziano con le nuove richieste LAB113; non inventare quelle della LAB111. Nessun nuovo schema di blocchi o incremento di quota è stato applicato.

**Gate produzione:** NON PROMOSSO a MAIN, LAST_GOOD o Worker ufficiale. Costo aggiuntivo €0. Nessuna promessa di zero 503 o di velocità di generazione indipendente dal provider.
