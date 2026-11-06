# StudyBook AI · Pilastro permanente dello studio progressivo (V1)

**Decisione del fondatore approvata il 6 novembre 2026. NON cambiare senza sua approvazione esplicita.**

## Invariante di prodotto
L'app serve a **studiare lo stesso argomento per approfondimenti successivi**. La sequenza è:
**Riassunto → 50% → 40% → 30% → 20% → 10% → Originale (0%).**

Ogni edizione trae origine **direttamente dal PDF originale immutabile** (non dalla riduzione precedente) e conserva tutte le **idee/definizioni/temi fondamentali**, il senso delle negazioni, le condizioni e i riferimenti necessari. Il riassunto e il 50% si possono presentare come elenco dei concetti con brevissime spiegazioni; i livelli successivi aggiungono gradualmente ragionamenti, collegamenti, contesto e dettagli. Non significa che tutte le parole e tutti gli esempi debbano comparire in tutte le edizioni.

### Riduzioni percentuali VINCOLANTI
Per il 10/20/30/40/50% la percentuale è la **quantità di lettere Unicode alfabetiche eliminate rispetto al testo originale** dell'intero libro. Spazi, cifre e segni non contano. L'obiettivo totale in lettere è round(lettere_originali * (1 - percentuale/100)); le quote sono assegnate senza perdita o creazione di lettere tramite l'algoritmo dei maggiori resti sui blocchi. Per un blocco verificato il numero di lettere deve coincidere esattamente con la quota intera assegnata. Zero scorciatoie, arrotondamenti apparenti, etichette fittizie o tagli a metà parola. Se non è possibile avere contemporaneamente esattezza e significato, quella variante resta **NON VERIFICATA**, con diagnostica e ripresa mirata; non pubblicare/mostrare come verificata una versione sostitutiva.

Il **Riassunto** è più breve del 50%, è una prima infarinatura che nomina **tutti i concetti principali**, prevalentemente in forma di elenco con microspiegazioni. Nessuna percentuale fissa è stata richiesta per esso; ne va misurata la lunghezza, non spacciata per «percentuale garantita».

### Ordine didattico, fedeltà e protezioni
- Sequenza dello studio: Riassunto, 50, 40, 30, 20, 10, originale.
- Gli stessi concetti fondamentali, cioè le stesse colonne portanti, restano in TUTTE le edizioni e vengono spiegati sempre meglio.
- No invenzioni, nessuna perdita di negazioni, riferimenti, formule, date, condizioni centrali.
- Se un brano brevissimo non consente questa combinazione, segnala il conflitto; non inventare un successo.
- Fonte e capitoli originali, figure, pagine, locandine, progressi e checkpoint rimangono protetti.
- Non reimportare il PDF durante la ripresa e non pagare per aggirare le quote Gemini.
- Statistiche di riduzione vere per blocco/pagina/libro; non visualizzare «0%» dove la misura è ignota.
- Ogni futura LAB e promozione deve eseguire una prova automatica del pilastro, oltre a Scudo360. Questa specifica è l'autorità del comportamento didattico, non una preferenza grafica temporanea.

## Proprietà, change guard e verifica
Ownership: StudyBook AI native generative engine, in Br174/StudyBook-AI.
Canonical code: `src/lib/studyPillarV38.js`; backend: `api/editionsV36.js` in servizio staging LAB38 isolato.
Test: `scripts/test-lab38-pillar.mjs`.
Un eventuale cambio di questo contratto richiede una richiesta esplicita dell'utente, analisi di compatibilità MotorLab e test del comportamento originale rispetto al nuovo.
