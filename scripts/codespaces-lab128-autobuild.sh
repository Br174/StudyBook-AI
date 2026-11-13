#!/usr/bin/env bash
# LAB128: compile and deliver from the user's EXISTING Codespace, without GitHub Actions.
set -Eeuo pipefail
umask 077
REPO='Br174/StudyBook-AI'
BRANCH='trial/studybook-lab128-provider-overload-recovery-20261113'
BASE='e2c7d2918f5fc5b08a98be562e6bfdf82068ad13'
NAME='StudyBook-AI-TRIAL-128'
cd "$(dirname "$0")/.."
ROOT="$PWD"
STATE="$HOME/.local/share/studybook-lab128/autobuild"
mkdir -p "$STATE"
command -v flock >/dev/null || { echo '[LAB128] flock non disponibile'; exit 1; }
exec 9>"$STATE/lock"
flock -n 9 || { echo '[LAB128] Altra compilazione già attiva: attendere il suo esito, nessun duplicato.' >&2; exit 75; }
fail(){ echo "[LAB128 BLOCCATO] $*" >&2; exit 1; }
for tool in git node npm gh; do command -v "$tool" >/dev/null || fail "$tool non disponibile"; done
[[ "$(git branch --show-current)" == "$BRANCH" ]] || fail 'Selezionare il ramo LAB128: non compilo altri rami'
[[ -d "$ROOT/node_modules" ]] || fail 'node_modules mancanti. Non modifico il workspace.'
case "$(git remote get-url origin)" in
  https://github.com/Br174/StudyBook-AI|https://github.com/Br174/StudyBook-AI.git|git@github.com:Br174/StudyBook-AI.git|ssh://git@github.com/Br174/StudyBook-AI.git) ;;
  *) fail 'Origine GitHub inattesa';;
esac
git fetch --quiet --no-tags origin "refs/heads/$BRANCH:refs/remotes/origin/$BRANCH" ||
  fail 'Aggiornamento remoto non riuscito'
REF="refs/remotes/origin/$BRANCH"
git merge-base --is-ancestor "$BASE" "$REF" || fail 'Checkpoint didattico LAB128 non verificato'
SHA="$(git rev-parse "$REF")"
SHORT="$(printf '%.12s' "$SHA")"
TAG="studybook-trial128-codespaces-$SHORT"
ARTIFACT_DIR="$ROOT/APK-LAB128"
mkdir -p "$ARTIFACT_DIR"
copy_artifacts(){
  local origin="$1" file
  [[ -s "$origin/$NAME-IDENTITY.txt" ]] || fail 'Identità dell’APK non disponibile'
  grep -Fxq "source=$SHA" "$origin/$NAME-IDENTITY.txt" ||
    fail 'Artefatto non derivato dal commit corrente'
  grep -Fxq 'signerSha256=D7BB9315C9C4351872495478610C484725086E2BABBC04BEC65EC823455FBDCC' "$origin/$NAME-IDENTITY.txt" ||
    fail 'Artefatto con firma non verificata'
  grep -Fxq 'versionCode=2026112801' "$origin/$NAME-IDENTITY.txt" ||
    fail 'Artefatto con versione Android errata'
  (cd "$origin" && sha256sum -c "$NAME.sha256" >/dev/null &&
   unzip -tq "$NAME.zip" >/dev/null) ||
    fail 'Hash/ZIP non integri: non riuso questo artefatto'
  for file in "$NAME.apk" "$NAME.zip" "$NAME.sha256" "$NAME-IDENTITY.txt"; do
    [[ -s "$origin/$file" ]] || fail "Artefatto compilato assente: $file"
    cp -f "$origin/$file" "$ARTIFACT_DIR/$file"
  done
  chmod 0644 "$ARTIFACT_DIR"/*
  printf '\n[LAB128] APK e ZIP nel workspace: %s\n' "$ARTIFACT_DIR"
  ls -lh "$ARTIFACT_DIR/$NAME.apk" "$ARTIFACT_DIR/$NAME.zip"
}
for candidate in "$STATE"/job-*/repo; do
  [[ -d "$candidate/.git" ]] || continue
  if [[ "$(git -C "$candidate" rev-parse HEAD 2>/dev/null || true)" == "$SHA" ]] &&
     [[ -s "$candidate/artifacts/LAB128-CODESPACES/$NAME.apk" ]] &&
     [[ -s "$candidate/artifacts/LAB128-CODESPACES/$NAME.zip" ]]; then
    echo '[LAB128] Riuso APK gia firmata senza ricompilare.'
    copy_artifacts "$candidate/artifacts/LAB128-CODESPACES"
    (cd "$candidate" && bash scripts/codespaces-lab128-publish.sh) ||
      echo '[LAB128] Release GitHub non autorizzata: APK e ZIP disponibili sul Codespace.'
    exit 0
  fi
done
JOB="$(mktemp -d "$STATE/job-XXXXXXXX")"
WORK="$JOB/repo"
git clone --quiet --local --no-hardlinks --no-checkout "$ROOT" "$WORK" ||
  fail 'Impossibile creare il clone isolato'
git -C "$WORK" remote set-url origin "$(git remote get-url origin)"
git -C "$WORK" fetch --quiet --no-tags origin "refs/heads/$BRANCH:refs/remotes/origin/$BRANCH" ||
  fail 'Impossibile ottenere il ramo di compilazione'
[[ "$(git -C "$WORK" rev-parse "refs/remotes/origin/$BRANCH")" == "$SHA" ]] ||
  fail 'Ramo aggiornato durante la preparazione: ripetere in sicurezza'
git -C "$WORK" checkout --quiet -B "$BRANCH" "$SHA" ||
  fail 'Checkout codice LAB128 fallito'
ln -s "$ROOT/node_modules" "$WORK/node_modules" ||
  fail 'Impossibile riusare le dipendenze del Codespace'
echo "[LAB128] Eseguo test, Scudo360 e APK/ZIP dal commit $SHORT."
if ! (cd "$WORK" && bash scripts/codespaces-lab128-build.sh); then
  fail 'Compilazione o preflight non superati: nessuna APK incompleta consegnata'
fi
copy_artifacts "$WORK/artifacts/LAB128-CODESPACES"
if (cd "$WORK" && bash scripts/codespaces-lab128-publish.sh); then
  echo "[LAB128] Release: https://github.com/$REPO/releases/tag/$TAG"
else
  echo '[LAB128] GitHub Releases non disponibile. Scaricare i file dal Codespace.'
fi
# A private forwarded port enables downloading from Android Chrome.
if command -v python3 >/dev/null && ! (echo > /dev/tcp/127.0.0.1/8766) 2>/dev/null; then
  nohup python3 -m http.server 8766 --bind 0.0.0.0 --directory "$ARTIFACT_DIR" \
    >"$STATE/file-server-8766.log" 2>&1 </dev/null &
  echo '[LAB128] File scaricabili tramite porta privata Codespaces 8766.'
fi
echo '[LAB128] Compilazione COMPLETATA. Nessuna GitHub Action avviata.'
