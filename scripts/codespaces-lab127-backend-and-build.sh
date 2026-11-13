#!/usr/bin/env bash
# LAB127 explicit user-invoked path: deploy only on --deploy-test-worker.
# Preserves existing LAB124 endpoints, no production service or paid upgrade.
set -Eeuo pipefail
cd "$(dirname "$0")/.."
[[ "$(git branch --show-current)" == 'trial/studybook-lab127-nonblocking-recovery-20261113' ]] ||
  { echo '[LAB127] Ramo errato. Nessun deploy.' >&2; exit 1; }
command -v curl >/dev/null && command -v npm >/dev/null && command -v node >/dev/null ||
  { echo '[LAB127] curl, node e npm sono richiesti.' >&2; exit 1; }
WORKER='https://studybook-ai-trial124.brunoverlezza.workers.dev'
probe(){
  local path="$1" headers code
  headers="$(mktemp)"
  code="$(curl -sS --head --max-time 18 -D "$headers" -o /dev/null -w '%{http_code}' "$WORKER$path" || true)"
  if [[ "$path" == '/api/explained/v126' ]]; then
    [[ "$code" = 405 ]] && grep -Eiq '^X-StudyBook-Phase-Contract:[[:space:]]*lab126[[:space:]]*$' "$headers" && grep -Eiq '^X-StudyBook-Recovery-Contract:[[:space:]]*lab127[[:space:]]*$' "$headers"
  else
    [[ "$code" = 405 ]]
  fi
  local result=$?
  rm -f "$headers"
  return "$result"
}
echo '[LAB127] Verifico il nuovo endpoint, nessuna chiamata Gemini.'
if ! probe '/api/explained/v126'; then
  [[ "$#" -ge 1 && "$1" == '--deploy-test-worker' ]] || {
    echo '[LAB127] Worker compatibile non ancora pubblicato.' >&2
    echo '[LAB127] Per aggiornare il Worker DI PROVA eseguire lo script con --deploy-test-worker.' >&2
    exit 1
  }
  echo '[LAB127] Controllo di sicurezza dell’endpoint gia esistente.'
  probe '/api/explained/v122' ||
    { echo '[LAB127] API precedente non risponde come previsto. Nessun deploy.' >&2; exit 1; }
  command -v npx >/dev/null ||
    { echo '[LAB127] npx assente.' >&2; exit 1; }
  if ! npx --no-install wrangler whoami >/dev/null 2>&1; then
    echo '[LAB127] Cloudflare non autenticato. Non eseguo deploy o addebiti.' >&2
    echo '[LAB127] Accesso Cloudflare necessario nel Codespace; mai incollare chiavi nella chat.' >&2
    exit 1
  fi
  echo '[LAB127] Test locali e compilazione frontend prima di qualsiasi deploy.'
  npm run test:lab127
  npm run build
  WRANGLER_SEND_METRICS=false npx --no-install wrangler deploy --dry-run --config wrangler.trial124.jsonc ||
    { echo '[LAB127] Dry-run Worker fallita. Nessun deploy.' >&2; exit 1; }
  echo '[LAB127] Aggiungo la rotta v126 SOLO al Worker DI PROVA trial124.'
  WRANGLER_SEND_METRICS=false npx --no-install wrangler deploy --config wrangler.trial124.jsonc ||
    { echo '[LAB127] Deploy fallito; nessuna APK incompatibile.' >&2; exit 1; }
  echo '[LAB127] Verifico che entrambe le API rispondano.'
  probe '/api/explained/v122' ||
    { echo '[LAB127] API precedente v122 non disponibile. APK bloccata.' >&2; exit 1; }
  STABLE=0
  for attempt in 1 2 3 4 5 6 7 8 9; do
    if probe '/api/explained/v126'; then
      STABLE=$((STABLE+1))
      if [[ "$STABLE" -ge 2 ]]; then break; fi
    else
      STABLE=0
      echo "[LAB127] Propagazione Worker trial in corso: verifica $attempt/9."
    fi
    [[ "$attempt" -eq 9 ]] || sleep 4
  done
  [[ "$STABLE" -ge 2 ]] ||
    { echo '[LAB127] Worker LAB127 non stabile su due letture consecutive. APK bloccata.' >&2; exit 1; }
fi
echo '[LAB127] Worker compatibile. Compilo APK+ZIP firmati, senza GitHub Actions.'
bash scripts/codespaces-lab127-autobuild.sh
