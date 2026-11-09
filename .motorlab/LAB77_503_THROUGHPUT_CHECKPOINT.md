# StudyBook AI · LAB77 · Protezione 503 senza frammentazione

Data: 9 novembre 2026 · MotorLab r40. Richiesta utente: «Andare al massimo consentito senza far bloccare il sistema», mantenere i blocchi grandi già approvati; incidente LAB76 sul libro reale 44 pagine: Riassunto 44/44, 50% 44/44, 503 entrando nel 40%; prevista verifica locale alle 19:47.

## Interpretazione prudente
- Un HTTP 503 è **servizio sovraccarico/temporaneamente non disponibile**. Non prova limite di contesto, errore didattico o superamento di quota RPM/TPM. Un HTTP 429 segnala limiti di quota/rate; conserva le due diagnosi separate.
- Nessun software può garantire assenza di 503 del fornitore. Misurare successo sul dispositivo con un libro vero, non dichiarare successo dalla sola simulazione.
- Preservare il **massimo blocco naturale sicuro** LAB58. Nessuna riduzione di token o split per un singolo 503. Hard 413 resta il distinto segnale di oversize.
- Niente chiamate o servizi Gemini extra e nessun costo a pagamento. Non modificare i 44+44 risultati già presenti in IndexedDB. Compatibilità dell'app id `it.studybook.ai.lab`, firma originale, checkpoint e codice sorgente LAB76.

## Modifica client LAB77
- `src/lib/geminiThroughputV77.js`: singola politica di *pacing* preventivo persistita nel resumeStore già usato. Dopo una risposta positiva con input >= 5000 token, un distanziamento minimo proporzionale alla latenza osservata, conteggiato dall'**inizio** della richiesta (non ritardo cieco dopo la fine); se l'elaborazione è già durata più della soglia, zero attesa aggiuntiva. Richieste piccole: nessun ritardo preventivo.
- Se si verifica un 503: memorizza una cadenza prudente per le chiamate successive con 90s minimo inter-avvio iniziale, intensificata in caso di ripetuti 503 e ridotta dopo successi. La pausa 503 già esistente resta la fonte autorevole del primo retry. Le attese vengono rivalutate al ritorno in primo piano.
- `src/lib/geminiCadenceV58.js`: la **stessa unica coda Gemini** attende il massimo tra il ritmo RPM documentato 429 e la cadenza LAB77, senza secondo scheduler.
- `src/lib/draftFirstV57.js`: riconosce il 503 come segnale locale per regolare la cadenza, non per spezzare il blocco.
- Nuovo Worker non necessario: riusa il Worker isolato LAB76 `studybook-ai-lab76-bestof.brunoverlezza.workers.dev`; il client LAB77 punta esclusivamente ad esso.
- `.github/workflows/android-apk.yml`: build solo dopo specifico marker `[lab77-release-approved]`; **nessuna promozione automatica** del ramo `motorlab/active-studybook-ai`, produzione e LAST_GOOD restano protetti.

## Evidenze già verificate
- GitHub Actions `42678516759` SUCCESS: `scripts/test-lab77-503-throughput-recovery.mjs` ricrea un libro da 44 pagine e 119 paragrafi, bozza Riassunto e 50% complete, 503 sul 40%, ripresa e completamento dei quattro livelli residui. 238 unità-bozza conservate; tentativi `summary,50,40-failure,40-success,30,20,10`, **nessuna rigenerazione** di summary/50. Nella simulazione i 6 grandi blocchi originali restano interi.
- LAB58 cadenza e blocchi grandi PASS; LAB55 cooldown/429/503 e checkpoint PASS; LAB76 4 golden testi source-backed e 5 mutazioni semantiche PASS; npm web build e Wrangler dry-run PASS.
- Queste sono **simulazioni senza chiamate Gemini reali**. Non certificano l'assenza di blocchi futuri, qualità semantica su un libro vero né velocità sul telefono. Dopo installazione LAB77 occorre misurare latenza di tutte le sei richieste, 429/503 e riavvio app.

## Sicurezza LAST_GOOD e Android
- Il workflow Android generico aveva tentato di avanzare accidentalmente `motorlab/active-studybook-ai` durante l'allestimento LAB77. È stato applicato il gate per v77 e **ripristinato tramite ref con lease** l'esatto ramo precedente `446134acd4a387beaae1e992de6572ce379cdbb9`, verificato tramite compare. Non ripromuovere v77 automaticamente.
- Base signed LAB76 source `34c2a8a7009b11316c73da1042b02e0e9e219d8e`, APK build success `42675104333`.
- Non disinstallare l'app; installare l'APK LAB77 come aggiornamento firmato sullo stesso application ID per conservare il database dei checkpoint.
