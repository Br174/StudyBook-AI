# StudyBook AI · Deployment di produzione

Questo documento descrive la configurazione operativa della release v1.0 senza inserire segreti nel repository.

## Target di produzione

- Hosting: Netlify
- Progetto Netlify: `studybook-ai`
- URL previsto: `https://studybook-ai.netlify.app`
- Branch sorgente: `main`
- Build command: `npm run build`
- Publish directory: `dist`
- Functions directory: `netlify/functions`

## API server-side

Le funzioni Netlify espongono gli stessi endpoint usati dal frontend:

- `/api/summarize`
- `/api/refine`
- `/api/explain`

Le chiavi AI devono restare esclusivamente nelle variabili d'ambiente del progetto Netlify.

Variabili richieste:

- `AI_API_URL`
- `AI_API_KEY`
- `AI_MODEL`

`AI_API_KEY` deve essere trattata come segreto e non va mai committata nel repository.

## PostHog · solo LAB MotorLab

Il pilota di diagnostica PostHog resta confinato al branch LAB e usa esclusivamente variabili d'ambiente del deploy di prova:

- `VITE_POSTHOG_PROJECT_TOKEN` — project token client-side del progetto PostHog;
- `VITE_POSTHOG_HOST` — host di ingestion indicato nelle impostazioni del progetto PostHog;
- `VITE_MOTORLAB_POSTHOG_TEST` — flag temporaneo del solo collaudo MotorLab; deve essere assente o disabilitato nei build normali.

Non inserire valori reali di queste variabili nei file sorgente o nella documentazione. I file `.env` e `.env.*` restano esclusi dal repository tramite `.gitignore`.

Il pilota non abilita session recording, autocapture di click/form, pageview o pageleave automatiche. Il probe sintetico richiede sia `VITE_MOTORLAB_POSTHOG_TEST=1` sia il parametro URL `motorlab_posthog_probe=1`.

Dopo una modifica delle variabili `branch-deploy`, avviare un nuovo build del branch LAB prima della verifica, così i valori Vite vengono incorporati esclusivamente nell'artefatto di prova.

## Verifica prima della pubblicazione

Ogni commit su `main` deve superare la pipeline GitHub Actions, che verifica sintassi API e funzioni Netlify, resilienza AI, gestione paragrafi lunghi, checkpoint OCR, persistenza scanner, protezione storage, strumenti di studio, cache persistente, PWA, stress test sintetico da 600 pagine e build Vite.

## Verifica dopo la pubblicazione

1. Aprire la home su HTTPS e verificare l'avvio della PWA.
2. Importare un piccolo PDF digitale.
3. Provare una fotografia e un flusso OCR.
4. Generare una sintesi con provider AI attivo.
5. Aprire Modalità Studio e testare `/api/explain`.
6. Testare `Migliora con AI` sul singolo paragrafo tramite `/api/refine`.
7. Verificare Libreria, export e reinstallazione/ripresa della PWA.
8. Su Android provare fotocamera, scanner multipagina, chiusura e ripresa della raccolta.

## Regola di rilascio

Una build CI riuscita certifica il codice e i test automatici. La release viene definita `production-verified` solo dopo il collaudo sul sito HTTPS con provider AI configurato e una prova reale su Android.