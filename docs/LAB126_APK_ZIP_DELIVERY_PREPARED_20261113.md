# StudyBook AI LAB126 — APK+ZIP: percorso compilazione predisposto, artefatti NON ancora generati

**Data:** 13 novembre 2026. **Stato:** PREPARATO SU GITHUB / COMPILAZIONE NON ESEGUITA. Non presentare link di download finché i file non esistono davvero.

## Identità e ambiente
- Ramo isolato `trial/studybook-lab126-deep-content-recovery-20261113`.
- Stesso package di prova installabile in aggiornamento: `it.studybook.ai.lab.trial111`.
- Nuovo versionCode: `2026112601`; versionName `0.3.126-prova.1`.
- Certificato Android originario da verificare ad ogni compilazione: `D7BB9315C9C4351872495478610C484725086E2BABBC04BEC65EC823455FBDCC`. Mai generare una nuova chiave.
- Toolchain preesistente Codespaces LAB125 riutilizzabile in `$HOME/.local/share/studybook-lab125`; no GitHub Actions.
- File attesi alla fine: `APK-LAB126/StudyBook-AI-TRIAL-126.apk`, `APK-LAB126/StudyBook-AI-TRIAL-126.zip`; hash e identità associati. La disponibilità del codice di compilazione non prova l'esistenza dei file.

## Blocchi tecnici verificati e guardie di sicurezza
1. Il nuovo client LAB126 richiede `/api/explained/v126`, endpoint non distribuito durante lo sviluppo LAB126. L'APK da sola NON può rendere disponibili le due fasi Gemini.
2. `scripts/codespaces-lab126-build.sh` effettua controllo **soltanto HEAD** sul Worker di prova `studybook-ai-trial124.brunoverlezza.workers.dev/api/explained/v126`: deve ricevere HTTP405 e intestazione `X-StudyBook-Phase-Contract: lab126`. Senza questo stop prima di firma/compilazione; no finta APK usabile.
3. `scripts/codespaces-lab126-backend-and-build.sh` è invocabile soltanto esplicitamente con `--deploy-test-worker` per introdurre l'endpoint sul **Worker di prova esistente** conservando gli handler precedenti (API v122). Questo modifica il servizio di prova esterno; non viene avviato da ChatGPT automaticamente. Controlla v122 prima, `wrangler whoami` per autenticazione, `npm run test:lab126`, `npm run build`, dry-run Wrangler prima di deploy e verifica v122/v126 dopo. Se Cloudflare non è autenticato, si ferma; non chiedere chiavi in chat. L'utente deve essere consapevole che l'operazione aggiorna il Worker di prova condiviso dalla LAB125.
4. `scripts/codespaces-lab126-autobuild.sh` opera in clone isolato, esegue gate Scudo360 e regressioni pregresse + test LAB126 e firma APK; copia i risultati in `APK-LAB126` nel workspace. Pubblicazione opzionale `scripts/codespaces-lab126-publish.sh` su GitHub Releases; se fallisce, i file restano nella cartella Codespaces. Se pronto, avvia port-forwarded file server privato sulla porta 8766.
5. `.vscode/tasks.json` esegue l'autobuild all'apertura della cartella **soltanto quando il branch attivo è LAB126**. Se il Worker non è disponibile, arresta la compilazione. Il Codespace precedente dell'utente è nel ramo LAB125: deve passare a LAB126 o aprire il ramo corretto prima del task.

## Comando unico nell'attuale Codespace Android (richiede che Cloudflare risulti già autenticato)
```bash
cd /workspaces/StudyBook-AI && git fetch origin && (git switch trial/studybook-lab126-deep-content-recovery-20261113 || git switch --track origin/trial/studybook-lab126-deep-content-recovery-20261113) && bash scripts/codespaces-lab126-backend-and-build.sh --deploy-test-worker
```

**Non inventare un link di download:** nel momento di scrivere questa nota non risulta alcuna GitHub Release LAB126 e nessun file APK/ZIP LAB126 materializzato da una compilazione. L'attivazione del comando e la firma sono operazioni che richiedono esecuzione nel Codespace con i permessi dell'utente; il connettore GitHub può scrivere sorgenti ma non eseguire un terminale Codespaces. GitHub Actions disponibili sono in coda e quindi non usati.

## Collaudo dopo la compilazione
Worker HEAD disponibile non equivale a modello Gemini reale collaudato. Installare la nuova Prova 126 sopra Prova 125 soltanto dopo i gate, importare il PDF originale 44 pagine, osservare **comprensione 44/44 prima di una sola pagina compressa**, poi verificare 1–44, 50% lettere+punteggiatura, completezza dei concetti, glossario, 429/503/checkpoint e PDF solo con 44 pagine conformi. Zero servizi a pagamento.
