# LAB45 • valutazione esecuzione Android persistente

Stato: PENDING_NATIVE_BRIDGE. Nessuna implementazione permanente dichiarata.

L'app è React/Vite in WebView Capacitor 8, i checkpoint e il PDF originale
sono gestiti da IndexedDB/Filesystem nel contesto dell'app. WorkManager di
Android può richiamare operazioni native differibili, ma non esegue
direttamente il motore JavaScript con accesso affidabile al database WebView
dopo la terminazione del processo. Un worker Android non può riutilizzare
automaticamente le chiamate JS `generateGeminiEditionsV36` e i checkpoint
IndexedDB senza un protocollo esplicito, testato, a sorgente unica.

Decisione conservativa LAB45: ripresa automatica durante l'esecuzione
in primo piano, timer quota e qualità limitati; al riavvio dell'app,
ripresa dei checkpoint. Non affermare funzionamento a schermo spento.
Scudo360 richiede ulteriori test Android reali prima di una eventuale
integrazione nativa WorkManager/servizio visibile. Nessuna modifica a
firma APK, struttura PDF, percentuali o dati esistenti.

Requisiti per un successivo supporto nativo:
- 1 identità di lavoro per libro, idempotente;
- confine transazionale e ownership del checkpoint, un solo writer;
- nessuna duplicazione di richieste Gemini;
- esecuzione nei limiti del provider e di Android;
- stato visibile e possibilità di sospensione dell'utente;
- prove su reboot, Doze, crash, disconnessione, quota RPD/RPM/TPM;
- zero servizi a pagamento e roll-back compatibile con LAB44.
