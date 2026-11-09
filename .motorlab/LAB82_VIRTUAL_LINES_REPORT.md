# MotorLab StudyBook AI LAB82 · Righe virtuali · prova Gemini reale

Data: 9 novembre 2026. Stato: prova INTERROTTA PROTETTA; solo la prima modalità ha prodotto un risultato misurabile.

## Provenienza
- Repo: `Br174/StudyBook-AI`.
- Ramo isolato: `audit/studybook-line-budget-v82-20261109`.
- GitHub Actions: https://github.com/Br174/StudyBook-AI/actions/runs/42582845764
- Risultati completi e testo Gemini: `audit/reports/lab82-virtual-lines-gemini.json`.
- Modello: `gemini-3.5-flash-lite`, segreto già configurato, nessuna nuova sottoscrizione.
- Pagine sintetiche LAB80, non contenuti utenti.
- Nessuna modifica a main, Worker produzione, APK, firma, PDF, checkpoint, LAST_GOOD.

## Confronto progettato (non completato)
- Metodo A: 'scrivi esattamente N righe virtuali', 50 lettere alfabetiche orientative per riga.
- Metodo B: 'elimina N righe virtuali dall'originale', con identica capienza media.
- Controllo C: 'scrivi circa X lettere' usando lo stesso testo fonte.
- Due fonti × 3 riduzioni (10%, 30%, 50%) × 3 formulazioni, massimo 18 richieste.
- Fasce accettabili ±2 punti percentuali, conteggio Unicode NFC alfabetico, esclusi spazi, cifre, punteggiatura.

## Risultato reale
- Prima chiamata A, scienze, riduzione richiesta del 10%: HTTP 200, testo utilizzabile.
- Originale 599 lettere, obiettivo 539, minimo 528, massimo 551.
- Originale virtuale ≈12 righe; Gemini incaricato di scrivere 11 righe virtuali (circa 50 lettere ciascuna).
- Righe vere ottenute: 11 (SUCCESSO formale).
- Lettere alfabetiche ottenute: 419 (FALLIMENTO rispetto alla fascia).
- Lunghezze righe: 39, 36, 40, 36, 37, 38, 39, 39, 40, 38, 37 lettere.
- Media: 38,09 lettere/riga, contro circa 49 attese.
- Riduzione effettiva: 30,05% anziché 10%, 120 lettere sotto il target.
- Tempo modello 1255 ms; token di output 130.
- Il modello ha potenzialmente sacrificato contenuto didattico per soddisfare le righe; da verificare semanticamente.
- Seconda chiamata B ('elimina N righe'): HTTP 503, nessun risultato testuale.
- Arresto immediato protetto dopo HTTP 503; totale 2 richieste, 1 risposta utilizzabile, 0 confronti completi.
- Non è possibile concludere se metodo B sia meglio di A o del controllo C.
- HTTP 503 non prova necessariamente esaurimento quota, può indicare indisponibilità o sovraccarico.

## Diagnosi
Il conteggio delle righe isolato non vincola matematicamente la lunghezza. Anche dicendo '50 lettere circa per riga', Gemini ha prodotto righe da 36–40 lettere.
Lo strumento deve continuare a misurare la quantità effettiva di lettere.
Prossima prova consigliata: confronto a quota disponibile su tre prompt usando identica fonte e identico target; includere mediana/dispersione delle lunghezze delle righe e fedeltà didattica.
Non attivare in produzione; non implementare tagli forzati o correzioni durante la generazione principale.

## Decisione
- Metodo A: non affidabile nel singolo caso osservato.
- Metodo B: non valutabile finché provider non restituisce risposta.
- Righe virtuali utili come guida visiva o come misura derivata dal contatore locale, non come garanzia di percentuali.
- Esperimento isolato con arresto sicuro: nessuna APK o ZIP generata.