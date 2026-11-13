#!/usr/bin/env bash
# LAB127 Codespaces: Android APK+ZIP isolati, riuso workflow GitHub, senza Actions.
set -Eeuo pipefail
umask 077
BRANCH='trial/studybook-lab127-nonblocking-recovery-20261113'
BASE_SHA='23fe1c657bcc9a772a23e087c2efff58d98bb22a'
REPO='Br174/StudyBook-AI'
CERT='D7BB9315C9C4351872495478610C484725086E2BABBC04BEC65EC823455FBDCC'
APP_ID='it.studybook.ai.lab.trial111'
VERSION_CODE='2026112701'
VERSION_NAME='0.3.127-prova.1'
NAME='StudyBook-AI-TRIAL-127'
WORKER_URL='https://studybook-ai-trial124.brunoverlezza.workers.dev'
TOOLS="$HOME/.local/share/studybook-lab125" # Riuso SDK/Java/Node originali LAB125
ANDROID_HOME="$TOOLS/android-sdk"
ANDROID_SDK_ROOT="$ANDROID_HOME"
OUT="$PWD/artifacts/LAB127-CODESPACES"
TMP=''
CHANGED=0
PHASE='preflight'
BLOCK_REASON='Interruzione di un comando o della connessione Codespaces'
say() { printf '\n[LAB127] %s\n' "$*"; }
fail() { BLOCK_REASON="$*"; printf '\n[LAB127 BLOCCATO - %s] %s\n' "$PHASE" "$*" >&2; exit 1; }
report_status() {
  local status="$1" code="$2" reason="$3" sha
  sha="$(git rev-parse --short HEAD 2>/dev/null || printf 'HEAD-non-disponibile')"
  # Solo diagnostica minimizzata e predeterminata: non pubblicare log, token, ambienti, keystore o contenuto di libri.
  local body="MotorLab LAB127 Codespaces — **${status}**\n\n- Fase: \`${PHASE}\`\n- Codice uscita: \`${code}\`\n- Commit: \`${sha}\`\n- Diagnosi: ${reason}\n- Privacy: nessun log completo, nessuna credenziale o firma caricata."
  if [[ "$status" == BLOCCATO && "$PHASE" == test && "$reason" == 'Scudo360 fallito' && -s "$OUT/scudo360-report.json" && -f scripts/lab124-scudo-safe-diagnostic.mjs ]]; then
    local detail
    detail="$(node scripts/lab124-scudo-safe-diagnostic.mjs "$OUT/scudo360-report.json" 2>/dev/null)" || detail='Safe classification unavailable'
    body="$body\n\n$detail"
  fi
  if gh issue comment 12 --repo "$REPO" --body "$(printf '%b' "$body")" >/dev/null 2>&1; then
    printf '\n[LAB127] Stato comunicato automaticamente a MotorLab: https://github.com/%s/issues/12\n' "$REPO"
  else
    printf '\n[LAB127] Impossibile inviare il rapporto GitHub; nessuna credenziale pubblicata.\n' >&2
  fi
}
cleanup() {
  local code=$?
  trap - EXIT
  if [[ "$CHANGED" = 1 && -n "$TMP" && -f "$TMP/original-capacitor.json" ]]; then
    cp "$TMP/original-capacitor.json" capacitor.config.json || true
  fi
  if [[ "$code" != 0 ]]; then
    printf '\n[LAB127] Interrotto in fase %s (codice %s).\n' "$PHASE" "$code" >&2
    report_status BLOCCATO "$code" "$BLOCK_REASON" || true
  elif [[ "$PHASE" = complete ]]; then
    report_status VERIFICATO 0 'Artefatti LAB127 creati e verificati localmente; collaudo sul telefono ancora necessario' || true
  fi
  if [[ -n "$TMP" && -d "$TMP" ]]; then rm -rf "$TMP"; fi
}
trap cleanup EXIT
# Read-only reuse of the EXISTING Scudo360 report; no Java, SDK, tests or build repeated.
if [[ "${1:-}" == '--diagnose' ]]; then
  PHASE='scudo360-diagnostica'
  REPORT='artifacts/LAB127-CODESPACES/scudo360-report.json'
  [[ -s "$REPORT" ]] || fail "Rapporto Scudo360 locale non trovato: $REPORT"
  command -v node >/dev/null || fail 'Node.js non disponibile'
  command -v gh >/dev/null || fail 'GitHub CLI non disponibile'
  BODY="$(node --input-type=module - "$REPORT" <<'NODE'
import fs from 'node:fs';
const report=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
if(report.gate!=='MotorLab-Scudo360')throw Error('Formato report Scudo360 inatteso');
const safeId=x=>String(x||'').replace(/[^a-zA-Z0-9._-]/g,'').slice(0,120);
const suites=(report.suites||[]).map(s=>({id:safeId(s.id),status:safeId(s.status),exitCode:s.exitCode??'null',tests:s.tests??0,failures:s.failures??0,errors:s.errors??0,skipped:s.skipped??0}));
const contracts=(report.contracts||[]).filter(c=>c.status!=='passed').map(c=>safeId(c.id)+':'+safeId(c.status));
const preflight=(report.preflight?.errors||[]).map(e=>safeId(e.code));
const errors=(report.errors||[]).map(e=>safeId(e.code)+':'+safeId(e.detail));
const lines=['**SCUDO360 — diagnostica locale LAB127**',
'Risultato: '+(report.passed?'PASS':'FAILED'),
'Preflight: '+(report.preflight?.valid?'PASS':'FAILED'),
'Suites:'];
for(const s of suites)lines.push('- '+s.id+' = '+s.status+'; exit='+s.exitCode+'; tests='+s.tests+'; failures='+s.failures+'; errors='+s.errors+'; skipped='+s.skipped);
lines.push('Contratti non superati: '+(contracts.join(', ')||'nessuno'));
lines.push('Errori preflight: '+(preflight.join(', ')||'nessuno'));
lines.push('Errori valutazione: '+(errors.join(', ')||'nessuno'));
lines.push('Rapporto limitato a identificativi e conteggi. Nessun log, testo, token, credenziale o keystore.');
process.stdout.write(lines.join('\n'));
NODE
)" || fail 'Non posso analizzare il report Scudo360'
  [[ -n "$BODY" ]] || fail 'Report diagnostico vuoto'
  SAFE_DETAIL="$(node scripts/lab124-scudo-safe-diagnostic.mjs "$REPORT")" || fail 'Classificazione sicura del test Cloudflare fallita'
  BODY="$BODY

$SAFE_DETAIL"
  gh issue comment 12 --repo "$REPO" --body "$BODY" >/dev/null || fail 'Invio diagnostica a GitHub non riuscito'
  say 'Diagnostica Scudo360 pubblicata nel registro privato GitHub Issue #12.'
  exit 0
fi
for program in git node npm curl unzip zip sha256sum gh tar df; do
  command -v "$program" >/dev/null || fail "Strumento mancante: $program"
done
[[ "$(git branch --show-current)" = "$BRANCH" ]] || fail 'Non sei sul ramo LAB127'
git merge-base --is-ancestor "$BASE_SHA" HEAD || fail 'Codespace non aggiornato al checkpoint corretto LAB127: non compilo APK vecchie'
[[ "$(node -p "require('./capacitor.config.json').appId")" = 'it.studybook.ai.lab' ]] || fail 'App ID sorgente inatteso'
git diff --quiet -- capacitor.config.json || fail 'capacitor.config.json già modificato: non sovrascrivo'
[[ "$(uname -m)" = x86_64 ]] || fail 'Supportato solo Codespaces Linux x86_64'
FREE_GB="$(df -Pk . | awk 'NR==2 {printf "%d", $4/1024/1024}')"
[[ "$FREE_GB" -ge 7 ]] || fail 'Spazio insufficiente, servono almeno 7 GB liberi'
[[ -d node_modules ]] || fail 'node_modules non presente: preservo package-lock.json, installazione manuale necessaria'

# LAB127 Worker may return old routes briefly during Cloudflare edge propagation.
# Bounded read-only HEAD retries. No Gemini or deployment requests.
PHASE='backend-preflight'
say 'Verifico il Worker LAB127 con retry di propagazione, senza chiamare Gemini.'
WORKER_HEADERS="$(mktemp)"
BACKEND_STABLE=0
BACKEND_READY=0
BACKEND_HTTP=''
for attempt in 1 2 3 4 5 6 7 8 9; do
  : > "$WORKER_HEADERS"
  BACKEND_HTTP="$(curl -sS --head --max-time 18 -D "$WORKER_HEADERS" -o /dev/null -w '%{http_code}' "$WORKER_URL/api/explained/v126" || true)"
  if [[ "$BACKEND_HTTP" == '405' ]] && grep -Eiq '^X-StudyBook-Phase-Contract:[[:space:]]*lab126[[:space:]]*$' "$WORKER_HEADERS" && grep -Eiq '^X-StudyBook-Recovery-Contract:[[:space:]]*lab127[[:space:]]*$' "$WORKER_HEADERS"; then
    BACKEND_STABLE=$((BACKEND_STABLE+1))
    if [[ "$BACKEND_STABLE" -ge 2 ]]; then BACKEND_READY=1; break; fi
  else
    BACKEND_STABLE=0
    say "Worker LAB127 in propagazione: HTTP $BACKEND_HTTP, verifica $attempt/9"
  fi
  [[ "$attempt" -eq 9 ]] || sleep 4
done
rm -f "$WORKER_HEADERS"
[[ "$BACKEND_READY" == 1 ]] || fail "Worker LAB127 non compatibile dopo 9 controlli HEAD: fase LAB126 e recovery LAB127 richiesti. Ultimo HTTP $BACKEND_HTTP. Nessuna APK incompatibile compilata."
PHASE='preflight'
say 'Worker LAB127 confermato due volte consecutive, procedo con la firma originale.'
mkdir -p "$TOOLS" "$OUT"
TMP="$(mktemp -d)"
cp capacitor.config.json "$TMP/original-capacitor.json"
say 'Nessuna modifica a main, nessun commit/push e nessuna GitHub Action.'

# Only full APK mode needs the private signer. Targeted Scudo must not access keystores.
if [[ "${1:-}" != '--scudo-only' ]]; then
  PHASE='signer-preflight'
  say 'Verifico subito l’accesso all’artefatto della firma originale, prima di consumare risorse di compilazione.'
  gh auth status -h github.com >/dev/null 2>&1 || fail 'GitHub CLI non autenticata: impossibile recuperare la firma originale'
  mkdir -p "$TMP/signing"
  # GitHub's artifact service may return transient 5xx even for an unexpired signer.
  # Bounded recovery only: never create or substitute a signing identity.
  # Optional restored original signing key, fingerprint verified before signing.
  if [[ -n "${STUDYBOOK_ORIGINAL_KEYSTORE:-}" && -s "${STUDYBOOK_ORIGINAL_KEYSTORE}" ]]; then
    KEY="${STUDYBOOK_ORIGINAL_KEYSTORE}"
    SIGNER_READY=1
    say 'Keystore originale locale: verifica certificato prima di firmare.'
  else
  SIGNER_READY=0
  for attempt in 1 2 3; do
    # Remove only this invocation's temporary partial download, never a real user file.
    rm -rf "$TMP/signing"
    mkdir -p "$TMP/signing"
    if gh run download 37467723184 --repo "$REPO" --name StudyBook-LAB01-signing-recovery --dir "$TMP/signing" >/dev/null 2>&1; then
      if [[ -s "$TMP/signing/lab01-debug.keystore" ]]; then
        SIGNER_READY=1
        break
      fi
    fi
    if [[ "$attempt" -lt 3 ]]; then
      say "Firma LAB01: tentativo $attempt non riuscito; nuova verifica limitata."
      sleep $((attempt * 2))
    fi
  done
  [[ "$SIGNER_READY" == 1 ]] || fail 'Artefatto firma originale non recuperabile dopo 3 tentativi; nessuna chiave sostitutiva'
  KEY="$TMP/signing/lab01-debug.keystore"
  fi
fi

PHASE='node22'
# Match the canonical LAB127 Actions workflow (actions/setup-node@v4, node-version 22).
# Do not change the system's Node 24 installation or package-lock.json.
if [[ "$(node -p 'process.versions.node.split(".")[0]')" != 22 ]]; then
  NODE22_BIN="$TOOLS/node22/bin/node"
  if [[ ! -x "$NODE22_BIN" ]]; then
    say 'LAB127 ufficiale usa Node 22; preparo Node 22 isolato con SHA256 ufficiale.'
    curl -fLsS --retry 2 --max-time 30 https://nodejs.org/dist/index.json -o "$TMP/node-index.json" || fail 'Indice versioni ufficiali Node.js non disponibile'
    VERSION="$(node -e 'const versions=require(process.argv[1]);const a=versions.find(x=>/^v22[.][0-9]+[.][0-9]+$/.test(x.version)&&x.files?.includes("linux-x64"));if(!a)process.exit(1);console.log(a.version)' "$TMP/node-index.json")" || fail 'Impossibile individuare Node 22 ufficiale'
    [[ "$VERSION" =~ ^v22[.][0-9]+[.][0-9]+$ ]] || fail 'Versione Node 22 non valida'
    TARBALL="node-$VERSION-linux-x64.tar.gz"
    BASE_URL="https://nodejs.org/dist/$VERSION"
    curl -fLsS --retry 2 --max-time 30 "$BASE_URL/SHASUMS256.txt" -o "$TMP/node22-sha.txt" || fail 'Checksum ufficiale Node 22 non raggiungibile'
    HASH="$(awk -v f="$TARBALL" '$2==f {print $1}' "$TMP/node22-sha.txt")"
    [[ "$HASH" =~ ^[a-fA-F0-9]{64}$ ]] || fail 'Checksum Node 22 non valido'
    curl -fLsS --retry 2 "$BASE_URL/$TARBALL" -o "$TMP/node22.tar.gz" || fail 'Download Node 22 fallito'
    printf '%s  %s\n' "$HASH" "$TMP/node22.tar.gz" | sha256sum -c - >/dev/null || fail 'Checksum Node 22 errato'
    mkdir -p "$TOOLS/node22"
    tar -xzf "$TMP/node22.tar.gz" -C "$TOOLS/node22" --strip-components=1 || fail 'Estrazione Node 22 fallita'
  fi
  export PATH="$TOOLS/node22/bin:$PATH"
fi
[[ "$(node -p 'process.versions.node.split(".")[0]')" == 22 ]] || fail 'Node 22 non disponibile'
say "Node allineato al workflow LAB127: $(node --version)"

# LAB127 targeted validation: no Android SDK/Java work, no Gemini requests, no deployment.
if [[ "${1:-}" == '--scudo-only' ]]; then
  PHASE='test'
  say 'Eseguo solo Scudo360 con Node 22 e codice Cloudflare corrente.'
  [[ -s dist/index.html ]] || fail 'Asset web mancanti; non eseguo test con build incompleta'
  node .motorlab/regression/scudo360-gate.mjs .motorlab/scudo360-contracts.json lab "$OUT/scudo360-report.json" || fail 'Scudo360 fallito'
  PHASE='scudo-only-complete'
  say 'Scudo360 superato con Node 22. APK e ZIP NON generati da questo controllo.'
  report_status SCUDO_PASS 0 'Solo Scudo360 superato con Node 22; APK e ZIP ancora da compilare' || true
  exit 0
fi

PHASE='java21'
if ! java -version 2>&1 | head -n 1 | grep -Eq '"21[.]'; then
  JDK="$TOOLS/temurin-21"
  if [[ ! -x "$JDK/bin/java" ]]; then
    say 'Scarico Temurin JDK 21 da Adoptium con verifica checksum SHA256.'
    API='https://api.adoptium.net/v3/assets/latest/21/hotspot?architecture=x64&heap_size=normal&image_type=jdk&jvm_impl=hotspot&os=linux&vendor=eclipse'
    curl -fLsS --retry 3 "$API" -o "$TMP/java.json" || fail 'API Adoptium non disponibile'
    node -e 'const p=require(process.argv[1])[0]?.binary?.package;if(!p?.link||!/^[a-f0-9]{64}$/i.test(p.checksum||""))process.exit(1);console.log(p.link);console.log(p.checksum)' "$TMP/java.json" > "$TMP/java-info.txt" || fail 'Metadati Adoptium non validi'
    JDK_URL="$(sed -n '1p' "$TMP/java-info.txt")"
    JDK_HASH="$(sed -n '2p' "$TMP/java-info.txt")"
    curl -fLsS --retry 3 "$JDK_URL" -o "$TMP/jdk.tar.gz" || fail 'Download Java fallito'
    printf '%s  %s\n' "$JDK_HASH" "$TMP/jdk.tar.gz" | sha256sum -c - >/dev/null || fail 'Checksum Java errato'
    mkdir -p "$JDK"
    tar -xzf "$TMP/jdk.tar.gz" -C "$JDK" --strip-components=1 || fail 'Estrazione Java fallita'
  fi
  export JAVA_HOME="$JDK"
  export PATH="$JAVA_HOME/bin:$PATH"
else
  export JAVA_HOME="$(dirname "$(dirname "$(readlink -f "$(command -v java)")")")"
fi
java -version 2>&1 | head -n 1
java -version 2>&1 | head -n 1 | grep -Eq '"21[.]' || fail 'Java 21 non attivo'
command -v keytool >/dev/null || fail 'keytool mancante'

PHASE='sdk'
SDKMANAGER="$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager"
if [[ ! -x "$SDKMANAGER" ]]; then
  say 'Scarico Command-line Tools Android ufficiali, SHA256 verificato.'
  URL='https://dl.google.com/android/repository/commandlinetools-linux-15859902_latest.zip'
  HASH='4e4c464f145a7512b57d088ac6c278c03c9eea610886b35a5e0804e74eedf583'
  curl -fLsS --retry 3 "$URL" -o "$TMP/sdk.zip" || fail 'Download Android SDK fallito'
  printf '%s  %s\n' "$HASH" "$TMP/sdk.zip" | sha256sum -c - >/dev/null || fail 'Checksum Android SDK errato'
  mkdir -p "$TMP/unpack" "$ANDROID_HOME/cmdline-tools"
  unzip -q "$TMP/sdk.zip" -d "$TMP/unpack" || fail 'Estrazione SDK fallita'
  [[ -f "$TMP/unpack/cmdline-tools/bin/sdkmanager" ]] || fail 'Layout SDK inatteso'
  mv "$TMP/unpack/cmdline-tools" "$ANDROID_HOME/cmdline-tools/latest"
fi
export ANDROID_HOME ANDROID_SDK_ROOT
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"
say 'Installo Android API 36, build-tools 36.0.0, platform-tools usando le licenze SDK del workflow LAB127.'
(yes || true) | "$SDKMANAGER" --sdk_root="$ANDROID_HOME" --licenses >/dev/null 2>&1 || fail 'Licenze SDK non accettate'
"$SDKMANAGER" --sdk_root="$ANDROID_HOME" 'platforms;android-36' 'build-tools;36.0.0' 'platform-tools' || fail 'Installazione SDK fallita'
[[ -x "$ANDROID_HOME/build-tools/36.0.0/apksigner" ]] || fail 'apksigner mancante'
[[ -x "$ANDROID_HOME/cmdline-tools/latest/bin/apkanalyzer" ]] || fail 'apkanalyzer mancante'

PHASE='web'
say 'Compilo asset web con endpoint e flag LAB127 esatti.'
export VITE_NATIVE_API_BASE="$WORKER_URL"
export VITE_STUDYBOOK_TRIAL_111=1 VITE_STUDYBOOK_TRIAL_113=1 VITE_STUDYBOOK_TRIAL_114=1
export VITE_STUDYBOOK_TRIAL_121=1 VITE_STUDYBOOK_TRIAL_122=1 VITE_STUDYBOOK_TRIAL_123=1
export VITE_STUDYBOOK_TRIAL_124=1 VITE_STUDYBOOK_TRIAL_125=1 VITE_STUDYBOOK_TRIAL_126=1 VITE_STUDYBOOK_TRIAL_127=1 VITE_STUDYBOOK_GEOMETRY_V78=1 WRANGLER_SEND_METRICS=false
npm run build || fail 'Build web fallita'
for marker in "$WORKER_URL" 'lab111-original-letters-retention-one-call-v1' 'studybook-503-one-shot-flashlite-v114' 'lab122-one-explained-glossary-v1' 'lab126-whole-book-comprehension-v1' 'lab127-automatic-recovery-v1'; do
  grep -RqlF "$marker" dist/assets/ || fail "Marker web mancante: $marker"
done

PHASE='test'
say 'Eseguo Scudo360, test locali e verifiche statiche LAB127.'
node .motorlab/regression/scudo360-gate.mjs .motorlab/scudo360-contracts.json lab "$OUT/scudo360-report.json" || fail 'Scudo360 fallito'
for testname in \
  test-lab79-quality-no-loop test-lab79-targeted-recalibration \
  test-lab109-worker-contract test-lab110-source-ledger-contract \
  test-lab110b-worker-contract test-lab110-source-risk-replay \
  test-lab111-lean-worker test-lab111-2000-pages test-lab113-traffic-pacing \
  test-lab114-one-shot-failover test-lab121-private-worker \
  test-lab122-single-explained test-lab124-large-call-parity \
  test-lab123-503-recovery test-lab122-recovery test-lab122-pdf-render \
  test-lab125-hardening test-lab125-didactic-matrix \
  test-lab127-nonblocking-recovery test-lab127-worker-contract test-lab127-codespaces-preflight; do
  say "Test: $testname"
  node "scripts/$testname.mjs" || fail "Test fallito: $testname"
done
node --check src/lib/draftFirstV57.js || fail 'Sintassi draft non valida'
node --check api/editionsBulkV51.js || fail 'Sintassi API non valida'
say 'Remote provider tests and extra Cloudflare checks skipped as requested.'
say 'Non eseguo test Gemini reali, per evitare richieste API e costi.'

# LAB127: user directs all live testing from Android APK. No backend probe or Cloudflare deployment.
HTTP="$BACKEND_HTTP"
GUIDANCE='LAB127_ROUTE_VERIFIED'
say 'Endpoint Worker LAB127 verificato con HEAD; nessun test Gemini reale eseguito.'

PHASE='capacitor'
say 'Genero package Android di prova; non cancello versioni Android già esistenti.'
[[ ! -e android ]] || fail 'Cartella android già presente: protezione anti-sovrascrittura'
node --input-type=module -e '
import {readFileSync,writeFileSync} from "node:fs";
const p="capacitor.config.json",x=JSON.parse(readFileSync(p,"utf8"));
if(x.appId!=="it.studybook.ai.lab")process.exit(1);
x.appId="it.studybook.ai.lab.trial111";
x.appName="StudyBook AI Prova 127";
writeFileSync(p,JSON.stringify(x,null,2)+"\n");
' || fail 'Configurazione Capacitor non valida'
CHANGED=1
npx --no-install cap add android || fail 'Capacitor add fallito'
npx --no-install cap sync android || fail 'Capacitor sync fallito'
export STUDYBOOK_APPLICATION_ID="$APP_ID" STUDYBOOK_VERSION_CODE="$VERSION_CODE" STUDYBOOK_VERSION_NAME="$VERSION_NAME"
node scripts/prepare-android.mjs || fail 'Preparazione Android fallita'

PHASE='gradle'
say 'Compilo APK con Gradle locale.'
(cd android && chmod +x gradlew && ./gradlew --no-daemon --max-workers=2 assembleDebug) || fail 'Gradle fallito'
APK='android/app/build/outputs/apk/debug/app-debug.apk'
[[ -s "$APK" ]] || fail 'APK assente'

PHASE='signing'
say 'Verifico che il keystore privato recuperato all’inizio sia quello originale.'
ACTUAL="$(keytool -list -v -keystore "$KEY" -storepass android -alias androiddebugkey 2>/dev/null | sed -n 's/.*SHA256: //p' | head -n 1 | tr -d ':[:space:]' | tr '[:lower:]' '[:upper:]')"
[[ "$ACTUAL" = "$CERT" ]] || fail 'Fingerprint del keystore errato: NON firmo'
SIGNED="$TMP/$NAME-signed.apk"
"$ANDROID_HOME/build-tools/36.0.0/apksigner" sign --ks "$KEY" --ks-key-alias androiddebugkey --ks-pass pass:android --key-pass pass:android --out "$SIGNED" "$APK" || fail 'Firma fallita'
"$ANDROID_HOME/build-tools/36.0.0/apksigner" verify --verbose --print-certs "$SIGNED" > "$TMP/cert.txt" || fail 'Verifica firma APK fallita'
FINAL="$(sed -n 's/.*certificate SHA-256 digest: //p' "$TMP/cert.txt" | head -n 1 | tr -d ':[:space:]' | tr '[:lower:]' '[:upper:]')"
[[ "$FINAL" = "$CERT" ]] || fail 'Certificato APK diverso dall’originale'
[[ "$("$ANDROID_HOME/cmdline-tools/latest/bin/apkanalyzer" manifest application-id "$SIGNED")" = "$APP_ID" ]] || fail 'applicationId errato'
[[ "$("$ANDROID_HOME/cmdline-tools/latest/bin/apkanalyzer" manifest version-code "$SIGNED")" = "$VERSION_CODE" ]] || fail 'versionCode errato'

PHASE='package'
say 'Confeziono APK, ZIP installer, sorgenti e checksum.'
cp "$SIGNED" "$OUT/$NAME.apk"
(cd "$OUT" && sha256sum "$NAME.apk" > "$NAME.sha256")
{
  echo 'Mode=INSTALLABLE_TEST_ONLY'
  echo "source=$(git rev-parse HEAD)"
  echo "appId=$APP_ID"
  echo "versionCode=$VERSION_CODE"
  echo "versionName=$VERSION_NAME"
  echo "signerSha256=$CERT"
  echo "backendHttp=$HTTP"
  echo 'realGeminiTest=USER_ANDROID_QA_PENDING'
  echo 'deployment=EXISTING_VERIFIED_WORKER_LAB127_RECOVERY_CONTRACT'
  echo "backendSourceGuidanceRevision=${GUIDANCE:-UNCONFIRMED}"
  echo 'androidDeviceTest=PENDING'
} > "$OUT/$NAME-IDENTITY.txt"
(cd "$OUT" && zip -q "$NAME.zip" "$NAME.apk" "$NAME.sha256" "$NAME-IDENTITY.txt")
git archive --format=zip --output="$OUT/$NAME-SORGENTI.zip" HEAD || fail 'ZIP sorgenti fallito'
(cd "$OUT" && unzip -tq "$NAME.zip" && unzip -tq "$NAME-SORGENTI.zip") || fail 'Integrità ZIP fallita'
(cd "$OUT" && sha256sum "$NAME.zip" "$NAME-SORGENTI.zip" > "$NAME-ZIP.sha256")
[[ -s "$OUT/$NAME.apk" && -s "$OUT/$NAME.zip" && -s "$OUT/$NAME-SORGENTI.zip" ]] || fail 'Artefatti mancanti'
PHASE='complete'
say "APK e ZIP verificati e disponibili: $OUT"
say "Certificato originale confermato; backend HTTP $HTTP. Test telefono ancora da fare."
say 'Arresta Codespaces dopo aver scaricato i file per conservare la quota gratuita.'
