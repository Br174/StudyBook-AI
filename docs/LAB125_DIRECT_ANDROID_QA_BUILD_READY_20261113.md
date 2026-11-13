# StudyBook AI — LAB125: build Android per collaudo diretto dell'utente
**Data:** 13 novembre 2026
**Decisione autorizzata:** test Gemini e lettura didattica direttamente sull'APK Android da parte di Bruno. Non effettuare ulteriori prove, modifiche, deploy o smoke test del Worker Cloudflare nel percorso di questa versione. Non attendere una certificazione esterna di Gemini prima della compilazione del prototipo. Preservare i limiti gratuiti e riconoscere i limiti del Worker esistente.

## Stato verificato sul ramo
- Branch unico: `trial/studybook-lab125-full-regression-didactics-20261113`. Fonte successiva alla LAB124, senza modificare la LAB124, MADRE, main o firmare con chiavi nuove.
- QA deterministica sul codice LAB125, in runtime JS isolato: **55/55 asserzioni** della suite `scripts/test-lab125-hardening.mjs` dopo ultima correzione del payload; **35/35 casi** di `scripts/test-lab125-didactic-matrix.mjs`. Risposte provider simulate, non prova della qualità del modello sul telefono.
- Regressioni vecchie ricalibrate e rieseguite sulla versione corrente: `scripts/test-lab122-recovery.mjs` **19/19 asserzioni**, `scripts/test-lab122-single-explained.mjs` **PASS**, `scripts/test-lab123-503-recovery.mjs` **PASS**. `scripts/test-lab124-large-call-parity.mjs` aggiornato per limite 40k, ma non eseguito in Node integrale; non dichiararlo green.
- Verifica statica dei **15 invarianti della compilazione Codespaces**: 15/15. Non equivalgono a Gradle/Scudo360 effettivamente eseguiti.
- Nessuna generazione reale Gemini 44p, nessun APK compilato nell'ambiente di ChatGPT, nessun ZIP ancora disponibile, nessuna firma realizzata in questo turno. `/mnt/data` non contiene SDK Android/Gradle né repository clonabile per DNS esterno. GitHub Actions legacy sono **queued dal 11 novembre 2026** e non sono considerati esecutori attivi.
- Test Android utente, quota Gemini live, export PDF reale e qualità delle 44 pagine **PENDING_DEVICE_QA**.

## Compilazione APK e ZIP già predisposta per Codespaces, senza Actions
- `.vscode/tasks.json`: `runOn:folderOpen` sul ramo LAB125.
- `scripts/codespaces-lab125-autobuild.sh`: recupera HEAD remoto, verifica il commit antenato LAB125, lavora in clone isolato, controlla eventuale release già pubblicata, anti-duplicazione.
- `scripts/codespaces-lab125-build.sh`: Node 22, Java 21, Android SDK 36 già disponibili o scaricati nei limiti gratuiti, Scudo360 nativo e test locali, Capacitor+Gradle Android, recupero keystore ORIGINALE da artefatto GitHub pre-esistente, verifica appId/versionCode/SHA256 certificato, APK+ZIP+ZIP sorgenti+checksum. NO Cloudflare deploy, NO Worker GET check, NO Gemini reale nella build.
- `scripts/codespaces-lab125-publish.sh`: **solo dopo** APK e ZIP fisicamente validati, pubblicazione GitHub Release prerelease di tag `studybook-trial125-codespaces-<12 cifre SHA>` e checkpoint #12, senza Actions.
- Identità prevista della LAB125: **`it.studybook.ai.lab.trial111`**, **versionCode `2026112501`**, **versionName `0.3.125-prova.1`**, SHA256 firma attesa `D7BB9315C9C4351872495478610C484725086E2BABBC04BEC65EC823455FBDCC` (certificato ORIGINALE; blocca se assente). Nome file `StudyBook-AI-TRIAL-125.apk`, `.zip`, `-SORGENTI.zip`.
- L'app usa l'endpoint trial già integrato nelle LAB precedenti `https://studybook-ai-trial124.brunoverlezza.workers.dev` **senza modificarlo e senza verificarlo in fase di build**, come espressamente chiesto. Non attestare che il Worker remoto abbia già il nuovo codice 42k: se ha ancora un tetto 30k, la LAB125 divide i blocchi dopo un 413 genuino, con un tentativo aggiuntivo e mantenendo i checkpoint. La fase di collaudo utente deciderà la qualità end-to-end.
- **FATTO:** script e task salvati su GitHub; **NON FATTO:** Codespace aperto/compilazione Gradle/release pubblicata. Non fornire un link APK non verificato.

## Azione mancante
L'ambiente conversazionale non dispone di sessione Codespaces/SDK Android o di esecuzione remota GitHub Actions attiva. Per avviare materialmente la build predisposta occorre **aprire o riaprire la cartella del ramo LAB125 in GitHub Codespaces**; il task folderOpen avvia automaticamente la compilazione e la pubblicazione una volta disponibili il Codespace e le dipendenze. Non serve incollare comandi nel terminale. Se signer, SDK o Scudo non sono accessibili, la build deve fallire visibilmente senza fabbricare un'altra APK o firma.

**Divieto:** nessun tag/release/APK deve essere dichiarato creato senza ricevuta finale, checksum verificato e sorgente fissata. Non promuovere a MADRE.
