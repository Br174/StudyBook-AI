# MotorLab LAB112 — Audit blocchi Gemini su StudyBook AI Prova 111

**Data:** 2026-11-10. **Solo diagnosi, senza modificare la LAB111 Android, Worker, firma, libro o checkpoint.**

## Scopo
L'utente vuole verificare se le 44 pagine del libro `Filosofia del diritto appunti+sbobine` vengono inviate a Gemini con grandi blocchi e capire quante chiamate reali causano attese HTTP503 e un altro blocco segnalato.

## Riscontri CERTI dal codice di release
Fonte congelata LAB111: commit `480c27480adecd9f2f39e235b0138a485797b9b7`.

1. `src/lib/draftFirstV57.js` usa `planNaturalBlocksLinearV111` e `for(const level of LEVELS)` in ordine `summary,50,40,30,20,10`. Ogni blocco contiene uno o più **paragrafi/pagine originali integri**, inviati in una unica richiesta generativa; non è configurato un invio Gemini per ogni pagina o ogni frase. La fonte originale viene tuttavia re-inviata per ciascuno dei sei livelli.
2. `src/lib/integralPlannerV51.js` / `src/lib/studyLinearPlannerV111.js` impostano **900.000 token stimati in ingresso, 50.000 token stimati in uscita, 1.200.000 caratteri per blocco**. Il limite di uscita è più stringente per i livelli poco compressi (10%,20%). Il limite di uscita viene ridotto soltanto dopo guasto rete misurato (`studyNetworkRecoveryV73.js`); un solo 503 non spezza blocchi `Gemini`.
3. `api/editionsBulkV51.js` effettua **UNA generazione** per richiesta `/api/editions/bulk/v51`. Per prompt stimati entro 100.000 token LAB111 non fa la chiamata `countTokens`; oltre può effettuare **una chiamata token-counter non generativa** prima dell'unica generazione, senza altra pianificazione Gemini.
4. `src/lib/draftFirstV57.js` mantiene già `diagnostics.requestsSent`, `draftRequests`, `errorsByCode`, `splits`, `lengthChecksV72[level].last`; ma **`requestsSent` viene inizializzato a 0 all'avvio di ogni esecuzione**, perciò non è una statistica persistente cumulativa dell'intero libro. Nessuna metrica per il libro reale è stata letta dal suo dispositivo.
5. Un blocco generativo incompleto può essere richiesto una seconda volta, poi diviso a confini naturali; su errore network `safeNetworkSplitV73` può suddividere fino a quattro volte. Un 503 da solo invece registra attesa e conserva le bozze.
6. `api/geminiQuotaV36.js` classifica 503 come `overload` indipendente dalla quota. `src/lib/geminiQuotaControllerV36.js` con orario solo **stimato localmente** applica per 503 ripetuti senza successi pause pari a circa 90, 180, 360 secondi, crescendo con i fallimenti fino al limite. `Gemini in attesa` può quindi comparire SENZA una nuova richiesta generativa in quel momento. Lo screenshot 16:49 -> 16:55 è compatibile con pausa locale 6 minuti, ma **NON è prova che vi siano stati precisamente tre 503**.
7. Il codice lato Android distingue il segnale HTTP 503 dalla pausa; un'ulteriore schermata di blocco può essere un messaggio di cooldown locale. Altre cause possibili sono 429 quota/token o 502/network/timeout; **senza codice preciso dell'altro blocco non si deve inventare una causa**.
8. Google ufficiale: 503 segnala indisponibilità/sovraccarico del servizio; 429 può segnalare RPM/TPM/RPD anche con poche richieste se i blocchi sono grandi. Fonte: https://ai.google.dev/gemini-api/docs/api-errors ; https://aistudio.google.com/docs/rate-limits .

## Test effettivo del planner release LAB111, solo dati SINTETICI

Workflow GitHub Actions: https://github.com/Br174/StudyBook-AI/actions/runs/42850543955 (**SUCCESS**). Script `scripts/test-lab112-44-page-block-audit.mjs` usa esattamente la funzione del planner installato, confrontandola con la LAB51 e riproducendo pause 503 tramite i moduli reali. Nessuna chiamata Gemini, nessuna quota gratuita consumata.

| Caratteri ORIGINALI sintetici medi per pagina | Totale sintetico 44 pagine | Generazioni progettate nei 6 livelli, assenti errori |
|---:|---:|---:|
| 1.500 | 66.000 | 6 (1 per livello) |
| 2.000 | 88.000 | 8 |
| 3.000 | 132.000 | 11 |
| 4.000 | 176.000 | 14 |
| 5.000 | 220.000 | 15 |

**NON sono chiamate osservate del libro sul telefono.** Per ottenere un conteggio esatto servono le lunghezze/struttura originali del libro come effettivamente acquisite oppure un registro leggibile delle richieste. I test assumono 44 pagine originali indipendenti, uguale quantità di caratteri per pagina, nessun errore, nessuna ricalibrazione, e non stimano la latenza del provider.

## Spiegazione delle schermate reali
Alle 16:37 lo schermo segnala 0/44 per tutti i livelli ed errore 503 con successivo controllo stimato 16:38; alle 16:49 vengono mostrate 44/44 Riassunto e 44/44 50%, con 503 e prossima verifica stimata 16:55. Sono progressi di 88 pagine-versione, NON prova di 88 chiamate Gemini. Il secondo messaggio di attesa può essere una pausa interna. Il tempo trascorso comprende elaborazioni, tempi di rete, eventuali fallimenti e timer locali.

## Verdetto
**I blocchi sono grandi per costruzione**; nessuna evidenza di tante microchiamate nella LAB111. La lentezza non dimostra inefficienza del numero di richieste. Concentrare molte pagine in pochi grandi blocchi riduce il costo fisso dei prompt e il numero delle chiamate, ma NON abbatte i token necessari per leggere 44 pagine sei volte e produrre sei libri; anzi ogni singolo output grande può essere lento o incontrare limiti/sovraccarico.

Il numero di richieste **effettive di questo libro non è verificabile dalle schermate o dai dati GitHub**. L'azione più precisa per una futura build, **se approvata**, è un registro per-blocco SOLO metadati (id libro anonimizzato, livello, pagine, caratteri/lettere originali, token stimati e reali, dimensione risposta, stato HTTP, tempi, numero di generazioni e retry), persistente cumulativo, senza inviare un'altra richiesta Gemini e senza salvare il libro in telemetria remota. Non introdurre spezzettamento automatico dei blocchi o pause artificiali senza prove.

**Produzione invariata**: LAB79, TRIAL110, TRIAL111, Worker e PDF/checkpoint dell'utente non toccati. Costi aggiuntivi €0.
