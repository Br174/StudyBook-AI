#!/usr/bin/env bash
# StudyBook LAB124 — auto build Codespaces in clone isolato, workspace utente intatto.
set -Eeuo pipefail
umask 077
BRANCH='trial/studybook-lab124-endtoend-0of44-device-recovery-20261111'
BASE_SHA='ac786508fb66d4f5278b7479088a961172d4e284'
REPO='Br174/StudyBook-AI'
NAME='StudyBook-AI-TRIAL-124'
cd "$(dirname "$0")/.."
ROOT="$PWD"
STATE="$HOME/.local/share/studybook-lab124/autobuild"
mkdir -p "$STATE"
exec 9>"$STATE/lock"
command -v flock >/dev/null || { echo '[LAB124] flock assente: auto-build fermato'; exit 1; }
flock -n 9 || { echo '[LAB124] Build gia in esecuzione: non duplico'; exit 0; }
fail(){
  local reason="$1"
  echo "[LAB124 AUTO BLOCCATO] $reason" >&2
  if command -v gh >/dev/null 2>&1; then
    gh issue comment 12 --repo "$REPO" --body "MotorLab LAB124 Codespaces isolato: BLOCCATO. Motivo: $reason. Workspace utente preservato. Nessuna Action avviata." >/dev/null 2>&1 || true
  fi
  exit 1
}
for cmd in git node npm gh; do command -v "$cmd" >/dev/null || fail "Strumento mancante: $cmd"; done
[[ "$(git branch --show-current)" == "$BRANCH" ]] || fail 'Workspace non associato al ramo LAB124; nessun altro ramo viene compilato'
REMOTE_URL="$(git remote get-url origin 2>/dev/null)" || fail 'Origine GitHub non disponibile'
case "$REMOTE_URL" in
  'https://github.com/Br174/StudyBook-AI'|'https://github.com/Br174/StudyBook-AI.git'|'git@github.com:Br174/StudyBook-AI.git'|'ssh://git@github.com/Br174/StudyBook-AI.git') ;;
  *) fail 'Repo origin diverso da Br174/StudyBook-AI' ;;
esac
[[ -d "$ROOT/node_modules" ]] || fail 'node_modules non disponibile nel Codespace corrente'
printf '[LAB124 AUTO] Recupero il ramo remoto corretto senza modificare i file locali.\n'
git fetch --quiet --no-tags origin "refs/heads/$BRANCH:refs/remotes/origin/$BRANCH" || fail 'Fetch remoto LAB124 non riuscito'
REMOTE_REF="refs/remotes/origin/$BRANCH"
git merge-base --is-ancestor "$BASE_SHA" "$REMOTE_REF" || fail 'Checkpoint LAB124 e correzione Scudo360 assenti'
SHA="$(git rev-parse "$REMOTE_REF")"
SHORT="$(printf '%.12s' "$SHA")"
TAG="studybook-trial124-codespaces-$SHORT"
if gh release view "$TAG" --repo "$REPO" >/dev/null 2>&1; then
  LIST="$(gh release view "$TAG" --repo "$REPO" --json assets --jq '.assets[].name')" || fail 'Release esistente non leggibile'
  for name in "$NAME.apk" "$NAME.zip" "$NAME.sha256" "$NAME-IDENTITY.txt" "$NAME-SORGENTI.zip"; do
    printf '%s\n' "$LIST" | grep -Fxq "$name" || fail 'Release esistente incompleta'
  done
  printf '[LAB124] Release gia verificata: https://github.com/%s/releases/tag/%s\n' "$REPO" "$TAG"
  exit 0
fi
# Riutilizza artefatti gia firmati se l'upload si era interrotto.
for candidate in "$STATE"/job-*/repo; do
  [[ -d "$candidate/.git" ]] || continue
  if [[ "$(git -C "$candidate" rev-parse HEAD 2>/dev/null)" == "$SHA" ]] &&
     [[ -s "$candidate/artifacts/LAB124-CODESPACES/$NAME.apk" ]] &&
     [[ -s "$candidate/artifacts/LAB124-CODESPACES/$NAME.zip" ]] &&
     grep -Fxq "source=$SHA" "$candidate/artifacts/LAB124-CODESPACES/$NAME-IDENTITY.txt"; then
    printf '[LAB124 AUTO] APK locale gia firmata: riprendo solo la pubblicazione.\n'
    (cd "$candidate" && bash scripts/codespaces-lab124-publish.sh) || fail 'Pubblicazione della build precedente fallita'
    exit 0
  fi
done
LAST="$STATE/last-attempt-$SHA"
NOW_SEC="$(date +%s)"
if [[ -f "$LAST" ]]; then
  OLD="$(cat "$LAST" 2>/dev/null || echo 0)"
  if [[ "$OLD" =~ ^[0-9]+$ ]] && ((NOW_SEC >= OLD && NOW_SEC - OLD < 21600)); then
    printf '[LAB124 AUTO] Tentativo rinviato: pausa anti-consumo di 6 ore.\n'
    exit 0
  fi
fi
printf '%s\n' "$NOW_SEC" > "$LAST"
JOB="$(mktemp -d "$STATE/job-XXXXXXXX")"
WORK="$JOB/repo"
git clone --quiet --local --no-hardlinks --no-checkout "$ROOT" "$WORK" || fail 'Clone isolato non riuscito'
git -C "$WORK" remote set-url origin "$REMOTE_URL" || fail 'Origine clone isolato non configurabile'
git -C "$WORK" fetch --quiet --no-tags origin "refs/heads/$BRANCH:refs/remotes/origin/$BRANCH" || fail 'Fetch clone isolato non riuscito'
[[ "$(git -C "$WORK" rev-parse "refs/remotes/origin/$BRANCH")" == "$SHA" ]] || fail 'SHA differente durante la sincronizzazione'
git -C "$WORK" checkout --quiet -B "$BRANCH" "$SHA" || fail 'Ramo LAB124 non selezionabile nel clone isolato'
[[ ! -e "$WORK/node_modules" ]] || fail 'Dipendenze inattese nel clone: blocco'
ln -s "$ROOT/node_modules" "$WORK/node_modules" || fail 'Dipendenze Codespaces non riutilizzabili'
(cd "$WORK" && grep -q 'EXPLAINED_TARGET_V122=50' src/lib/explainedPolicyV122.js) || fail 'Target 50% assente'
(cd "$WORK" && grep -q 'Libro spiegato · unica versione' src/components/StudyPhaseProgressV59.jsx) || fail 'Schermata a versione unica assente'
printf '[LAB124 AUTO] Compilazione isolata del commit %s, senza Actions.\n' "$SHORT"
(cd "$WORK" && bash scripts/codespaces-lab124-build.sh) || fail 'Compilazione Android/Scudo360 fallita'
(cd "$WORK" && bash scripts/codespaces-lab124-publish.sh) || fail 'APK compilata ma pubblicazione automatica fallita'
printf '[LAB124 AUTO] APK+ZIP pubblicati: https://github.com/%s/releases/tag/%s\n' "$REPO" "$TAG"
