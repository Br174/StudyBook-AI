# MotorLab StudyBook LAB83: calibrazione una tantum degli spazi

Data: 9 novembre 2026. TEST LOCALE NUMERICO, senza richieste Gemini e senza modifiche all'app.

## Parametro scelto PRIMA del campionamento
- Capienza della riga: **60 caratteri** complessivi inclusi spazi, lettere, cifre e punteggiatura.
- Le parole non vengono divise. Le righe naturali sono greedy-wrapped entro 60 caratteri.
- Il residuo a fine riga viene riempito idealmente con spazi addizionali distribuiti tra le parole, ottenendo 60 posizioni per riga.
- Campione: prime 100 righe consecutive di prosa italiana a partire da "Quel ramo del lago di Como" nel romanzo *I promessi sposi* di A. Manzoni, Project Gutenberg #45334.
- Fonte: https://www.gutenberg.org/cache/epub/45334/pg45334.txt
- Rimozione degli a capo editoriali e ricomposizione della prosa con spazi singoli prima di andare a capo a 60 posizioni.
- Conteggio lettere = lettere alfabetiche Unicode dopo NFC, esclusi spazi, cifre, punteggiatura.

## Misure sul campione
- Lunghezza massima: 60 caratteri; lunghezza media non giustificata: **56,80**.
- Spazi normali: **876 totali, 8,76 per riga** (minimo 6, massimo 12).
- Residuo medio per giustificazione: **3,20 posizioni per riga**, 320 in totale.
- Spazi totali a riga giustificata: **1196**, media **11,96**.
- Punteggiatura e altri segni non alfabetici non numerici: **2,37 per riga**.
- Cifre: **0,05 per riga**.
- Lettere alfabetiche: **4562 in 100 righe**, media **45,62 per riga**, minimo 40, massimo 51.
- Formula: **60 - 11,96 spazi - 2,37 altri segni - 0,05 cifre = 45,62 lettere**.
- Stima fissa pratica: 46 lettere/60 caratteri; su 100 righe stimerebbe 4600 lettere contro 4562 osservate, scostamento di +38 lettere (0,83% sul reale).
- Stimare 50 lettere per riga avrebbe prodotto 5000 anziché 4562, errore di +438 lettere (9,6% sul reale).

## Variabilità osservata
- Per ogni riga il numero di lettere varia fra 40 e 51 pur mantenendo la riga uniforme di 60 caratteri con spazi.
- Sono stati misurati 86 blocchi consecutivi da 15 righe: lettere per blocco tra **658 e 707**, media **684.21**.
- Se l'originale avesse 1000 lettere e il target fosse riduzione 30%, target 700 lettere, ±2 punti = 680-720 lettere, ±5 punti = 650-750.
- Tra i blocchi da 15 righe, **52/86** rientrano nella fascia 680-720; **86/86** rientrano in quella 650-750. Questi sono paragoni statistici su un unico campione, NON test di compressione Gemini.

## Regola corretta
1. Dal budget di lettere da conservare NON si sottraggono ulteriori spazi: già non si contano nell'obiettivo.
2. Per tradurre lettere in righe, sottrarre dalla capienza fissa 60 sia la media degli spazi (~11,96) sia i segni (~2,42), ottenendo circa 45,62 lettere per riga.
3. Le righe necessarie sono targetLettere / 45,62, con arrotondamento ed eventuale margine applicato a livello di testo, non affidandosi ciecamente alla media.
4. La giustificazione degli spazi serve alla lunghezza visiva, non corregge lettere mancanti; ogni pagina deve conservare il conteggio Unicode definitivo.
5. Il riferimento una tantum è valido come calibrazione preliminare di prosa italiana: testi tecnici, elenchi, formule, parole lunghe o impaginazioni diverse possono cambiare molto la media. Il contatore reale resta l'autorità e la lunghezza in pixel/font non coincide con il numero di caratteri.

## Conservazione
- Nessuna chiamata Gemini né patch dell'app, nessuna APK/ZIP, nessuna modifica alla produzione.
- Non impostare la calibrazione come vincolo rigido senza una prova real-time sul testo didattico.
