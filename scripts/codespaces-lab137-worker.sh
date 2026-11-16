#!/usr/bin/env bash
# LAB137 changes only the Android foreground recovery. The already-verified
# trial124 Worker remains untouched. Read-only contract checks: zero deployments.
set -Eeuo pipefail
cd "$(dirname "$0")/.."
BRANCH='trial/studybook-lab137-android-resume-503-recovery-20261116'
BASE='https://studybook-ai-trial124.brunoverlezza.workers.dev'
fail(){ printf '[LAB137 WORKER PRECHECK BLOCCATO] %s\n' "$*" >&2; exit 1; }
[[ "$(git branch --show-current)" == "$BRANCH" ]] || fail 'Ramo LAB137 errato'
command -v curl >/dev/null || fail 'curl non disponibile'
probe(){
 local headers code
 headers="$(mktemp)"
 code="$(curl -sS -I --max-time 15 -D "$headers" -o /dev/null -w '%{http_code}' "$BASE/api/explained/v126" || true)"
 if [[ "$code" != 405 ]] ||
   ! grep -Eiq '^X-StudyBook-Phase-Contract:[[:space:]]*lab126[[:space:]]*$' "$headers" ||
   ! grep -Eiq '^X-StudyBook-Recovery-Contract:[[:space:]]*lab127[[:space:]]*$' "$headers" ||
   ! grep -Eiq '^X-StudyBook-Fixed-Model-Contract:[[:space:]]*lab134-fixed-gemini-3.1-flash-lite-v1[[:space:]]*$' "$headers" ||
   ! grep -Eiq '^X-StudyBook-One-Pass-Contract:[[:space:]]*lab135-explain-first-v1[[:space:]]*$' "$headers" ||
   ! grep -Eiq '^X-StudyBook-Quality-Contract:[[:space:]]*lab136-balanced-page-v1[[:space:]]*$' "$headers"; then
   rm -f "$headers";return 1
 fi
 : > "$headers"
 code="$(curl -sS -I --max-time 15 -D "$headers" -o /dev/null -w '%{http_code}' "$BASE/api/reformulate/v132" || true)"
 if [[ "$code" != 405 ]] ||
  ! grep -Eiq '^X-StudyBook-Riformula-Contract:[[:space:]]*lab132-manual-riformula-v2[[:space:]]*$' "$headers"; then
  rm -f "$headers";return 1
 fi
 rm -f "$headers";return 0
}
successful=0
for attempt in 1 2 3 4 5 6; do
 if probe; then successful=$((successful+1)); else successful=0; fi
 if [[ "$successful" -ge 2 ]]; then
  echo '[LAB137] Worker trial124 verificato in sola lettura. Nessun deploy e nessuna richiesta Gemini.'
  exit 0
 fi
 [[ "$attempt" == 6 ]] || sleep 4
done
fail 'Contratto Worker di prova LAB136 non verificabile. Conservo il backend e la APK precedente.'
