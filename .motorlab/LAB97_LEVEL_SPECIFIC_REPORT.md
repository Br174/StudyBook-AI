# StudyBook AI — MotorLab LAB97: modalità didattiche per livello e correzioni controllate

**Data:** 9 novembre 2026. **Stato:** prove eseguite, non approvato per produzione.
**Repository:** `Br174/StudyBook-AI`, ramo isolato `audit/studybook-level-specific-v97-20261109`.
**CORE MotorLab:** `Br174/Chatgpt` release `2026.10.29-r40`. **Satellite:** release `2026.10.29-r40`, `STATE=VERIFIED`. Sincronizzati, nessuna migrazione.
**Motore dell'app, firma, dati, main, APK e ZIP:** non modificati.

## Obiettivo
Dopo la LAB96, che controllava le righe ma comprimeva troppo il 10% e il 20%, provare strategie SEPARATE:
- **10–20% editing conservativo:** non è un riassunto, mantenere quasi tutte le frasi della fonte, eliminare soltanto ridondanze e semplificare;
- **30–40% riscrittura moderata:** sintesi senza perdere fatti e condizioni;
- **50% e riassunto 65%:** sintesi didattica con conservazione dei fatti essenziali.

La checklist dei fatti resta nascosta a Gemini: viene applicata solo nella verifica dopo la generazione. Il prompt non deve contenere un elenco duplicato dei fatti. Ogni pagina risulta un solo paragrafo continuo con massimo 60 celle virtuali per riga, senza spezzare parole. Numeri, negazioni, termini fondamentali e grado di certezza devono essere preservati. La pagina originale resta la stessa; 1–5 righe hanno percentuale libera. «In parole semplici» non viene generato in automatico.

## Audit deterministico preliminare, zero richieste Gemini
- **30** combinazioni di fixture su cinque tipi di testo e sei livelli.
- **12.000** stress test di conteggio, capienza ed eliminazione evidente di fatti: **zero errori**.
- Due esempi di fattibilità **redatti manualmente**, non da Gemini, al 20%: scienze 16,86% e medicina 16,35%, entrambi nei limiti e con allarmi lessicali assenti.
- **12** vecchie risposte Gemini LAB96 ri-verificate come baseline, senza riscriverle.

Evidenza: `audit/reports/lab97-offline-preflight.json`.

## Prove Gemini reali
GitHub Actions: https://github.com/Br174/StudyBook-AI/actions/runs/42630537563
Modello: `gemini-3.5-flash-lite`; chiave gratuita preesistente. Massimo programmato di 20 tentativi HTTP, con arresto dopo due 503 consecutivi o primo 429.

- **4 risposte complete**, tutte del **10%**; **4/4** nella griglia fisica; **3/4** entro fascia percentuale ±5 punti; **3/4** rispettano insieme griglia e percentuale.
- Scienze al 10%: **15,03%** di riduzione, **11/12** righe: 0,03 punti oltre la fascia (un singolo carattere nel conteggio). Revisione per piccola eccezione possibile, NON certificata.
- Medicina al 10%: **9,34%**, **14/15** righe: successo quantitativo.
- Procedura al 10%: **9,91%**, **13/13** righe: successo quantitativo.
- Storia al 10%: **12,39%**, **13/14** righe: successo quantitativo.
- **6 richieste HTTP**: quattro esiti validi, poi **due errori HTTP503 consecutivi** alla prima prova del 20% scientifico; stop protettivo. Quindi nessun esperimento reale di 20/30/40/50/65 in questa LAB. Non è corretto dedurne l'efficacia delle altre due modalità.
- Nessun testo è pronto per pubblicazione, né è stato aggiunto all'app.

| Materia | Target | Riduzione reale | Righe | Successo matematico | Semanticamente approvato |
|---|---:|---:|---:|:---:|:---:|
| Scienze | 10% | 15,03% | 11/12 | NO, lieve sforo | NO |
| Medicina | 10% | 9,34% | 14/15 | SÌ | NO |
| Procedura | 10% | 9,91% | 13/13 | SÌ | NO |
| Storia | 10% | 12,39% | 13/14 | SÌ | NO |

## Rilettura qualitativa dei quattro testi
- **Scienze:** il modello ha usato «allineamento specifico che esclude ogni lunazione». Formulazione ambigua rispetto a «non avvengono a ogni lunazione». Inoltre «rifiutando prove isolate» è meno precisa della cautela «un risultato isolato non basta». Va corretto.
- **Medicina:** la fonte dice che sotto sforzo la frequenza respiratoria «**può** aumentare»; Gemini dice che «**sale**». Il modo verbale cambia una possibilità in certezza. Le altre principali informazioni della fonte appaiono preservate, ma questa sfumatura è essenziale.
- **Procedura:** contenuti principali conservati, ma due errori grafici «l alunno» e «l iscritto» e uso di «norma 12» al posto di «regola interna numero 12», che rischia di alterare il tipo di riferimento.
- **Storia:** «fatti dimostrati» al posto di «fatti documentati» accentua indebitamente la certezza; altre variazioni lessicali sono accettabili. I controlli regex avevano anche falsi positivi, quindi non si può equiparare un allarme a una omissione.

Evidenza: `audit/reports/lab97-qualitative-review.json`.

## Esperimento aggiuntivo, senza Gemini: ortografia sicura e allarmi semantici
Workflow: https://github.com/Br174/StudyBook-AI/actions/runs/42631087997

- **15.000** simulazioni riproducibili di due correzioni ortografiche esplicite, `l alunno` -> `l'alunno`, `l iscritto` -> `l'iscritto`, senza nuove richieste Gemini.
- **Zero** variazioni nel totale delle lettere, nei test invarianti e nei righi degli output reali, dove si applica.
- Corretto in modo deterministico **1/4** dei testi reali (procedura), con due sostituzioni; non promosso in app.
- **4** allarmi semantici: negazione sulle lunazioni, modalità può/sale, regola interna/norma e documentati/dimostrati.
- Questi allarmi non possono essere corretti automaticamente da una regola tipografica; occorre un confronto con la fonte e, solo se veramente necessario, una riscrittura mirata senza toccare il testo già fedele.

Evidenza: `audit/reports/lab97-safe-fixes-and-semantic-risks.json`.

## Confronto equo LAB96 vs LAB97, solo 10%
| Fonte | LAB96 reale | LAB97 reale |
|---|---:|---:|
| Scienze | 29,88% | **15,03%** |
| Medicina | 22,39% | **9,34%** |
| Procedura | **non testato** | 9,91% |
| Storia | **non testato** | 12,39% |

Miglioramento evidente di lunghezza per scienze e medicina, **non ancora di accuratezza didattica certificata**. Le prove delle altre percentuali sono state interrotte dal provider, per cui il giudizio sperimentale riguarda soltanto il 10%.

## Prossimo passo dopo blocco 503
1. **Conservare la modalità editing conservativo per il 10%**, perché i risultati numerici sono promettenti; il 20% non è stato ancora collaudato nella LAB97.
2. **Rendere immutabili alcune sfumature semanticamente fragili** prima di generare: negazioni, «può»/«deve», termini di certezza (documentati/dimostrati), «regola interna» vs «norma». Fornire soltanto una nota breve sulle classi di rischi, non ricopiare l'intera checklist.
3. Mantenere il ledger dei fatti durante la verifica post-generazione e introdurre allarmi su modalità e relazioni, non basarsi soltanto su parole identiche.
4. **Correggere in modo deterministico SOLO errori grafici sicuri e testati**, con prove di invariabilità delle lettere, righi e dei fatti; evitare sostituzioni grammaticali generiche.
5. Quando il provider torna disponibile, ripetere in un nuovo test isolato i livelli 20%, 30%, 40%, 50% e 65%; evitare retry aggressivi e costi aggiuntivi.
6. Solo dopo aver ottenuto conformità semantica e matematica affidabile su più materie, verificare PDF reali/A4, recupero checkpoint, quote e compilazione APK/ZIP.

**Nessuna modifica alla branch main né alla build installata. Nessuna promozione di testo non conforme.**
