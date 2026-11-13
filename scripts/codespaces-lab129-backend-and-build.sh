#!/usr/bin/env bash
# LAB129: existing Codespace, read-only verification of the LAB127 trial Worker.
# UI/quiz restore and inherited LAB128 retry require NO Cloudflare deployment.
set -Eeuo pipefail
cd "$(dirname "$0")/.."
BRANCH='trial/studybook-lab129-mobile-reader-tools-layout-20261113'
[[ "$(git branch --show-current)" == "$BRANCH" ]] ||
  { echo '[LAB129] Ramo errato. Nessuna compilazione.' >&2; exit 1; }
command -v curl >/dev/null || { echo '[LAB129] curl non disponibile.' >&2; exit 1; }
WORKER='https://studybook-ai-trial124.brunoverlezza.workers.dev'
check(){
  local tmp code
  tmp="$(mktemp)"
  code="$(curl -sS --head --max-time 18 -D "$tmp" -o /dev/null -w '%{http_code}'     "$WORKER/api/explained/v126" || true)"
  if [[ "$code" = 405 ]] &&
     grep -Eiq '^X-StudyBook-Phase-Contract:[[:space:]]*lab126[[:space:]]*$' "$tmp" &&
     grep -Eiq '^X-StudyBook-Recovery-Contract:[[:space:]]*lab127[[:space:]]*$' "$tmp"; then
     rm -f "$tmp";return 0
  fi
  rm -f "$tmp";return 1
}
echo '[LAB129] Verifico Worker LAB127 esistente: nessuna modifica a Cloudflare.'
stable=0
for attempt in 1 2 3 4 5 6 7 8 9; do
 if check; then
   stable=$((stable+1))
   if [[ "$stable" -ge 2 ]]; then break; fi
 else
   stable=0
   echo "[LAB129] Endpoint non stabile: controllo $attempt/9."
 fi
 [[ "$attempt" -eq 9 ]] || sleep 4
done
[[ "$stable" -ge 2 ]] ||
  { echo '[LAB129] Worker non compatibile: stop senza APK o deploy.' >&2; exit 1; }
echo '[LAB129] Worker verificato. Test, Scudo360, firma originale, APK e ZIP in Codespaces.'
bash scripts/codespaces-lab129-autobuild.sh
