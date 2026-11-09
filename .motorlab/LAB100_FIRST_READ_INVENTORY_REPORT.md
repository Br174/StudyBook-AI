# MotorLab StudyBook AI — LAB100 | Prima lettura unica e inventario persistente dei fatti

**Data:** 9 novembre 2026
**Stato:** esperimento completo e verificato nel ramo LAB; **NON APPROVATO PER PRODUZIONE**.
**Ramo:** `audit/studybook-first-read-inventory-v100-20261109`
**Repository:** `Br174/StudyBook-AI`
**CORE MotorLab:** `Br174/Chatgpt`, release `2026.10.29-r40`
**Satellite:** `2026.10.29-r40`, `STATE=VERIFIED`, stessa release del CORE.
**Routing applicazione:** `motorlab/active-studybook-control` in modalità `control-only`, non modificato.
**Immutabilità:** branch main, app installata, Android signing, Cloudflare e dati non modificati. Nessun APK/ZIP creato.

## Scopo

Realizzare e collaudare il principio discusso: la lettura completa della pagina crea **una sola volta** un inventario ordinato di fatti, negazioni, numeri, condizioni, cause, soggetti ed eccezioni. L'inventario è memorizzato con l'impronta crittografica del testo originale, e viene **riutilizzato identico** per i sei livelli didattici: 10%, 20%, 30%, 40%, 50% e riassunto (~65%). Non mostrare al modello un secondo elenco completo di fatti durante le successive riscritture. La regola STOP AL PENSIERO COMPLETO resta in vigore: mai riempire mezza riga con testo artificiale.

### Distinzione essenziale

Questa LAB dimostra la **creazione automatica dei cinque inventari** dai cinque testi di pagina sintetici già estratti, e la **preparazione matematica di trenta piani**, uno per ciascuna versione.

**Non dimostra** che Gemini abbia poi generato trenta testi compressi. Non dimostra l'estrazione autonoma da PDF reale, la lettura contestuale di un libro completo, la correttezza accademica certificata, l'impaginazione fisica A4, o la gestione di checkpoint sulla versione installata.

## Metodo realizzato

- `scripts/lab100-first-read-ledger.mjs`: suddivide deterministicamente il testo della pagina in frasi numerate `S1..`. Riceve un inventario JSON di affermazioni brevi `F1..`, ciascuna con frase di origine, **citazione letterale dal testo**, affermazione italiana, tipo di fatto e priorità `essential`.
- L'inventario è accettato strutturalmente solo se le citazioni appartengono realmente alla frase indicata, tutte le frasi hanno almeno un fatto, gli ID sono unici e la fonte non è scambiata con un'altra.
- `sha256` sull'originale e sull'inventario; i sei piani fanno riferimento alla **stessa impronta** e non richiedono sei nuove estrazioni.
- `scripts/lab100-verify-evidence-case.mjs`: rettifica SOLO la capitalizzazione di una citazione se corrisponde in modo univoco alla fonte con confronto indipendente dal maiuscolo/minuscolo. Le affermazioni Gemini restano identiche.
- Il controllo lessicale manuale di riferimento su **64 elementi** viene usato soltanto come segnale di allarme, non come certificazione del significato.
- Nessuna citazione proveniente dal contesto di pagina vicina viene autorizzata come evidenza della pagina corrente.

## Prove senza Gemini

**Primo ciclo**: GitHub Actions https://github.com/Br174/StudyBook-AI/actions/runs/42639243666

- **30.000** tentativi deterministici di manomissione: fatto mancante, citazione estranea alla fonte, ID di frase inesistente, ID di fatto duplicato e riutilizzo di inventario su pagina mutata. **Zero errori** nelle verifiche.
- **5 pagine × 6 livelli = 30** piani matematici basati su un singolo inventario per pagina.
- Nessuna chiamata Gemini per questi calcoli. Ricordare che un test di integrità delle citazioni non certifica il significato della frase estratta.

**Secondo ciclo**: GitHub Actions https://github.com/Br174/StudyBook-AI/actions/runs/42640123756

- Ripetute **20.000** manomissioni avversarie, in particolare citazioni deliberatamente inventate: **20.000 respinte**, zero errori.
- Cinque inventari di Gemini rianalizzati senza nuove richieste; un solo errore di maiuscola di citazione corretto in metadata, **zero affermazioni cambiate**.
- Inventari originali e corretti archiviati nel ramo LAB con impronte del testo sorgente.

## Prime letture Gemini reali

Workflow originale: https://github.com/Br174/StudyBook-AI/actions/runs/42639243666

Modello: `gemini-3.5-flash-lite`; segreto gratuito esistente. **6 richieste HTTP per 5 pagine complete**: un HTTP **503** iniziale in scienze, recuperato con un solo retry; cinque risposte JSON valide. **Nessun HTTP429**.

| Materia | Fatti ricavati | Citazioni strutturalmente valide, dopo rettifica | Piani riutilizzati |
|---|---:|:---:|---:|
| Scienze | **12** | Sì | 6 |
| Procedura | **11** | Sì | 6 |
| Medicina | **14** | Sì, una maiuscola metadata corretta | 6 |
| Storia e fonti | **13** | Sì | 6 |
| Pagina giuridica breve | **3** | Sì | 6 |
| **Totale** | **53** | **5/5** | **30** |

La rettifica della citazione medica è stata: `durante l'inspirazione il diaframma si contrae` → `Durante l'inspirazione il diaframma si contrae`. **Non è stata riscritta la proposizione né sostituita una fonte semantica**.

Evidenza originale: `audit/reports/lab100-real-first-read.json`.
Inventari verificati con dati integrali e sei piani ciascuno: `audit/reports/lab100-safe-anchor-final.json`.

## Qualità didattica: controllo dei 64 fatti di riferimento

L'inventario dispone di 53 fatti estratti, alcuni dei quali incorporano più di una delle 64 informazioni del benchmark manuale.

**61/64** controlli lessicali hanno trovato l'informazione con la formulazione attesa. I tre allarmi residui sono concentrati nella pagina medica:
1. **Direzione dell'anidride carbonica:** il modello ha usato `tragitto inverso` invece di `percorso opposto`.
2. **Emoglobina e ossigeno:** il modello ha invertito legittimamente l'ordine delle parole, scrivendo che l'ossigeno «viene trasportato dall'emoglobina».
3. **Produzione di CO₂:** il modello ha usato `produzione`, mentre la regex richiedeva la radice `produc`.

Queste tre differenze appaiono **falsi allarmi lessicali** alla lettura della fonte, non prove di omissioni. Non si devono comunque eliminare i controlli alla cieca: occorre una verifica semantica più robusta di sinonimi, soggetto/predicato, negazioni e grado di certezza.

**Rischio nuovo scoperto:** Gemini ha marcato **tutti i 53 fatti come `essential: true`**. Non sa ancora separare in modo affidabile i concetti imprescindibili dai dettagli utili, distinzione cruciale per ripartire lo spazio fra i livelli al 50% e riassunto. Una lista interamente essenziale può non entrare nella pagina e incentiva compressioni troppo aggressive o impossibili. Questa classificazione NON può essere promossa come sistema finale di priorità.

Altri limiti qualitativi:
- Un'affermazione del testo procedurale presenta `l obbligo` invece di `l'obbligo`: l'inventario interno non è perfetto nella grafia.
- Il modello usa talvolta categorie `obbligo` e `possibilità` assenti dalla stretta prima enumerazione degli schemi: non equivalgono a errori semantici.
- L'analizzatore segnala qualche clausola potenzialmente non coperta, ma una singola clausola può essere correttamente rappresentata da **più fatti brevi**. I guard semantici non possono basarsi sulla sola lunghezza della citazione.
- **Nessun inventario è stato certificato da revisione specialistica indipendente** e non sono stati provati casi di contraddizione sofisticata o testi PDF scansionati.

Rilettura pagina per pagina: `audit/reports/lab100-qualitative-review.json`.

## Architettura proposta, alla luce dei risultati

**Prima lettura (una volta per pagina):** leggere testo e contesto del libro, segmentare periodi e unità semantiche, riconoscere fatti e relazioni, associare la citazione e la pagina originale, memorizzare un hash e gli atomi di conoscenza. I fatti non devono passare tra pagine. Questo è stato testato solo su pagine sintetiche già estratte.

**Sei generazioni successive:** usare **lo stesso** inventario come vincolo di controllo locale e pianificare target di lettere e righe separati; il prompt Gemini riceve **la fonte originale e poche istruzioni sul livello**, senza un secondo elenco verboso dei fatti (LAB94/95 dimostrano il rischio di testi gonfiati). Non aggiungere spiegazioni per riempire righe; pagina originale invariata.

**Controllo post-generazione:** conteggi deterministici, geometria, integrità dei riferimenti, livello di certezza e relazione fra fatti. Evitare l'autoapprovazione per sole parole corrispondenti; usare eventualmente **una sola correzione mirata** della frase effettivamente difettosa (LAB99), senza rigenerare il resto della pagina e con rollback se fuori fascia o fuori pagina.

**Priorità per la successiva LAB101:** tarare durante la stessa prima lettura una gerarchia a **concetti essenziali, fatti di supporto e contesto**, dimostrando sui casi reali che le informazioni essenziali rimangono in tutte le versioni e che i dettagli di supporto vengono trattati senza violare le percentuali. Le nozioni non devono sparire in modo arbitrario. Prima di ogni promozione, validare PDF reali/A4, font fisso, capitoli e pagine originali, 10/20/30/40/50/riassunto, errori 429/503, checkpoint e prestazioni su Android.

## Esito

**Avanzamento reale:** la prima lettura automatica funziona come prototipo per cinque pagine sintetiche: **5 inventari verificati con citazioni**, **53 fatti**, **30 piani di riduzione**, **50.000 test deterministici senza errori**, nessuna duplicazione delle chiamate per i sei livelli.

**Non ancora dimostrato:** precisione didattica semantica completa, prioritizzazione realistica, sei testi di studio completi, integrazione PDF/A4 e prestazioni dell'app. **0 inventari promossi e 0 pagine pubblicate in produzione.**

Zero upgrade o servizi a pagamento. L'app installata non è stata toccata e nessun APK/ZIP è stato compilato.
