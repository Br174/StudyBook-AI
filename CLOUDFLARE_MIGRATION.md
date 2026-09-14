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
