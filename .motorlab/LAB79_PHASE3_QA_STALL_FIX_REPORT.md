# StudyBook AI · LAB79 · Correzione stallo fase 3 (44 pagine × 6 livelli)

Data: 9 novembre 2026. Orchestratore: MotorLab r40. Versione sorgente di partenza: LAB78 sperimentale, APK firmata versione 0.3.558; LAST_GOOD separato e protetto.

## Problema confermato dalle cinque schermate reali, ore 22:19–22:21
- Libro "Filosofia del diritto appunti+sbobine": ogni livello Riassunto, 50, 40, 30, 20, 10 mostra **44/44** ma la Fase 3 rimane "Controllo qualità", seguita dai pulsanti "Riprendi elaborazione dal checkpoint" e "Verifica richiesta Gemini".
- La visualizzazione "44/44" misurava **bozze esaminate**, non pagine matematicamente conformi. La riduzione reale era mostrata come "In elaborazione" benché la QA avesse già i numeri.
- Bug 1: `studyAutoResumeV45.js` rientrava in `local-quality-audit` anche quando lo snapshot LAB78 `publicationModeV66` aveva un `qualityV66` già completato e numericamente non conforme. Il foreground scheduler poteva ripetere il ciclo senza produrre progressi.
- Bug 2: `AppV15.jsx` interpretava `draftComplete=true` come motivo per **rifare una QA locale**, anziché distinguere richiesta di correzione dalla richiesta di ripresa del download.
- Bug 3: `AppScreens.jsx` rendeva `canImprove` vero solo per `editionState.complete` e per la vecchia publication mode LAB66. LAB78 segna `complete=false` quando almeno una versione fuori margine, quindi nascondeva "Migliora percentuali" proprio quando necessaria.
- Bug 4: `editionViewV36.js` nasconde `achievedLettersPercent` se `complete=false`; la UI Studio non faceva fallback al valore già misurato da `qualityV66.levels[level].actualReduction`.
- Bug 5: la QA virtuale da 60 posizioni non veniva considerata nella selezione delle sole pagine da correggere quando l'intero libro risultava nel margine globale.

## Implementazioni LAB79
- `src/lib/studyQualityRecoveryV79.js`: classificazione dei quattro stati `none`, `local-audit`, `manual-recalibration`, `resume-generation`; una QA già completata non può reiterare.
- `src/lib/studyAutoResumeV45.js`: esclude le bozze LAB78 già esaminate dai timer; preserva la ripresa automatica autentica delle bozze mancanti e dei provider 503/429.
- `src/AppV15.jsx`: una richiesta "riprendi" sul libro già esaminato mostra direttamente la procedura corretta in Studio, senza ulteriori chiamate Gemini o reimportazioni.
- `src/components/AppScreens.jsx`: il pulsante "Migliora percentuali e chiarezza" è disponibile anche per `quality-notes` LAB78; compare il valore reale ottenuto, compreso quando fuori margine; nasconde il vecchio pulsante di ripresa improduttivo.
- `src/components/HomeDashboardV16.jsx`: distingue "bozze salvate / verifica non conforme" da "Gemini in corso", indicando il comando di ricalibrazione.
- `src/lib/studyPhaseProgressV59.js` e `StudyPhaseProgressV59.jsx`: separano "44/44 esaminate" da "x/44 conformi"; tutte le bozze restano conservate.
- `src/lib/studyRebalanceV67.js`: per la sola famiglia LAB78 include anche i gruppi pagina che rispettano le lettere ma non il limite delle righe virtuali; conserva i limiti storici di massimo due chiamate per blocco nelle versioni precedenti.
- `src/lib/studyGeometryV78.js`: espone l'identificatore sorgente dei gruppi che devono essere corretti; non modifica la fonte o il planner dei grandi blocchi.

## Verifica e sicurezza
- CI LAB79 `42704832170`: PASS. Esegue una vera QA locale con 44 pagine e tutte e sei le bozze, 264 pagine-versione salvate: `planStudyAutoResumeV45` dopo audit restituisce `null`, `canRebalanceBookV67` è vero, conformità in progress ≠ presenza. Zero nuove chiamate Gemini.
- Tutti i controlli del contratto LAB72: 7/7 PASS, comprese la garanzia LAB69 di due chiamate massime e la non regressione LAB66/67. LAB77 recupero 503 e LAB78 Worker geometry PASS. Build Vite e Wrangler dry-run PASS.
- I precedenti run falliti LAB79 sono stati fallimenti **di regressione storica e/o di assert di un simbolo eliminato da bundler**, risolti senza disabilitare i test. Non contano come test passati.
- Non si afferma che il modello Gemini abbia corretto tutte e sei le riduzioni su questo libro: **NON TESTATO**, e il fornitore continua a poter rispondere 503.
- L'app non deve rifare il libro, cancellare dati, riavviare 264 richieste o sostituire LAST_GOOD. La ricalibrazione Gemini avviene **solo su un comando esplicito** e in modo mirato; la quota gratuita non viene bypassata. I controlli sul significato non sono una certificazione completa.
- Nuovo Worker non necessario: riusa quello isolato LAB78, con controllo di versione obbligatorio. Firma Android e applicazione `it.studybook.ai.lab` da preservare.
- Rilascio LAB79 solo come APK sperimentale verificato da pipeline Scudo360 completa. Prova sullo stesso libro, senza disinstallazione e senza cancellare checkpoint, poi verifica quantità/righe e qualità realmente ottenuta.
