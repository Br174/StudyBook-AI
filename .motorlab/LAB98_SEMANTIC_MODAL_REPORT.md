# MotorLab StudyBook AI — LAB98: salvaguardia semantica e test reali multi-livello

**Data:** 9 novembre 2026. **Stato:** collaudo completo; **NON PROMOSSO** in produzione.
**Ramo isolato:** `audit/studybook-semantic-modal-guard-v98-20261109`
**Workflow riuscito:** https://github.com/Br174/StudyBook-AI/actions/runs/42633438222
**Repository:** `Br174/StudyBook-AI`
**MotorLab CORE:** `Br174/Chatgpt` release `2026.10.29-r40`, satellite locale `2026.10.29-r40`, `STATE=VERIFIED`.
**Invarianza:** nessuna modifica al ramo applicativo attivo, main, firma, APK, dati, Cloudflare, Worker o build di produzione.

## Scopo
Dopo la LAB97, in cui il 10% migliorava come percentuale ma alcune formulazioni perdevano modalità, termini di certezza e negazioni, aggiungere un **controllore deterministico di rischio semantico** che confronta la fonte con l'output, senza riscrivere automaticamente il testo o duplicare la checklist nel prompt Gemini. Il prompt comprende un breve avvertimento su `può`, `non`, `documentato/dimostrato`, `regola interna/norma`, e conserva la regola **STOP al pensiero completo**.

Modalità:
- 10% e 20% = `EDITING_CONSERVATIVO`;
- 30% e 40% = `RISCRITTURA_MODERATA`;
- 50% e riassunto 65% = `SINTESI_FEDELE`.

Tutte le versioni devono rispettare i limiti di lettere Unicode e una griglia virtuale a **60 posizioni monospaziate**, condivisa da tutti i concetti sulla stessa pagina, senza cambi di font né righe fisiche separate obbligatorie. Le pagine originali da 1–5 righe sono esentate dalla percentuale ma non dalla completezza. «In parole semplici» non è generata in anticipo.

## Test offline
- Verificato il satellite r40 e il CORE centrale r40.
- **16.000 mutazioni avversarie riproducibili** che eliminano o cambiano una negazione, possibilità, regola, categoria epistemica, condizione o diritto: **16.000 rilevate**, **zero fallimenti**.
- **Cinque sorgenti originali**: zero allarmi del guard per il testo originale.
- **16 rianalisi** di risposte Gemini LAB96–97, senza modifiche.
- Il controllore ha individuato **4/4** delle alterazioni semantiche critiche LAB97: eclissi e lunazioni, frequenza respiratoria da probabilità a certezza, regola interna diventata norma, documentato diventato dimostrato.
- **Limite metodologico:** le mutazioni sono costruite in modo noto e limitato. Non dimostrano generalizzazione a tutta la lingua italiana; false omissioni e falsi allarmi restano possibili.
- Durante il collaudo offline sono stati corretti errori nel test stesso: apostrofo non protetto, frase originale inesatta della pagina breve e confusione tra scadenza iniziale e una «scadenza» successiva non collegata. Il workflow finale è riuscito.
- Evidenza `audit/reports/lab98-offline-semantic-guard.json`.

## Test reali Gemini
**Modello:** `gemini-3.5-flash-lite`, segreto gratuito già configurato; fino a 16 richieste HTTP senza costi extra.
- **16 chiamate**, **15 risposte JSON valide** e **un HTTP 429**, che ha fermato i test.
- **14 pagine lunghe:** **10/14** rientrano nelle righe, **8/14** nella fascia ±5 punti, **6/14** in entrambi.
- Soltanto **3/14** uniscono fascia, griglia e nessun allarme del nuovo guard mirato. **Tutte e tre però contengono omissioni accertate dalla rilettura.**
- Una pagina giuridica breve rispetta la capienza **4/5** ed è esente dalla percentuale, ma il guard ha prodotto un falso positivo: «permane il diritto» era equivalente a «resta il diritto» nella fonte.
- **Nessuno** dei 15 testi è stato certificato come pronto per l'app.
- Evidenza `audit/reports/lab98-real-gemini.json`.

### Risultati per livello e materia

| Fonte | Livello richiesto | Riduzione reale | Righe | Fascia+griglia |
|---|---:|---:|---:|:---:|
| Scienze | 20% | 26,88% | 9/11 | NO |
| Medicina | 20% | 21,29% | 12/13 | SÌ, con omissioni |
| Procedura | 20% | 0,00% | 14/11 | NO |
| Storia | 20% | 1,79% | 14/12 | NO |
| Giuridico breve | 20% | 0,65% | 4/5 | ESENTE dalla banda |
| Scienze | 30% | 35,39% | 9/10 | NO |
| Medicina | 30% | 39,01% | 10/12 | NO |
| Procedura | 30% | 34,91% | 9/10 | SÌ, con omissioni |
| Scienze | 40% | 41,40% | 8/8 | SÌ, con omissioni |
| Procedura | 40% | 43,08% | 8/9 | SÌ, con omissioni |
| Scienze | 50% | 50,08% | 7/7 | SÌ, con omissioni |
| Medicina | 50% | 45,05% | 9/8 | NO |
| Scienze | Riassunto 65% | 64,94% | 5/5 | SÌ, con omissioni |
| Procedura | Riassunto 65% | 61,95% | 6/5 | NO |
| Scienze | 10% | 22,20% | 10/12 | NO |
| Medicina | 10% | non completato | - | HTTP 429 |

### I tre falsi successi se guardassimo solo numeri + assenza allarmi
1. **Medicina 20% (21,29%, 12/13):** scompare il riferimento ai globuli rossi; «non basta sempre» diventa «non basta», alterando la sfumatura. «Consumo e produzione di gas» è invece presente: la regex ha segnalato un falso allarme.
2. **Procedura 40% (43,08%, 8/9):** mancano «anche se la lettura non è finita» e l'identità e il giorno di chi ha preso il libro nel registro.
3. **Scienze 50% (50,08%, 7/7):** mancano il contributo del Sole alle maree, l'allineamento come condizione per le eclissi, le osservazioni ripetibili e la distinzione fra descrizione e cause.

Quindi **0/15 pronti per l'uso didattico**, nonostante alcuni successi matematici.

### Altre osservazioni
- Scienze 30/40% omette le eclissi non presenti a ogni lunazione. Scienze 65% omette il fatto che le stagioni non dipendono dalla distanza e la cautela sul singolo esperimento.
- Medicina 30/50% perde «pressione parziale» e limiti diagnostici; 50% supera di una riga il limite.
- Procedura 20% riproduce esattamente il testo originale, quindi 0% di riduzione e 3 righe di overflow, pur preservando i fatti.
- Storia 20% cambia quasi nulla ma perde apostrofi e punteggiatura importanti, con 14/12 righe.
- Procedura 30% non dice più che la proroga è non automatica e che il volume prenotato deve essere restituito anche se la lettura è incompleta.
- Scienze 10% elimina la menzione esplicita della lunazione in favore di «ogni volta», ambiguo: 22,20% di riduzione invece di 10%.
- L'allarme «permane diritto alla motivazione» della pagina breve è un falso positivo da normalizzare nel motore, **senza autocertificare il significato**.

Revisione testo-per-testo: `audit/reports/lab98-qualitative-review.json`.

## Diagnosi e prossima architettura da collaudare
1. **Non peggiorare la generazione con istruzioni duplicate.** I testi al 10/20% devono essere editing conservativo, ma non la mera copia dell'originale, come nella procedura al 20%.
2. **Doppio guard: quantitative + relazionale.** Il conteggio delle lettere/righe deve essere indipendente; la verifica semantica deve preservare attori, negazioni, modalità, qualificatori, nessi e condizioni. Semplici regex non bastano per approvare il testo.
3. **Lettura unificata del libro prima della generazione.** Identificare i fatti indispensabili per ciascuna pagina una sola volta, poi verificare tutte le sei versioni senza richiederne la ripetizione a Gemini.
4. **Se una parte è effettivamente mancante, correggere SOLO la frase specifica**, con un'eventuale seconda chiamata limitata e non obbligatoria, senza rigenerare il libro o tutte le riduzioni. Evitare concatenazioni di tentativi che causino quota 429 e blocchi.
5. **Gestire risultati sotto e sopra fascia con trasparenza.** Se un pensiero è completo non aggiungere parole; se la riduzione è troppo aggressiva e perde fatti, invece non approvare. Se l'output è troppo lungo, ridurre formulazioni ripetitive senza sacrificare informazioni.
6. **Prima di APK/ZIP:** dimostrare accuratamente la relazione fra casi e fatti su più fonti, oltre alla geometria A4 con font/margini fissati e alle prove di checkpoint, ripresa Gemini e PDF reali. Le presenti prove sono solo su **griglia virtuale monospaziata e pagine sintetiche presegmentate**.

**Nessuna modifica a produzione, branch main, app o credenziali. Nessun nuovo APK/ZIP, nessun costo aggiuntivo.**
