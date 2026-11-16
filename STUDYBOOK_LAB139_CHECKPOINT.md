# StudyBook AI — MotorLab LAB139, modalità rapida 50% (2026-11-16)

## Stato verificato
- **Sorgenti registrati sul ramo LAB139. Test Node/Scudo360, deploy Worker, Gradle, firma APK e ZIP: NON ANCORA ESEGUITI.** Non dichiarare release pronta.
- Ramo di origine esatto: `trial/studybook-lab138-quality-yield-checkpoint-20261116` al commit `1a869ddf8aaa19d3e1fb71b93eb65d3eabae94a4`; baseline LAST_GOOD LAB138 prerelease `studybook-trial138-codespaces-1a869ddf8aaa`.
- Ramo LAB139 isolato: `trial/studybook-lab139-length-fast-503-20261116`.
- MotorLab r40 CORE/satellite verificato alla release `2026.10.29-r40`.
- Installazione famiglia: `applicationId=it.studybook.ai.lab.trial111`, firma SHA256 attesa `D7BB9315C9C4351872495478610C484725086E2BABBC04BEC65EC823455FBDCC`, `versionCode=2026113901`, `versionName=0.3.139-prova.1`; controllo reale da effettuare sul pacchetto firmato.
- Modello resta esclusivamente `gemini-3.1-flash-lite`; Worker Cloudflare gratuito già esistente `studybook-ai-trial124`. Zero costi extra, niente nuovo Cloudflare service, nessuna GitHub Action.

## Evidenza e approvazione
- Bruno, screenshot LAB138 alle 19:27 Italia: originale 44/44; 14 pagine conformi, 3 con riserva, 27 ancora da elaborare; 32 bozze ricevute; 17/26 risposte Gemini, 9 HTTP503; velocità indicata 594 caratteri/s; la sessione imponeva attese e riprese che compromettevano il tempo di completamento.
- Bruno ha approvato esplicitamente il piano LAB139 di **solo controllo didattico bloccante della lunghezza**, fascia interna 40–60% con target Gemini 50%, pagine ≤5 righe esenti dal vincolo percentuale ma testo integro; controlli tecnici strutturali essenziali; massimo due correzioni per pagina nella nuova modalità; attesa locale stimata 503 breve e progressiva senza eludere limiti Google 429/Retry-After; preservazione checkpoint e firma.
- Questa nuova modalità certifica **lunghezza e integrità tecnica, non semantica, leggi, glossario o veridicità**. Non trasformare tale dicitura in "significato verificato".

## Modifiche già committate
1. `src/lib/explainedStagesV126.js`: `auditExplainedPageV139` nuova funzione pura, valuta singola pagina su caratteri Unicode lettere+punteggiatura (target riduzione 50%, interna 40–60 inclusi), pagine originali 1–5 righe esentate, verifica ID, stesso numero e ordine segmenti, corpo non vuoto, nessun TODO/troncamento. Ignora come cause bloccanti i controlli di glossario, stile, comprensione, parole protette, fidelità semantica. Aggiunge contatori lettere e `verificationScope: length-and-structure-only`. Nuovo prompt V139 breve: significato essenziale richiesto al modello; non gli vengono comunicati limiti privati.
2. `api/explainedV139.js`, `worker/index.js`, `api/explainedV126.js`: endpoint opt-in `/api/explained/v139`, con header `X-StudyBook-Fast-Contract: lab139-length-only-fast-v1`; riusa stesso provider/modello e rigoroso JSON schema; audit rapido solo con flag trusted dal route handler; nessuna chiamata nascosta extra dopo 503. Preesistenti `/v126`, `/v138`, `/reformulate/v132` restano immutati per APK installate.
3. `src/lib/explainedProviderRecoveryV128.js`: `providerPauseV139` opt-in SOLO per HTTP503: se Google non indica attese obbligatorie, primo timeout locale 8–10 secondi, poi 16–18, 32–34, 64–66, 120–122; jitter locale per non creare tempeste. Se provider specifica Retry-After/RetryInfo conserva il minimo indicato. 429 e vecchio backoff V128 immutati; no garanzia che Google non dia altri 503.
4. `src/lib/explainedGeneratorV126.js`: opt-in `fastLengthV139` fornito solo dalla nuova app. Prima di qualsiasi richiesta rivaluta LOCALMENTE bozze con precedente audit semantico fallito, e quelle nel range sono accettate subito senza Gemini; conserva tutte le vecchie pagine già conformi e le riserve precedenti, con possibilità di promozione delle riserve che hanno già lunghezza adeguata e non sono fallback originali. Massimo 2 correzioni nella nuova modalità, poi eventuale pagina con riserva esplicita senza falsa conformità; pagine e checkpoint persistenti. Planner di blocchi 40k originale conservato, nessun taglio di pagine e nessuna riduzione arbitraria solo a causa di 503.
5. `src/AppV15.jsx`: chiama nuovo motore opt-in soltanto su V126; messaggi di progresso indicano conformità per lunghezza, non significato certificato.
6. `src/lib/explainedLayoutV122.js`, `src/lib/explainedViewV122.js`: **correzione fondamentale**: il lettore e PDF non riapplicano vecchi audit semantici alle pagine V139. Ricontrollano in locale solo lunghezza e integrità per stampa; testo incompleto resta bloccato dall'export finale. Riserve continuano ad essere esplicitamente segnalate, non dichiarate conformi.
7. `src/components/StudyPhaseProgressV59.jsx`: conteggio conformi **per lunghezza**, avviso non certificazione semantica e massimo 2 cicli.
8. `scripts/test-lab139-fast-length.mjs`, `npm run test:lab139`: test offline riduzione 39.9/40/50/60/60.1, righe 5/6, struttura, glossario/semantica non bloccante, confini 503/429/Retry-After, isolamento route V138 legacy, rianalisi locale 14+1 pagine, lettore e PDF non ritornano a vecchi audit.
9. `scripts/codespaces-lab139-worker.sh`: test completo prima del deploy, target **solo trial124** con prova presenza V126/V138/Riformula, aggiunge route V139; due verifiche HEAD dopo l'aggiornamento. `scripts/codespaces-lab139-build.sh`, `scripts/codespaces-lab139-autobuild.sh`, `scripts/codespaces-lab139-publish.sh`: scripts isolati, firma Android originale, Scudo360, Node, Gradle, ZIP, GitHub Releases, senza GitHub Actions.

## Verifica QA non ancora completata
- Revisione statica dei 16 file V139 passata tramite confronto dei sorgenti GitHub. Una precedente duplicazione accidentale nello script Worker durante sostituzione è stata corretta: script finale di 4597 byte con un solo shebang. Nessuna esecuzione reale del codice in questa chat.
- **PENDING:** `npm run test:lab139`, regressioni legacy, `npm run build`, `bash -n`, Scudo360 e JUnit richiesti, Worker dry-run/deploy trial124 e HEAD, APK firma e zip, test su smartphone per libro reale da 44 pagine e simulazione/stress 2000 pagine. Non falsificare risultati.
- Con 503 Google può ancora essere temporaneamente indisponibile. Non si può tecnicamente azzerare il rate limit o garantire il completamento di un libro senza tempo esterno.
- Le 3 pagine precedentemente "con riserva" rimangono esplicitamente con riserva se non conformi alla nuova lunghezza. La generazione deve perseguire ~50% di lunghezza in ciascuna pagina, senza certificazione semantica.

## Passaggio Codespace esistente
Terminale GitHub Codespaces `super eureka`, zero nuovi ambienti. Eseguire:
```bash
git fetch --no-tags origin "refs/heads/trial/studybook-lab139-length-fast-503-20261116:refs/remotes/origin/trial/studybook-lab139-length-fast-503-20261116" && (git switch trial/studybook-lab139-length-fast-503-20261116 || git switch --track origin/trial/studybook-lab139-length-fast-503-20261116) && git pull --ff-only origin trial/studybook-lab139-length-fast-503-20261116 && bash scripts/codespaces-lab139-autobuild.sh
```
- STOP se il codice locale contiene modifiche incompatibili: non usare `git reset --hard`, non perdere file/certificati/dati precedenti.
- Non creare link APK/ZIP LAB139 prima che GitHub Releases abbia pubblicato gli artefatti firmati. Non suggerire reinstallazione pulita o cancellazione della memoria Android.


## Addendum — velocità, ri-controlli nascosti e correzioni successive
- La modalità rapida NON eredita più il tetto ridotto a 8.000 caratteri dalle vecchie riparazioni basate sulla qualità del testo. Riutilizza il preflight già esistente da max 40.000 caratteri, con limiti token e pagine originali; soltanto veri 413/422/troncamenti possono suddividere i gruppi. Una risposta HTTP200 con semantica non certificata non dimezza più artificialmente i blocchi V139.
- Bug aggiuntivo verificato nel codice e corretto: `src/lib/explainedLayoutV122.js` e `src/lib/explainedViewV122.js` rieseguivano `auditExplainedPageV126` anche su `record.review.ready=true`, respingendo i risultati LAB139. Ora, se `snapshot.lengthOnlyV139===true`, usano esclusivamente `auditExplainedPageV139`, senza riattivare verifiche semantiche.
- `src/lib/explainedRepairV127.js`: `correctionAttempts` riflette i tentativi reali (2 nella nuova modalità; 5 nelle vecchie); messaggi UI su pagina e stato finale esplicitano solo controllo di lunghezza/struttura.
- `scripts/test-lab139-fast-length.mjs`: verifica anche che tetto V138 precedentemente ridotto a 8.000 venga ripristinato a 40.000 e che il primo blocco non sia inutilmente frammentato; lettore mostra 14+1 pagine e PDF finale resta bloccato se mancano ancora pagine.
- Ancora **nessun test runtime eseguito** dalla chat: la prossima operazione deve essere Codespace esistente (Node, test, Worker trial124, Scudo360, signer, APK, ZIP). Non dichiarare l'APK LAB139 già pubblicata e non inventare link.
