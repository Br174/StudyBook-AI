#!/usr/bin/env bash
# Pubblicazione APK/ZIP verificati da Codespaces. Non avvia GitHub Actions.
set -Eeuo pipefail
umask 077
REPO='Br174/StudyBook-AI'
BRANCH='trial/studybook-lab124-endtoend-0of44-device-recovery-20261111'
NAME='StudyBook-AI-TRIAL-124'
BASE='ac786508fb66d4f5278b7479088a961172d4e284'
cd "$(dirname "$0")/.."
fail(){ printf '[LAB124 PUBBLICAZIONE BLOCCATA] %s\n' "$*" >&2; exit 1; }
[[ "$(git branch --show-current)" == "$BRANCH" ]] || fail 'Ramo LAB124 non attivo'
git merge-base --is-ancestor "$BASE" HEAD || fail 'Revisione LAB124 errata'
command -v gh >/dev/null || fail 'GitHub CLI assente'
gh auth status -h github.com >/dev/null 2>&1 || fail 'GitHub CLI non autenticata'
# Evita di generare persino indirettamente un evento Actions attraverso un tag/release.
node --input-type=module <<'NODE'
import fs from 'node:fs';
import path from 'node:path';
const dir='.github/workflows';
for(const name of fs.readdirSync(dir).filter(x=>/\.ya?ml$/i.test(x))){
  const lines=fs.readFileSync(path.join(dir,name),'utf8').split(/\r?\n/);
  let i=lines.findIndex(l=>/^on\s*:/u.test(l));
  if(i<0)continue;
  const h=lines[i].replace(/^on\s*:\s*/u,'').trim();
  let events=[],sections={},current='';
  if(h){
    if(/^\[[^\]]+\]$/u.test(h))events=h.slice(1,-1).split(',').map(x=>x.trim().replace(/["']/gu,''));
    else if(/^[a-z_-]+$/u.test(h))events=[h];
    else throw Error('Evento YAML ambiguo: '+name);
  } else {
    for(let j=i+1;j<lines.length;j++){
      const line=lines[j];
      if(/^\S/u.test(line)&&! /^\s*#/u.test(line))break;
      if(/^  ([a-zA-Z_-]+)\s*:/u.test(line)){
        current=line.match(/^  ([a-zA-Z_-]+)\s*:/u)[1];
        events.push(current);sections[current]=[];
      }else if(current)sections[current].push(line);
    }
  }
  if(events.includes('release')||events.includes('create'))throw Error('Workflow attivabile da tag/release: '+name);
  if(events.includes('push')){
    const pushLines=sections.push||[];
    const branchesOnly=pushLines.some(l=>/^    branches\s*:/u.test(l));
    const tagged=pushLines.some(l=>/^    tags\s*:/u.test(l));
    if(!branchesOnly||tagged)throw Error('Workflow push puo avviarsi su tag: '+name);
  }
}
console.log('[LAB124] Controllo workflow superato: release/tag non devono avviare Actions.');
NODE
OUT="$PWD/artifacts/LAB124-CODESPACES"
SHA="$(git rev-parse HEAD)"
SHORT="$(printf '%.12s' "$SHA")"
TAG="studybook-trial124-codespaces-$SHORT"
for f in "$NAME.apk" "$NAME.zip" "$NAME.sha256" "$NAME-IDENTITY.txt" "$NAME-SORGENTI.zip"; do
  [[ -s "$OUT/$f" ]] || fail "Artefatto assente: $f"
done
grep -Fxq "source=$SHA" "$OUT/$NAME-IDENTITY.txt" || fail 'Identita APK differente dal commit'
grep -Fxq 'signerSha256=D7BB9315C9C4351872495478610C484725086E2BABBC04BEC65EC823455FBDCC' "$OUT/$NAME-IDENTITY.txt" || fail 'Firma originale non confermata'
grep -Fxq 'appId=it.studybook.ai.lab.trial111' "$OUT/$NAME-IDENTITY.txt" || fail 'Application ID errato'
grep -Fxq 'versionCode=2026112403' "$OUT/$NAME-IDENTITY.txt" || fail 'VersionCode errato'
grep -Fxq 'backendSourceGuidanceRevision=2' "$OUT/$NAME-IDENTITY.txt" || fail 'Worker LAB124 non verificato'
(cd "$OUT" && sha256sum -c "$NAME.sha256" >/dev/null) || fail 'Hash APK errato'
(cd "$OUT" && unzip -tq "$NAME.zip" >/dev/null && unzip -tq "$NAME-SORGENTI.zip" >/dev/null) || fail 'ZIP non integri'
if gh release view "$TAG" --repo "$REPO" >/dev/null 2>&1; then
  ASSETS="$(gh release view "$TAG" --repo "$REPO" --json assets --jq '.assets[].name')" || fail 'Release gia esistente non verificabile'
  for f in "$NAME.apk" "$NAME.zip" "$NAME.sha256" "$NAME-IDENTITY.txt" "$NAME-SORGENTI.zip"; do
    printf '%s\n' "$ASSETS" | grep -Fxq "$f" || fail "Release precedente incompleta: $f"
  done
  printf '[LAB124] Release gia verificata: %s\n' "$TAG"
else
  gh release create "$TAG" \
    "$OUT/$NAME.apk" "$OUT/$NAME.zip" "$OUT/$NAME.sha256" "$OUT/$NAME-IDENTITY.txt" "$OUT/$NAME-SORGENTI.zip" \
    --repo "$REPO" --target "$SHA" \
    --title 'StudyBook AI TRIAL124 — Libro spiegato ~50% — Codespaces' \
    --notes 'APK di prova compilata da Codespaces, una sola versione Libro spiegato con glossario e checkpoint. Scudo360 e firma originale sono obbligatori nello script locale. Test Android reale ancora necessario. GitHub Actions non usato per la build.' \
    --prerelease || fail 'Pubblicazione GitHub non riuscita'
fi
URL="https://github.com/$REPO/releases/tag/$TAG"
printf '[LAB124] APK e ZIP scaricabili: %s\n' "$URL"
gh issue comment 12 --repo "$REPO" --body "MotorLab LAB124: compilazione e pubblicazione Codespaces, commit $SHA. Release: $URL. Firma e Scudo360 verificati dallo script. Collaudo Android ancora necessario." >/dev/null 2>&1 || true
