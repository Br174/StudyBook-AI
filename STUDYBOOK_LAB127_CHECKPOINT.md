# StudyBook AI LAB127 — Checkpoint operativo (13 novembre 2026)

## Stato e identità del progetto
- Repository: `Br174/StudyBook-AI` (privato).
- Ramo di lavoro isolato: `trial/studybook-lab127-nonblocking-recovery-20261113`.
- Base: `trial/studybook-lab126-deep-content-recovery-20261113`.
- MotorLab centrale e satellite locale: release `2026.10.29-r40`; nessuna migrazione a produzione.
- **NON RILASCIATO**: nessun APK o ZIP compilato/pubblicato in questa lavorazione; nessun deploy Cloudflare effettuato.

## Regole approvate
1. Comprensione del libro senza soglie qualitative, percentuali o blocchi semantici; resta obbligatoria la corrispondenza tecnica di pagine e segmenti.
2. La riscrittura (Libro spiegato al 50%) conserva controlli di riduzione, grammatica e fedeltà per ogni pagina.
3. Le pagine difettose ricevono fino a CINQUE chiamate automatiche di correzione per pagina, con bozza precedente, errori specifici e strategia adattiva. Non viene fatta una sesta chiamata.
4. Dopo cinque correzioni fallite, salvataggio automatico **con riserva**, mantenendo la migliore bozza utilizzabile oppure il testo originale dichiarato non rielaborato.
5. Fino a due riletture tecniche aggiuntive delle pagine non comprese. Se falliscono, originale con riserva, senza falsificare la comprensione.
6. Tutte le altre pagine continuano; checkpoint persistenti; quote HTTP 429/503 rispettate, senza consumare i cinque tentativi.
7. PDF esportabile anche con riserve quando tutte le pagine sono conformi o esplicitamente riservate, con indicatore «CON RISERVA» e rapporto finale delle anomalie.
8. Zero costi aggiuntivi; preservare originale, libro, libreria, firma/package Android e branche protette.

## File applicativi modificati
- `src/lib/explainedGeneratorV126.js` — orchestrazione, checkpoint, cicli 1–5, ripresa, fallback.
- `src/lib/explainedRepairV127.js` — operazioni pure e certificazione esplicita con riserva.
- `src/lib/explainedStagesV126.js` — comprensione solo tecnica, correzione guidata con bozza precedente.
- `api/explainedV126.js` — risposta Worker con handshake `repairContractV127`.
- `src/lib/studyAutoResumeV45.js` — non ripetere chiamate con Worker vecchio o non configurato.
- `src/lib/explainedLayoutV122.js` e `src/lib/exportExplainedPdfV122.js` — layout originale e allegato anomalie.
- `src/lib/explainedViewV122.js`, `src/components/AppScreens.jsx`,
  `src/components/StudyPhaseProgressV59.jsx`, `src/AppV15.jsx`,
  `src/lib/explainedGeneratorV122.js` — UI, lettura, conteggi e messaggi.

## Test creati
- `npm run test:lab127` esegue:
  - `scripts/test-lab127-nonblocking-recovery.mjs`
  - `scripts/test-lab127-worker-contract.mjs`.
- Test eseguiti nell'ambiente JavaScript isolato tramite adattamento degli import: **PASS** per 44 pagine, 2.000 pagine simulate, cinque cicli, successo al ciclo 2, limite 429 e ripresa, vecchio Worker, reader, layout PDF e allegato anomalie con mock jsPDF; **PASS** per il contratto di Worker e la presenza della bozza precedente nel payload destinato al modello. Nessuna chiamata reale a Gemini.
- Restano **NON VERIFICATI** in questa sessione: `npm run test:lab127` eseguito da Node su repository completo con dipendenze installate; build Vite/React/Capacitor; PDF reale jsPDF; test reali Gemini; verifica Android, firma e installazione aggiornamento; deploy Cloudflare.

## Blocco tecnico di rilascio
L'APK LAB127 richiede che il Worker `/api/explained/v126` sia prima distribuito con `repairContractV127:'lab127-automatic-recovery-v1'`. Se il Worker è vecchio, il client interrompe in modo esplicito senza falsificare o consumare correzioni. Worker fonte: `worker/index.js` importa `api/explainedV126.js`; wrangler: `wrangler.jsonc`.

## Prossime operazioni, nell'ordine
1. Eseguire `npm install --no-audit --no-fund && npm run test:lab127 && npm run build` in ambiente di build affidabile sul ramo LAB127.
2. Eseguire Scudo360, regressioni didattiche, prova reale controllata con Gemini gratuito e PDF con riserve, in ambiente isolato; mantenere budget zero.
3. Distribuire e verificare il Worker LAB127 nel confine sicuro senza sovrascrivere produzione prematuramente; verificare il marker di compatibilità.
4. Usare la procedura Android firmata già verificata del progetto, mantenendo package e certificato; creare APK+ZIP, QA su telefono e soltanto allora valutare la promozione.
5. Conservare questo checkpoint e gli SHA GitHub; non risincronizzare MotorLab durante operazioni attive.

**La presenza di codice e test simulati nel ramo LAB127 non equivale a un rilascio APK testato o alla prova dell'efficacia semantica di Gemini reale.**

## AGGIORNAMENTO OPERATIVO — percorso Codespaces predisposto
- Verifica remota effettiva: LAB126 **pubblicata** su GitHub Releases con APK (5.770.275 byte) e ZIP (5.396.124 byte), tag `studybook-trial126-codespaces-7ce00c76b394`; il checkpoint storico di preparazione LAB126 non riportava il rilascio successivo.
- LAB127: creati `scripts/codespaces-lab127-autobuild.sh`, `scripts/codespaces-lab127-build.sh`, `scripts/codespaces-lab127-publish.sh`, `scripts/codespaces-lab127-backend-and-build.sh`, test shell `scripts/test-lab127-codespaces-preflight.mjs`, attività VS Code specifiche del ramo in `.vscode/tasks.json`. Il comando di accesso è documentato in `docs/LAB127_CODESPACES_BUILD_HANDOFF_20261113.md`.
- La pipeline è isolata: target Worker `studybook-ai-trial124`, doppio handshake fase `lab126` e recupero `lab127`, test locali e Scudo360, package Android `it.studybook.ai.lab.trial111`, `versionCode=2026112701`, certificato originale SHA-256 invariato. Alternativa di firma possibile solo con keystore locale preesistente e fingerprint uguale.
- Gli script sono **scritti e verificati staticamente in GitHub**, ma il controllo nativo `bash -n`, `npm run test:lab127` con dipendenze installate, il build Gradle, il deploy Cloudflare e la prova Gemini reale **non sono ancora eseguiti**. Questi sono vincoli reali, non test superati implicitamente.
- Motivo esecuzione assente: il connettore GitHub presente non include terminale Codespaces; il runtime locale di ChatGPT non ha DNS verso GitHub, SDK Android o keystore firmatario. Nessuna API a pagamento è stata utilizzata, nessuna GitHub Action richiesta e nessuna modifica a produzione eseguita.
- Primo passo in Codespace autenticato: eseguire il comando unico dal documento handoff; l'operazione controlla modifiche locali e si interrompe se branch/signer/Worker non sono sicuri.
