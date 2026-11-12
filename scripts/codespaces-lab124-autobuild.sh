#!/usr/bin/env bash
# LAB124 Codespaces: sincronizzazione + build automatica all'apertura di VS Code.
# Non avvia GitHub Actions, non cambia ramo, non cancella file non tracciati.
set -Eeuo pipefail
umask 077
BRANCH='trial/studybook-lab124-endtoend-0of44-device-recovery-20261111'
BASE_SHA='ac786508fb66d4f5278b7479088a961172d4e284'
REPO='Br174/StudyBook-AI'
NAME='StudyBook-AI-TRIAL-124'
SCRIPT_DIR="$(cd -- "$(dirname -- "$0")" && pwd)"
cd "$SCRIPT_DIR/.."
STATE_DIR="$HOME/.local/share/studybook-lab124/autobuild"
mkdir -p "$STATE_DIR"
exec 9>"$STATE_DIR/lock"
if ! command -v flock >/dev/null 2>&1; then
  printf '[LAB124 AUTO] Blocco esecuzione unica assente; non avvio build.\n' >&2
  exit 1
fi
if ! flock -n 9; then
  printf '[LAB124 AUTO] Una build e gia in corso; evito duplicazioni.\n'
  exit 0
fi
report_failure() {
  local msg="$1"
  printf '[LAB124 AUTO BLOCCATO] %s\n' "$msg" >&2
  if command -v gh >/dev/null 2>&1; then
    gh issue comment 12 --repo "$REPO" --body "MotorLab LAB124 Codespaces autobuild - BLOCCATO. Diagnosi: $msg. Nessun file utente cancellato, nessuna GitHub Action, firma originale invariata." >/dev/null 2>&1 || true
  fi
  exit 1
}
command -v git >/dev/null 2>&1 || report_failure 'Git non disponibile'
[[ "$(git branch --show-current 2>/dev/null)" == "$BRANCH" ]] || report_failure 'Ramo diverso da LAB124: non compilo'
REMOTE_URL="$(git remote get-url origin 2>/dev/null)" || report_failure 'Remote origin non disponibile'
case "$REMOTE_URL" in
  'https://github.com/Br174/StudyBook-AI'|'https://github.com/Br174/StudyBook-AI.git'|'git@github.com:Br174/StudyBook-AI.git'|'ssh://git@github.com/Br174/StudyBook-AI.git') ;;
  *) report_failure 'Remote repository inatteso: non compilo' ;;
esac
command -v sha256sum >/dev/null 2>&1 || report_failure 'sha256sum non disponibile'
printf '[LAB124 AUTO] Verifico il ramo remoto LAB124.\n'
git fetch --quiet --no-tags origin "refs/heads/$BRANCH:refs/remotes/origin/$BRANCH" || report_failure 'Fetch LAB124 non riuscito'
REMOTE_REF="refs/remotes/origin/$BRANCH"
git merge-base --is-ancestor "$BASE_SHA" "$REMOTE_REF" || report_failure 'Ramo remoto senza correzione Scudo360 LAB124'
git merge-base --is-ancestor HEAD "$REMOTE_REF" || report_failure 'Commit locali divergenti: nessun reset o sovrascrittura'
# Preserva l'unica modifica locale Copilot nota, senza toccare gli altri file.
if ! git diff --quiet HEAD -- scripts/StudyBookCloudflare.mjs; then
  NOW="$(date -u +%Y%m%dT%H%M%SZ)"
  PATCH="$STATE_DIR/StudyBookCloudflare-Copilot-$NOW.patch"
  git diff --binary HEAD -- scripts/StudyBookCloudflare.mjs > "$PATCH" || report_failure 'Backup modifica Copilot non riuscito'
  [[ -s "$PATCH" ]] || report_failure 'Backup modifica Copilot vuoto; arresto sicuro'
  git stash push --quiet --message "LAB124-auto-preserva-Copilot-$NOW" -- scripts/StudyBookCloudflare.mjs || report_failure 'Stash Copilot non riuscito'
  git diff --quiet HEAD -- scripts/StudyBookCloudflare.mjs || report_failure 'Modifica Copilot non isolata'
  printf '[LAB124 AUTO] Modifica Copilot conservata in Git stash e patch, recuperabile.\n'
fi
git diff --quiet HEAD -- || report_failure 'Altre modifiche tracciate presenti: preservate; nessuna build'
if [[ "$(git rev-parse HEAD)" != "$(git rev-parse "$REMOTE_REF")" ]]; then
  git merge --ff-only "$REMOTE_REF" || report_failure 'Pull fast-forward non riuscito; file locali conservati'
fi
git merge-base --is-ancestor "$BASE_SHA" HEAD || report_failure 'HEAD privo del checkpoint LAB124 corretto'
grep -q 'EXPLAINED_TARGET_V122=50' src/lib/explainedPolicyV122.js || report_failure 'Target 50% assente: non compilo'
grep -q 'Libro spiegato · unica versione' src/components/AppScreens.jsx || report_failure 'Versione unica del Libro spiegato non verificata'
git diff --quiet HEAD -- || report_failure 'File tracciati modificati dopo la sincronizzazione'
HEAD_SHA="$(git rev-parse HEAD)"
HEAD_SHORT="$(printf '%.12s' "$HEAD_SHA")"
OUT="$PWD/artifacts/LAB124-CODESPACES"
APK="$OUT/$NAME.apk"
ZIP="$OUT/$NAME.zip"
IDENTITY="$OUT/$NAME-IDENTITY.txt"
CHECKSUM="$OUT/$NAME.sha256"
if [[ -s "$APK" && -s "$ZIP" && -s "$IDENTITY" && -s "$CHECKSUM" ]] &&
   grep -Fxq "source=$HEAD_SHA" "$IDENTITY" &&
   (cd "$OUT" && sha256sum -c "$NAME.sha256" >/dev/null 2>&1); then
  printf '[LAB124 AUTO] APK gia verificata per %s: pubblico/linko senza ricompilare.\n' "$HEAD_SHORT"
  bash scripts/codespaces-lab124-publish.sh || report_failure 'APK pronta, pubblicazione GitHub fallita'
  exit 0
fi
# Protezione quota Codespaces se il browser apre e chiude la stessa cartella spesso.
LAST_ATTEMPT="$STATE_DIR/last-attempt-$HEAD_SHA"
NOW_SEC="$(date +%s)"
if [[ -f "$LAST_ATTEMPT" ]]; then
  LAST_SEC="$(cat "$LAST_ATTEMPT" 2>/dev/null || echo 0)"
  if [[ "$LAST_SEC" =~ ^[0-9]+$ ]] && (( NOW_SEC >= LAST_SEC && NOW_SEC - LAST_SEC < 21600 )); then
    printf '[LAB124 AUTO] Tentativo recente: pausa anti-consumo di 6 ore per questo commit.\n'
    exit 0
  fi
fi
printf '%s\n' "$NOW_SEC" > "$LAST_ATTEMPT"
printf '[LAB124 AUTO] Avvio Scudo360 + Android APK/ZIP su %s.\n' "$HEAD_SHORT"
bash scripts/codespaces-lab124-build.sh
if [[ ! -s "$APK" || ! -s "$ZIP" || ! -s "$IDENTITY" ]] ||
   ! grep -Fxq "source=$HEAD_SHA" "$IDENTITY"; then
  report_failure 'Build conclusa ma APK/ZIP non verificabili'
fi
bash scripts/codespaces-lab124-publish.sh || report_failure 'APK compilata ma pubblicazione GitHub non riuscita'
printf '[LAB124 AUTO] APK e ZIP LAB124 pronti: %s\n' "$OUT"
