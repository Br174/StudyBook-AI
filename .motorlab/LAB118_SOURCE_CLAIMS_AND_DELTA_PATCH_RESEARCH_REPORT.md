# StudyBook AI LAB118 — source claim ledger + delta-only editing (2026-11-11)
MotorLab CORE release **2026.10.29-r40**, satellite local **2026.10.29-r40 VERIFIED**. Stato: **ricerca isolata, non incorporata in APK/Worker**. Nessun merge in main o modifica a Prova114 installata.

## Motivazione
Sul PDF reale da 44 pagine, LAB114 mostrava 8/264 pagine-versione conformi. LAB116 e LAB117 hanno dimostrato su campioni sintetici che i prompt liberi non garantiscono percentuali/fedeltà; LAB117 real Gemini ha raggiunto solo 3/6 metriche quantitative su due pagine. L'utente vuole un unico lavoro Gemini per blocchi grandi, leggero anche su 2.000 pagine, senza controlli che avviano nuove chiamate né cancellazioni dei concetti o del libro.

## LAB118.A: registro delle proposizioni
`src/lib/studyClaimLedgerV118.js` genera identificativi originali stabili `unit-id:Cn` usando il proprietario già esistente `buildConceptInventory`, protezioni date/numeri/condizioni/negazioni. L'equivalenza automatica è ammessa esclusivamente per duplicati testuali identici nell'unità: lo stesso argomento NON equivale allo stesso fatto. Il model output non può certificare da solo la propria correttezza.

**CI offline** https://github.com/Br174/StudyBook-AI/actions/runs/42954193618 SUCCESS: 40 frasi campione, 36 ripetizioni letterali + 4 proposizioni originali distinte, test su prove inventate, quote assenti, ID replicati, condizioni e modalizzazioni, **0 chiamate Gemini**.

## LAB118.B: prova con UNA chiamata Gemini reale
GitHub CI https://github.com/Br174/StudyBook-AI/actions/runs/42953808440: UNA chiamata Gemini 3.5 Flash-Lite gratuita su **2 sole pagine artificiali pubbliche**, **8.583 ms** risposta, nessun retry. La risposta non rispetta il contratto: **2 varianti per pagina anziché 9 e 7**; le `claimEvidence` riportano citazioni che talvolta provengono dal testo originale ma NON compaiono nel risultato ridotto. Non è sicuro convertirle in prove.

È stato sviluppato `deriveClaimEvidenceLocallyV118`, che recupera CITAZIONI solo dal vero testo prodotto e marca rischi/ambiguità, senza chiamare Gemini; `inspectPartialGeminiReplyV118` separa le bozze incomplete dal contenuto originale, non rietichetta una bozza non conforme come pronta e non ripete la richiesta. Replay https://github.com/Br174/StudyBook-AI/actions/runs/42954261942 SUCCESS **come diagnosi tecnica**, non come qualità del libro: 17 proposizioni sorgente, **26 avvisi di copertura** fra 50 e Riassunto sulle 2 pagine. Macro grezze, riduzione per le pagine 1/2: 50 = 56,1% / 65,4%; Riassunto = 76,5% / 81,0%; fuori fascia. Gemini aveva restituito 2 anziché 9/7 varianti. Nessun nuovo modello contattato durante il replay. Il test attesta quindi il **difetto** e la corretta segnalazione, NON un libro pronto.

## LAB118.C/D: proposta di cambiamento del metodo, test OFFLINE
`src/lib/studySourcePatchV118.js` sostituisce il vincolo fragile «un array con una variante per ogni frase» con un **elenco facoltativo di modifiche locali `{from,to,occurrence,importance}`**. Ogni `from` dev'essere una sottostringa esatta della fonte. `to` dev'essere più breve e passare i vincoli lessicali/qualificatori/immutabilità, senza aggiungere testo estraneo. Il software sceglie offline un sottoinsieme di modifiche e ricostruisce l'intera pagina e i sei livelli, misurando LETTERE Unicode + righi virtuali. Una cancellazione completa è permessa **solo per una frase identica ripetuta nella stessa pagina**, a condizione che dopo l'intera selezione resti almeno una copia originale intatta; nessuna cancellazione di affermazioni uniche. Niente filler, troncamenti o controllo Gemini nella generazione locale; gli scarti e i livelli impossibili sono dichiarati.

**CI offline** https://github.com/Br174/StudyBook-AI/actions/runs/42954983098 SUCCESS: 40 assert, pagina sintetica con 20 frasi contenenti ridondanze VERAMENTE identiche. Riduzioni con soli patch non vuoti: 10%=10,1; 20%=20,3; 30%=30,4; 40%=40,6; 50%=50,7 (5 livelli); Riassunto=50,7 NON conforme perché l'originale non permetteva abbastanza eliminazioni sicure. Aggiungendo nel test la cancellazione ancorata di frasi letteralmente identiche (lasciando almeno una copia originale), **tutti e sei** i livelli hanno superato le fasce e i righi virtuali. Impediscono eliminazione dell'unica informazione, modifiche a data 2024/condizione, sovrapposizioni e ricorrenza errata. Questa è una prova su modifiche SINTETICHE MANUALI, non Gemini reale e non la verifica semantica dell'intero PDF.

## Scala 2.000 pagine
Workflow https://github.com/Br174/StudyBook-AI/actions/runs/42955161006 avviato con 2.000 pagine sintetiche ×6 livelli, senza Gemini. **Stato al checkpoint: IN CORSO, NON considerare PASS o prestazione attestata finché non conclude**. Script `scripts/bench-lab118-2000-patch-pages.mjs` con molti patch, può risultare troppo lento: se il test impiega troppo tempo è una **regressione prestazionale** da ottimizzare, non ignorare. NON promettere la stessa velocità di LAB117 né 2.000 pagine generate in pochi secondi.

## Interpretazione e gate rigorosi
- Il generatore attualmente installato NON è cambiato. Nessuna APK / ZIP Android LAB118, nessun Worker LAB118, nessuna esecuzione sul PDF privato perché l'originale non era disponibile come file nel progetto corrente.
- Il risultato offline sintetico 6/6 non prova che Gemini produca `patches` corretti su libri reali: **manca prova reale del nuovo protocollo e verifica semantica**, dunque ancora NON APP READY.
- Il protocollo delta-only riduce potenzialmente output/token e degrada in modo sicuro se Gemini restituisce un numero variabile di proposte, evitando una richiesta automatica ripetuta; l'efficacia reale è un'ipotesi da misurare.
- Nessun incremento di costi a pagamento, nessuna quota Gemini usata nei replay; un'unica chiamata reale per LAB118 registrata.
- Salvataggio originali e checkpoint LAB114 invariati, nessuna pressione su «Migliora percentuali e chiarezza» eseguita.

## Prossimo confine operativo
Chiudere e misurare bench 2.000 pagine; ottimizzare ricerca combinazioni se oltre il budget di tempo/memoria. Solo dopo che risultati locali sono sostenibili, eseguire al massimo **una prova breve** con il nuovo protocollo `patches` su campioni pubblici (NON stessa vecchia risposta e senza rigenerare sei varianti). Verificare quattro controlli: percentuali delle 6 versioni, assunti preservati, richieste Gemini reali, tempo complessivo. Non pubblicare APK se fallisce qualsiasi gate.
