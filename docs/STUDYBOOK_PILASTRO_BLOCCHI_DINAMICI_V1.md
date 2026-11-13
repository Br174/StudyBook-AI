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

**Stato evidenze al 13-11-2026:** LAB124 corrente limita il blocco a 28.000 caratteri nel planner e 30.000 nel Worker; una prova locale sul PDF 44 pagine ha pianificato 5 blocchi a 28k, 3 a ~40k e 2 a ~60k. **Due/tre blocchi NON sono ancora confermati da test reali di completamento Gemini** e non sono soglie calibrate definitive. Nessuna APK da compilare prima del collaudo.

## Governance e continuità

Autorità: questo documento versionato nel repository GitHub `Br174/StudyBook-AI`. Le regole approvate qui sono permanenti e devono essere richiamate nei prossimi LAB, test, handoff e nuove chat attraverso `MOTORLAB_PROJECT_HOOK.txt` e il checkpoint operativo. Lo stato live del codice resta distinto da questa specifica: **salvare la regola NON equivale ad averla implementata o collaudata**.

Appartiene al sottosistema di pianificazione/trasporto di StudyBook e coesiste con i vecchi documenti sui sei livelli, senza riscrivere retroattivamente i formati delle precedenti versioni salvate. Non introdurre un secondo planner concorrente: aggiornare e testare quello attivo.
