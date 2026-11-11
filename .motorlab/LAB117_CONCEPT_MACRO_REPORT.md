# StudyBook AI / MotorLab LAB117 — Fusione di concetti senza richieste Gemini superflue
Data: 2026-11-11 (Europe/Rome).
CORE MotorLab r40 e satellite locale r40 verificati. Operazione autorizzata con «Ok» alla continuazione di LAB116.

## Stato: RESEARCH ONLY / NON APPROVATO PER APK
Ramo esclusivo `research/studybook-lab117-concept-macro-20261111`. Nessuna modifica alla famiglia Android installata, al Worker, al motore di generazione, all'APK o ai libri e checkpoint. No merge, no release, zero upgrade, zero servizi a pagamento.

## Ipotesi implementata e verificata
`src/lib/studyConceptMacroV117.js` sviluppato come modulo isolato. Alla stessa chiamata Gemini che genera varianti frasali LAB116 aggiunge `macro50` e `macroSummary` per unire ridondanze *realmente presenti* nello stesso paragrafo. Compose in locale 50% e Riassunto assieme alle altre quattro versioni esistenti, usando budget ufficiali di lettere per pagina e righe virtuali, gruppi originali indivisibili, JSON con ID. Non aggiunge chiamate Gemini per ricomporre e non rietichetta i risultati. Blocca abbreviazioni con numeri/condizioni protetti alterati, riferimenti inventati, rischio causale direzionale, mancanze evidenti di negazioni, obblighi ed eccezioni. La fedeltà globale NON è certificata da euristiche lessicali. Se i candidati non permettono di stare in fascia senza perdere contenuti, mantiene la misura reale e fallisce la promozione.

## Test locali a costo quota zero: SUCCESS
- Test `scripts/test-lab117-concept-macro.mjs`, GitHub CI https://github.com/Br174/StudyBook-AI/actions/runs/42952209814: **26 assert superate**, riduzione 50% e Riassunto 60% su quattro pagine sintetiche contenenti **ridondanze identiche realmente eliminabili**. Gestione di più unità per pagina; rigetto di falsa data 2023 al posto di 2024, condizione giuridica perduta, e salto da «influisce» a «causano».
- Benchmark `scripts/bench-lab117-2000.mjs`, GitHub CI https://github.com/Br174/StudyBook-AI/actions/runs/42952257341 SUCCESS: 2.000 pagine sintetiche ricomposte con **4.000 controlli pagina per 50%+Riassunto**, in 20 blocchi di 100 pagine, **22.347 ms** sul runner GitHub, blocco 100 pagine max **1.175 ms**, memoria heap osservata fino a **53 MB**, **0 chiamate Gemini**. Non misurano tempi di generazione, verità semantica, A4 fisico o esperienza su Android. Versioni abbreviate del benchmark redatte manualmente: non sono produzione Gemini.
- Script di verifica sintassi e invarianti, falliscono esplicitamente su divergenze reali; non confondere pass dei test locali con collaudo dell'APK.

## Prima prova Gemini REALE per LAB117: FAIL, non occultare
GitHub CI https://github.com/Br174/StudyBook-AI/actions/runs/42951777342, una sola richiesta a Gemini 3.5 Flash Lite su **due campioni sintetici pubblici** (scienze, procedura biblioteca), risposta in **6.636 ms**, nessun retry e nessun dato privato del libro:
| Livello | Riduzione effettiva | Pagine quantitative nei margini | Stato |
| --- | ---: | ---: | --- |
| Riassunto 60% | 34.7% | 0/2 | FAIL |
| 50% | 34.7% | 0/2 | FAIL |
| 40% | 33.7% | 1/2 | FAIL |
| 30% | 29.6% | 2/2 | numerico PASS, rischio semantico distinto |
| 20% | 20.0% | 2/2 | numerico PASS, semantica non certificata |
| 10% | 10.0% | 2/2 | numerico PASS, semantica non certificata |

Report JSON real output conservato in GitHub Actions artifact **13825605455**. **NESSUNA** APK/build con LAB117 approvata.

## Replay dello STESSO output reale: zero chiamate Gemini aggiuntive
GitHub CI https://github.com/Br174/StudyBook-AI/actions/runs/42952127436, diagnostica read-only, gate volutamente FAIL poiché solo 3/6 livelli rispettano l'intera metrica. Nessuna fusione macro (0/4) supera contemporaneamente tutti i controlli preliminari di sicurezza. Dati misurati sull'originale delle due pagine:
| Macro | Pagina 1 | Pagina 2 |
| --- | ---: | ---: |
| macro50 (obiettivo 50) | 20.4% | 37.7% |
| macroSummary (obiettivo 60) | 50.9% | 65.3% |
Il primo Riassunto omette informazioni protette (p.es. la diversa causa delle stagioni); il secondo Riassunto è troppo breve e perde fatti e condizioni della procedura. Anche il 50% contiene rischi di qualificazione/omissione. Segnali di significato riscontrati perfino su 40/30: la sola misura numerica NON vale come accettazione didattica.

## Diagnosi causale
Nella prova reale non si è verificato alcun errore 503/429 o timeout. **I candidati Gemini sono numericamente sbagliati prima ancora della ricomposizione, e alcuni non sono fedeli al testo originale.** Il compositore non può inventare spiegazioni affidabili per far tornare il numero, né eliminare arbitrariamente clausole irripetibili. LAB116 sui due campioni aveva 4/6 quantitativi, LAB117 con una nuova risposta Gemini e nuove istruzioni è 3/6. Non dichiarare confronto A/B rigoroso: sono due campioni e risposte stochasticamente diverse.

## Next safe step (non eseguito come risultato completo)
Analizzare prima densità informativa e reale ridondanza con un **inventario di proposizioni esplicito** e un identificativo stabile per ogni negazione, condizione e fatto, nello STESSO prompt della fusione, evitando chiamate extra. Non fondere proposizioni non equivalenti. Confrontare le evidenze di supporto del testo generato con la fonte locale: se una pagina è densa e una riduzione è semanticamente impossibile, segnalarlo senza false approvazioni. Test offline sul replay conservato prima di spendere nuovi token; poi piccoli campioni multipli e solo successivamente libro autentico da 44 pagine quando accessibile. Conservare obiettivi Riassunto/50/40/30/20/10 originali, UI, checkpoint, scaffolding e costo €0. La pubblicazione APK richiede prove quantitative e di contenuto valide, oltre ai gate Android Scudo360.

## Identità / continuità
LAB116 rapporto preservato in `research/studybook-lab116-source-anchored-20261110`. LAB117: `src/lib/studyConceptMacroV117.js`, `scripts/test-lab117-concept-macro.mjs`, `scripts/test-lab117-one-real-request.mjs`, `scripts/replay-lab117-real.mjs`, `scripts/bench-lab117-2000.mjs`, CI workflows omonimi. Nessuna modifica a `main`, né LAST_GOOD, né APK/Worker reali.
