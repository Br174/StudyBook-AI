# StudyBook AI · MotorLab LAB105 · 1000 pagine, sei riduzioni, affidabilità e checkpoint

Data: 9 novembre 2026. MotorLab r40, satellite locale r40. **Stato**: collaudi su campioni sintetici e test reali di Gemini completati nei limiti del fornitore; **NON è una release né il collaudo integrale di un libro autentico di 1000 pagine con 6000 riduzioni Gemini**.

**Ramo isolato:** `audit/studybook-1000page-reliability-v105-20261109`.
**Produzione, APK, firma, dati, Worker Cloudflare, chiavi, PDF utente, LAST_GOOD:** invariati.
**Spesa aggiuntiva deliberata:** €0. Unicamente gli strumenti/quote gratuite esistenti, nessun upgrade. Una quota del provider è stata raggiunta, e il test live si è fermato.

## 1. Stress della macchina a stati 1000 pagine × sei livelli

Workflow PASS: https://github.com/Br174/StudyBook-AI/actions/runs/42662879485
Dati: `audit/reports/lab105-1000-page-stress.json`.
Script: `scripts/lab105-1000-page-stress.mjs`.

**1000 RECORD di pagina simulati**, **25 capitoli**, **6000 verifiche su metadati di candidati precedentemente prodotti da Gemini**. Attenzione: **cinque testi campione distinti ripetuti 200 volte**; 6000 test non sono 6000 risposte indipendenti. La selezione utilizza il best-of registrato dalle LAB85–104, con hash e controllo delle fasce. L'inventario della LAB101 non è reimmesso nel prompt.

| Livello | Conformi per lettere e righe | Non conformi | Totale |
|---|---:|---:|---:|
| Riassunto ~65% | 600 | 400 | 1000 |
| 50% | 800 | 200 | 1000 |
| 40% | 1000 | 0 | 1000 |
| 30% | 800 | 200 | 1000 |
| 20% | 1000 | 0 | 1000 |
| 10% | 1000 | 0 | 1000 |
| Totale | **5200** | **800** | **6000** |

Questi sono **controlli di archivio ripetuto**, non una percentuale di successo predittiva su nuovi libri. In particolare, per le pagine brevi 1–5 righe si applica l'esenzione percentuale già concordata: la conformità non dimostra che sia stato ottenuto esattamente il 10/20/30/40/50/65%.

**Ripresa:** quattro interruzioni simulate, a pagina 7, pagina 610 (61%), pagina 760 (76%, checkpoint primario volutamente corrotto e ripristino LAST_GOOD a pagina 750) e pagina 990 (99%). 10 pagine ripercorse in sicurezza nel caso corrotto, senza duplicare alcuno dei 6000 lavori. Sette mutazioni artificiali su identità pagina/source hash/risultati sono state rifiutate. Non è una prova di interruzioni reali del processo Android.

## 2. PDF REALE con 1000 pagine fisiche sintetiche

Workflow PASS: https://github.com/Br174/StudyBook-AI/actions/runs/42663538683
Dati: `audit/reports/lab105-1000-physical-pdf.json`.
Script: `scripts/lab105-1000-page-physical-pdf.mjs`.

Creato in memoria un vero **PDF di 1000 pagine** (863.916 byte) con cinque testi italiani campione ripetuti, 25 capitoli, un identificativo univoco per pagina. È stato importato con il **lettore realmente usato da StudyBook**, `readPdfIntegrity360`, nel percorso `textOnly`, con `fake-indexeddb` su GitHub Actions.

- 1000/1000 pagine estratte e verificate; 0 pagine mancanti.
- 1000/1000 numerazioni e marcatori specifici delle pagine conservati.
- 25/25 capitoli rilevati e in ordine.
- 1000/1000 checkpoint salvati e recuperati in seconda apertura; stessa impronta del documento.
- Zero regressioni di progresso osservate.
- Runner GitHub: 1.666 ms prima lettura, 331 ms riapertura. **Non sono benchmark Android.**
- PDF sintetico testuale, **non** un libro autentico, **non** una scansione/OCR né un confronto dell'impaginazione fisica su A4.

## 3. Motore di studio locale su mille pagine

Workflow PASS: https://github.com/Br174/StudyBook-AI/actions/runs/42664065814
Script: `scripts/lab105-1000page-native-study-engine.mjs`.

Estensione **dal preesistente** `scripts/stress-large-book.mjs` (600 pagine) invece di ricominciare da zero. Test sintetico text-first, `preferAi:false`.

- 1000 pagine, 140/140 capitoli, 420 sezioni, 1000/1000 paragrafi.
- Integrità dei dati numerici per pagina, progress monotono e verifiche dei confini dei capitoli superate.
- Build del motore locale su GitHub: 5.215 ms, crescita heap 44,4 MB; 96 ms parsing.
- Firma/checkpoint signature presente. **Non prova il funzionamento Gemini né il caricamento reale su Android**.

## 4. Nuova generazione REAL Gemini: prova controllata entro quota

Workflow eseguito: https://github.com/Br174/StudyBook-AI/actions/runs/42663745784
Risposte originali: `audit/reports/lab105-real-six-levels-pilot.json`.
Script: `scripts/test-lab105-real-six-levels-pilot.mjs` (riprende la formulazione best-of LAB98 e resta source-only, senza lista verbosa di fatti nel prompt).

- Pianificati 5 archetipi × 6 livelli = **30 nuove risposte indipendenti**.
- Risposte effettivamente ricevute: **12/30** (tutti e 6 i livelli per Scienze e per Procedura). La chiamata successiva, Medicina 10%, ha ricevuto **HTTP 429**, dopo 13 chiamate totali. **Fermato deliberatamente**, nessun retry aggressivo o modello a pagamento.
- 12 risposte valide, di cui **3** con fascia percentuale + righe contemporaneamente rispettate: Scienze 20%, Procedura 40%, Procedura 50%.
- Solo **1/12** risposte era matematicamente conforme e priva di allarmi del guard preliminare, ma nessuna è semanticamente certificata.
- I livelli 10, 30, Riassunto 65% hanno registrato rispettivamente **0/2** risposte matematicamente conformi; 20, 40, 50% hanno **1/2** a testa. Queste sono frequenze del solo mini-campione, non prestazioni universali del metodo.
- I problemi sono sia quantitativi sia semantici (negazioni, cause, qualificatori, regole e relazioni). **Non sostituire le versioni migliori della LAB103/104** con queste nuove risposte.
- Il job CI è contrassegnato **FAILURE perché il test live è incompleto per limiti della quota**, non perché l'importazione PDF o il motore locale siano falliti. Risposte e statistiche grezze sono state salvate.

## 5. Verità operativa, senza interpretazioni gonfiate

| Ambito | Stato | Prova disponibile |
|---|---|---|
| Gestione di 1000 record pagina, 6000 livelli storici, recupero checkpoint simulati | **PASS** | Simulazione deterministica |
| PDF testuale sintetico fisico di 1000 pagine, capitoli e recupero | **PASS** | Lettore native StudyBook |
| Parsing e motore locale su 1000 pagine, 140 capitoli | **PASS** | Motore native senza IA |
| Sei riduzioni Gemini su nuovi testi | **PARZIALE** | 12/30 risposte; 3/12 entro fascia+griglia; fermato da 429 |
| Revisione completa del significato delle nuove risposte | **NON CERTIFICATA** | Guard/lettere non dimostrano comprensione |
| Elaborazione autonoma di un libro autentico di 1000 pagine con sei riduzioni e tutte le pagine corrette | **NON TESTATA** | Richiede testo autentico, 6000 generazioni/riusi e reali limiti gratuiti |
| Prestazioni e memoria Android su 1000 pagine | **NON TESTATE** | Runner GitHub non equivale al telefono |
| Integrità OCR/scansioni e paginazione A4 reale | **NON TESTATA** | PDF di prova testuale |

## 6. Massimi da preservare: anti-regressione

1. Il miglior risultato per livello (conteggio e righe) resta **quello verificato nella LAB103**, non una risposta della LAB105 che non supera la soglia.
2. **LAB104** resta il riferimento per correttezza (Storia 20%, Medicina 10%, Scienze 30%, Scienze Riassunto con fatti parziali segnalati).
3. Per la produzione non trasformare un allarme lessicale verde in certificazione didattica; compare ogni fatto a fonte e non alterare cause, condizioni, termini, negazioni, modalità o cifre.
4. Le percentuali delle prove storico-numeriche **sono già dimostrate realizzabili individualmente**: non è necessario ripartire dal principio. L'obiettivo da dimostrare è **riproducibilità su input nuovo**, 6 livelli completi sulla stessa pagina e fattibilità per libri di lunghezza elevata.
5. Risolvere la ripresa dei test live **senza ripetere i 12 risultati** ottenuti, con limite gratuito. Non mettere un workflow costoso in ciclo continuo senza garanzia di costo zero.
6. Per la prossima prova vera da 1000 pagine, acquisire un **PDF autentico** di cui si possa verificare il testo integrale e misurare reale importazione, pagine, capitoli, progressi, ripresa e risultati su tutte le pagine. L'IA non deve cancellare fatti per soddisfare solo il numero.
7. Evitare promozioni a produzione/MADRE o nuove APK finché non esiste una prova A4 reale e un gate semantico consistente.

**Stato LAB105:** completata come ricerca di robustezza, con tre prove di infrastruttura PASS e una prova Gemini parziale per quota. Nessuna modifica alla produzione, zero nuovi costi aggiuntivi. Successiva LAB eventuale: revisione quantitativa+semantica su campione multigenere più ampio e un autentico libro molto grande, senza ricominciare dalle LAB95–104.
