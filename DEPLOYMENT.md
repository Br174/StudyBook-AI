# StudyBook AI · Cloudflare production

Hosting di produzione: Cloudflare Workers, worker `studybook-ai`, sorgente `main`.
La pipeline `.github/workflows/cloudflare-production.yml` esegue build, verifica workerd (23 test), deploy e smoke test HTTPS con tutti e tre gli endpoint AI reali. L'URL e la versione restituiti da Wrangler vengono salvati nel riepilogo e nell'artefatto `StudyBook-Cloudflare-Production`.

Il branch `candidate/cloudflare-production-01` consente la prima pubblicazione con marker `[cloudflare-production]` prima di promuovere `main`. I deploy successivi partono dai push su `main` o da workflow_dispatch su `main`. Netlify non è più il target di pubblicazione.

## Configurazione

`wrangler.jsonc` definisce asset `dist`, fallback SPA, routing `/api/*`, modello e URL provider. Il frontend conserva gli endpoint `/api/summarize`, `/api/explain`, `/api/refine`.

Secret GitHub richiesti: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `AI_API_KEY` oppure `GEMINI_API_KEY`, `VITE_POSTHOG_PROJECT_TOKEN`. La chiave AI viene trasferita nel secret Worker `AI_API_KEY` tramite un file temporaneo rimosso al termine del job. Nessuna chiave AI entra nel bundle browser.

## PostHog

Diagnostica degli errori nel progetto EU configurato dal project token; session recording, autocapture click/form e pageview automatiche restano disabilitati. La build di produzione imposta `VITE_MOTORLAB_POSTHOG_TEST=0`, disabilitando il probe sintetico anche se presente il parametro URL. Il LAB separato mantiene il suo workflow preview e il probe esplicito.

## Netlify

Dopo la verifica della prima pubblicazione Cloudflare, scollegare il repository GitHub da `studybook-ai` e arrestare le build Netlify prima di promuovere `main`. Il vecchio progetto resta recuperabile: non eliminare account, altri progetti o dati.

## Collaudo reale Android

Le verifiche automatiche e HTTPS non sostituiscono il collaudo Android di fotocamera, scanner multipagina, import PDF, OCR, Libreria, export, installazione PWA e ripresa dopo chiusura. Definire la release `production-verified` solo dopo questo collaudo.
