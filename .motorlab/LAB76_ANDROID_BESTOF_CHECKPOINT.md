# StudyBook AI · LAB76 Best-of · APK sperimentale utente

Data: 9 novembre 2026. Autorizzazione utente: «Ok procedi» dopo confronto LAB103 (precisione) e LAB104 (fedeltà). Orchestratore MotorLab r40. Il motore nativo StudyBook resta il responsabile della generazione, della ripresa e delle pagine.

## Fonti verificate, NON promesse universali

- Quantitativo LAB103: 168 output Gemini storici. I sei casi con riduzione più vicina sono 64,94% (Riassunto di ricerca 65), 50,00%, 40,25%, 29,72%, 20,70%, 9,91%, tutti dentro fascia ±5 e righe virtuali di 60 celle.
- Qualitativo LAB104: quattro casi source-backed 52 fatti inventariati, 39 completamente espressi nella revisione editoriale, 11 parziali, 2 dettagli non essenziali omessi. Storia 20%, 18,66%, 12/12 righe e 13/13 fatti è il benchmark qualitativo; medicina 10% 9,34%; scienze 30% 25,21%. Nessun testo certificato didatticamente su libri autentici.
- LAB105 nuove risposte: solo 3/12 entro percentuale e righe, con limite Gemini 429. Da NON chiamare «affidabilità garantita».
- LAB106 one-call: codice sperimentale e test replay; NON dimostrata una percentuale migliore su testi nuovi.

## La reale integrazione LAB76

Ramo source LAB76: `lab/studybook-core-android-01-update-76-best-of-20261109`.
Sicurezza pre-change: `lab/safety-studybook-core-android-01-update-76-before`, biforcata da LAB75.
Famiglia Android precedente preservata: `motorlab/active-studybook-ai`; app ID `it.studybook.ai.lab`; certificato originale SHA256 `D7BB9315C9C4351872495478610C484725086E2BABBC04BEC65EC823455FBDCC`. Firmare e verificare lo stesso, usare versionCode monotono.
- `src/lib/studyBestOfV76.js`: prompt di prima bozza compatto e specifico per livello (editing conservativo 10–20, riscrittura moderata 30–40, sintesi fedele 50/Riassunto), fonte unica, lettere Unicode e budget originali di pagina, nessuna lista estesa di fatti nel prompt; diagnostica source-backed per direzioni, modalità, negazioni, cause.
- `api/editionsBulkV51.js`: il percorso REALE V74 invoca le istruzioni LAB76. Nuovo Worker sperimentale specifico per LAB76, non modifica il Cloudflare Worker di produzione.
- `src/lib/studyQualityV66.js`: seconda valutazione LOCALE e senza Gemini dell'esito per ogni unità, percentuale, griglia virtuale e rischi semantici visibili come avvisi, non falsa certificazione.
- `src/lib/integralPlannerV51.js`: BLOCCO MASSIMO SICURO, lasciato IDENTICO; non tagliare pagina/paragrafo; non fissare dimensione di 2/3/5 pagine.
- Le pagine incerte restano evidenziate; la versione LAB è una prova sul telefono, non promozione definitiva o MADRE.
- Il Riassunto nell'app conserva temporaneamente la politica originale 60% (55–65%). Il benchmark di ricerca 64,94% appartiene al 65% ed è anche entro il margine superiore del Riassunto applicativo. Non convertire segretamente la politica.
- «In parole semplici» continua a essere attivato solo al clic; niente generazione durante l'importazione.

## Rilascio sperimentale e sicurezza

- Prova offline prima del download: `scripts/test-lab76-best-of.mjs`: 4 output golden LAB104, 5 manipolazioni rischiose, coesistenza con 44 pagine/6 blocchi LAB58, integrazione della quality pipeline.
- Workflow preflight: `.github/workflows/studybook-lab76-bestof-preflight.yml`.
- Workflow Android: `.github/workflows/android-apk.yml`, build solo con commit esplicito `[lab76-release-approved]`; Scudo360 obbligatorio; firma da file LAB01 originale; Worker isolato `https://studybook-ai-lab76-bestof.brunoverlezza.workers.dev`, GET protocollo originale LAB74 per compatibilità; impacchettamento APK e ZIP con origini.
- Nessun avanzamento automatico `motorlab/active-studybook-ai` da questa LAB sperimentale. Non modificare prod Cloudflare, main/MADRE, LAST_GOOD, dati dei libri o chiavi. €0 di servizi aggiuntivi.
- Non promettere link APK senza build firmata e artefatto verificato.

## Limiti di validità sul telefono

- Il controllo alfabetico e i limiti di riga virtuale non garantiscono una impaginazione fisica A4 identica; testare stampa/PDF reale.
- Le segnalazioni semantiche sono EURISTICHE, non certificazione; i risultati storici LAB103/104 non garantiscono output sempre conformi da Gemini su un libro nuovo.
- Le nuove modifiche al server NON si applicano all'app installata finché il Worker LAB76 non viene distribuito e il nuovo APK non punta a quel Worker. Per questo la pipeline verifica la URL effettiva prima di firmare.
- Se il rilascio fallisce, conservare ramo e test come checkpoint e non avanzare LAST_GOOD.

Prossima prova utente dopo firma: installare senza disinstallare, importare un libro reale, misurare tutte e sei le varianti, controllare percentuali e righe/pagine reali, semantica contro fonte, ripresa dopo errore/quota, durata fino alla prima pagina pronta.
