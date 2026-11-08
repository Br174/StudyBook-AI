# StudyBook AI · Pilastro permanente dello studio progressivo (V1)

**Decisione del fondatore approvata il 6 novembre 2026. NON cambiare senza sua approvazione esplicita.**

## Invariante di prodotto
L'app serve a **studiare lo stesso argomento per approfondimenti successivi**. La sequenza è:
**Riassunto → 50% → 40% → 30% → 20% → 10% → Originale (0%).**

Ogni edizione trae origine **direttamente dal PDF originale immutabile** (non dalla riduzione precedente) e conserva tutte le **idee/definizioni/temi fondamentali**, il senso delle negazioni, le condizioni e i riferimenti necessari. Il riassunto e il 50% si possono presentare come elenco dei concetti con brevissime spiegazioni; i livelli successivi aggiungono gradualmente ragionamenti, collegamenti, contesto e dettagli. Non significa che tutte le parole e tutti gli esempi debbano comparire in tutte le edizioni.

### Budget preventivo VINCOLANTE · approvazione 8 novembre 2026 · LAB74

Questa regola più recente **sostituisce i vecchi margini ±2 punti**
e il vecchio criterio "solo globale" per le nuove generazioni.
È stata approvata esplicitamente dal fondatore con l'esempio:
100 lettere originali, riduzione 50%, risultato centrale 50,
minimo 45 e massimo 55.

**Prima di chiamare Gemini** StudyBook conta le lettere alfabetiche Unicode
dell'originale di ogni pagina. Spazi, cifre e punteggiatura non contano.
Calcola per ciascuna delle sei varianti la quantità di LETTERE DA
CONSERVARE, non la percentuale di lettere da tenere confusa con la riduzione.
Comunica a Gemini l'originale, l'obiettivo centrale, il minimo e il massimo.
Una quota massima NON sostituisce l'obiettivo centrale: il modello non può
scambiare il limite 55 con il permesso di produrre 10 lettere.

| Versione | Lettere centrali su 100 | Fascia consentita su 100 |
| --- | ---: | ---: |
| Riassunto (riduzione 60%) | 40 | 35–45 |
| 50% | 50 | 45–55 |
| 40% | 60 | 55–65 |
| 30% | 70 | 65–75 |
| 20% | 80 | 75–85 |
| 10% | 90 | 85–95 |
| Originale | 100 | identico al PDF |

Il margine è **±5 punti percentuali delle lettere ORIGINALI**, non ±5%
delle lettere già ridotte: per una pagina di 2.000 lettere e riduzione 50%,
obiettivo 1.000, minimo 900, massimo 1.100.

StudyBook organizza prima i testi per pagina originale e fa rispettare il
budget delle lettere della pagina, oltre al totale del libro. Se un paragrafo
originale attraversa più pagine, il gruppo di pagine sovrapposte è
**indivisibile**: nessun taglio di paragrafo soltanto per far tornare il conto.
Se la pagina è così breve che nessun numero intero di lettere può cadere
nella fascia, segnala il caso, senza una falsa certificazione.

**Prima crea, poi controlla e corregge**: nessun confronto pesante o Gemini
aggiuntivo durante la generazione delle bozze; tutte le bozze e i checkpoint
vanno salvati in ordine. Il successivo audit valuta dimensione per pagina,
dimensione globale e fedeltà di significato. Una riduzione fuori margine
resta leggibile soltanto come provvisoria, senza essere dichiarata conforme.
Le correzioni recuperano contenuti dall'originale, non inseriscono frasi
ripetitive; non cancellano negazioni, condizioni, citazioni normative,
formule, dettagli indispensabili né inventano esempi.

Autorità numerica unica: `src/lib/studyRebalancePolicyV67.js`;
calcolo per pagine: `src/lib/studyPageBudgetsV74.js`;
backend di controllo dell'originale: `api/editionsBulkV51.js`;
protocollo aggiornamento app/Worker: `src/lib/studyDraftProtocolV74.js`.
Le regole dei blocchi di codice LAB38–LAB73 valgono soltanto per
compatibilità storica, non scavalcano la LAB74. Le righe risparmiate sono
una statistica separata, mai usata per misurare le lettere.

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
