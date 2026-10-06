import summarizeHandler from '../api/summarize.js';
import explainHandler from '../api/explain.js';
import refineHandler from '../api/refine.js';

const API_ROUTES = new Map([
  ['/api/summarize', summarizeHandler],
  ['/api/explain', explainHandler],
  ['/api/refine', refineHandler],
]);

const NATIVE_ORIGINS = new Set([
  'http://localhost',
  'https://localhost',
  'capacitor://localhost',
]);

function withNativeCors(response, request) {
  const origin = request.headers.get('Origin') || '';
  if (!NATIVE_ORIGINS.has(origin)) return response;
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Access-Control-Allow-Methods', 'POST, GET, HEAD, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type');
  headers.set('Access-Control-Max-Age', '86400');
  headers.append('Vary', 'Origin');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function requestHeaders(request) {
  return Object.fromEntries(request.headers.entries());
}

async function runLegacyApi(handler, request) {
  let body = {};

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    try {
      const raw = await request.text();
      body = raw ? JSON.parse(raw) : {};
    } catch {
      return Response.json({ error: 'JSON non valido.' }, { status: 400 });
    }
  }

  const req = {
    method: request.method,
    body,
    headers: requestHeaders(request),
    url: request.url,
  };

  let statusCode = 200;
  const headers = new Headers();
  let responseBody = '';
  let finished = false;

  const res = {
    setHeader(name, value) {
      if (Array.isArray(value)) {
        value.forEach((item) => headers.append(name, String(item)));
      } else {
        headers.set(name, String(value));
      }
      return res;
    },
    status(code) {
      statusCode = Number(code) || 200;
      return res;
    },
    json(value) {
      headers.set('Content-Type', 'application/json; charset=utf-8');
      responseBody = JSON.stringify(value ?? null);
      finished = true;
      return res;
    },
    send(value) {
      responseBody = typeof value === 'string' ? value : JSON.stringify(value ?? '');
      finished = true;
      return res;
    },
    end(value = '') {
      responseBody = String(value ?? '');
      finished = true;
      return res;
    },
  };

  try {
    const returned = await handler(req, res);
    if (!finished && returned instanceof Response) return returned;
  } catch (error) {
    console.error('StudyBook API failure', error);
    return Response.json(
      { error: 'Errore interno del servizio.', code: 'INTERNAL_ERROR' },
      { status: 500 },
    );
  }

  return new Response(responseBody, {
    status: statusCode,
    headers,
  });
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const handler = API_ROUTES.get(url.pathname);

    if (!handler) {
      return withNativeCors(Response.json({ error: 'Endpoint non trovato.' }, { status: 404 }), request);
    }

    if (request.method === 'OPTIONS') {
      return withNativeCors(new Response(null, { status: 204 }), request);
    }

    return withNativeCors(await runLegacyApi(handler, request), request);
  },
};
