# StudyBook AI · Pilastro permanente dello studio progressivo (V1)

**Decisione del fondatore approvata il 6 novembre 2026. NON cambiare senza sua approvazione esplicita.**

## Invariante di prodotto
L'app serve a **studiare lo stesso argomento per approfondimenti successivi**. La sequenza è:
**Riassunto → 50% → 40% → 30% → 20% → 10% → Originale (0%).**

Ogni edizione trae origine **direttamente dal PDF originale immutabile** (non dalla riduzione precedente) e conserva tutte le **idee/definizioni/temi fondamentali**, il senso delle negazioni, le condizioni e i riferimenti necessari. Il riassunto e il 50% si possono presentare come elenco dei concetti con brevissime spiegazioni; i livelli successivi aggiungono gradualmente ragionamenti, collegamenti, contesto e dettagli. Non significa che tutte le parole e tutti gli esempi debbano comparire in tutte le edizioni.

### Riduzioni percentuali VINCOLANTI · consolidamento approvato 7–8 novembre 2026

Questo aggiornamento esplicito **sostituisce** i due vecchi criteri incompatibili:
«lettere esatte per ciascun blocco» e «Riassunto senza percentuale fissa».
Resta invariato il principio fondante: studiare lo stesso argomento con
spiegazioni sempre più approfondite ricavate dal PDF originale immutabile.

La percentuale è la **quantità di lettere Unicode alfabetiche eliminate**
rispetto all'originale dell'INTERO LIBRO, non la quota rimasta.
Spazi, cifre e punteggiatura non entrano nel conteggio.

Obiettivi richiesti:
- Riassunto circa 60% di riduzione: **55–65%**
- 50%: **48–52%**
- 40%: **38–42%**
- 30%: **28–32%**
- 20%: **18–22%**
- 10%: **8–12%**
- Originale: immutabile, nessuna riduzione.

Le quote per i singoli paragrafi o blocchi sono **indicative** per distribuire
la lunghezza, non limiti duri che autorizzano omissioni semantiche.
Una versione completa è conforme solo quando la sua percentuale GLOBALE
rientra nella fascia; va inoltre mantenuta la fedeltà al testo, senza
inventare dati, alterare formule o mutilare citazioni necessarie.
Le righe risparmiate sono una statistica separata, mai usata come sinonimo
del conteggio delle lettere.

**Ordine della lavorazione approvato:** prima si generano e salvano tutte le
bozze; POI si effettua il controllo di completezza, precisione, chiarezza e
percentuali; la correzione è mirata, limitata e non blocca la prima generazione.
Il pulsante «Migliora percentuali e chiarezza» avvia una ricalibrazione
esplicita, preservando i risultati e i checkpoint già salvati.
Nessuna etichetta «verificata», dato inventato o sostituzione silenziosa
può dichiarare conforme una versione fuori fascia.

La **sola autorità numerica attiva** è
`src/lib/studyRebalancePolicyV67.js`, con valutazione condivisa
`measureEditionLengthV72`. `studyPillarV38.js` conserva i propri
controlli storici per i libri non ancora migrati, ma NON governa i
target numerici delle nuove elaborazioni LAB72.
`studyQualityV66.js`, il backend generativo e il lettore devono
applicare gli stessi margini globali. Nessuna seconda fonte di verità.

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
Canonical source/pedagogia: `src/lib/studyPillarV38.js` (legacy incluso). Autorità delle percentuali attuali: `src/lib/studyRebalancePolicyV67.js`. Backend attivo: `api/editionsBulkV51.js` su Worker isolato. `api/editionsV36.js` resta solo per compatibilità con i percorsi storici.
Test: `scripts/test-lab38-pillar.mjs`.
Un eventuale cambio di questo contratto richiede una richiesta esplicita dell'utente, analisi di compatibilità MotorLab e test del comportamento originale rispetto al nuovo.
