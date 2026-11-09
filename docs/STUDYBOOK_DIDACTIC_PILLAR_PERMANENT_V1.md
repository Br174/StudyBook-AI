# STUDYBOOK AI — PILASTRO DIDATTICO PERMANENTE V1
Data decisione utente: 9 novembre 2026
Stato: SPECIFICA APPROVATA DALL'UTENTE, SALVATA IN DOCUMENTAZIONE; NON ANCORA IMPLEMENTATA/TESTATA NELL'APP
Motore orchestratore: MotorLab r40 insieme al motore nativo StudyBook AI
Ambito: ogni rielaborazione di libri di studio, generi giuridici, medici, scientifici, teatrali e qualsiasi altra disciplina.
Vincoli: zero costi aggiuntivi; preservare i dati, le pagine, l'impaginazione, il PILASTRO preesistente e la firma Android. Il file NON è una modifica all'eseguibile.

## 1. Comprensione globale e proprietà della pagina
- La prima lettura del documento ricostruisce la struttura completa: libro, capitoli, articoli, paragrafi, frasi, nessi semantici e continuità tra pagine.
- Registra per ogni contenuto un riferimento immutabile alla pagina e all'intervallo di origine, oltre a eventuali identificatori del medesimo articolo/ragionamento che attraversa più pagine.
- Durante la generazione della pagina P l'IA può leggere il contesto necessario delle pagine P-1 e P+1 (o il contesto globale già analizzato), ma **deve produrre esclusivamente la rielaborazione del segmento che appartiene in origine a P**. Il contesto esterno è *di sola lettura*.
- Il pezzo che originariamente è sulla pagina P resta sulla pagina P anche se la frase o l'articolo proseguono sulla pagina P+1. Non si trasferiscono, anticipano, ripetono, completano artificialmente o duplicano parti su un'altra pagina.
- Se un periodo inizia nella pagina precedente o finisce nella successiva, lo stile di P deve essere coerente con il discorso completo, ma il contenuto e la provenienza restano ancorati a P. Nessuna aggiunta al PDF di marcatori interni.
- Titoli, indici, numerazione e ordine originali devono essere preservati, inclusi eventuali bis/ter già previsti nel sistema. Non spezzare parole o frasi artificialmente per adeguare il budget.

## 2. Le sei versioni e la semplificazione progressiva
La **chiarezza è obbligatoria in tutte le sei versioni**, ma non è sinonimo di eliminazione dei vocaboli specialistici. Il linguaggio cambia progressivamente insieme alla riduzione; *le informazioni essenziali rimangono in tutte le versioni*.

| Edizione | Riduzione centrale | Linguaggio / termini di settore |
|---|---:|---|
| 10% | 10% | Preservare i termini tecnici *esatti* e le definizioni corrette. Rendere più semplici soprattutto sintassi, struttura, collegamenti, ripetizioni; non tradurre termini di settore in parole vaghe. Un chiarimento minimo è consentito quando utile. |
| 20% | 20% | Conservare i termini specialistici fondamentali, con brevi spiegazioni in linguaggio comune quando necessario. Sintassi ulteriormente semplificata. |
| 30% | 30% | Iniziare una sostituzione selettiva del gergo non essenziale con lingua comune; mantenere nome tecnico chiave alla prima occorrenza e accompagnarlo con una spiegazione breve. |
| 40% | 40% | Semplificazione più forte di periodi e lessico; mantenere i termini scientifici/giuridici/medici indispensabili, chiarendoli con poche parole. |
| 50% | 50% | Esposizione molto sintetica e comprensibile: usare parole comuni quando possibile, ma non cancellare termini tecnici necessari per precisione, esami o pratica professionale. |
| Riassunto finale | circa 65% (fascia 60–70%) | Concetti minimi fondamentali, linguaggio chiaro, termini tecnici solo quando necessari per non perdere il senso disciplinare. |

- La semplificazione lessicale deve essere graduale, non un interruttore on/off al 30%.
- Un vocabolo indispensabile non è intercambiabile con un sinonimo colloquiale, e deve rimanere, eventualmente spiegato, in qualsiasi edizione. Esempi: 'termine perentorio' in diritto, 'insulina' in medicina, nomi di norme, procedure, diagnosi, unità di misura e definizioni canoniche.
- Un glossario/etichetta interna può supportare coerenza tra pagine e livelli, ma non deve generare chiamate superflue o spostare testo tra pagine.
- Se il testo è già chiaro, non forzare sostituzioni artificiali: l'obiettivo è migliorare la comprensibilità quando utile, evitando errori tecnici.
- La funzione separata **«In parole semplici» resta rigorosamente on-demand e per singola pagina**: non si anticipa né si genera durante la creazione delle sei versioni; può spiegare liberamente anche in maggiore lunghezza e memorizza solo l'ultima versione della pagina finché l'utente la rigenera.

## 3. Eccezione per pagine brevissime, senza rinuncia alla chiarezza
- Calcolare la lunghezza della **sola pagina originale** usando per il test la riga virtuale già calibrata: 60 caratteri totali per riga con parole non spezzate. Il criterio si basa sul contenuto originale della pagina, non sulla somma delle pagine contigue, non sulle righe vuote e non sulle dimensioni del display.
- **1–5 righe virtuali:** la pagina viene comunque rielaborata e, quando possibile, resa più comprensibile secondo la progressione lessicale sopra definita. Le percentuali di riduzione sono *libere*: anche testo quasi invariato è ammissibile se corto e imprescindibile. Non inventare differenze né aggiungere riempitivi per simulare sei livelli.
- **Da 6 righe virtuali in poi:** obiettivi di riduzione con margine di **±5 punti percentuali** sul numero effettivo di lettere alfabetiche Unicode, rispetto alla sola fonte della pagina. Riassunto circa 65%, ammissibile 60–70%; 50% ammissibile 45–55%; 40% 35–45%; 30% 25–35%; 20% 15–25%; 10% 5–15%.
- Anche da 6 righe il budget non autorizza perdite semantiche: se non fattibile senza eliminare nozioni imprescindibili, non mascherare l'errore; conservare il contenuto, registrare lo scostamento e segnalare «riduzione impossibile senza perdita di concetti», senza bloccare l'elaborazione delle altre pagine.
- I numeri, le negazioni, i riferimenti, le condizioni, le eccezioni, le cause-effetti e le definizioni devono essere preservati e verificati; controllo semantico e controllo delle percentuali sono separati.
- La compressione non può togliere automaticamente un vocabolo necessario solo per rispettare una percentuale.

## 4. Calibrazione di righe e spazi
- Dati LAB84: 5 fonti italiane diverse × 100 righe virtuali di 60 caratteri = 500 righe.
- Medie osservate per riga: **11,502 spazi inclusi quelli di giustificazione**, **46,346 lettere**, **1,966 segni di punteggiatura**, **0,186 cifre** (somma 60).
- Usare queste medie **solo per suggerire inizialmente la quantità di righe**; non contare gli spazi come lettere, né presumere che la media valga identicamente su ogni pagina.
- Il giudizio finale sulla percentuale rimane deterministico sulle lettere Unicode realmente presenti nella pagina generata.
- Provenienza delle misure: `audit/reports/studybook-lab84-multigenre-space-calibration.json`, ramo `audit/studybook-multigenre-spaces-v84-20261109`. Le fonti campione non garantiscono fedeltà della generazione Gemini.
- La nuova calibrazione e questa regola NON sono ancora validate in un test reale completo delle sei versioni; non annunciare successo senza il relativo report.


## 4 bis. Vincolo geometrico deterministico delle righe: non solo impaginazione successiva
**Vincolo aggiuntivo fondamentale, chiarito il 9 novembre 2026.** L'utente vuole un foglio/griglia predefinito, non una pagina che si allarghi o venga rimpicciolita in funzione di quanto scrive l'IA.

- Il programma **sceglie PRIMA** della generazione la dimensione del foglio/area di studio, il font, la dimensione del carattere, i margini, l'interlinea, la lunghezza massima di ogni riga e il **numero massimo delle righe** consentito per quella versione della pagina. I parametri non possono essere alterati da Gemini; non si cambiano font, dimensioni, spaziature o margini per far stare più testo.
- La prova sperimentale usa **60 posizioni di carattere per riga**; se si usa un font monospaziato, 60 caratteri danno anche una larghezza fisica uniforme. Su foglio A4/PDF o con font proporzionali la reale capacità in larghezza **non dipende solo dal numero di caratteri** (es. «i» e «m» occupano spazi differenti): serve misurazione della larghezza grafica con il font effettivo e a grandezza fissa.
- Per ogni livello del PILASTRO, dal budget in **lettere alfabetiche Unicode** e dalla calibrazione indicativa LAB84 (46,346 lettere e 11,502 spazi totali per 60 posizioni), ricavare **prima** la capienza/numero massimo delle righe. Es.: un testo con 599 lettere ridotto del 40% richiede 359 lettere stimate, cioè circa 8 righe virtuali da 60 posizioni; il margine ammesso è ±5 punti percentuali.
- Gemini **non controlla il numero finale delle righe**. Riceve una capienza vincolante ma **un validatore deterministico esterno** deve misurare il risultato con il font/larghezza scelti e impedire che superi la griglia. Se il testo necessita di 11 righe quando ne sono consentite 8, il risultato è **non conforme** e deve essere corretto sul testo, non impaginato più piccolo né trasferito sulla pagina seguente.
- L'IA deve comporre parole intere, senza incollare parole né alterare i caratteri; gli spazi di giustificazione sono aggiunti *dal motore di layout* soltanto per uniformare visivamente la riga. La media statistica degli spazi è **una stima di capacità**, non una quantità obbligatoria di spazi né un numero di parole fisse.
- Le due verifiche sono distinte: (1) **la griglia fisica non viene superata** (numero righe e larghezza di ogni riga), (2) **il conteggio totale delle lettere** rientra nella riduzione ±5 punti. Bloccare le righe da solo NON garantisce il conteggio percentuale, perché parole più lunghe/corte, punteggiatura e spazi variano.
- Se la generazione non soddisfa righe **e** lettere **e** contenuti, eseguire solo una correzione mirata e limitata; **mai tagliare automaticamente le parole finali**, eliminare fatti imprescindibili, diminuire il font o spostare contenuto su un'altra pagina per chiudere il conteggio. In caso di conflitto insolubile, preservare la fonte e segnalare lo scostamento invece di dichiarare un falso successo.
- Il limite delle pagine di **1–5 righe originali** resta valido: semplificazione sempre, percentuale non vincolante; l'area può avere righe vuote e non deve essere riempita artificialmente. Le versioni 10/20 restano tecnicamente precise, quelle successive più accessibili, e «In parole semplici» resta solo su pressione del tasto.
- Risultato precedente LAB85: il prompt esprimeva soltanto un **obiettivo orientativo di righe** e suddivideva in righe il testo **dopo** la generazione; non è una prova valida del blocco geometrico rigido richiesto. Il vero test di questo requisito richiede la verifica e la non accettazione dell'overflow **prima** di segnare la versione come conclusa.
- I confini di contenuto delle singole pagine originali prevalgono sempre, anche quando il ragionamento prosegue da una pagina alla successiva.

**Stato:** specifica canonica salvata; la griglia rigida non è ancora implementata né validata con Gemini. Eventuali nuovi test devono distinguere esplicitamente vincolo di geometria, % di lettere e fedeltà semantica.

## 5. Casi di accettazione da usare nei test
A. Una definizione giuridica in 3 righe: produrre tutti e sei i livelli, con spiegazione più semplice dove utile e termini tecnici preservati almeno al 10/20%; accettare riduzioni diverse dagli obiettivi.
B. Articolo che inizia su P e finisce su P+1: la prima lettura riconosce la continuità; il testo derivato di P non contiene parti che appartengono a P+1, e viceversa; nessuna duplicazione.
C. Termine fondamentale presente nella fonte: 10/20 mantengono il vocabolo tecnico identico; al 30/40/50 se indispensabile rimane con spiegazione breve e fedele.
D. Una pagina di 6+ righe: verificare per ogni livello la fascia ±5 punti, contando le sole lettere Unicode della pagina P senza spazi o punteggiatura; verificare concetti separatamente.
E. Testo già semplice: nessuna parafrasi inutile, nessun testo inventato per differenziare le versioni.
F. «In parole semplici»: nessuna generazione anticipata, solo pressione sul pulsante e salvataggio dell'ultima versione per pagina.
G. Nessun contenuto generato o importato può scivolare da una pagina all'altra per compensare carenze di lunghezza.

**Stato operativo**: specifica canonica persistente per le future LAB; NON prova che l'app abbia già queste capacità. Prima dell'attivazione in produzione occorre implementazione isolata, verifica Scudo360, prove semanticamente fedeli e test percentuali su libri reali.
