# MotorLab / StudyBook AI LAB130 — checkpoint operativo
Data: 14 novembre 2026 · Release MotorLab centrale/satellite: 2026.10.29-r40

## Identità e ambito autorizzato
- Repository privato `Br174/StudyBook-AI`
- LAB130: `trial/studybook-lab130-on-demand-study-formats-20261114`
- Base esatta LAB129 (APK installata): `98da6eeb1432f143820ffb81499f180ef52d6221`
- App di prova invariata `it.studybook.ai.lab.trial111`
- Firma Android obbligatoria immutata: SHA-256 `D7BB9315C9C4351872495478610C484725086E2BABBC04BEC65EC823455FBDCC`.
- Versione LAB130 prevista: `versionCode=2026113001`, `versionName=0.3.130-prova.1`.
- Nessuna mutazione di main/produzione o dell'API Gemini esistente; il Worker trial124 riceverà un endpoint aggiuntivo solo dopo QA. Nessun servizio a pagamento deliberatamente abilitato.
- Approvazione LAB130 dell'utente: a) pulsanti rapidi e feedback; b) lettori PDF esterni Android; c) Word DOCX/eBook EPUB/altre esportazioni e importazioni; d) flashcard/quiz/mappa/orale create davvero da Gemini **solo su clic**.

## Bug confermati
1. LAB129 `StudyMode.jsx` costruiva subito domande con `studyTools.js` regex locali, anche prive di senso (es. «perché» e «Campania o »). Non era Gemini.
2. `AppScreens.jsx` nascondeva DOCX/EPUB/HTML/ODT/RTF/TXT per `explainedV122`, pur essendo presenti exporter e import da PDF/DOCX/EPUB/RTF/ODT/TXT/HTML/Markdown.
3. `exportExplainedPdfV122.js` usava `deliverBlob` senza `preferOpen`, entrando nello Share Sheet invece del selettore lettori PDF. La vista originale aveva un routing diverso; LAB130 separa `pdf-open` e `pdf`.
4. Il PDF spiegato veniva rielaborato a ogni pressione. Ora cache della Blob in memoria sullo stesso snapshot verificato. Stato UI immediato quando occorre generare un documento.

## Codice applicativo implementato
- `src/lib/studyToolsV130Policy.js`: contratto `lab130-gemini-on-demand-v1`, ambito 1 pagina/paragrafo o capitolo/libro, limite 14k caratteri/richiesta e 12k per singolo passaggio, audit evidence letterale dal testo originale, scarto domande malformate, incoerenti o senza ancoraggio lessicale, quiz 3 opzioni.
- `api/studyToolsV130.js`: endpoint POST `/api/study-tools/v130`, 405 HEAD con `X-StudyBook-Tools-Contract: lab130`. Gemini gratuito e modello allowlist già esistente. JSON strutturato, una richiesta deliberata, massimo 8 items accettati, errori 429/503 espliciti. Fallback provider 503 solo se già autorizzato/configurato; **nessuna domanda artificiale** durante un problema del provider. Input libro trattato come fonte, non istruzioni. Questo endpoint **NON è ancora distribuito**.
- `worker/index.js`: routing al nuovo endpoint senza cambiare quelli LAB127.
- `src/lib/studyToolsOnDemandV130.js`: selezione per paragrafo, capitolo, intero libro (campionamento esplicito e distribuito quando eccede i limiti, non fingere copertura integrale). Ricezione e seconda validazione locale. Cache IndexedDB persistente per libro, attività, ambito e impronta fonte; nulla è generato finché l'utente non preme **Crea**/**Rigenera**.
- `src/components/StudyMode.jsx`, `src/studyMode.css`: pulsanti on-demand, note sugli estratti, feedback progressi/errori, uso UI Flashcard Quiz Mappa Interrogazione già esistente. Gli algoritmi locali non sono più il generatore delle quattro attività; nessuna chiamata su cambio tab.
- `src/lib/fileDelivery.js`: integra `@capacitor-community/file-opener@8.0.1` (MIT, compatibile Capacitor 8) con `openWithDefault:false` per mostrare scelta di app compatibili. Preserva `@capacitor/file-viewer` come fallback tecnico e il pannello Share per il download.
- `src/lib/exportExplainedPdfV122.js`, `src/lib/exportersV12.js`, `src/AppV15.jsx`: formato `pdf-open` separato dal formato `pdf`. Originale PDF aperto con il proprio blob; per il Libro spiegato PDF generato con funzione esistente e `preferOpen`, opzionale PDF provvisorio con pagine non rielaborate etichettate. Il PDF già generato viene riutilizzato se la versione è invariata.
- `src/components/AppScreens.jsx`: mostra DOCX, EPUB, HTML, ODT, RTF, Markdown, TXT, PDF quando il Libro spiegato è completo; finché è incompleto lascia PDF provvisorio e **disabilita gli altri formati**, per non certificare bozze. Avanzamento visibile immediatamente; import DOCX/EPUB/PDF più chiaro. La logica import esistente accetta già PDF/DOCX/EPUB/TXT/HTML/RTF/ODT/Markdown, conservata.

## Sicurezza e regressioni
- Test nuovo `scripts/test-lab130-study-on-demand.mjs` creato con mock Gemini e controllo Worker. Caso positivo, errori 503, domande malformate, validazione quote di prova, approssimazione intero libro 2000 pagine, cache senza richiamate, interfaccia PDF/format.
- **PASS** in ambiente JS isolato su LAB130 prima delle ultime due asserzioni supplementari; rieseguire `npm run test:lab130` in Codespaces per l'esito nativo definitivo.
- **PASS** suite LAB128 riprovata su codice LAB130 (2 errori 503 dimezzano, 2 successi ripristinano, PDF provvisorio/finale, 44 pagine).
- **PASS** suite LAB127 sul codice LAB130 (44/2000 pagine, checkpoint e cinque correzioni).
- **PASS** suite LAB129 sul codice LAB130 (quattro strumenti preesistenti, glossario mobile, routing reader/study).
- **PASS statico** preflight pipeline LAB130 in JavaScript V8 simulato; NON equivale all'esecuzione nativa di `bash -n` su Codespaces.
- `api/explainedV126.js`, algoritmo compressioni, firma, originali, strutture DB originali, PDF di stampa e produzione non modificati dai cambiamenti LAB130 (salvo cache di PDF già generato, consegna/open-only).
- Ancora **non verificati**: vera chiamata Gemini, sezione Android con API/keystore nuovo plugin, documenti DOCX/EPUB letti con app Android, build Vite e Gradle reale, firma APK, prove su telefono.

## Codespace/Worker di prova / build
- `scripts/codespaces-lab130-backend-and-build.sh`: ramo guardato, riconoscimento `wrangler.trial124.jsonc` (destinazione `studybook-ai-trial124`), verifica API spiegazione LAB127, test LAB130 + build Vite + Wrangler dry-run prima di deploy **solo trial**; dopo deploy verifica due volte HEAD della nuova API e vecchia API; poi avvia autobuild. Nessun deploy su `wrangler.jsonc` o Worker produzione.
- `scripts/codespaces-lab130-build.sh`: status GitHub, Scudo360, checksum/release/signer originale e versionCode, Worker HEAD LAB127+LAB130, dipendenza opensource FileOpener 8.0.1 installata con `--no-save --package-lock=false` senza cambiare package-lock, test prima di firmare.
- `scripts/codespaces-lab130-autobuild.sh`, `scripts/codespaces-lab130-publish.sh`, `.vscode/tasks.json`, `scripts/test-lab130-codespaces-preflight.mjs`: rami LAB130, GitHub Actions non richieste, produzione intatta.
- Codice Android non ancora compilato. Non inventare percorsi sandbox: dopo build reale attesi `APK-LAB130/StudyBook-AI-TRIAL-130.apk` e `.zip`, GitHub prerelease `studybook-trial130-codespaces-<SHA>`.
- Codespace utente già esistente: **super eureka**. Eseguire sul terminale esistente, senza cancellare APK precedenti, senza reset hard, senza disinstallare la LAB129:
```bash
cd /workspaces/StudyBook-AI && git diff --quiet && git diff --cached --quiet && git fetch origin && (git switch trial/studybook-lab130-on-demand-study-formats-20261114 || git switch --track origin/trial/studybook-lab130-on-demand-study-formats-20261114) && git pull --ff-only && bash scripts/codespaces-lab130-backend-and-build.sh
```
- Prima di installare APK testare che GitHub Release contenga realmente APK+ZIP e firma/manifest validi. Poi fare test telefono su file Word, scelta reader PDF Android, on-demand card+quiz+map+oral con Gemini reale, caching e quote; non cancellare dati o checkpoint.

## Criteri di riuscita
Le quattro attività non devono mostrare domande finché non si preme Crea/Rigenera; solo Gemini può produrle. Rifiutare domande evidentemente scorrette invece di salvare schede inutili. PDF apre un lettore compatibile, condividere è azione separata; esportazioni Word/EPUB/TXT disponibili per libro completo. Apertura lettura e pulsanti devono mostrare subito una risposta visibile. Zero extra costi intenzionali, nessuna produzione modificata.

## Aggiornamento — esportazione modificabile provvisoria autorizzata (14 novembre 2026)
- L'utente ha un libro parziale; lasciare Word ed EPUB nascosti fino a 44/44 spiegate non soddisfa il recupero dei formati. Ora `src/lib/explainedEditableExportV130.js` costruisce **in memoria**, dalla LAB128, un documento editabile con le pagine spiegate e, nelle altre, l'originale accompagnato da `BOZZA INCOMPLETA — TESTO ORIGINALE NON ANCORA RIELABORATO CON GEMINI`. Il titolo del file esportato contiene `_BOZZA_INCOMPLETA`. Non modifica mai `editionsV36` o il flag `complete` salvato.
- `src/AppV15.jsx`: per libri spiegati parziali invia questa copia separata agli exporter DOCX, EPUB, ODT, RTF, HTML, Markdown e TXT (il PDF ha ancora il proprio percorso layout-controllato), senza modificare le altre edizioni.
- `src/components/AppScreens.jsx`: formati disponibili anche su libri parziali, con avviso leggibile e nessuna etichetta di libro definitivo.
- `scripts/test-lab128-503-recovery.mjs` (su **questo ramo LAB130 soltanto**): nuovi assert reali su 44 pagine simulano documento editabile completo da 44 pagine, verificano tutte le pagine, marcatori di originale e nessuna mutazione del checkpoint. **PASS** nell'ambiente JS isolato con PDF mock, insieme ai test regressivi LAB128 HTTP503 e PDF.
- `scripts/test-lab130-study-on-demand.mjs` è stato riprovato con mock dopo l'audit rinforzato sulle risposte (riferimenti presenti e sovrapposizione concettuale minimale) e limite di 12k caratteri per passaggio. **PASS**.
- Stato di rilascio invariato: **non ancora distribuito né compilato** il Worker trial LAB130 o l'APK LAB130; `npm run test:lab130`, Vite, Wrangler, Gradle, firma e verifica app Android restano gate operativi del Codespace.

## Controllo finale dei blocchi di studio
- `src/lib/studyToolsOnDemandV130.js` limita anche un capitolo formato da molti frammenti brevi a **massimo 40 passaggi** per una singola richiesta, coerentemente con il limite Worker; la selezione troncata è segnalata come campionata. Rimangono limite complessivo 13.500 caratteri client e 14.000 lato Worker.
- La prova aggiunta a `scripts/test-lab130-study-on-demand.mjs` simula 90 paragrafi validi ed esige 40 segmenti esatti più indicatore di campionamento.
- **PASS**, dopo la correzione, della suite LAB130 in JavaScript isolato con endpoint Gemini simulato. La prova di esportazione modificabile 44 pagine + LAB128 con PDF simulato è **PASS**. Non affermare esecuzione nativa Node o build Android finché non sono osservate nel Codespace.
