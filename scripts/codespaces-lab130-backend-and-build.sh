#!/usr/bin/env bash
# LAB130: safely update existing TRIAL124 Worker after mock tests, then build Android.
# Never deploy main/prod Worker, never create another key, runner or paid service.
set -Eeuo pipefail
cd "$(dirname "$0")/.."
BRANCH='trial/studybook-lab130-on-demand-study-formats-20261114'
CONFIG='wrangler.trial124.jsonc'
WORKER='https://studybook-ai-trial124.brunoverlezza.workers.dev'
[[ "$(git branch --show-current)" = "$BRANCH" ]] ||
 { echo '[LAB130] Ramo errato: nessun deploy o APK.' >&2; exit 1; }
[[ -f "$CONFIG" ]] || { echo '[LAB130] Configurazione trial assente.' >&2; exit 1; }
grep -Fq '"name": "studybook-ai-trial124"' "$CONFIG" ||
 { echo '[LAB130] La destinazione NON è il Worker trial autorizzato.' >&2; exit 1; }
command -v curl >/dev/null && command -v npm >/dev/null ||
 { echo '[LAB130] curl/npm non presenti.' >&2; exit 1; }
check(){
 local route="$1" marker="$2" headers code
 headers="$(mktemp)"
 code="$(curl -sS --head --max-time 18 -D "$headers" -o /dev/null -w '%{http_code}' "$WORKER$route" || true)"
 if [[ "$code" = 405 ]] && grep -Eiq "$marker" "$headers"; then
  rm -f "$headers";return 0
 fi
 rm -f "$headers";return 1
}
OLD="^X-StudyBook-Recovery-Contract:[[:space:]]*lab127[[:space:]]*$"
NEW="^X-StudyBook-Tools-Contract:[[:space:]]*lab130[[:space:]]*$"
check '/api/explained/v126' "$OLD" ||
 { echo '[LAB130] Vecchio Worker LAB127 non disponibile: stop.' >&2; exit 1; }
if check '/api/study-tools/v130' "$NEW"; then
 echo '[LAB130] Worker trial LAB130 già configurato: nessun deploy duplicato.'
else
 echo '[LAB130] Nuovo endpoint Gemini assente. Preflight prima di pubblicare SOLO il Worker trial.'
 if [[ ! -f node_modules/@capacitor-community/file-opener/package.json ]]; then
  npm install --no-save --package-lock=false --ignore-scripts --no-audit --no-fund @capacitor-community/file-opener@8.0.1 ||
   { echo '[LAB130] Dipendenza Android gratuita non disponibile.' >&2; exit 1; }
 fi
 npm run test:lab130 || { echo '[LAB130] Test regressione falliti: stop.' >&2; exit 1; }
 npm run build || { echo '[LAB130] Build web fallita: stop.' >&2; exit 1; }
 npx --no-install wrangler deploy --config "$CONFIG" --dry-run ||
  { echo '[LAB130] Controllo Cloudflare trial fallito: stop.' >&2; exit 1; }
 echo '[LAB130] Aggiorno soltanto lo stesso Worker di prova. Nessun deploy produzione.'
 npx --no-install wrangler deploy --config "$CONFIG" ||
  { echo '[LAB130] Deploy Worker trial fallito: APK bloccata.' >&2; exit 1; }
fi
STABLE=0
for attempt in 1 2 3 4 5 6 7 8 9; do
 if check '/api/explained/v126' "$OLD" &&
    check '/api/study-tools/v130' "$NEW"; then
  STABLE=$((STABLE+1))
  if [[ "$STABLE" -ge 2 ]]; then break; fi
 else
  STABLE=0
  echo "[LAB130] Propagazione Worker trial: controllo $attempt/9."
 fi
 [[ "$attempt" -eq 9 ]] || sleep 4
done
[[ "$STABLE" -ge 2 ]] ||
 { echo '[LAB130] Il Worker non presenta i due contratti richiesti. APK bloccata.' >&2; exit 1; }
echo '[LAB130] Contratti LAB127 e LAB130 verificati. Procedo alla APK firmata.'
bash scripts/codespaces-lab130-autobuild.sh
