# MotorLab StudyBook AI · LAB84 · Confronto 100 righe su 5 generi italiani

**Data:** 9 novembre 2026
**Stato:** test di misura **completato**, nessuna chiamata Gemini, nessuna modifica all'app/Worker/Android.

## Domanda sperimentale
Con righe di **60 caratteri fissi**, 100 righe per fonte e parole non spezzate, gli spazi e il numero medio di lettere per riga restano sufficientemente stabili tra narrativa, giurisprudenza, teatro, medicina e biologia scolastica?

## Protocollo replicabile
1. Prima della selezione, fissare **60 posizioni di carattere per riga**.
2. Selezionare un punto di inizio dichiarato in un testo reale italiano di ogni genere.
3. Escludere elementi di navigazione, intestazioni tecniche, marcatori Markdown e titoli non pertinenti, mantenendo il testo sostanziale e i nomi dei parlanti teatrali.
4. Normalizzare gli a capo originali a spazi singoli e impaginare avidamente a 60 caratteri **senza spezzare parole**.
5. Misurare le **prime 100 righe complete**. Ogni riga è giustificata concettualmente a 60 posizioni aggiungendo spazi, senza alterare le lettere.
6. Contare alfabetici Unicode NFC, spazi naturali, spazi aggiuntivi per giustificazione, punteggiatura e cifre.
7. Controllo aggiuntivo a parità di lettere: ripetere la misura con il prefisso di **4562 lettere alfabetiche** per ciascun genere e osservare quante righe da 60 posizioni occupa.

Tutte le 5 fonti hanno 100 righe × 60 posizioni = **6000 posizioni**, quindi **30000 posizioni totali**.

## Risultati per 100 righe

| Fonte | Spazi naturali / riga | Spazi extra / riga | Spazi totali / riga | Lettere / riga | Lettere totali |
|---|---:|---:|---:|---:|---:|
| Romanzo: *I promessi sposi* (LAB83, riferimento) | 8,76 | 3,20 | **11,96** | **45,62** | 4562 |
| Diritto: lezione sulla Costituzione | 6,72 | 4,53 | **11,25** | **47,08** | 4708 |
| Teatro: *La locandiera* (Atto I) | 8,61 | 3,25 | **11,86** | **44,82** | 4482 |
| Medicina: diabete mellito | 7,73 | 3,70 | **11,43** | **46,60** | 4660 |
| Scuola: biologia liceo | 7,40 | 3,61 | **11,01** | **47,61** | 4761 |
| **Media 5 fonti** | 7,84 | 3,66 | **11,50** | **46,35** | 4634,6 |

Ripartizione complessiva nelle 30000 posizioni: **23173 lettere**, **5751 spazi**, **983 segni/punteggiatura**, **93 cifre**. Quadratura: 23173 + 5751 + 983 + 93 = 30000.

## Controllo a parità di lettere: 4562 alfabetiche

| Fonte | Righe a larghezza 60 necessarie |
|---|---:|
| Narrativa (riferimento) | 100 |
| Giuridico | 97 |
| Teatrale | 102 |
| Medico | 98 |
| Scolastico | 96 |

Le righe sono *richieste* per contenere 4562 lettere e la relativa punteggiatura/spazi; l'ultima riga è parziale, e nella selezione dei 4562 caratteri alfabetici l'ultimo vocabolo può risultare tagliato **solo ai fini del controllo numerico**, non del testo di studio.

## Variazione rispetto al riferimento narrativa 45,62 lettere/riga

- Giuridico: +1,46 lettere/riga (+3,20% relativo alla densità narrativa).
- Teatrale: −0,80 lettere/riga (−1,75%).
- Medico: +0,98 lettere/riga (+2,15%).
- Scolastico: +1,99 lettere/riga (+4,36%).

La forbice osservata tra i cinque generi è **44,82–47,61 lettere per riga**, differenza totale 2,79 lettere. Spazi giustificati **11,01–11,96 per riga**, differenza 0,95.

## Prova delle tolleranze su 15 righe consecutive
Controllo *illustrativo*, non generazione AI: a partire dalle righe reali si considerano 86 finestre scorrevoli di 15 righe per ciascuna delle 5 fonti, quindi 430 finestre sovrapposte.

Con un originale ipotetico di 1000 lettere, riduzione voluta 30%, target 700 lettere:
- ±2 punti (680–720): **293/430 finestre (68,14%)**.
- ±5 punti (650–750): **429/430 finestre (99,77%)**.

Le finestre condividono quasi tutto il testo, **non sono osservazioni indipendenti** e queste percentuali NON indicano la probabilità che Gemini rispetti la riduzione. In particolare l'interpretazione a ±5 punti non corrisponde a una garanzia su altri libri o su pagine brevi.

## Decisione prudente
- **Promossa come calibrazione orientativa per righe da 60 caratteri:** assumere circa **11,5 spazi** (arrotondabile a 12), **46,35 lettere** (arrotondabile a 46) e circa 2,15 caratteri di cifre/punteggiatura per riga.
- Le **righe di testo uniformi visivamente** e gli spazi servono come guida di lunghezza, NON garantiscono la percentuale.
- Nel PILASTRO DIDATTICO, la misura finale delle riduzioni 10–50% deve continuare a dipendere dal conteggio reale delle lettere Unicode, con fedeltà del contenuto verificata separatamente.
- Testo teatrale: qui le battute dei personaggi sono state normalizzate in un flusso continuo; se StudyBook mantenesse un cambio riga fisso per battuta, la densità diverrebbe molto inferiore. Anche formule, tabelle, articoli e note possono alterare significativamente la media.
- Nessuna modifica in produzione e nessuna chiave Gemini utilizzata.

## Fonti e ancore di selezione
1. **Narrativa**, Alessandro Manzoni, *I promessi sposi*, inizio «Quel ramo del lago di Como», [Project Gutenberg #45334](https://www.gutenberg.org/ebooks/45334).
2. **Diritto**, lezione *La Costituzione italiana*, inizio «La Costituzione della Repubblica Italiana è la legge fondamentale», [Wikiversità](https://it.wikiversity.org/wiki/La_Costituzione_italiana).
3. **Teatro**, Carlo Goldoni, *La locandiera*, Atto I, inizio «Marchese. Fra voi e me vi è qualche differenza», [Wikisource](https://it.wikisource.org/wiki/La_locandiera/Atto_I).
4. **Medicina**, *Panoramica sul diabete mellito*, inizio «Il diabete mellito è un disturbo nel quale l’organismo non produce», [Manuale MSD](https://www.msdmanuals.com/it/casa/disturbi-ormonali-e-metabolici/diabete-mellito-e-bassi-livelli-di-zucchero-nel-sangue-ipoglicemia/panoramica-sul-diabete-mellito).
5. **Scuola**, *Biologia per il liceo / Il metabolismo cellulare*, inizio «La membrana plasmatica inoltre non è un semplice contenitore», [Wikibooks](https://it.wikibooks.org/wiki/Biologia_per_il_liceo/Il_metabolismo_cellulare).

**Rapporto numerico completo**: audit/reports/studybook-lab84-multigenre-space-calibration.json (stesso ramo).
