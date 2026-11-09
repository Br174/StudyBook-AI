# StudyBook AI · MotorLab LAB104 · Verifica fonte per fonte, nessuna regressione

Data: 9 novembre 2026.
Stato: **collaudo offline eseguito e verificato**. Non è una certificazione didattica professionale, né una release dell'app.

- Repository: `Br174/StudyBook-AI`.
- Branch sperimentale: `audit/studybook-source-fact-review-v104-20261109`.
- Test GitHub Actions: https://github.com/Br174/StudyBook-AI/actions/runs/42657954629 (SUCCESS).
- Risultati integrali, inclusi 52 citazioni originali, decisioni e testi completi: `audit/reports/lab104-fact-by-fact-editorial-review.json`.
- Script riproducibile: `scripts/lab104-fact-by-fact-editorial-review.mjs`.
- Fonte documentale delle 52 affermazioni: `audit/reports/lab101-real-priorities.json`.
- Fonti di pagina: cinque campioni sintetici già segmentati `audit/test-fixtures/lab89-semantic-concepts.json` (qui esaminate solo quattro coppie pagina/livello).
- Motore MotorLab r40 e motore StudyBook originario preservati. Produzione, Android, Cloudflare, chiavi, firma, PDF utente, APK e ZIP: **non modificati**.
- Chiamate Gemini aggiuntive: **0**. Spesa aggiuntiva: **€0**.

## Punto di partenza scelto: i massimi verificati, non la LAB più recente

La LAB103 ha confrontato **168 testi REALI storici** dalle LAB85–102 e fissato indipendentemente i migliori riferimenti matematici e i quattro candidati più promettenti semanticamente. LAB104 non ha ripetuto quelle chiamate, non ha reintrodotto la checklist verbosa nel prompt di generazione e non ha riscritto le sei versioni di nessuna pagina.

Ogni uscita finale qui riportata conserva una percentuale entro ±5 punti e il limite di righe virtuali da 60 posizioni. Le righe NON sono una verifica fisica su PDF A4.

## Verifica editoriale di tutte le 52 affermazioni LAB101

I controlli sono *editoriali a fronte di citazioni letterali della fonte*, non una misura autonoma di comprensione semantica generale. Le evidenze parola-per-parola sono conservate e testate esattamente contro l'output finale, con impronta SHA-256 della sorgente.

| Pagina | Riduzione finale | Righe | Fatti completi | Fatti parziali | Dettagli non essenziali omessi |
|---|---:|---:|---:|---:|---:|
| Medicina 10% | **9,34%** | **14/15** | 12 | 2 | 1 contesto |
| Storia 20% | **18,66%** | **12/12** | 13 | 0 | 0 |
| Scienze, Riassunto 65% | **61,10%** | **5/5** | 3 | 8 | 1 supporto |
| Scienze 30% | **25,21%** | **10/10** | 11 | 1 | 0 |
| **Totale** | | | **39** | **11** | **2** |

Dei 11 punti parziali, **10 sono classificati fondamentali** nell'inventario LAB101. Pertanto **non è corretto dichiarare tutte e quattro le pagine didatticamente approvate**.

### Migliore candidata: storia 20%

**13/13 fatti dell'inventario espressi integralmente secondo la revisione editoriale.** Corretta SOLO la frase sulle due testimonianze per preservare l'incertezza e collegare gli interessi agli autori.

- LAB103 (in copia): «Due testimonianze sullo stesso episodio possono differire per aspetti osservati o interessi particolari.»
- LAB104 (in copia): «Testimonianze sullo stesso episodio possono differire per aspetti osservati o interessi degli autori.»
- Riduzione **18,21% → 18,66%**, quindi anche più vicina al target 20%; righe **12/12 → 12/12**.
- Zero perdita di altri periodi; nessuna riscrittura totale.
- Invarianti di hash, contatore e griglia verificati. La pagina è un **candidato prioritario per la revisione didattica indipendente**, non un PDF/app già certificato.

### Medicina 10%: conservato il migliore risultato senza toccarlo

Riduzione **9,34%**, **14/15** righe, 12 fatti già considerati completi; alcuni dettagli ancora da esaminare:
- F9, *supporto*: testo «pareti sottili» anziché fonte «pareti **molto** sottili».
- F10, *fondamentale*: il passaggio sull'emoglobina nei globuli rossi non ripete esplicitamente «**nel sangue**», pur essendo inferibile dal contesto.
- F1 era solo una premessa «In un esempio didattico», non un fatto fondamentale. La sua omissione non va confusa con una perdita del meccanismo respiratorio.

**Decisione anti-regressione:** questa candidata resta immutata per ora, perché modifiche meramente cosmetiche possono peggiorare il conteggio senza beneficio didattico dimostrato.

### Scienze 30%: migliorata chiarezza, stessa percentuale

Una sola unità C4 modificata: «un solo risultato non basta» diventa «un solo risultato **non dimostra una spiegazione**». Lo scopo della cautela scientifica è finalmente esplicito.

- Riduzione **25,21% → 25,21%**; griglia **10/10**.
- Fatti completamente individuati: **11/12**.
- Il solo F12 rimane *parziale*: il testo dice «Distinguere moto e cause delle variazioni» ma la fonte contrappone **descrizione del movimento** e **cause delle variazioni osservate**. Non aggiungere spiegazioni a caso se la fascia o la pagina non lo consentono.

### Scienze, Riassunto 65%: errore corretto senza nascondere i limiti

- «Luna e Sole **causano** maree» sostituito con «Maree: Luna e Sole **influiscono**», allineato alla fonte (influenza, non causalità dichiarata).
- «un risultato isolato» reso «un esito isolato» per compensare esattamente le quattro lettere in più, senza aggiungere riempitivi o cancellare il concetto.
- Riduzione **61,10% invariata**, **5/5 righe invariato**.
- Vecchio guard lessicale segnala `single_result_not_proof` quando incontra «esito» anziché «risultato». L'allarme grezzo è conservato nel JSON, con adjudicazione specifica e verificata sulla fonte; non è stata disattivata la regola generale.
- **8 fatti fondamentali restano solo parzialmente rappresentati**: rotazione sull'asse, nesso giorno/notte, approssimazione dell'anno, rapporto inclinazione/stagioni e distanza dal Sole, allineamento come condizione, scopo della singola prova, descrizione vs cause. **Riassunto NON pronto per studio.**
- Non promettere che preservare tutte le informazioni sia sempre fattibile nel 65% e in cinque righe. Se non fattibile, segnalare la difficoltà senza eliminare fatti o ingannare il contatore.

## Verifiche anti-regressione e tracciabilità

- Firma dei quattro originali congelata in LAB103, confronto con fonte LAB101 a SHA verificato.
- **52/52** identificativi di fatti associati univocamente; nessun fatto fondamentale marcato facoltativo; citazioni e casi parziali registrati.
- **3** candidati modificati con sostituzioni mirate; quarto candidato (medicina) volutamente invariato.
- Le tre correzioni conservano fascia percentuale, numero massimo di righe e direzione respiratoria.
- LAB103 offline re-test (168 testi e quattro mutazioni) superato assieme alla LAB104.
- Controlli lessicali e aderenza editoriale non garantiscono ancora comprensione automatica generalizzabile.
- Primi tentativi CI LAB104 falliti per bug *del test stesso* (selezione hash senza confronto `from`, `null` versus `undefined`, falso allarme su «esito»). Questi sono stati corretti in modo tracciato prima della run finale. Una CI successiva ha fallito **solo** nella pubblicazione del report per file LAB103 timestampati non ripristinati; risolto e verificato nella run finale verde. Nessuno dei fallimenti implicava un errore nell'app installata.

## Vincolo permanente per continuare

**Non ripartire dalle percentuali.** Il problema ora è la fedeltà del contenuto, con accettazione indipendente delle percentuali già raggiunte.

Ordine operativo raccomandato:
1. Studiare prima il F12 di Scienze 30%, che è un'unica incompletezza da affrontare con una correzione locale senza variare 25,21% e 10/10 righe.
2. Rivedere la precisazione F10 di Medicina 10% solo se migliora la fedeltà senza peggiorare inutilmente 9,34%.
3. Riassunto scientifico: verificare la **fattibilità complessiva** dei fatti fondamentali su cinque righe, invece di forzare otto correzioni separate incoerenti. Segnalare la non-fattibilità anziché inventare riempitivi, troncare o omettere fatti.
4. Usare la storia 20% come candidato di controllo di qualità da non peggiorare. Validare poi su veri PDF A4 e libri completi prima di release.

**Checkpoint di continuità:**
LAB104 completata come indagine QA, senza Gemini, zero euro, produzione intatta. 52 fatti esaminati, 39 espressi completamente nella verifica editoriale, 11 parziali, 2 omessi perché non essenziali; **0 testi certificati per la produzione**. Il metodo vincente è LAB97–99 + inventario LAB101 come controllore post-generazione, e LAB103/104 come sistema di massimi e revisione chirurgica.
