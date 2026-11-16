#!/usr/bin/env bash
# Pubblicazione APK/ZIP verificati da Codespaces. Non avvia GitHub Actions.
set -Eeuo pipefail
umask 077
REPO='Br174/StudyBook-AI'
BRANCH='trial/studybook-lab141-final-tail-50pct-20261116'
NAME='StudyBook-AI-TRIAL-141'
BASE='3248e0ae61c3e9b4d446f32829970f43f26c0dd8'
cd "$(dirname "$0")/.."
fail(){ printf '[LAB141 PUBBLICAZIONE BLOCCATA] %s\n' "$*" >&2; exit 1; }
[[ "$(git branch --show-current)" == "$BRANCH" ]] || fail 'Ramo LAB141 non attivo'
git merge-base --is-ancestor "$BASE" HEAD || fail 'Revisione LAB141 errata'
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
console.log('[LAB141] Controllo workflow superato: release/tag non devono avviare Actions.');
NODE
OUT="$PWD/artifacts/LAB141-CODESPACES"
SHA="$(git rev-parse HEAD)"
SHORT="$(printf '%.12s' "$SHA")"
TAG="studybook-trial141-codespaces-$SHORT"
for f in "$NAME.apk" "$NAME.zip" "$NAME.sha256" "$NAME-IDENTITY.txt" "$NAME-SORGENTI.zip"; do
  [[ -s "$OUT/$f" ]] || fail "Artefatto assente: $f"
done
grep -Fxq "source=$SHA" "$OUT/$NAME-IDENTITY.txt" || fail 'Identita APK differente dal commit'
grep -Fxq 'signerSha256=D7BB9315C9C4351872495478610C484725086E2BABBC04BEC65EC823455FBDCC' "$OUT/$NAME-IDENTITY.txt" || fail 'Firma originale non confermata'
grep -Fxq 'appId=it.studybook.ai.lab.trial111' "$OUT/$NAME-IDENTITY.txt" || fail 'Application ID errato'
grep -Fxq 'versionCode=2026114101' "$OUT/$NAME-IDENTITY.txt" || fail 'VersionCode errato'
(cd "$OUT" && sha256sum -c "$NAME.sha256" >/dev/null) || fail 'Hash APK errato'
(cd "$OUT" && unzip -tq "$NAME.zip" >/dev/null && unzip -tq "$NAME-SORGENTI.zip" >/dev/null) || fail 'ZIP non integri'
if gh release view "$TAG" --repo "$REPO" >/dev/null 2>&1; then
  ASSETS="$(gh release view "$TAG" --repo "$REPO" --json assets --jq '.assets[].name')" || fail 'Release gia esistente non verificabile'
  for f in "$NAME.apk" "$NAME.zip" "$NAME.sha256" "$NAME-IDENTITY.txt" "$NAME-SORGENTI.zip"; do
    printf '%s\n' "$ASSETS" | grep -Fxq "$f" || fail "Release precedente incompleta: $f"
  done
  printf '[LAB141] Release gia verificata: %s\n' "$TAG"
else
  gh release create "$TAG" \
    "$OUT/$NAME.apk" "$OUT/$NAME.zip" "$OUT/$NAME.sha256" "$OUT/$NAME-IDENTITY.txt" "$OUT/$NAME-SORGENTI.zip" \
    --repo "$REPO" --target "$SHA" \
    --title 'StudyBook AI TRIAL141 — Velocità e affidabilità del libro spiegato — Codespaces' \
    --notes 'LAB141: sblocca il completamento 41/44 della modalità rapida risolvendo il conflitto tra massimo 2 correzioni e precedente controllo terminale da 5. Recupera checkpoint esauriti localmente senza ripetere pagine già conformi; se tre pagine restano fuori intervallo le rende disponibili CON RISERVA, senza falsa conformità al 50%. Nelle correzioni ancora disponibili richiede numericamente circa 50% nella STESSA chiamata Gemini, no fasi aggiuntive, glossario automatico LAB140 e on-demand invariati. Target 50%, banda interna 40-60, Gemini 3.1 fisso, Worker gratuito trial124, firma Android originale, Scudo360 e test. Nessun collaudo smartphone ancora dichiarato.' \
    --prerelease || fail 'Pubblicazione GitHub non riuscita'
fi
URL="https://github.com/$REPO/releases/tag/$TAG"
printf '[LAB141] APK e ZIP scaricabili: %s\n' "$URL"
gh issue comment 12 --repo "$REPO" --body "MotorLab LAB141: compilazione e pubblicazione Codespaces, commit $SHA. Release: $URL. Firma e Scudo360 verificati dallo script. Collaudo Android ancora necessario." >/dev/null 2>&1 || true
