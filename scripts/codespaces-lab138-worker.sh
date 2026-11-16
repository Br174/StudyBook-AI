#!/usr/bin/env bash
# LAB138: add ONLY the isolated /api/explained/v138 route to the existing
# Cloudflare trial124 Worker. Never touch production, create a paid service,
# rotate Gemini keys or change legacy /v126 and /reformulate contracts.
set -Eeuo pipefail
cd "$(dirname "$0")/.."
BRANCH='trial/studybook-lab138-quality-yield-checkpoint-20261116'
BASE='https://studybook-ai-trial124.brunoverlezza.workers.dev'
fail(){ echo "[LAB138 WORKER BLOCCATO] $*" >&2; exit 1; }
[[ "$(git branch --show-current)" == "$BRANCH" ]] || fail 'Ramo LAB138 errato'
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
check_legacy || fail 'Worker trial124 esistente non corrisponde ai contratti verificati LAB136/LAB137'
if check_v138; then
 echo '[LAB138] Route nuova già disponibile: nessun nuovo deploy.'
 exit 0
fi
node scripts/test-lab138-quality-yield.mjs ||
 fail 'Test qualità/503/checkpoint fallito: niente deploy'
node scripts/test-lab135-worker.mjs ||
 fail 'Vecchio contratto v126 modificato: niente deploy'
node scripts/test-lab132-manual-worker.mjs ||
 fail 'Riformula V132 modificata: niente deploy'
npx --no-install wrangler whoami >/dev/null 2>&1 ||
 fail 'Cloudflare non autenticato sul Codespace esistente. Non creo account né servizi.'
export VITE_NATIVE_API_BASE="$BASE"
export VITE_STUDYBOOK_TRIAL_111=1 VITE_STUDYBOOK_TRIAL_113=1 VITE_STUDYBOOK_TRIAL_114=1
export VITE_STUDYBOOK_TRIAL_121=1 VITE_STUDYBOOK_TRIAL_122=1 VITE_STUDYBOOK_TRIAL_123=1
export VITE_STUDYBOOK_TRIAL_124=1 VITE_STUDYBOOK_TRIAL_125=1 VITE_STUDYBOOK_TRIAL_126=1
export VITE_STUDYBOOK_TRIAL_127=1 VITE_STUDYBOOK_TRIAL_128=1 VITE_STUDYBOOK_TRIAL_129=1
export VITE_STUDYBOOK_TRIAL_130=1 VITE_STUDYBOOK_GEOMETRY_V78=1 WRANGLER_SEND_METRICS=false
npm run build || fail 'Build asset di prova fallita'
npx --no-install wrangler deploy --dry-run --config wrangler.trial124.jsonc >/dev/null ||
 fail 'Worker dry-run fallito'
echo '[LAB138] Aggiorno SOLO trial124 con la nuova route; le route vecchie restano compatibili.'
npx --no-install wrangler deploy --config wrangler.trial124.jsonc >/dev/null ||
 fail 'Deploy trial124 fallito'
successful=0
for attempt in 1 2 3 4 5 6 7 8 9; do
 if check_legacy && check_v138; then successful=$((successful+1));else successful=0;fi
 if [[ "$successful" -ge 2 ]];then
  echo '[LAB138] Contratti v126, v138 e Riformula verificati due volte; nessuna richiesta Gemini.'
  exit 0
 fi
 [[ "$attempt" == 9 ]] || sleep 4
done
fail 'Worker trial124 aggiornato ma contratti non verificabili su più POP. APK LAB138 bloccata.'
