# StudyBook AI | LAB72 preflight causal review, 8 novembre 2026

## Stato dell'operazione
- **Solo ramo di audit**: `audit/studybook-lab72-negative-preflight-20261108`.
- Base verificata: LAB71 Android 0.3.446 (`446134acd4a387beaae1e992de6572ce379cdbb9`).
- **Nessuna distribuzione** Android, nessuna modifica allo stato del dispositivo, nessun aggiornamento al CORE MotorLab, nessuna promozione o cambio di ambiente di produzione.
- MotorLab locale e centrale: release `2026.10.29-r40`, satellite verificato.
- Registro di continuità centrale su `main` arretrato; proposta di aggiornamento non ancora integrata: PR #105.

## Contraddizioni rinvenute e risolte sul ramo di audit
1. Pilastro storico (6 novembre): rigidità esatta per blocco e Riassunto senza percentuale prestabilita. Regola approvata più recentemente (7–8 novembre): intervalli globali `55–65` Riassunto, `48–52` 50%, `38–42` 40%, `28–32` 30%, `18–22` 20%, `8–12` 10%. **Una sola autorità numerica attiva**: `src/lib/studyRebalancePolicyV67.js` e `measureEditionLengthV72`.
2. Planner `integralPlannerV51`: cap Riassunto precedente impostato al 50% delle lettere mantenute. Sul ramo audit la quota del Riassunto è il 40% mantenuto, coerente con il 60% ridotto.
3. Backend `editionsBulkV51`: `hasExactLength` precedente per Riassunto accettava anche una riduzione 88,5%. Ora esatta è solo la quota bersaglio, e la conformità globale usa la fascia corretta.
4. Qualità `studyQualityV66`: non emetteva warning per Riassunto troppo corto. Ora emette warning numerico in base alla fascia canonica.
5. Risposte di Gemini: `finish_reason` non arrivava al client nei risultati HTTP 200. Ora il risultato rende visibile `finishReason`, token usati, limite di uscita e avviso di possibile troncamento.
6. Checkpoint delle bozze: ora il ramo di audit conserva, con ogni nuovo draft, versione del protocollo, modello, origine, lettere fonte e risultato, riduzione, motivo dello stop e orario; senza cambiare il contenuto sorgente.
7. Collegamento app/Worker: protocollo V72 dedicato `lab72-canonical-range-observability-v1`, con verifica di versione e dati di misurazione; la compatibilità V70/V71 resta per i vecchi client.

## Prove per esclusione: risultati verificati

**LAB71 negativo prima delle modifiche**:
- GitHub Actions `42444952355`: PASS nell'individuare il difetto originale con risposte simulate, senza Gemini vero.
- Sei risultati ricevuti dal telefono, tutti fuori fascia: Riassunto 88,5%; 50% 84,2%; 40% 84,6%; 30% 83,1%; 20% 68,0%; 10% 51,0%.

**Dopo modifiche nel ramo di audit**:
- GitHub Actions `42445726072`: PASS. Test di rifiuto del false summary, protocollo V72, misurazione token, regresso 44 pagine e sei livelli, salvataggi storici e protezione di citazioni, formule e checkpoint.
- Questo test usa risposte finte preimpostate. Non dimostra la capacità del modello reale di mantenere le percentuali.

**Prove Gemini reali, testo sintetico non appartenente all'utente, un solo modello già configurato**:
- `42445321360`: richiesta 10%, risposta **18,2%**. `finish_reason=stop`, 346 token su un limite di 6000, 1.365 lettere originali, 1.117 risultanti. Non è un arresto per limite di token.
- `42445446564`: lo stesso esempio in un'altra prova ha risposto con **33,3%** di riduzione, stop naturale; tentativo di recupero mirato da una bozza sintetica più corta: riduzione **−8,9%**, stop naturale. La correzione guidata può sovracompensare la lunghezza.
- **I risultati reali non sono conformi**, nonostante completamento regolare e istruzioni numeriche. La variabilità del modello è dimostrata su questi esempi, non su ogni libro o variante.
- Le prove vere sono state chiuse e disattivate dalla pipeline automatica: **non ripetere chiamate Gemini a ogni commit**.

## Cosa è stato escluso / non escluso
- Esclusi nella prova dell'utente: residui delle vecchie bozze dopo cancellazione dati Android.
- Escluso **sui due esempi reali eseguiti**: troncamento per token come spiegazione della misura errata.
- Non escluso su libri di grandi dimensioni: limiti di uscita, rete, SocketException, risposta incompleta e difficoltà di quota.
- NON verificata la fedeltà semantica di un intero libro reale; non basta una percentuale numerica.
- Il solo prompt non garantisce che tutte le percentuali vengano rispettate: anche la prova di recupero reale è fallita.

## Proposta per futura LAB72 applicativa, in attesa di ulteriore revisione
Prima di una nuova distribuzione correggere il comportamento del motore con un **ciclo controllato post-generazione**, senza bloccare la prima fase:
1. Salvare tutti i testi iniziali come bozze con diagnosi reale.
2. Nell'audit finale identificare quali unità hanno più errori e quali informazioni originali sono rimaste inesplorate.
3. Per bozze troppo corte, chiedere un'espansione didattica mirata solo sulle informazioni presenti nell'originale e mancanti nel testo. Per bozze troppo lunghe, lavorare su ridondanze e ripetizioni realmente superflue. Vietati riempitivi e tagli meccanici.
4. Controllare nuovamente il totale di lettere sull'intero libro, l'ordine progressivo e la fedeltà dei contenuti, entro un limite concordato di richieste, senza costi aggiuntivi.
5. Accettare e sostituire una versione solo se conforme e semanticamente sicura. In caso contrario conservare l'ultima versione salvata, dichiarare il margine non raggiunto e non promettere successo.
6. Solo dopo una prova reale riuscita su materiale rappresentativo: Scudo360, Pac-Man/AutoSetup come percorso subordinato, verifiche firma Android, LAB APK+ZIP.

La parte numerica e osservabilità è preparata nel ramo audit, **ma non è ancora una LAB72 distribuibile**. `motorlab/active-studybook-ai`, LAB71, LAB70 e salvataggi dell'utente restano invariati.
