# StudyBook AI — migrazione Cloudflare

Questa branch prepara una migrazione parallela da Netlify a Cloudflare Workers senza modificare o spegnere la versione Netlify esistente.

## Obiettivo

- Mantenere invariati frontend React/Vite, PWA, OCR, libreria locale, checkpoint, esportazioni e flusso di studio.
- Mantenere Gemini come unico motore AI.
- Spostare hosting statico e backend API da Netlify a Cloudflare Workers.
- Conservare Netlify come fallback finché la versione Cloudflare non è stata verificata end-to-end.

## Branch di lavoro

`cloudflare-migration`

Non effettuare il cutover su `main` finché tutti i test non sono completati.

## Configurazione Cloudflare

Il file `wrangler.jsonc` definisce:

- Worker: `studybook-ai`
- entrypoint: `worker/index.js`
- asset Vite: `dist`
- fallback SPA
- routing Worker-first solo per `/api/*`
- `AI_API_URL`
- `AI_MODEL=gemini-3.6-flash`
- `AI_TIMEOUT_MS=30000`
- secret obbligatorio: `AI_API_KEY`

La chiave `AI_API_KEY` non deve mai essere salvata nel repository.

## API migrate

Il Worker espone gli stessi endpoint usati oggi dall'app:

- `POST /api/summarize`
- `POST /api/explain`
- `POST /api/refine`

L'adapter Cloudflare riusa gli handler esistenti nella cartella `api/`, così la logica Gemini resta identica a Netlify.

## Build

Build applicazione:

```text
npm run build
```

Output statico:

```text
dist
```

Deploy Cloudflare:

```text
npx wrangler deploy
```

## Regole di sicurezza

1. Non cancellare o disattivare Netlify durante la migrazione.
2. Non cambiare modello Gemini.
3. Non inserire API key in GitHub, file sorgente, log o chat.
4. Non modificare il comportamento dell'app se non strettamente necessario alla compatibilità Cloudflare.
5. Prima del cutover verificare la PWA su Android e tutti gli endpoint AI.

## Verifica minima prima del cutover

- build Vite riuscita;
- home/app caricata da Cloudflare;
- PWA installabile e riapribile;
- import PDF funzionante;
- OCR funzionante;
- checkpoint e ripresa funzionanti;
- `/api/summarize` funzionante con Gemini;
- `/api/explain` funzionante;
- `/api/refine` funzionante;
- esportazione PDF funzionante;
- nessun secret esposto nel client o nel repository;
- confronto funzionale con la versione Netlify.

Solo dopo questi controlli si può valutare il passaggio definitivo a Cloudflare.

## Verifica automatica della migrazione

Requisito degli strumenti Cloudflare: Node.js 22 o successivo. Wrangler è fissato
alla versione 4.131.2 nelle dipendenze di sviluppo; la pipeline usa Node.js 22.

Dopo avere installato le dipendenze con `npm install`, eseguire:

```text
npm run check:cloudflare
```

Il comando compila l'app con il comando di build esistente, verifica il bundle del
Worker con `wrangler deploy --dry-run` ed esegue il collaudo nel runtime locale
Cloudflare (`workerd`) usando `createTestHarness` di Wrangler.

Il collaudo carica la stessa `wrangler.jsonc` prevista per il deploy e verifica:

- home, collegamenti diretti SPA e JavaScript compilato;
- service worker, manifest e icona PWA;
- routing API, errori 400/404/405/413 e intestazione Allow;
- contratti JSON di summarize, explain e refine;
- passaggio del modello configurato e del secret tramite process.env;
- ordine dei paragrafi e richieste simultanee;
- retry transitorio, rifiuto credenziali e JSON AI non valido;
- risposta AI_NOT_CONFIGURED quando il secret è vuoto.

Le richieste AI di questo collaudo vanno a un server di prova locale, con una
credenziale fittizia. Non vengono inviate a Gemini e non verificano la validità
della chiave reale, la disponibilità del modello o la qualità delle risposte.
Il modello in configurazione e la logica degli handler non vengono modificati.

La data di compatibilità 2026-09-14 abilita già il supporto Node.js e il popolamento
di process.env con variabili e secret. Non occorre copiare il secret in variabili
globali o modificare gli handler condivisi con Netlify.

La pipeline GitHub esegue questi controlli oltre ai test esistenti. Un esito positivo
non sostituisce il collaudo HTTPS con Gemini reale e la prova della PWA su Android.

## Comandi per Cloudflare

- `npm run dev:cloudflare`: build dell'app e avvio locale del Worker.
- `npm run check:cloudflare`: build, verifica deploy senza pubblicazione e test.
- `npm run deploy:cloudflare`: build e pubblicazione sul proprio account Cloudflare.

Per l'avvio locale con Gemini reale, configurare AI_API_KEY in un file .dev.vars
ignorato da Git; non inserire la chiave nel codice o in chat.
Per la pubblicazione, configurare il secret AI_API_KEY sul Worker studybook-ai
tramite il pannello Cloudflare oppure il comando interattivo:

```text
npx wrangler secret put AI_API_KEY
```

Il comando che configura il secret scrive sul proprio account Cloudflare.
La verifica in CI e il dry-run non pubblicano l'app e non modificano Netlify.
Per Workers Builds, usare esclusivamente cloudflare-migration come branch di
produzione del progetto di migrazione, build command npm run build e deploy
command npx wrangler deploy. Il repository resta privato e deve essere autorizzato
nell'integrazione GitHub di Cloudflare.

## Riferimenti tecnici

- [Cloudflare: process.env e compatibilità Node.js](https://developers.cloudflare.com/workers/runtime-apis/nodejs/process/)
- [Cloudflare: API di test Wrangler](https://developers.cloudflare.com/workers/wrangler/api/)
- [Cloudflare: configurazione, routing asset e secret richiesti](https://developers.cloudflare.com/workers/wrangler/configuration/)

## Collegamento dal telefono e prima pubblicazione

Worker creato nel pannello Cloudflare: `studybook-ai`.

Indirizzo del Worker: https://studybook-ai.brunoverlezza.workers.dev

Per scegliere una branch diversa da quella predefinita del repository prima di
pubblicare l'app, creare inizialmente il Worker con il modello Hello World, poi
aprire Impostazioni > Crea > Repository git > Connetti.

Impostazioni da usare nel collegamento:

- Account Git: `Br174`.
- Repository: `StudyBook-AI`.
- Branch di produzione: `cloudflare-migration`.
- Abilita build di anteprima: disattivato.
- Comando di generazione: `npm run build`.
- Comando Distribuisci: `npx wrangler deploy`.
- Percorso del progetto: `/`.

Configurare `AI_API_KEY` nelle variabili e nei segreti di runtime del Worker,
selezionando Segreto. Le variabili della compilazione non sostituiscono i segreti
di runtime. Salvare il segreto prima di inviare il commit che avvia la prima
pubblicazione: Wrangler verifica i segreti obbligatori e rifiuta il deploy se
mancano. Non riportare il valore della chiave nel repository o nei log.

Dopo il collegamento, un nuovo commit sulla branch di produzione configurata
avvia Workers Builds. Il collegamento Git e la presenza del segreto non attestano
da soli che l'app sia pubblicata: controllare l'esito del deploy e poi verificare
l'indirizzo pubblico e gli endpoint Gemini prima del cutover.

- [Cloudflare: collegare un Worker esistente](https://developers.cloudflare.com/workers/ci-cd/builds/#connect-an-existing-worker)
- [Cloudflare: scelta della branch di produzione](https://developers.cloudflare.com/workers/ci-cd/builds/build-branches/)
- [Cloudflare: segreti obbligatori prima del deploy](https://developers.cloudflare.com/workers/configuration/secrets/#validate-secrets-before-deploy)
