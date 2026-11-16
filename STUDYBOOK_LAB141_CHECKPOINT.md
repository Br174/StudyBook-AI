# StudyBook AI — MotorLab LAB141: finale 41/44 e precisione del 50%
Data: 2026-11-16. Stato: codice su LAB isolato; runtime QA, Worker, APK, ZIP e collaudo Android NON ancora eseguiti da questa chat.

## Evidenza utente
LAB140 ha migliorato la velocità, ma si ferma vicino alla fine del libro: 41 delle 44 pagine risultano completate, tre non arrivano alla certificazione della lunghezza. L'utente richiede una correzione SENZA rallentare importazione, spiegazione e ripresa, e con riduzione per pagina attorno al 50%. Non c'è screenshot delle nuove statistiche o codice di errore del telefono: i difetti nel codice sono stati verificati, ma resta da misurare l'esatta causa del singolo episodio sul device.

## Baseline sicura
- Repository: `Br174/StudyBook-AI`, branch isolato: `trial/studybook-lab141-final-tail-50pct-20261116`.
- Base LAST_GOOD LAB140: `3248e0ae61c3e9b4d446f32829970f43f26c0dd8`, release `studybook-trial140-codespaces-3248e0ae61c3` esistente, firmata e pubblicata. Non modificata.
- MotorLab CORE e satellite r40 verificati; StudyBook native engine resta responsabile del contenuto.
- Identità Android: `it.studybook.ai.lab.trial111`, certificato SHA256 `D7BB9315C9C4351872495478610C484725086E2BABBC04BEC65EC823455FBDCC`, nuova proposta `versionCode=2026114101`, `versionName=0.3.141-prova.1`. Richiesta verifica reale dello script su APK firmata.
- Backend: Worker gratuito già esistente `studybook-ai-trial124`, modello fisso Gemini 3.1 Flash-Lite; zero euro aggiuntivi, nessun GitHub Actions, nuovo Codespace, servizio, credenziale o nuova firma.

## Root cause confermata nel sorgente V140
1. `src/lib/explainedGeneratorV126.js`: quickV139 impone `correctionLimit=2`; `markAttempt` dopo due correzioni produceva `acceptedWithReserve=true` e `correctionAttempts=2`. Però `reserveAcceptedV127` in `src/lib/explainedRepairV127.js` considerava terminale **soltanto 5 tentativi**, così la pagina era esclusa dal nuovo retry (limite2) ma non conteggiata come completata. Risultato possibile: 41/44 e quality-review senza ulteriori pagine eleggibili.
2. Diagnostica finale `qualityReview`: nelle versioni onePass contava anche pagine verificate perché verificava la presenza della mappa comprehension separata che nella onePass non esiste. False pagine mancanti, possibili risvegli inutili e arresti dopo tentativi.
3. Correzioni 50%: prompt V140 includeva `targetBodyUnits`, ma le correzioni V139 non presentavano al modello una misura esplicita `previousBodyUnits` né lo scostamento numerico dal target; i codici issue V139 erano filtrati dal vecchio protocollo, quindi il modello poteva ripetere lo stesso testo o restare fuori fascia.

## Patch LAB141
- `src/lib/explainedRepairV127.js`: le pagine marcate `fastTerminalV141:true` e `terminalCorrectionLimitV141:2` sono considerate terminali dopo esattamente due correzioni, MA SEMPRE `review.ready=false`, `acceptedWithReserve=true`; output non rientrato 40–60 non è falsamente certificato. Se fallback originale, il testo deve corrispondere ESATTAMENTE a ciascun segmento originale. Il limite legacy di cinque rimane immutato.
- `src/lib/explainedGeneratorV126.js`: al caricamento dei checkpoint V139/V140, migra IN LOCALE e senza Gemini i draft già esauriti a una riserva con stato esplicito; preserva tutte le pagine valide. Conta in `diagnostics.qualityReview` soltanto pagine realmente mancanti, non quelle già accettate senza comprehension map. Tiene `correctionLimit=2`, lo stesso planner 40k, medesimo backoff e una sola richiesta per gruppo. `tailReliableV141:true` seleziona la nuova route per gli unici retry necessari.
- `src/lib/explainedTailV141.js`: prompt del testo al 50% con, durante l'ordinaria correzione delle sole pagine pendenti, `previousBodyUnits`, `targetBodyUnits`, `lengthDirection` e `lengthAdjustmentUnits`; Gemini produce una sola versione, nessun secondo passaggio. Soglie private di accettazione non rivelate.
- `api/explainedV141.js`, `api/explainedV126.js` e `worker/index.js`: route opt-in `/api/explained/v141`, header `X-StudyBook-Tail-Contract: lab141-endgame-two-repairs-one-pass-v1`. Endpoint precedenti V126/V138/V139/V140, manual glossary V140 e Riformula preservati.
- `src/AppV15.jsx`: opt-in solo nuova APK, nessuna nuova fase, no duplicazioni, recupero dati e glossario intatti.
- `scripts/test-lab141-endgame.mjs`, `npm run test:lab141`: tre simulazioni offline deterministiche con 44 pagine: (a) 41 già conformi, 3 esaurite => chiusura 44 con 3 riserve, **0** chiamate; (b) 41 conformi e 3 eleggibili => Gemini 1 chiamata alle sole p42–44, testo 50%, **44 conformi**; (c) ultima correzione torna ancora fuori fascia => **41 conformi+3 riserve**, 1 chiamata e niente loop. Verificano compatibilità vecchio gate 5, fallback originale esatto, glossario non mutato, assenza banda privata nel prompt, sistema ripresa non crea timer per un'edizione completa.
- `scripts/codespaces-lab141-worker.sh`, `-build.sh`, `-autobuild.sh`, `-publish.sh`: nuovi script isolati per il Codespace GitHub esistente `super eureka`, stesso signer, Scudo360 e SHA, release senza Actions. Worker deploy solo al trial124, verifica v126/v138/v139/v140/glossario/Riformula prima di aggiungere v141. Contract HEAD verificato due volte. Nessun pagamento.

## Stato QA e rischi (non inventare successi)
- Codice e script scritti su GitHub, verifiche statiche in corso.
- Test `npm run test:lab141`, build Vite, bash -n, Scudo360, Worker dry-run e deploy, firma APK+ZIP, test Android 44/2000 pagine: **DA ESEGUIRE** nel Codespace autorizzato; non dichiarare successo prima di risultanze reali.
- Se Gemini restituisce una correzione entro il range, 44/44 possono essere conformi. Se due correzioni falliscono, 3 pagine devono essere rese disponibili CON RISERVA senza loop; **non dichiarare 44/44 al 50%** se non lo sono.
- Un 503 esterno può ancora imporre backoff ufficiale; non alterare limiti provider. Dati originali, firma e cache non devono essere cancellati.

## Compilazione sicura nel Codespace già esistente
```bash
git fetch --no-tags origin "refs/heads/trial/studybook-lab141-final-tail-50pct-20261116:refs/remotes/origin/trial/studybook-lab141-final-tail-50pct-20261116" && (git switch trial/studybook-lab141-final-tail-50pct-20261116 || git switch --track origin/trial/studybook-lab141-final-tail-50pct-20261116) && git pull --ff-only origin trial/studybook-lab141-final-tail-50pct-20261116 && bash scripts/codespaces-lab141-autobuild.sh
```
STOP se branch errato, modifiche locali conflittuali, Worker contratto non verificato, test falliti, signer diverso. Non usare reset --hard. Non fornire link APK LAB141 prima di effettiva GitHub Release. Non chiedere cancellazione memoria telefono; installare sopra LAB140.


## Verifiche statiche/pure eseguite in questa chat
- Diff GitHub rispetto al LAST_GOOD LAB140: ramo LAB141 **ahead** di 18 commit, 0 behind, 14 file coinvolti, nessuna modifica a main/produzione.
- Controllo strutturale dei 14 file: presenza route V141, nuovo versionCode, commit base, script Worker isolato, test LAB141 e hook App corretti; nessun riferimento a ramo vecchio negli script.
- Sintassi JS parsata in isolamento per `explainedRepairV127.js`, `explainedGeneratorV126.js`, `explainedTailV141.js`, `api/explainedV126.js`, `api/explainedV141.js` e `explainedStagesV126.js`; test `test-lab141-endgame.mjs` sintatticamente valido dopo rimozione degli import ESM/shebang per il controllo V8. Questo NON equivale a test Node integrativo.
- Eseguita la funzione REALE `reservedExplainedPageV127` / `reserveAcceptedV127` in sandbox JS: con fast limit 2 accettazione con riserva TRUE e ready FALSE; con legacy limit 2 accettazione FALSE; legacy 5 TRUE; fallback originale esatto TRUE.
- `scripts/test-lab141-endgame.mjs` include ora anche un terzo scenario in cui l'ultima correzione torna fuori fascia: una richiesta per le sole p42–44, chiusura 41 conformi+3 con riserva, niente risvegli in loop.
- GitHub Releases verificato: **nessuna release LAB141 ancora pubblicata**; la più recente rimane LAB140. Impedito l'accesso diretto al repository privato dal container (DNS/network unavailable), perciò nessun test Node/Gradle reale viene dichiarato superato.
- Prossima prova nel Codespace esistente: `npm run test:lab141` tramite `bash scripts/codespaces-lab141-autobuild.sh`. Se un test fallisce, arrestare deploy e APK e correggere **solo il test/bug reale** nel ramo isolato. Non distribuire la LAB141 prima che tutti i check passino.


## Diagnosi Codespaces 22:18 — task LAB132 obsoleta (2026-11-16)
- Screenshot del terminale `super eureka`: processo VS Code `Attività: bash -c` carica `scripts/codespaces-lab132-autobuild.sh` ed esce con codice 1; barra inferiore Codespaces ancora sul ramo LAB140. NON è un test né una compilazione LAB141.
- Causa confermata nel file `.vscode/tasks.json` presente nel ramo LAB140/141: il task predefinito era ancora `LAB132 — Compilazione automatica APK+ZIP`, `runOn: folderOpen`, che si avviava all'apertura di VS Code e si fermava correttamente se non sul ramo LAB132.
- Correzione sul ramo LAB141: `.vscode/tasks.json` ora contiene `LAB141 — Compilazione APK+ZIP (Codespaces, manuale)` come task build predefinito e `LAB141 — Test del completamento 41/44 (nessun deploy)`; `runOn: folderOpen` RIMOSSO. Nessuna build all'apertura. Nessun cambiamento a vecchie release o task sul ramo LAB140.
- Azione necessaria sul dispositivo: nel Codespace già aperto selezionare un nuovo terminale `+` (non la scheda Attività terminata), incollare il comando di switch al ramo LAB141 + `bash scripts/codespaces-lab141-autobuild.sh`; senza reset hard e senza cancellare `package-lock.json` untracked o altre modifiche.
- HEAD verifica: GitHub non mostra ancora release LAB141, ultimo tag LAB140. MotorLab CORE e satellite r40 coincidono. Test integrazione e APK LAB141 ancora non eseguiti dalla chat.


## Diagnosi Codespaces 22:26 — test LAB132 legacy incompatibile con default LAB141
- Screenshot Android/Brave 22:26: Codespaces sulla branch LAB141 (giusta), Node.js 22.23.5, `[LAB141 BLOCCATO - test] Test fallito: test-lab132-codespaces-preflight`. `ERR_ASSERTION`, actual `undefined`, expected `folderOpen`. Nessun APK incompleto distribuito.
- Causa concreta: `scripts/test-lab132-codespaces-preflight.mjs` era scritto quando `.vscode/tasks.json` conteneva il vecchio task LAB132 con avvio `folderOpen`. In LAB141 il task è stato volutamente sostituito con default manual-only, per eliminare l'avvio automatico errato LAB132. Il vecchio test asseriva rigidamente `tasks.tasks[0].runOptions.runOn==='folderOpen'`, quindi falliva prima ancora di compilare.
- Correzione committata su branch LAB141: `scripts/test-lab132-codespaces-preflight.mjs` effettua verifiche storiche LAB132 inalterate sugli script e signer e un controllo condizionato sulla task corrente: task LAB141 deve essere default manuale, senza `folderOpen`, deve puntare a `scripts/codespaces-lab141-autobuild.sh`, avere `flock`, nessuna GitHub Action e task test separata `npm run test:lab141`.
- Commit della correzione `e81f481155832423d71b7f9159045e8e1cf2edba`. Analisi statica e parsing JavaScript del test corretti; `npm run test:lab141`, esecuzione reale dello script, Scudo360, Worker, Gradle e firma Android devono ANCORA essere verificati sul Codespace.
- Riprova sicura nel terminale Codespace **già sul ramo LAB141**: `git pull --ff-only origin trial/studybook-lab141-final-tail-50pct-20261116 && bash scripts/codespaces-lab141-autobuild.sh`; non serve creare o cambiare Codespace, pulire i dati Android o reinstallare LAB140. Non riattivare `folderOpen` per far passare il vecchio test.
- GitHub Releases controllato: ultima release pubblicata LAB140, nessuna LAB141.
