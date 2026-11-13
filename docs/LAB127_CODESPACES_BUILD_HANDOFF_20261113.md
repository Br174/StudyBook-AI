# StudyBook AI LAB127 — Consegna Codespaces Android, 13 novembre 2026

**Stato:** sorgenti, test e automazione predisposti; **non equivale a una compilazione riuscita**. Non risultano ancora APK/ZIP LAB127 né deploy Worker eseguiti da questa sessione.

## Identità invariata, aggiornamento sul telefono
- Ramo di prova isolato: `trial/studybook-lab127-nonblocking-recovery-20261113`.
- Base MotorLab LAB127 confermata: `23fe1c657bcc9a772a23e087c2efff58d98bb22a`.
- Package Android di prova preesistente: `it.studybook.ai.lab.trial111` (**stesso della LAB126**).
- Versione prevista: `versionCode=2026112701`, `versionName=0.3.127-prova.1` (superiori alla LAB126 `2026112601`).
- Certificato originale SHA-256 obbligatorio:
  `D7BB9315C9C4351872495478610C484725086E2BABBC04BEC65EC823455FBDCC`.
- Solo Worker DI PROVA esistente: `studybook-ai-trial124.brunoverlezza.workers.dev`, nessuna modifica intenzionale al servizio di produzione.
- Nessuna richiesta a Gemini reale compiuta dai test automatici; quote e costi sono controllati separatamente sul dispositivo.

## Lancio unico dal Codespace ESISTENTE, dal terminale in cui è già presente il progetto

```bash
cd /workspaces/StudyBook-AI && git diff --quiet && git diff --cached --quiet && git fetch origin && (git switch trial/studybook-lab127-nonblocking-recovery-20261113 || git switch --track origin/trial/studybook-lab127-nonblocking-recovery-20261113) && git pull --ff-only && bash scripts/codespaces-lab127-backend-and-build.sh --deploy-test-worker
```

Il comando non fa `reset --hard`, `git clean` o checkout di produzione; fallisce se ci sono modifiche tracciate da proteggere. Richiede che Codespaces, GitHub CLI e Wrangler siano già autenticati **nelle rispettive interfacce**, senza condividere credenziali in chat. Utilizza soltanto il Codespace già esistente, evitando di crearne uno nuovo.

## Fasi automatiche della pipeline
1. Controllo del ramo corretto e dell'endpoint trial v122 esistente.
2. Se l'endpoint v126 non presenta `X-StudyBook-Recovery-Contract: lab127`, esegue `npm run test:lab127`, `npm run build`, `wrangler deploy --dry-run` e aggiorna **solo** il Worker trial124; nessun Workers di produzione viene invocato.
3. Due controlli HEAD consecutivi richiedono **entrambi** `X-StudyBook-Phase-Contract: lab126` e `X-StudyBook-Recovery-Contract: lab127`; se falliscono, stop, **nessuna APK incompatibile**.
4. Clone isolato del commit GitHub corrente, verifica Scudo360, test didattici preesistenti, test LAB127, sincronizzazione Capacitor e Gradle.
5. Recupero della firma originale attraverso il precedente artefatto GitHub autorizzato; in alternativa può utilizzare `STUDYBOOK_ORIGINAL_KEYSTORE` **già presente nel Codespace**, verificando esattamente lo stesso certificato. Non genera mai una nuova chiave.
6. Firma, verifica manifest/certificato/versionCode, ZIP e checksum. Pubblica su GitHub Releases una prerelease `studybook-trial127-codespaces-<SHA>`; in caso di fallimento della pubblicazione, lascia i file nel Codespace e prepara la porta privata 8766 per il download.
7. Al termine arrestare il Codespace quando non serve: evitare consumi della quota gratuita. La firma confermata **non** dimostra funzionamento Android o riuscita delle correzioni semantiche con Gemini reale.

## Percorsi previsti (solo dopo una build verificata)
- `APK-LAB127/StudyBook-AI-TRIAL-127.apk`
- `APK-LAB127/StudyBook-AI-TRIAL-127.zip`
- `artifacts/LAB127-CODESPACES/StudyBook-AI-TRIAL-127-IDENTITY.txt`
- `artifacts/LAB127-CODESPACES/scudo360-report.json`
- `artifacts/LAB127-CODESPACES/StudyBook-AI-TRIAL-127-SORGENTI.zip`

## Gate onesti
- Il connettore GitHub disponibile in ChatGPT consente lettura/scrittura del repository ma **non esegue la shell Codespaces**; questa procedura richiede l'avvio nel Codespace già autenticato.
- Non è stata osservata in questa sessione una build Android LAB127 o un deploy reale.
- I controlli GitHub eseguiti su risposte Gemini simulate sono utili ma non equivalgono a prova di correzione efficace del testo.
- Se manca il vecchio keystore o non è verificabile, la procedura si ferma, senza rompere l'aggiornamento Android.
- L'uso di un Codespace può dipendere dalle quote disponibili dell'account; prima dell'esecuzione verificare che non comporti costi aggiuntivi.

## Ripresa
Su ChatGPT, continuare dal checkpoint `STUDYBOOK_LAB127_CHECKPOINT.md` e verificare su GitHub l'ultimo commit del ramo. Dopo la build cercare la prerelease GitHub `studybook-trial127-codespaces-<SHA>`, confrontare Identity e checksum, poi procedere ai test reali sul telefono.
