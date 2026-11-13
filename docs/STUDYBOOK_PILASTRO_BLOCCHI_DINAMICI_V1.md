# StudyBook AI — Pilastro permanente: pianificazione preventiva dei blocchi Gemini (V1)

**Stato: REGOLA ARCHITETTURALE OBBLIGATORIA approvata dal fondatore il 13 novembre 2026.** 
**Ambito:** motore di acquisizione e generazione spiegata di StudyBook AI, in particolare la famiglia sperimentale LAB124 e successive. **Non modificare o ritirare senza esplicita approvazione del fondatore.**

## Principio non negoziabile

**La calibrazione complessa si fa una volta, prima, attraverso test veri; per ogni nuovo libro l'app effettua soltanto una misurazione preventiva rapida e deterministica e applica i parametri già collaudati.**

Il numero di blocchi Gemini **non è fisso per numero di pagine**: deve essere il *minimo numero di blocchi sicuri* per quel documento, senza scavalcare quote, timeout e limiti di risposta. Un libro di 44 pagine può richiedere 1, 2, 3 o più blocchi a seconda del testo effettivo e dei vincoli verificati; un libro di 2.000 pagine non va trattato moltiplicando meccanicamente il numero di blocchi di un libro più corto.

## Due fasi rigorosamente distinte

### A. Calibrazione del motore — una tantum per versione/modello

Mediante test ripetuti e reali, stabilire e conservare nel codice/configurazione versionata i parametri **riutilizzabili per tutti i libri**:
- soglie sicure di input e output (token, caratteri), incluse istruzioni, JSON, ID, segmenti, concetti protetti, spiegazioni e glossario;
- margine di sicurezza rispetto a capacità effettive e misurate del modello e del Worker, limiti di `max_tokens`, dimensione massima HTTP e timeout;
- limiti di servizio gratuito (RPM, TPM, RPD e disponibilità effettiva), evitando servizi a pagamento;
- regole di stima dei token e del volume della risposta, costi temporali osservati, tasso di risposte complete, soglie di suddivisione e classificazione degli errori;
- limiti di retry/backoff, checkpoint persistenti e ripresa autonoma al momento consentito, senza loop di chiamate.

Le soglie numeriche definitive **non si inventano**: si confermano con prove end-to-end su PDF reali e risposta Gemini reale, inclusi documenti lunghi. Restano centralizzate e modificabili solo mediante nuova calibrazione verificata quando cambiano modello, API o provider. Un modello con context window elevata non implica automaticamente una risposta altrettanto grande o quota gratuita sufficiente.

### B. Pianificazione automatica — ogni libro

**Prima di qualsiasi generazione Gemini**:
1. Acquisire il documento e contare pagine fisiche, testo effettivo e segmenti/pagina, senza usare la sola dimensione MB come metrica.
2. Stimare localmente input e output per blocco, comprendendo overhead di JSON, istruzioni e glossario. Nessuna chiamata Gemini dedicata soltanto alla stima.
3. Applicare le soglie CALIBRATE della fase A: ordinare pagine e comporre gruppi **più grandi possibile** che rispettino simultaneamente TUTTI i limiti. Spezzare ai confini di pagina; **mai troncare o perdere testo o pagine**.
4. Calcolare e mostrare il numero previsto di richieste e le pagine/blocchi; la previsione non è un risultato di generazione.
5. Usare solo il minimo numero di richieste sicure, non un numero prudenziale arbitrario per pagine. Evitare doppie chiamate di controllo durante la generazione ordinaria.

## Recupero e persistenza

- Le pagine già ricevute e conformi sono salvate in checkpoint; la correzione riguarda soltanto la/le pagina/e non conformi, anche se il primo invio era multi-pagina. Nessuna rigenerazione delle altre pagine.
- Se un blocco supera limiti reali di dimensione/formato (es. 413 o risposta tronca 422), ridimensionare **solo il blocco interessato**, preservando pagine intere e tutto il lavoro valido.
- Su 429/503/timeout e limiti temporanei, applicare attesa e ripresa con backoff; non provocare raffiche di nuovi tentativi né assumere che 503 significhi sempre blocco troppo grande.
- Riprendere da checkpoint senza reimportare il libro o duplicare richieste già completate.
- Un sovraccarico reale può impedire temporaneamente progresso: non promettere assenza assoluta di errori esterni. Lo scopo è minimizzarli e recuperarli autonomamente.

## Confini con il pilastro didattico e pubblicazione

La **dimensione dei blocchi riguarda esclusivamente il trasporto verso Gemini** e non altera la struttura delle pagine né le regole didattiche:
- Gemini riceve SOLO l'obiettivo di riduzione 50% di lettere alfabetiche del corpo, più semplificazione e tutela dei concetti; **non riceve la fascia interna**.
- Per ogni pagina originale con **più di 5 righe non vuote**, l'app verifica individualmente la riduzione **40–60% inclusi** (usando il rapporto reale di lettere non arrotondato per decidere); le pagine da 1 a 5 righe devono essere comunque semplificate, anche senza percentuale obbligatoria.
- Nessuna media totale del libro può compensare una pagina oltre fascia; solo le pagine non conformi sono rigenerate.
- **Studio e lettura progressivi su Android**: ogni pagina conforme è studiabile appena pronta, anche se una pagina precedente è ancora in elaborazione. I warning qualitativi non devono nascondere tutto il libro, né essere presentati come certificazione semantica.
- **PDF completo, download e stampa soltanto quando TUTTE le pagine sono pronte e conformi**; niente PDF parziali.
- Le statistiche devono distinguere pagine ricevute, pagine approvate, riduzione effettiva per pagina e previsione delle richieste.

## Verifiche obbligatorie PRIMA della prossima APK

- PDF reale di 44 pagine «Filosofia del diritto appunti+sbobine.pdf»: nessuna pagina persa, integrità delle pagine e degli ID, confronto configurazioni 2/3/5 blocchi e misurazioni di chiamate/rate/tempo/esito; non confondere simulazione con prova reale Gemini.
- Simulazioni/real-test su documenti lunghi (1000–2000 pagine), token input/output e JSON strutturato, glossario, quote gratuite, risposte troncate, errori 429/503, ripresa.
- Test invarianti per pagina: righe 1, 3, 5, 6; riduzioni reali 39,99 / 40,00 / 50,00 / 60,00 / 60,01; verifica che la fascia privata non entri nel prompt/payload.
- Test che una pagina conforme sia leggibile su Android mentre altra è in correzione, e che PDF/stampa restino bloccati fino all'ultima pagina.
- Confronto contro LAB124 e Scudo360, senza modificare APK installata, firma Android, package, produzione, prezzi o servizi.

**Stato evidenze al 13-11-2026:** LAB124 corrente limita il blocco a 28.000 caratteri nel planner e 30.000 nel Worker; una prova locale sul PDF 44 pagine ha pianificato 5 blocchi a 28k e 3 a ~40k; il caso 60k può apparire in 2 blocchi per soli caratteri, ma non soddisfa il limite prudente di output di 30k token. **Il piano di tre blocchi NON è ancora confermato da test reali di completamento Gemini** e non sono soglie calibrate definitive. Nessuna APK da compilare prima del collaudo.


## Profilo preventivo numerico V1 — deciso il 13 novembre 2026

**Archivio tecnico machine-readable:** `docs/STUDYBOOK_GEMINI_BLOCK_PROFILE_V1.json`. È il riferimento unico per i numeri e le formule qui riepilogate; non crearne una seconda copia discordante. **Stato del profilo: CANDIDATO misurato localmente, NON ancora certificato da risposta Gemini reale**. I numeri vengono fissati ora come impostazioni da collaudare; il codice corrente e il Worker in produzione NON li applicano ancora. La promozione a profilo `VERIFIED` richiede collaudo del provider e dell'Android reale.

### Limiti preliminari deliberati

| Parametro unico | Valore candidato | Motivazione |
| --- | ---: | --- |
| Testo originale complessivo per blocco | **40.000 caratteri Unicode** | 3 blocchi simulati sul PDF reale 44 pagine; margine rispetto all'attuale profilo 28k |
| Tetto Worker da predisporre | **42.000 caratteri sorgente** | 2.000 di margine tra planner e validazione server; modifica ancora da eseguire/testare |
| Input stimato per blocco | **massimo 35.000 token** | Include overhead di pagina, segmenti, istruzioni e JSON |
| Output stimato per blocco | **massimo 30.000 token** | Margine 6.000 rispetto a `max_tokens` corrente 36.000 |
| Output massimo della richiesta Worker | **36.000 token** | Limite applicativo già attuale, non limite assoluto di Gemini |
| Pagine per blocco | **massimo 72**, ma anche tutte le altre soglie devono essere rispettate | Limite strutturale del Worker |
| Timeout server Gemini | **150 s** | Limite applicativo attuale, da misurare nella prova reale |
| Timeout client | **165 s** | Margine per viaggio di rete / risposta |
| Numero chiamate per calcolare i blocchi | **0** | Solo scansione locale del libro |
| Soglia sotto la quale ridimensionare una richiesta dopo 413/422 | **1.200 caratteri** come limite tecnico esistente | Non iniziare una raffica di tentativi; ogni pagina resta tracciata e integra |

**Conteggio preventivo per ogni libro:** numero pagine fisiche + conteggio caratteri e lettere Unicode del testo acquisito per pagina + numero segmenti/pagina + numero righe non vuote. La sola dimensione in MB, la sola quantità di lettere e la sola quantità di pagine non bastano a prevedere l'output. Il lettore esegue questi conteggi con una scansione locale rapida e senza chiamate al provider.

**Stima token conservativa attuale, da verificare con misure reali di `usage`**:

- `inputStimato = ceil(caratteriSorgente × 0,62) + 190 × pagine + 65 × segmenti + 1.500`;
- `outputStimato = ceil(caratteriSorgente × 0,58 / 1,4) + 420 × pagine + 115 × segmenti + 1.800`.

L'app include una nuova pagina nel blocco solo se **tutte** le soglie rimangono rispettate: caratteri, stima input, stima output, massimo pagine. Appena una soglia verrebbe superata, chiude il blocco precedente e ne apre un altro, preservando la pagina intera. Questa regola greedy per pagine contigue e costi cumulativi positivi ottiene il numero minimo di blocchi con le soglie indicate. Se una singola pagina eccede da sola un tetto, segnala un caso eccezionale senza troncarla e applica un trattamento separato validato, non la certifica falsamente.

**Soglie del provider distinte dalle soglie prudenti dell'app:** Gemini Flash-Lite offre limiti nominali molto superiori (1.048.576 token input e 65.536 output per i modelli documentati), ma **non si usa il massimo nominale come quota gratis garantita**. RPM/TPM/RPD sono diversi per progetto e modello: non inventare numeri permanenti. Per i libri futuri verificare solo disponibilità/risposta dei tentativi reali, rispettare `Retry-After` e checkpoint; aggiornare unicamente il profilo versionato al cambio di modello, limiti effettivi o gateway. Vietato attivare account a pagamento.

### Risultato locale ripetibile su PDF autentico (non chiamata Gemini)

- `Filosofia del diritto appunti+sbobine.pdf`: **44 pagine; 116.920 caratteri estratti; 95.691 lettere Unicode**; 43 pagine oltre cinque righe, 1 pagina di tre righe.
- Simulazione del planner con struttura semplice a un segmento per pagina: limite 28k → **5 blocchi**; limite 40k + limiti token sopracitati → **3 blocchi**.
- I tre gruppi di pagine stimati con 40k sono **1–16** (39.945 caratteri, 30.346 token input stimati, 26.909 output), **17–30** (39.165, 29.353, 25.516), **31–44** (37.810, 28.513, 24.955). Con *due segmenti per pagina*, la simulazione resta a 3 blocchi; con segmentazione più fitta può salirvi a 4. L'app dovrà usare i segmenti EFFETTIVI, non un numero ipotetico.
- Con 60k di soli caratteri si vedrebbero 2 gruppi, **ma il limite di 30k token di output stimati ne impedisce attualmente l'adozione**: con l'intero budget di input/output vigente il planner si ferma a 3 gruppi. Quindi **due blocchi non sono una decisione approvata**.
- Ripetendo artificialmente la distribuzione delle 44 pagine fino a 2.000, il profilo candidato prevede **137 blocchi**, non un numero fisso per ogni libro futuro. Serve il test di stabilità sul testo effettivo di libri grandi.
- **Nessuna risposta Gemini reale, tempo effettivo, quota account, qualità delle riscritture o APK è stata validata da questa simulazione.** Non dichiarare il profilo definitivo o privo di errori prima dei test.

### Decisione operativa

Usare il **profilo da 40k** come **unica candidata prioritaria** per i prossimi test autentici. Non fare una gara infinita fra soglie ad ogni libro; il passo successivo è calibrare UNA VOLTA il profilo, promuoverlo dopo test affidabili e poi per ogni libro eseguire solo preflight locale con la formula stabile. Potenziali blocchi da 60k o maggiori richiederebbero una nuova calibrazione esplicita dei tetti di uscita, timeout, tempi e quote. Non modificare ora la produzione o la firma, non eseguire l'APK automatica.

## Governance e continuità

Autorità: questo documento versionato nel repository GitHub `Br174/StudyBook-AI`. Le regole approvate qui sono permanenti e devono essere richiamate nei prossimi LAB, test, handoff e nuove chat attraverso `MOTORLAB_PROJECT_HOOK.txt` e il checkpoint operativo. Lo stato live del codice resta distinto da questa specifica: **salvare la regola NON equivale ad averla implementata o collaudata**.

Appartiene al sottosistema di pianificazione/trasporto di StudyBook e coesiste con i vecchi documenti sui sei livelli, senza riscrivere retroattivamente i formati delle precedenti versioni salvate. Non introdurre un secondo planner concorrente: aggiornare e testare quello attivo.
