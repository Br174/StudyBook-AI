#!/usr/bin/env bash
# LAB142: add ONLY the isolated /api/explained/v140 and optional /api/glossary/v140 routes to the existing
# Cloudflare trial124 Worker. Never touch production, create a paid service,
# rotate Gemini keys or change legacy /v126 and /reformulate contracts.
set -Eeuo pipefail
cd "$(dirname "$0")/.."
BRANCH='trial/studybook-lab142-epub-single-50-20261117'
BASE='https://studybook-ai-trial124.brunoverlezza.workers.dev'
fail(){ echo "[LAB142 WORKER BLOCCATO] $*" >&2; exit 1; }
[[ "$(git branch --show-current)" == "$BRANCH" ]] || fail 'Ramo LAB142 errato'
[[ "$(git rev-parse HEAD)" == "$(git rev-parse "refs/remotes/origin/$BRANCH")" ]] ||
 fail 'Checkout locale non allineato: git pull --ff-only'
grep -Fq '"name": "studybook-ai-trial124"' wrangler.trial124.jsonc ||
 fail 'Non è il Worker di prova esistente'
[[ -d node_modules ]] || fail 'Dipendenze esistenti mancanti'
for tool in curl node npm npx; do command -v "$tool" >/dev/null || fail "$tool non disponibile"; done
head_contract(){
 local endpoint="$1" header="$2" status headers
 headers="$(mktemp)"
 status="$(curl --silent --show-error --head --max-time 20 -D "$headers" -o /dev/null -w '%{http_code}' "$BASE$endpoint" || true)"
 if [[ "$status" == '405' ]] &&
   grep -Eiq "^$header:[[:space:]]*[^[:space:]]+[[:space:]]*$" "$headers"; then
  rm -f "$headers";return 0
 fi
 rm -f "$headers";return 1
}
check_legacy(){
 head_contract '/api/explained/v126' 'X-StudyBook-Quality-Contract' &&
 head_contract '/api/reformulate/v132' 'X-StudyBook-Riformula-Contract'
}
check_v138(){
 local headers status
 headers="$(mktemp)"
 status="$(curl --silent --show-error --head --max-time 20 -D "$headers" -o /dev/null -w '%{http_code}' "$BASE/api/explained/v138" || true)"
 if [[ "$status" == '405' ]] &&
   grep -Eiq '^X-StudyBook-Quality-Strategy-Contract:[[:space:]]*lab138-targeted-reliable-pages-v1[[:space:]]*$' "$headers" &&
   grep -Eiq '^X-StudyBook-Fixed-Model-Contract:[[:space:]]*lab134-fixed-gemini-3.1-flash-lite-v1[[:space:]]*$' "$headers"; then
  rm -f "$headers";return 0
 fi
 rm -f "$headers";return 1
}
check_v139(){
 local headers status
 headers="$(mktemp)"
 status="$(curl --silent --show-error --head --max-time 20 -D "$headers" -o /dev/null -w '%{http_code}' "$BASE/api/explained/v139" || true)"
 if [[ "$status" == '405' ]] &&
   grep -Eiq '^X-StudyBook-Fast-Contract:[[:space:]]*lab139-length-only-fast-v1[[:space:]]*$' "$headers" &&
   grep -Eiq '^X-StudyBook-Fixed-Model-Contract:[[:space:]]*lab134-fixed-gemini-3.1-flash-lite-v1[[:space:]]*$' "$headers"; then
  rm -f "$headers";return 0
 fi
 rm -f "$headers";return 1
}
check_v140(){
 local headers status
 headers="$(mktemp)"
 status="$(curl --silent --show-error --head --max-time 20 -D "$headers" -o /dev/null -w '%{http_code}' "$BASE/api/explained/v140" || true)"
 if [[ "$status" == '405' ]] &&
    grep -Eiq '^X-StudyBook-Glossary-Contract:[[:space:]]*lab140-glossary-one-pass-precision-v1[[:space:]]*$' "$headers" &&
    grep -Eiq '^X-StudyBook-Fixed-Model-Contract:[[:space:]]*lab134-fixed-gemini-3.1-flash-lite-v1[[:space:]]*$' "$headers"; then
  rm -f "$headers";return 0
 fi
 rm -f "$headers";return 1
}
check_manual_glossary(){
 local headers status
 headers="$(mktemp)"
 status="$(curl --silent --show-error --head --max-time 20 -D "$headers" -o /dev/null -w '%{http_code}' "$BASE/api/glossary/v140" || true)"
 if [[ "$status" == '405' ]] &&
    grep -Eiq '^X-StudyBook-Glossary-Manual-Contract:[[:space:]]*lab140-glossary-manual-optional-v1[[:space:]]*$' "$headers" &&
    grep -Eiq '^X-StudyBook-Fixed-Model-Contract:[[:space:]]*lab134-fixed-gemini-3.1-flash-lite-v1[[:space:]]*$' "$headers"; then
  rm -f "$headers";return 0
 fi
 rm -f "$headers";return 1
}
check_v141(){
 local headers status
 headers="$(mktemp)"
 status="$(curl --silent --show-error --head --max-time 20 -D "$headers" -o /dev/null -w '%{http_code}' "$BASE/api/explained/v141" || true)"
 if [[ "$status" == '405' ]] &&
    grep -Eiq '^X-StudyBook-Tail-Contract:[[:space:]]*lab141-endgame-two-repairs-one-pass-v1[[:space:]]*$' "$headers" &&
    grep -Eiq '^X-StudyBook-Fixed-Model-Contract:[[:space:]]*lab134-fixed-gemini-3.1-flash-lite-v1[[:space:]]*$' "$headers"; then
  rm -f "$headers";return 0
 fi
 rm -f "$headers";return 1
}
# LAB142 only changes EPUB text parsing and local routing. There is NO
# Worker source change, no deploy, no new service and no additional Gemini call.
check_legacy || fail 'Worker trial124 legacy v126/Riformula non disponibile'
check_v138 || fail 'Endpoint V138 mancante'
CHECK_STABLE=0
for attempt in 1 2 3 4 5 6 7 8; do
 if check_v139 && check_v140 && check_manual_glossary && check_v141; then
  CHECK_STABLE=$((CHECK_STABLE+1))
 else CHECK_STABLE=0;fi
 if [[ "$CHECK_STABLE" -ge 2 ]];then
  echo '[LAB142] Worker esistente V126/V138/V139/V140/V141 + glossario verificato due volte.'
  echo '[LAB142] Nessun deploy, modifica backend o chiamata Gemini.'
  exit 0
 fi
 [[ "$attempt" == 8 ]] || sleep 3
done
fail 'Worker LAB141 non confermato: conservare l’APK attuale; niente build LAB142.'
