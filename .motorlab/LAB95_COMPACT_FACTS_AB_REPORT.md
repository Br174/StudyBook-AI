# MotorLab StudyBook AI | LAB95 | Concetti italiani compatti: prova A/B reale

**Data:** 9 novembre 2026
**Stato:** collaudo A/B eseguito e analizzato, **non conforme**; nessuna modifica all'app o alla produzione.
**Ramo audit:** `audit/studybook-compact-facts-v95-20261109`
**GitHub Actions:** https://github.com/Br174/StudyBook-AI/actions/runs/42627100926

## Domanda sperimentale
Possiamo conservare tutti i fatti essenziali in una sola generazione per pagina e riduzione, chiedendo a Gemini di COMBINARLI in periodi concisi anziché trasformare ogni fatto della checklist in una frase indipendente?
- Variante **A**: fatti italiani, sintesi per clausole, stesso numero di lettere/righe target.
- Variante **B**: come A, ma con stime morbide in lettere per ciascun concetto.
- Entrambe conservano la regola "pensiero completo, stop"; nessuna aggiunta per riempire la riga.
- Tutti gli output sono controllati con Unicode e wrapping monospaziato di 60 posizioni. La pagina breve è sempre esclusa dall'obbligo della percentuale.
- I concetti sono estratti **manualmente** dalla fonte sintetica nelle fixture; il riconoscimento autonomo da PDF non è testato.

## Verifiche offline, senza Gemini
- Due testi di riferimento **scritti manualmente** (non generati dal modello):
  - Scienze al 20%: **498 lettere** su **599**, riduzione **16,86%**, **11/11 righe**, checklist atomica soddisfatta in tutti i controlli disponibili.
  - Medicina al 20%: **609 lettere** su **728**, riduzione **16,35%**, **13/13 righe**, checklist atomica soddisfatta in tutti i controlli disponibili.
- Questi risultati mostrano che la fascia richiesta 15–25% **è fattibile** sui due esempi senza tagliare fatti.
- **4.000/4.000** prove negative di eliminazione di un concetto rilevate dal controllo lessicale; zero errori. Attenzione: test negativo semplice, NON prova che il controllo capisca tutte le equivalenze semantiche.
- Dati: `audit/reports/lab95-offline-feasibility.json`; fixture manuale `audit/test-fixtures/lab94-golden-20-percent-manual.json`.

## Test reali Gemini
- Modello preesistente `gemini-3.5-flash-lite` tramite chiave gratuita già configurata, nessun upgrade.
- **8 tentativi HTTP**: **7** risposte complete, poi HTTP **429**; stop immediato, nessuna raffica di retry.
- Totale programmato 13 casi, interrotti al primo limite della quota.
- **0/7** conformi a percentuale e capienza, **0/7** conformi alla percentuale, **0/7** conformi al limite righe.
- **0** falsi cambi automatici lingua inglese rilevati.
- Le quattro risposte A e le tre B erano tutte troppo lunghe, anche quando il testo preservava in buona parte i fatti.
- **Nessuna risposta** è stata promossa nell'app.

### Riduzione reale ottenuta sui casi al 20%
| Materia | Variante A | Variante B | Fascia richiesta |
|---|---:|---:|---:|
| Scienze | **−3,67%** (14/11 righe) | **−3,17%** (13/11) | 15–25% |
| Medicina | **−4,67%** (16/13) | **−0,27%** (16/13) | 15–25% |
| Procedura | **−2,99%** (14/11) | **−11,32%** (15/11) | 15–25% |
| Storia, concetto sbilanciato | **−3,88%** (15/12) | non completata | 15–25% |

Le riduzioni negative indicano testo **più lungo dell'originale**. La variante B NON è generalmente migliore della A, e aggiungere budget per-concetto nel prompt non ha risolto.

### Distanza dalle lettere target
| Caso | Lettere modello | Originale | Obiettivo | Eccedenza sul target |
|---|---:|---:|---:|---:|
| Scienze A | 621 | 599 | 479 | **+142** |
| Scienze B | 618 | 599 | 479 | **+139** |
| Medicina A | 762 | 728 | 582 | **+180** |
| Medicina B | 730 | 728 | 582 | **+148** |
| Procedura A | 655 | 636 | 509 | **+146** |
| Procedura B | 708 | 636 | 509 | **+199** |
| Storia A | 696 | 670 | 536 | **+160** |

## Controllo linguistico e semantico
- Scienze A/B preserva indicativamente la checklist, ma scrive `poichè` invece di `poiché`, e l'output supera di 2–3 righe il limite.
- Medicina A conserva molti dettagli, ma mette spazi errati negli apostrofi (`l apparato`, `l inspirazione`...), e supera di 3 righe il limite.
- Medicina B usa l'italiano meglio, ma rimane fuori fascia e supera di 3 righe.
- Procedura A/B mantiene i concetti principali, ma si dilunga. Alcune segnalazioni della checklist sono falsi positivi: il testo esprime la proroga non automatica e la data che resta valida senza conferma con formulazioni diverse dalle regex.
- Storia A conserva molti concetti ma è più lunga della fonte e supera di 3 righe.
- Nessuno di questi controlli equivale a una revisione professionale completa della fedeltà didattica.

## Diagnosi
È una **ipotesi corroborata da più output, non causalità dimostrata**: inserire sia l'intera fonte sia una checklist verbosa di fatti in italiano incoraggia il modello a parafrasare o ripetere i fatti invece di ridurli. Le istruzioni di compressione A/B non hanno prevalso in nessuno dei sette casi.

## Correzione progettuale consigliata
Per la prossima prova:
1. Lasciare **la checklist dettagliata SOLO nel motore di verifica**, senza mostrarla al modello. Conservare il vettore dei fatti indispensabili dal primo esame del libro, ma non ripetere nel prompt ogni fatto con una frase completa.
2. Dare al modello la **fonte originale, il livello, l'intervallo alfabetico, i concetti in ordine e soltanto i divieti semantici minimi**, cioè non eliminare numeri, negazioni, definizioni, eccezioni e condizioni. Evitare un elenco che duplichi la pagina.
3. Mantenere la regola STOP A PENSIERO COMPLETO, nessun riempitivo e nessun a capo obbligatorio tra concetti; limite righe totale con font fisso e spazi condivisi.
4. Una sola generazione per pagina/livello; misurare risultato tramite codice indipendente e validare significato, non soltanto sinonimi testuali.
5. Non lanciare nuove chiamate Gemini mentre il provider comunica HTTP429; no costi aggiuntivi.
6. In futuro, per la vera app, verificare font/margini PDF A4 e qualità su libri reali dopo stabilizzazione del modello su fonti sintetiche.

**Verdetto:** la fattibilità matematica esiste e il limite tecnico può essere misurato, ma le risposte Gemini con checklist ripetuta non sono soddisfacenti. Nessuna modifica a main, nessun APK/ZIP compilato in questa LAB.
