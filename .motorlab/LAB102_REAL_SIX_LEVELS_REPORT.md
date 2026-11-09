# StudyBook AI — MotorLab LAB102 | Sei riduzioni reali da inventario LAB101

**Data:** 9 novembre 2026.
**Stato:** LAB102 sperimentale eseguita e archiviata. **NON certificata didatticamente e NON promossa nell'app.**
**Ramo:** `audit/studybook-six-real-levels-v102-20261109`.
**Base immutabile LAB101:** `67e546101c12ee95f61735654a510c169335fbc0`, checkpoint `.motorlab/STUDYBOOK_CROSS_CHAT_CHECKPOINT_POST_LAB101_20261109.md`.
**MotorLab:** CORE `Br174/Chatgpt` r40; satellite locale StudyBook AI r40, verificati all'avvio.
**Vincolo:** zero servizi a pagamento, nessuna modifica produzione, cloud, dati, applicationId, firma, APK/ZIP.

## 1. Prove eseguite e riferimenti primari

- **Scienze, sei risposte Gemini:** https://github.com/Br174/StudyBook-AI/actions/runs/42649216047. JSON originale `audit/reports/lab102-real-six-reductions.json`.
- **Revisione mirata e primo tentativo sulle altre quattro pagine:** https://github.com/Br174/StudyBook-AI/actions/runs/42650169494. È terminato senza eccezione di script ma **l'esperimento Gemini è stato PARZIALE** per due HTTP503 consecutivi nella versione 10% di medicina. Erano stati ottenuti 11/24 testi, tutti salvati.
- **Ripresa dai checkpoint senza ricalcolare gli 11 testi riusciti:** https://github.com/Br174/StudyBook-AI/actions/runs/42650484666. JSON cumulativo `audit/reports/lab102-other-four-real-six-reductions.json`: 24/24 testi presenti. 13 nuove richieste al fornitore nella ripresa, 11 versioni precedenti riutilizzate.
- **Correzioni mirate in copia del Riassunto e della sezione C4 del 30% di scienze:** `audit/reports/lab102-science-targeted-review.json`; passaggio offline verificato nel secondo e nel terzo workflow. Le risposte originali di Gemini restano intatte.

Le cinque fonti sono campioni **sintetici preestratti**, non PDF reali. Fonte: `audit/test-fixtures/lab89-semantic-concepts.json`. I 56 fatti e i piani provengono da `audit/reports/lab101-real-priorities.json` e sono riutilizzati verificando gli hash; **nessuna nuova prima lettura Gemini** è stata richiesta.

## 2. Esiti numerici/di geometria reali

| Pagina campione | Gemini | Conformi inizialmente per lettere e righe | Nota |
|---|---:|---:|---|
| Scienze | 6/6 | 1/6 | Versione 30% inizialmente conforme ma frase finale C4 incompleta |
| Procedura | 6/6 | 0/6 | Priorità F11 preservata a scopo sperimentale; allarmi di relazioni/condizioni |
| Medicina | 6/6 | 2/6 | 503 su alcuni tentativi, recupero checkpoint riuscito |
| Storia / concetto sbilanciato | 6/6 | 3/6 | Migliori risultati numerici a 40%, 30%, 20%, ma controllo semantico incompleto |
| Giuridica breve | 6/6 | 6/6 | **Esenzione percentuale** originale 1–5 righe: non interpretare i 6 passaggi come rispetto di sei percentuali |
| **Totale** | **30/30** | **12/30** | Sulle sole pagine lunghe **6/24** conformi inizialmente |

Misurazione deterministica: sole lettere alfabetiche Unicode per la percentuale, parole non spezzate, righe virtuali di massimo 60 posizioni, massimo righe fissato prima della generazione. Il test NON misura l'effettiva occupazione di un foglio A4 con font proporzionale.

### Scienze: correzioni mirate senza rigenerazione globale

1. **Riassunto 65%**: prima 250 lettere, riduzione 58,26%, 6 righe su 5 consentite, due allarmi di relazioni; proposta editoriale in copia **233 lettere, riduzione 61,10%, 5 righe su 5, zero allarmi del guard**.
2. **30%**: prima 438 lettere, riduzione 26,88%, 10/10 righe; la conclusione «Occorre distinguere» era incompleta. Modificata **solo la frase della sezione C4** in copia: **448 lettere, riduzione 25,21%, 10/10 righe, zero allarmi del guard**.
3. Entrambe le proposte superano le misure e il guard di relazioni, **NON certificano da sole la correttezza semantica**. Lo stesso modello/guard può non cogliere una parafrasi falsa. Risultati grezzi conservati e rollback possibile.

Il Riassunto corretto aggiunge una versione matematicamente e geometricamente conforme, quindi le copie con correzione avrebbero **13/30** conformità matematiche/geometriche, di cui **7/24** sulle pagine lunghe. Non confondere questo con 13 successi didattici: **0/30 certificazioni semantiche**.

## 3. Difetti emersi

- **Superamento sistematico della lunghezza:** soprattutto Riassunto e livelli 50/40/20/10; anche con budget preventivo e inventario sintetico il modello spesso produce più lettere/righe del consentito.
- **Compatibilità qualità/spazio:** non è garantito che tutti i fondamentali possano essere espressi in uno spazio molto ridotto. Non eliminare negazioni, soggetti, cause, condizioni o altri fatti per raggiungere la percentuale.
- **Guard semantico solo lessicale:** un esito verde per parole chiave o stessa frase non dimostra verità causale, modalità, condizione o completezza. Nella pagina giuridica breve le riduzioni 65/50 comprimono talvolta troppo il riferimento al *deposito delle osservazioni*; revisionare anche quando la percentuale è esente.
- **Priorità nella procedura:** la LAB101 aveva declassato F11 sul registro (chi/quando). In LAB102 la generazione conserva cautelativamente tale fatto come fondamentale in **copia**, non cambia l'inventario originale. La negazione F12 sulle opinioni dei lettori rimane materia di revisione editoriale.
- **HTTP503 e falsa semantica di workflow SUCCESS:** il primo run di estensione ha prodotto 11/24 testi poi è stato interrotto dal fornitore, benché lo step abbia avuto exit zero. `scripts/lab102-real-six-reductions.mjs` è stato modificato dopo la ripresa per impostare exit code 2 quando `successfulGenerations != expectedGenerations` oppure il fornitore interrompe. **Questa ultima modifica necessita ancora di un test CI specifico con interruzione simulata; non marcarla come prevenzione pienamente verificata.**
- **Resumability:** il secondo run ha riusato effettivamente le versioni registrate con `sourceHash` e `inventoryHash`; il JSON originale è conservato nella storia Git. Mancano stress test su interruzioni di alimentazione, file parziali e vere pagine Android.
- **Questa LAB non ha validato** PDF autentici, font A4 reale, prestazioni su centinaia di pagine, checkpoint Android, operazioni Cloudflare o firma APK.

## 4. Stato operativo / controllo di sicurezza

- `RESEARCH_TRACK_LAST_COMPLETED_LAB=LAB102`
- `RESEARCH_TRACK_RESULT=30_REAL_REDUCTIONS;12_INITIAL_NUMERIC_GRID_PASS;2_TARGETED_SCIENCE_PATCHES;0_SEMANTIC_CERTIFICATES`
- `RESEARCH_TRACK_PRODUCTION_PROMOTION=BLOCKED`
- `NEXT_SAFE_STEP=LAB103_DESIGN_AND_APPROVAL_REQUIRED`
- `LAST_GOOD_RESEARCH=LAB101_CHECKPOINT_AND_LAB102_RAW_EVIDENCE`
- `ANDROID_APP_CHANGED=NO`
- `APK_ZIP_CREATED=NO`
- `COST_ADDED=ZERO`

**Prossima proposta, non ancora autorizzata:** LAB103, motore di riduzione vincolata che usa il primo inventario una volta, budget proporzionale e fluido per concetto, controlli deterministici dopo la generazione, patch SOLO di passaggi individuati e rollback; valutazione indipendente completa di tutti i fatti fondamentali e delle relazioni per pagina. Se il limite è irrealizzabile senza cancellare nozioni, segnalarlo anziché falsificare il risultato. Prima della produzione richiedere prove di paginazione A4 reale e di checkpoint/ripresa Android.

## 5. Handoff

Al successivo avvio: leggere l'hook, il satellite, il manifest CORE, il checkpoint LAB101 e **questo rapporto LAB102**, poi i tre JSON probatori. Non ripetere le 30 chiamate Gemini solo per ricostruire risultati già salvati. Non scambiare test sintetici con una versione Android approvata. È vietata la promozione automatica alla MADRE o alla CANDIDATA.
