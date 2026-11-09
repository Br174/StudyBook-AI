# MotorLab StudyBook AI LAB92 — Stop al pensiero completo, nessun riempimento

**Data:** 9 novembre 2026
**Stato:** collaudo reale e matematico eseguito su ramo audit, **NON pronto per produzione**.
**Ramo:** `audit/studybook-stop-complete-v92-20261109`
**MotorLab:** CORE `Br174/Chatgpt` 2026.10.29-r40, satellite `Br174/StudyBook-AI` r40 stato VERIFIED; motore dell'app, dati, Worker, firma e APK invariati.

## Regola testata
L'utente ha stabilito che il modello deve fermarsi quando un pensiero completo e corretto è stato espresso, anche quando rimane mezza riga o una riga libera. Mai ampliare con parole di riempimento per centrare il budget, né spostare informazioni fra pagine. I concetti vengono segmentati e pesati in anticipo; quote di lettere morbide e proporzionali; il testo procede nella stessa riga dopo un solo spazio; griglia virtuale 60 posizioni; caratteri invariati.

**Vincolo metodologico:** i concetti di cinque pagine di prova erano segmentati in anticipo nelle fixture; **non è stato collaudato** il riconoscimento automatico delle unità semantiche nei PDF. La griglia virtuale monospaziata non è una dimostrazione della larghezza A4 con font proporzionale.

## Prove matematiche senza Gemini
- **24.000** scenari sintetici riproducibili verificati, **zero errori** di somma dei budget, capienza teorica o conteggio lettere.
- **30** piani su cinque testi e sei percentuali.
- **30** ripetizioni/ri-misurazioni dei risultati precedenti LAB89 e LAB90, senza modificare le lettere originali.
- Medie reali LAB84: per riga virtuale da 60 posizioni, **46,346 lettere**, **7,844 spazi naturali**, **3,658 spazi grafici aggiuntivi**, **1,966 punteggiature**, **0,186 cifre**. I 3,658 spazi grafici non sono testo e non contribuiscono al conteggio delle lettere.
- Budget stimato in frazioni di riga e distinto dal tetto intero delle righe fisicamente occupabili. La percentuale reale resta verificata sul conteggio alfabetico Unicode.

Dati: `audit/reports/lab92-offline-stop-complete.json`.

## Collaudo reale Gemini
Workflow: https://github.com/Br174/StudyBook-AI/actions/runs/42609925664
Modello già configurato: `gemini-3.5-flash-lite`, segreti GitHub esistenti, nessun servizio aggiuntivo.
- 30 casi programmati, **16 richieste HTTP**, **15 risposte valide**; il sedicesimo tentativo ha ricevuto **HTTP429**, fermando la prova senza altre richieste.
- Due livelli completati su tutti e cinque i generi (40% e 50%); un terzo livello (20%) completato su tutti e cinque; 10%, 30%, 65% non eseguiti a causa del limite.
- **12** prove su pagine originali lunghe >5 righe: **10/12** rispettano il numero di righe, **3/12** rispettano anche la percentuale ±5 punti.
- **3** risposte su pagina giuridica brevissima (<=5 righe) rispettano la capienza e conservano in generale i fatti principali, ma sono esenti dalla percentuale ed esigono revisione linguistica.
- **4/12** pagine lunghe presentano scostamenti *lievemente più corti* del margine ordinario (meno di circa una riga stimata oltre soglia) e possono essere esaminate didatticamente. **Nessun superamento automatico**: il vero valore percentuale deve essere registrato.
- **Zero** nuove versioni approvate o copiate nell'APK. Il filtro di test automatico aveva 5 casi puliti, ma il controllo testuale umano ha individuato omissioni anche in casi matematicamente corretti.

## Percentuali effettive delle pagine lunghe

| Riduzione richiesta | Scienze | Procedura | Medicina | Storia sbilanciata |
|---|---:|---:|---:|---:|
| **40%** | 28,21% | 45,28% | **42,17% ✓** | 48,36% |
| **50%** | **46,74% ✓** | 43,55% | **50,27% ✓** | 57,16% |
| **20%** | 31,39% | 36,48% | 50,27% | 37,76% |

✓ = **solo fascia e righe corrette**, NON qualità didattica certificata.

## Confronto equo LAB90 → LAB92
Sulle **10** combinazioni comune (5 materie x livelli 40/50, comprese 2 pagine brevi):
- Rispetto geometrico e percentuale: LAB90 **2/10** (entrambe pagine brevi), LAB92 **5/10** (3 pagine lunghe e 2 brevi).
- Considerando soltanto le **8 pagine lunghe**, LAB90 **0/8**, LAB92 **3/8**.
- La regola STOP ha corretto l'espansione indiscriminata della LAB90; resta il rischio di **sintesi troppo aggressiva** su riduzioni leggere.

## Qualità didattica: i casi più importanti
- **Scienze 50%**: 46,74% e 7/7 righe, ma manca l'importante negazione "le eclissi non avvengono a ogni lunazione" e manca il principio "un risultato isolato non basta". **Non conforme semanticamente**.
- **Medicina 40%**: 42,17% e 9/10 righe; il testo non conserva il dettaglio sul consumo di ossigeno E produzione di anidride carbonica durante lo sforzo e il ruolo delle vie aeree. **Da correggere nel contenuto**.
- **Medicina 50%**: 50,27% e 8/8 righe; ha omesso il ruolo di vie aeree e precisazioni del contesto gassoso. **Da correggere nel contenuto**.
- **Procedura 40%**: 45,28%, appena 0,28 punti oltre l'intervallo 35–45; il testo entra in 8/9 righe, in gran parte mantiene la disciplina essenziale. **Potenziale eccezione lieve**, previa verifica del dettaglio giuridico.
- **Storia 40%/50%**: esiti molto brevi, alcuni nessi fatti/opinioni/incertezza non espressi; al 50% compare anche una frase grammaticalmente scorretta.
- **Riduzione 20%**: scienze 31,39% (poco meno di una riga oltre soglia), procedura 36,48%, medicina 50,27%, storia 37,76%. Le ultime tre sono **troppo sintetiche** per l'intento 20%, quindi la norma "meglio corto" NON deve prevalere sul pilastro didattico e sui dati essenziali.
- **Breve giuridico**: la pagina rimane 3–4 righe e non richiede allungamento; la formula "decade dal deposito" potrebbe essere resa più precisamente in italiano.

Le 15 letture e osservazioni: `audit/reports/lab92-qualitative-spotcheck.json`.

## Decisione
**Conservare la regola "stop quando il pensiero è completo"**: previene riempimento artificiale, e il tetto di righe è rispettato più spesso. **Non promuovere ancora il metodo**: soltanto 3/12 risultati matematicamente conformi e diversi ancora imperfetti semanticamente.

Per una prossima prova isolata, mantenendo costi zero:
1. Nella prima lettura identificare non soltanto "concetti" ma anche i dettagli essenziali *espressi* in ciascun concetto: condizioni, negazioni, cifre, termini specialistici e cause che il testo generato deve riutilizzare.
2. In fase di prompt, rendere il 10/20% quasi esteso e controllare che la semplificazione non diventi una forte compressione del 30–50%; NON usare "più corto è meglio" per omettere dettagli.
3. Non generare approfondimenti per riempire. Se un concetto è completo il testo finisce; uno scostamento equivalente a mezza riga o riga vuota può essere valutato, **ma si annota la riduzione reale e si segnala ogni omissione**.
4. Validare separatamente numero righe, lettere Unicode e fedeltà semantica. Tutte le correzioni eccezionali devono essere limitate, mirate e senza sovrapposizione dei testi.
5. Eseguire un test A4 reale con font/margini fissati soltanto dopo aver stabilizzato le percentuali e la fedeltà, senza chiedere cambiamento di font per rientrare nei margini.

Nessuna modifica a main produttivo o app. Nessun APK o ZIP compilato poiché fase sperimentale non certificata.
