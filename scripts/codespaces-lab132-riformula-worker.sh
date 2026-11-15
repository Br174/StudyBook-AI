#!/usr/bin/env bash
# LAB132.4 deploys ONLY existing studybook-ai-trial124, never production.
# The dedicated route /api/reformulate/v132 needs no new paid service.
set -Eeuo pipefail
cd "$(dirname "$0")/.."
fail(){ echo "[LAB132 RIFORMULA BLOCCATA] $*" >&2; exit 1; }
BRANCH='trial/studybook-lab132-reformulation-library-20261114'
URL='https://studybook-ai-trial124.brunoverlezza.workers.dev/api/reformulate/v132'
[[ "$(git branch --show-current)" == "$BRANCH" ]] || fail 'Ramo LAB132 errato'
[[ "$(git rev-parse HEAD)" == "$(git rev-parse "refs/remotes/origin/$BRANCH")" ]] ||
 fail 'Sorgenti locali non allineati: fare prima git pull --ff-only'
grep -Fq '"name": "studybook-ai-trial124"' wrangler.trial124.jsonc ||
 fail 'Il target Worker non corrisponde al trial124 esistente'
[[ -d node_modules ]] || fail 'Dipendenze già installate assenti'
command -v curl >/dev/null || fail 'curl assente'
probe(){
 local headers status
 headers="$(mktemp)"
 status="$(curl --silent --show-error --head --max-time 18 -D "$headers" -o /dev/null -w '%{http_code}' "$URL" || true)"
 if [[ "$status" == '405' ]] &&
  grep -Eiq '^X-StudyBook-Riformula-Contract:[[:space:]]*lab132-manual-riformula-v2[[:space:]]*$' "$headers"; then
  rm -f "$headers";return 0
 fi
 rm -f "$headers";return 1
}
if probe; then
 echo '[LAB132] Worker Riformula già pubblicato: nessun nuovo deploy.'
 exit 0
fi
command -v npx >/dev/null || fail 'npx assente'
if ! npx --no-install wrangler whoami >/dev/null 2>&1; then
 fail 'Cloudflare non autenticato nel Codespace. Non creo un account né un Worker nuovo.'
fi
echo '[LAB132] Aggiorno SOLO il Worker trial124 esistente con la route dedicata.'
export VITE_NATIVE_API_BASE='https://studybook-ai-trial124.brunoverlezza.workers.dev'
export VITE_STUDYBOOK_TRIAL_111=1 VITE_STUDYBOOK_TRIAL_113=1 VITE_STUDYBOOK_TRIAL_114=1
export VITE_STUDYBOOK_TRIAL_121=1 VITE_STUDYBOOK_TRIAL_122=1 VITE_STUDYBOOK_TRIAL_123=1
export VITE_STUDYBOOK_TRIAL_124=1 VITE_STUDYBOOK_TRIAL_125=1 VITE_STUDYBOOK_TRIAL_126=1
export VITE_STUDYBOOK_TRIAL_127=1 VITE_STUDYBOOK_TRIAL_128=1 VITE_STUDYBOOK_TRIAL_129=1
export VITE_STUDYBOOK_TRIAL_130=1 VITE_STUDYBOOK_GEOMETRY_V78=1 WRANGLER_SEND_METRICS=false
npm run build || fail 'Build frontend prova non riuscita'
node scripts/test-lab132-manual-worker.mjs ||
 fail 'Test Riformula dedicato non superato'
npx --no-install wrangler deploy --dry-run --config wrangler.trial124.jsonc >/dev/null ||
 fail 'Verifica Worker dry-run non superata'
npx --no-install wrangler deploy --config wrangler.trial124.jsonc >/dev/null ||
 fail 'Aggiornamento Worker trial124 non riuscito'
for attempt in 1 2 3 4 5 6; do
 if probe; then
  echo '[LAB132] Worker Riformula aggiornato e verificato.'
  exit 0
 fi
 [[ "$attempt" == 6 ]] || sleep 4
done
fail 'Worker aggiornato non verificabile. Nessuna APK incompatibile consentita.'
