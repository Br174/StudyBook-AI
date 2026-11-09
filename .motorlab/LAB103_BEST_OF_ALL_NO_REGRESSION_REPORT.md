# StudyBook AI | MotorLab LAB103 — BASE MASSIMA SENZA REGRESSIONI

**Data:** 9 novembre 2026. **Stato:** consolidamento offline completato, una correzione semantica mirata in copia verificata. **NON è una release.**
**Repo:** `Br174/StudyBook-AI` | **Ramo isolato:** `audit/studybook-best-of-all-qa-v103-20261109`.
**CORE e satellite:** MotorLab r40, invariati. **Produzione, APK, firma, dati, Worker, Cloudflare:** invariati. **Costo aggiuntivo:** €0.

## 1. Perché questa LAB esiste

L'utente ha richiesto esplicitamente di **NON tornare indietro**, partire sempre dai massimi risultati precedentemente verificati di (A) precisione quantitativa e (B) correttezza del testo. La LAB102 aveva riutilizzato correttamente l'inventario LAB101 ma rimesso nel prompt dettagliati `FONDAMENTALI GIÀ VERIFICATI`, contrariamente alla conclusione LAB95–96: duplicare i fatti nel prompt rende spesso le risposte troppo prolisse. **Non replicare questa regressione.**

**Fonte di verità per la generazione:** LAB97 editing conservativo 10/20, LAB98 tutela di negazioni/modalità, LAB99 correzione chirurgica di un periodo e rollback. **Fonte di verità per controllo dopo generazione:** LAB101 inventario unico di fatti+priorità; checklist NON nel prompt. **LAB102:** solo prove originali archiviate, sorgente dei risultati utili e del recupero checkpoint, NON prompt-guida per generare nuove pagine.

## 2. Verifica quantitativa storica completa (zero Gemini)

Workflow GitHub Actions:
- https://github.com/Br174/StudyBook-AI/actions/runs/42654697575 | confronto storico ampliato.
- https://github.com/Br174/StudyBook-AI/actions/runs/42655192278 | confronto + correzione di una sola frase.

Report: `audit/reports/lab103-incumbent-no-regression.json`.
**168 testi storici REALI ricavati da LAB85–102**, dieci dataset anteriori in aggiunta a LAB97–102. **Nessuna chiamata aggiuntiva Gemini**, niente test ripetuti. Tutti gli esempi seguenti rispettano contemporaneamente la fascia ±5 punti e la griglia virtuale fissa da 60 posizioni:

| Target | Esempio PIÙ VICINO numericamente tra le 168 risposte archiviate | Righe | Provenienza | Limite noto |
|---|---:|---:|---|---|
| Riassunto 65% | 64,94% | 5/5 | scienze LAB98 | omissioni scientifiche |
| 50% | 50,00% | 7/7 | procedura LAB86 | omissioni di condizioni/registro |
| 40% | 40,25% | 9/9 | procedura LAB99, frase recuperata | manca chi/quando nel registro |
| 30% | 29,72% | 10/10 | procedura LAB85 | condizioni non pienamente salvaguardate |
| 20% | 20,70% | 11/11 | scienze LAB85 | allarmi su negazioni/cause |
| 10% | 9,91% | 13/13 | procedura LAB97 | grafie «l alunno», «l iscritto», «norma» anziché regola interna |

**Non scegliere queste uscite come campioni migliori di comprensione.** Un esatto 50,00% che perde fatti non supera una versione fedele al 49% o 47%. Nessuna delle sei è certificata semanticamente.

## 3. Il massimo risultato di fedeltà: campioni da conservare

La verifica di 4 candidati avanzati è in `audit/reports/lab103-incumbent-no-regression.json`. Le espressioni/fonti presenti sono state controllate e misurate, ma la corrispondenza lessicale non costituisce certificazione professionale.

| Candidato | Riduzione reale | Righe | Esito |
|---|---:|---:|---|
| **Medicina 10%** LAB102 | **9,34%** | **14/15** | tutti i 13 fatti LAB101 fondamentali e la precisazione sulle pareti sottili risultano espressi nella lettura dell'output; revisione indipendente ancora richiesta |
| **Storia 20%** LAB102 | **18,81%** | **11/12** | tutte le unità fondamentali appaiono presenti; però la modalità «possono differire» era resa troppo assertiva |
| Scienze Riassunto LAB102, copia mirata | 61,10% | 5/5 | relazioni critiche recuperate; brevità su «un risultato isolato non basta» e «moti e cause» da giudicare didatticamente |
| Scienze 30% LAB102, copia mirata | 25,21% | 10/10 | frase conclusiva ripristinata; «un solo risultato non basta» potrebbe richiedere oggetto esplicito della dimostrazione |

### Correzione mirata verificata in questa LAB

**Storia 20%**, un solo periodo, nessun altro testo modificato:
- **Prima, Gemini archiviato:** «Testimonianze diverse sullo stesso episodio dipendono da aspetti osservati o interessi particolari.»
- **Dopo, copia sperimentale:** «Due testimonianze sullo stesso episodio **possono** differire per aspetti osservati o interessi particolari.»
- **Prima:** 544 lettere, 18,81%, 11/12 righe.
- **Dopo:** **548 lettere, 18,21%, 12/12 righe**, zero nuovi allarmi, verbale di possibilità recuperato, testo originale intatto.
- **Prova:** `audit/reports/lab103-targeted-history-modality.json`.
- Migliora la fedeltà alla fonte per quella frase, senza rigenerare la pagina e senza chiamare Gemini. Non certifica automaticamente l'intera pagina.

## 4. Verifica avversaria del controllo del significato

Quattro falsificazioni deliberate su testi campione:
1. Medicina «può aumentare» → «deve aumentare»: individuata.
2. Storia «fatti documentati» → «fatti dimostrati»: individuata.
3. Scienze «non ogni lunazione» → «ogni lunazione»: individuata.
4. Medicina «ossigeno dall'aria al sangue» → «ossigeno dal sangue all'aria»: **NON individuata dal vecchio guard LAB99**.

Aggiunto in **script isolato nuovo** `scripts/lab103-source-direction-risk.mjs` un controllo specifico ancorato al testo fonte, NON un sistema semantico generale. Ora **4/4 manipolazioni campione segnalate**, nessun falso allarme sull'uscita corretta medicina 10%. Esiti: `audit/reports/lab103-incumbent-no-regression.json`. Altri falsi negativi sono possibili. Non certificare per questo la fedeltà didattica.

## 5. PROTOCOLLO PERMANENTE ANTI-REGRESSIONE

1. Conservare separatamente **campione migliore per precisione** e **campione migliore per correttezza**; non selezionare un testo per la sola vicinanza al numero.
2. Una nuova variante può sostituire la precedente **solo se non peggiora percentuale+griglia e preservazione dei fatti**, con evidenze archiviate. Se non migliora entrambi, resta esperimento.
3. Nessuna nuova generazione su pagine già corrette. Riutilizzare `sourceHash`, `rankedInventoryHash`, testi e controlli storici.
4. Per la generazione: LAB97→99, prompt breve sulla FONTE e sul livello; inventario unico LAB101 conservato **solo nel verificatore**, mai incollato integralmente nel prompt.
5. Controllo quantitativo e semantico dopo la generazione, separati. Coprire soggetto, direzione, negazioni, modalizzatori, cause, condizioni, numeri, termini tecnici e riconoscimento delle parafrasi.
6. Se manca davvero un fatto: correzione **solo** della frase, rollback se non conforme; mai forzare riempitivi o tagliare parole per entrare nel budget.
7. Non scambiare un testo matematicamente corretto, una regex verde o una prova sintetica con un PDF A4 o un'app pronta. Nessuna promozione prima di revisione didattica completa e prove Android reali.
8. **Costo extra €0**; credenziale gratuita preesistente soltanto quando ulteriori test Gemini sono motivati da difetti specifici non risolvibili offline.

## 6. Handoff e prossima azione esatta

**LAB103_OFFLINE_BASELINE=VERIFIED**.
**BEST_PERCENT_EVIDENCE=168_HISTORICAL_GEMINI_OUTPUTS_WITH_SIX_CLOSEST_VALUES**.
**BEST_QUALITY_EVIDENCE=MEDICINA10_AND_STORIA20_PLUS_TWO_SCIENCE_PATCHES**.
**CURRENT_TARGET=SEMANTIC_FIDELITY_ONLY_WITH_NUMERIC_NO_REGRESSION**.
**FULL_SEMANTIC_CERTIFICATION=NOT_YET_PROVEN**.
**PRODUCTION_AND_APK=UNCHANGED**.

La prossima attività, senza ricominciare i test quantitativi, è una **revisione fatto-per-fatto dei campioni qualitativamente migliori**, con chiari riferimenti alle citazioni della fonte. In caso di dubbio correggere esattamente il periodo coinvolto, non ripetere le sei generazioni. Applicare il protocollo LAB99/101 e conservare i best-of nel sistema di prove. Prima di passare a PDF veri, validare semanticamente l'intera pagina.
