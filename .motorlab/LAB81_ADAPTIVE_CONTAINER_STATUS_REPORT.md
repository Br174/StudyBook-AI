# StudyBook AI LAB81 - Stato di prova e recupero offline

Data: 9 novembre 2026. MotorLab r40.
Repository: Br174/StudyBook-AI.
Ramo sperimentale: audit/studybook-adaptive-container-v81-20261109.
Workflow GitHub Actions: https://github.com/Br174/StudyBook-AI/actions/runs/42581221607

## Prova in tempo reale
- Script: scripts/test-lab81-adaptive-container.mjs
- Workflow: .github/workflows/studybook-lab81-adaptive-container.yml
- Modello configurato: gemini-3.5-flash-lite, chiave preesistente; massimo 18 chiamate.
- Esecuzione: una sola richiesta, HTTP 503, nessun testo utilizzabile, zero coppie confrontabili.
- Risultato workflow: FAILURE per arresto protetto. Sintassi script: PASS.
- ATTENZIONE: HTTP 503 non prova il superamento quota Gemini, può essere sovraccarico o indisponibilità temporanea; il campo 'quotaStopped' nel JSON del test è un flag operativo di arresto, non una diagnosi quota.
- Dati grezzi: audit/reports/studybook-lab81-real.json (stesso ramo).
- Nessun retry e nessuna seconda chiamata dopo HTTP 503.

## Prova offline mirata con testo costruito manualmente
- Fonte: pagina sintetica 'procedura' della LAB80, 636 lettere originali; riduzione 50%.
- Target: 318 lettere; fascia matematica: 306-330 lettere.
- In LAB80 Gemini aveva generato tre alternative per concetto, ma anche le più corte sommate davano 458 lettere.
- Questa volta è stata elaborata MANUALMENTE una riscrittura più integrata e compatta: non è un output Gemini e non dimostra che il modello la produrrebbe.
- Lettere alfabetiche Unicode NFC, esclusi numeri, spazi e punteggiatura: 325.
- Fascia rispettata: SÌ.
- I riferimenti 2024 e 12 sono presenti come cifre, le condizioni di prestito, proroga, scadenza, registro e opinioni sono ancora espresse nel testo.
- La verifica semantica è solo lettura qualitativa interna e NON una certificazione indipendente.

> Nel 2024 una biblioteca simulata segue la regola 12: registrare il titolo prima del prestito e confermare il reso entro dieci giorni. Il personale può prorogare solo se il libro non è prenotato; senza conferma scritta vale la prima scadenza. Se prenotato, va reso alla scadenza anche se non letto. Il registro indica chi lo riceve e quando, non opinioni personali. Condizioni ed eccezioni sono essenziali.

## Diagnosi operativa
- La non fattibilità del contenitore LAB80 al 50% derivava dalle alternative troppo lunghe, non dalla matematica. Una formulazione integrata può potenzialmente rientrare, ma la generazione automatica deve essere testata.
- Modifica sperimentale successiva proposta: se le alternative per singolo concetto non sono fattibili, tentare una sola riformulazione di più concetti collegati, mantenendo esplicitamente i vincoli didattici.
- Proteggere tutti i numeri, le condizioni e i riferimenti; evitare tagli meccanici.
- Riattivare prove con Gemini solo dopo conferma dell'accessibilità del servizio e nel limite gratuito, senza retry aggressivi.
- Per adesso non dichiarare il metodo LAB81 migliore del LAB80: mancano prove reali sufficienti.

## Isolamento
- Nessun cambiamento ad APK, firma, versione installata, ramo main, LAST_GOOD, PDF, contenuti utenti, Worker di produzione.
- Questo documento è solo evidenza e non attiva nuovamente il workflow sperimentale.