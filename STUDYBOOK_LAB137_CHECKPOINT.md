# StudyBook AI — LAB137: ripresa Android dopo 503 (2026-11-16)

**Stato:** patch applicate in LAB isolato; test Node/Scudo, compilazione APK/ZIP e collaudo su telefono NON ancora eseguiti. LAB136 precedente preservata e installata dall'utente.

## Evidenza utente
Screenshot della LAB136 Android (16 novembre 2026, 15:31 ora italiana): originale letto 44/44; spiegazioni conformi 9/44; bozze 44/44; Gemini 3.1 Flash-Lite 32/37 risposte, 5 HTTP503 consecutivi, velocità registrata 586 caratteri/s; ripresa dichiarata possibile dalle 15:00 ma progresso ancora fermo alle 15:31. Segnalazioni: 20 riduzione fuori fascia, 17 condizioni/modalità, 10 immutabili, 7 concetti protetti, 2 body triviale. Una pausa scaduta e il testo visibile non dimostrano da soli se una chiamata provider è in-flight; serve collaudo strumentato sul device.

## Scopo approvato e compatibilità
Continua l'intervento MotorLab precedentemente approvato sullo stesso motore: ripresa automatica da checkpoint senza presenza costante, niente raffiche, stessi dati e qualità. Nessuna modifica al modello fisso Gemini 3.1, limiti 40k del trasporto, Worker, importazione sorgente, PDF, Riformula, paginazione, libreria o soglie interne.

## Provenienza
- Repository: `Br174/StudyBook-AI`
- Ramo LAB137: `trial/studybook-lab137-android-resume-503-recovery-20261116`
- Base famiglia Android LAB136 verificata: `21382efbf0371ae1af5ffa84dbb7372688ef9739`
- LAST_GOOD LAB136 release: `studybook-trial136-codespaces-21382efbf037` (nessuna alterazione)
- MotorLab CORE/satellite verificato: `2026.10.29-r40`

## Patch mirate
1. `src/lib/studyAutoResumeV45.js`: il cooldown Gemini V126 ha precedenza sulle correzioni; `autoResumeRecheckDelayV137` restituisce intervallo di revisione dello STESSO scheduler quando la WebView è nascosta (15s), è in volo una richiesta (2.5s) o il termine non è ancora raggiunto. Non avvia né installa un nuovo Worker/scheduler.
2. `src/AppV15.jsx`: nel singolo `useEffect` LAB45, le sospensioni dei timer Android non consumano il turno di ripresa; aggiunti eventi `resume` e `online` oltre ai precedenti `visibilitychange`, `focus`, `pageshow`; se libro locale non disponibile riparte dal checkpoint IndexedDB. Stato del tentativo visualizzato appena parte; nessun Gemini quando `visibilityState=hidden`. Il timer resta uno solo; nessuna richiesta simultanea.
3. `scripts/test-lab137-android-resume.mjs`: regressioni offline per scadenza 503, app nascosta, risveglio, assenza duplicati, priorità quota rispetto qualità e check statici del singolo owner. Registrata in `package.json` (`npm run test:lab137`).
4. `scripts/codespaces-lab137-worker.sh`: sola lettura HEAD sul Worker trial124 esistente (fisso Gemini 3.1 e contratto prompt LAB136), NO deploy Cloudflare, NO richieste Gemini.
5. Script dedicati `scripts/codespaces-lab137-build.sh`, `scripts/codespaces-lab137-autobuild.sh`, `scripts/codespaces-lab137-publish.sh`: stessa famiglia e certificato `D7BB9315C9C4351872495478610C484725086E2BABBC04BEC65EC823455FBDCC`, `applicationId=it.studybook.ai.lab.trial111`, `versionCode=2026113701`, `versionName=0.3.137-prova.1`. Riuso stesso Codespace/SDK e Scudo360. Non usare Actions.
6. Pilastro `docs/STUDYBOOK_PILASTRO_BLOCCHI_DINAMICI_V1.md` letto e rispettato; per 503 non si riduce arbitrariamente il blocco. Soglia/trasporto 40k e modello invariati.

## Controlli necessari e limiti
- Codice e script controllati staticamente via GitHub; `node`, `npm`, Scudo360, Gradle, firma Android, installazione reale NON eseguiti dalla chat.
- Gemini 503 è un errore temporaneo del servizio Google: nessuna app può garantire che nuove risposte arrivino finché il provider è sovraccarico. La patch evita la perdita del timer/recupero; non inventa risposte o considera conformi le 35 pagine mancanti.
- Android non garantisce l'esecuzione continua se il sistema termina la WebView in background; la patch mira a riprendere al ritorno in primo piano. Non dichiarare lavoro autonomo garantito a schermo spento.
- Per proseguire dal Codespace ESISTENTE (senza eliminare `package-lock.json` non tracciato o i libri), nel terminale autorizzato:
```bash
git fetch --no-tags origin "refs/heads/trial/studybook-lab137-android-resume-503-recovery-20261116:refs/remotes/origin/trial/studybook-lab137-android-resume-503-recovery-20261116" && (git switch trial/studybook-lab137-android-resume-503-recovery-20261116 || git switch --track origin/trial/studybook-lab137-android-resume-503-recovery-20261116) && git pull --ff-only origin trial/studybook-lab137-android-resume-503-recovery-20261116 && bash scripts/codespaces-lab137-autobuild.sh
```
- Non distribuire alcuna APK/ZIP o affermare successo prima di test verdi, SHA/manifest/firma, release GitHub verificata e collaudo Android (quest'ultimo successivo al download).
