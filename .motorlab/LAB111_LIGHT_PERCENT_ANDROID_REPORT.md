# StudyBook AI LAB111 · Percentuali leggere e prova Android indipendente

**Data:** 10 novembre 2026. **MotorLab:** r40 verificato, autorità centrale `Br174/Chatgpt`. **Stato:** APK SPERIMENTALE, firmata e installabile. Nessuna promozione del generatore a produzione o certificazione didattica.

## Scopo approvato
Correggere la riduzione eccessiva osservata nel test reale della TRIAL110 (44 pagine, 6 livelli, soltanto 1/264 pagine-versione conformi), senza allungamenti artificiali, mantenendo gli assunti utili riferiti dall'utente, senza un controllo Gemini separato o cicli di correzione per ogni pagina. Preparare una gestione rapida anche di libri fino a 2.000 pagine.

## Implementazione effettiva
- `src/lib/studyLeanPercentV111.js`: prompt compatto unico, con budget lettere e righe **ufficiali e invariati** da `studyPageBudgetsV74` e `studyGeometryV78`; tutti i sei livelli `summary/50/40/30/20/10`; distingue lettere eliminate da conservate. Niente elenco di concetti per singola frase, nessuna seconda chiamata generativa, nessuna falsa etichetta.
- `api/editionsBulkV51.js`: usa LAB111 soltanto con `STUDYBOOK_LEAN_PERCENT_V111=1` sul Worker **e** `experimentV111=lab111-original-letters-retention-one-call-v1` dal client. Il protocollo LAB79 resta invariato altrove; input/target originali sempre verificati. Se il messaggio è sicuramente piccolo, salta la chiamata ausiliaria `countTokens` con stima locale prudente; sopra la soglia conserva l'esistente countTokens. Una generazione Gemini per blocco.
- `src/lib/studyLinearPlannerV111.js`: pianificazione incrementale lineare senza ripetere le scansioni di prefissi dell'algoritmo LAB51. Limiti di input/output originali, confini di pagina e paragrafi indivisibili preservati.
- `src/lib/draftFirstV57.js`: sotto il solo flag di PROVA `VITE_STUDYBOOK_TRIAL_111=1`, ogni livello usa LAB111 e il planner lineare; prima completa e persiste tutte le bozze. Dopo generazione una sola ispezione locale `finalizeStudyQualityV66`, **zero richieste automatiche Gemini di ricalibrazione**. Le vecchie bozze non vengono cancellate; il tasto manuale di miglioramento rimane una procedura distinta e NON è parte del fast path.
- `wrangler.trial111.jsonc`: Worker isolato `studybook-ai-trial111`, distinto da Worker produzione e TRIAL110.
- Android: identificativo **`it.studybook.ai.lab.trial111`**, distinto sia da LAB79 (`it.studybook.ai.lab`) sia da Prova110 (`it.studybook.ai.lab.trial110`), per garantire archivi separati e non riutilizzare erroneamente le vecchie bozze. Nome `StudyBook AI Prova 111`, versione `0.3.111-prova`, codice `2026111101`.

## Test ed evidenza

**Contratto Worker + Scudo360:** PASS `https://github.com/Br174/StudyBook-AI/actions/runs/42794669211`, con regressioni LAB79/LAB109/LAB110 e test LAB111.

**Test di stress locale:** 2.000 pagine sintetiche × 6 livelli; 155 asserzioni PASS, 12 comparazioni dell'esatta distribuzione di blocchi LAB51/LAB111, zero pagine spezzate impropriamente, 0 chiamate Gemini. Planner in circa **0,66 secondi complessivi** su GitHub runner, heap circa **10,08 MB**. **NON** equivalgono al tempo di generazione con Gemini né provano l'utilizzo di RAM e la durata sul telefono. Blocchi pianificati sul dataset sintetico: 17 Riassunto, 19 al 50%, 21 al 40%, 24 al 30%, 27 al 20%, 29 al 10% (totale **137 blocchi**, dunque in condizioni normali almeno una generazione per blocco, vincolata ai limiti del modello gratuito). Nessuna promessa di 2.000 pagine elaborate in pochi secondi.

**Gemini reale LAB111:** prova mirata su due livelli di un campione sintetico tramite lo stesso Worker, senza ulteriori chiamate. 10% su `scienze`: **14,52%**, banda ufficiale 5–15% e righe 11/12 conformi; esame semantico solo preliminare, non certificato, contiene imperfezioni ortografiche. 50% su `procedura`: HTTP **503** overload del provider, nessuna risposta utilizzabile, **nessun retry automatico**. Workflow della prova reale `https://github.com/Br174/StudyBook-AI/actions/runs/42793337859` è segnato FAILURE perché una delle due risposte è mancata; i test offline sono PASS, non mascherare il 503. Evidenza `audit/reports/lab111-real-two-levels.json`.

**Build Android:** `https://github.com/Br174/StudyBook-AI/actions/runs/42794669211` SUCCESS (Gradle, firma, Scudo360, integrazione Worker, archive ZIP e GitHub Release). Commit esatto del file APK: **`480c27480adecd9f2f39e235b0138a485797b9b7`**. Firma Android SHA256 certificato LAB originale (verificata nel workflow) `D7BB9315C9C4351872495478610C484725086E2BABBC04BEC65EC823455FBDCC`.

**Download verificati:**
- Release privata: https://github.com/Br174/StudyBook-AI/releases/tag/studybook-trial111-480c27480ade
- APK: https://github.com/Br174/StudyBook-AI/releases/download/studybook-trial111-480c27480ade/StudyBook-AI-TRIAL-111.apk
- ZIP: https://github.com/Br174/StudyBook-AI/releases/download/studybook-trial111-480c27480ade/StudyBook-AI-TRIAL-111.zip
- Sorgenti: https://github.com/Br174/StudyBook-AI/releases/download/studybook-trial111-480c27480ade/StudyBook-AI-TRIAL-111-SORGENTI.zip
- SHA256 APK: `d6476120accc4e1e0f95edfc448d9c40f097fad0149cb0c12aa7e42f392c5cb1`.
- Dimensione APK: 5.737.507 byte, ZIP con APK 5.363.672 byte. Archivio GitHub Actions ID `13752198965`.
- Contenuto scaricato in chat e controllato: ZIP interno, ZIP sorgenti e APK integri, firma verificata da CI, manifest ID `it.studybook.ai.lab.trial111`, versione 0.3.111-prova.

## Comportamento e limiti da verificare sul telefono

1. Installare la Prova111 come NUOVA app; NON disinstallare LAB79 o Prova110 e NON cancellare alcun dato. Importare lo stesso PDF nella Prova111 per confronto su nuova memoria senza checkpoint preesistenti.
2. Valutare ogni livello per percentuale effettiva e righe e confrontare assunti, rispettando ±5 punti. Un numero rosso significa LETTERE e/o RIGHE fuori margine, non prova di concetti persi.
3. Il sistema non avvia più automaticamente la ricalibrazione dopo le prime bozze; i testi fuori margine sono salvati ma non dichiarati approvati. Il pulsante manuale `Migliora percentuali e chiarezza` può usare il vecchio percorso e consumare chiamate. **Non premere la ricalibrazione totale nel primo test**.
4. Testato localmente il planner di 2.000 pagine, non la generazione reale da 2.000 pagine; la durata totale e i limiti di quota Gemini restano dipendenti dal provider.
5. Se la prima generazione produce ancora una riduzione fuori banda, usare i dati originali della prova e non modificare le etichette numeriche. Il controllo quantità e la resa semantica sono due problemi distinti, quest'ultima non è certificata qui.

**Stato del rilascio:** PRERELEASE solo test, non MAIN, non LAST_GOOD, non Android attivo LAB79, non Cloudflare di produzione. Costi aggiuntivi €0.
