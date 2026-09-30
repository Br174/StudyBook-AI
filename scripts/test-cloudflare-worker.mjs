import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { after, before, beforeEach, describe, test } from 'node:test';
import { createTestHarness } from 'wrangler';

const config = JSON.parse(await readFile(new URL('../wrangler.jsonc', import.meta.url), 'utf8'));
const root = new URL('../', import.meta.url);
const testSecret = 'studybook-cloudflare-test-only';
const observed = [];
let providerMode = 'success';
let server;
let workerOptions;

function resultFor(source) {
  return {
    summary: source,
    dsaSummary: source,
    keyPoints: [source],
    remember: [source],
    keywords: [],
    glossary: [],
  };
}

const provider = createServer(async (req, res) => {
  try {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    const payload = JSON.parse(raw);
    observed.push({ payload, authorization: req.headers.authorization });
    if (providerMode === 'reject') {
      res.writeHead(401).end('Credenziali di test rifiutate');
      return;
    }
    if (providerMode === 'retry' && observed.length === 1) {
      res.writeHead(503).end('Errore transitorio di test');
      return;
    }
    const prompt = payload.messages?.[0]?.content || '';
    const source = payload.messages?.[1]?.content || '';
    let answer;
    if (prompt.includes('assistente di comprensione')) {
      answer = { answer: 'Spiegazione di prova.', basis: 'source', label: 'Significato' };
    } else if (prompt.includes('editor di precisione')) {
      answer = resultFor('Sintesi corretta di prova.');
    } else {
      const paragraphs = [...source.matchAll(/<PARAGRAFO id="\d+">\n([\s\S]*?)\n<\/PARAGRAFO>/g)];
      answer = { summaries: paragraphs.map((match) => resultFor(match[1])) };
    }
    const content = providerMode === 'malformed' ? '{json non valido' : JSON.stringify(answer);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ choices: [{ message: { content } }] }));
  } catch {
    res.writeHead(500).end('Richiesta di test non valida');
  }
});

async function post(path, body) {
  return server.fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function jsonResponse(response, status) {
  assert.equal(response.status, status);
  assert.match(response.headers.get('Content-Type') || '', /application\/json/);
  const text = await response.text();
  assert.ok(!text.includes(testSecret), 'Il secret non deve essere restituito al client.');
  return JSON.parse(text);
}

describe('Cloudflare migration: production configuration in workerd', { concurrency: false, timeout: 120000 }, () => {
  before(async () => {
    await new Promise((resolve, reject) => {
      provider.once('error', reject);
      provider.listen(0, '127.0.0.1', resolve);
    });
    workerOptions = {
      configPath: new URL('../wrangler.jsonc', import.meta.url),
      vars: { AI_API_URL: 'http://127.0.0.1:' + provider.address().port + '/v1/chat/completions' },
      secrets: { AI_API_KEY: testSecret },
    };
    server = createTestHarness({ workers: [workerOptions] });
    await server.listen();
  });

  beforeEach(() => {
    observed.length = 0;
    providerMode = 'success';
  });

  after(async () => {
    try {
      if (server) await server.close();
    } finally {
      provider.closeAllConnections();
      if (provider.listening) await new Promise((resolve) => provider.close(resolve));
    }
  });

  test('home serves the Vite application', async () => {
    const response = await server.fetch('/');
    assert.equal(response.status, 200);
    assert.match(response.headers.get('Content-Type') || '', /text\/html/);
    assert.equal(await response.text(), await readFile(new URL('dist/index.html', root), 'utf8'));
  });

  test('deep links use the SPA fallback', async () => {
    const response = await server.fetch('/studio/capitolo-di-prova', {
      headers: { Accept: 'text/html', 'Sec-Fetch-Mode': 'navigate' },
    });
    assert.equal(response.status, 200);
    assert.equal(await response.text(), await readFile(new URL('dist/index.html', root), 'utf8'));
  });

  test('the built JavaScript is served as an asset', async () => {
    const html = await readFile(new URL('dist/index.html', root), 'utf8');
    const path = html.match(/<script\b[^>]*\bsrc="([^"]+)"/)?.[1];
    assert.ok(path, 'Manca lo script principale nella build.');
    const response = await server.fetch(path);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('Content-Type') || '', /javascript/);
    const source = await response.text();
    assert.ok(!source.includes(testSecret), 'Il secret non deve essere incluso nel bundle client.');
    assert.ok(source.length > 100);
  });

  for (const path of ['/sw.js', '/manifest.webmanifest', '/studybook-icon.svg']) {
    test('PWA asset ' + path + ' is preserved', async () => {
      const response = await server.fetch(path);
      assert.equal(response.status, 200);
      assert.equal(await response.text(), await readFile(new URL('dist' + path, root), 'utf8'));
    });
  }

  test('unknown API stays JSON even for browser navigation', async () => {
    const response = await server.fetch('/api/not-found', {
      headers: { Accept: 'text/html', 'Sec-Fetch-Mode': 'navigate' },
    });
    const body = await jsonResponse(response, 404);
    assert.equal(body.error, 'Endpoint non trovato.');
    assert.equal(observed.length, 0);
  });

  for (const path of ['/api/summarize', '/api/explain', '/api/refine']) {
    test('GET ' + path + ' returns 405 with Allow', async () => {
      const response = await server.fetch(path);
      assert.equal(response.headers.get('Allow'), 'POST');
      await jsonResponse(response, 405);
      assert.equal(observed.length, 0);
    });
  }

  test('malformed input JSON returns 400 without contacting AI', async () => {
    const response = await server.fetch('/api/summarize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{',
    });
    await jsonResponse(response, 400);
    assert.equal(observed.length, 0);
  });

  test('summaries preserve order and use the configured model and secret', async () => {
    const paragraphs = ['Primo paragrafo.', 'Secondo paragrafo.'];
    const response = await post('/api/summarize?source=test', { paragraphs });
    const body = await jsonResponse(response, 200);
    assert.deepEqual(body.summaries.map((item) => item.summary), paragraphs);
    assert.ok(body.summaries.every((item) => item.engine === 'ai'));
    assert.deepEqual(body.resilience, { providerRequests: 1, providerRetries: 0, batchSplits: 0 });
    assert.equal(observed.length, 1);
    assert.equal(observed[0].authorization, 'Bearer ' + testSecret);
    assert.equal(observed[0].payload.model, config.vars.AI_MODEL);
  });

  test('explain preserves its API contract', async () => {
    const body = await jsonResponse(await post('/api/explain', {
      selection: 'Termine di prova', sourceText: 'Contesto di prova.', action: 'meaning',
    }), 200);
    assert.deepEqual(body, { answer: 'Spiegazione di prova.', basis: 'source', label: 'Significato' });
    assert.equal(observed.length, 1);
    assert.equal(observed[0].authorization, 'Bearer ' + testSecret);
    assert.equal(observed[0].payload.model, config.vars.AI_MODEL);
  });

  test('refine preserves its API contract', async () => {
    const body = await jsonResponse(await post('/api/refine', {
      original: 'Testo originale.', summary: 'Sintesi precedente.',
    }), 200);
    assert.equal(body.result.summary, 'Sintesi corretta di prova.');
    assert.ok(Array.isArray(body.result.keyPoints));
    assert.equal(observed.length, 1);
    assert.equal(observed[0].authorization, 'Bearer ' + testSecret);
    assert.equal(observed[0].payload.model, config.vars.AI_MODEL);
  });

  test('empty summary input is rejected before contacting AI', async () => {
    await jsonResponse(await post('/api/summarize', { paragraphs: [] }), 400);
    assert.equal(observed.length, 0);
  });

  test('oversized summary batches retain the existing size limit', async () => {
    const body = await jsonResponse(await post('/api/summarize', { paragraphs: ['a'.repeat(22001)] }), 413);
    assert.equal(body.code, 'BATCH_TOO_LARGE');
    assert.equal(observed.length, 0);
  });

  test('missing selected text is rejected before contacting AI', async () => {
    await jsonResponse(await post('/api/explain', {}), 400);
    assert.equal(observed.length, 0);
  });

  test('oversized refine input retains the existing size limit', async () => {
    await jsonResponse(await post('/api/refine', { original: 'a'.repeat(14001) }), 413);
    assert.equal(observed.length, 0);
  });

  test('transient provider failures retain the existing retry', async () => {
    providerMode = 'retry';
    const body = await jsonResponse(await post('/api/summarize', { paragraphs: ['Prova retry.'] }), 200);
    assert.equal(body.summaries[0].summary, 'Prova retry.');
    assert.equal(body.resilience.providerRetries, 1);
    assert.equal(observed.length, 2);
  });

  test('provider authentication failures are not retried', async () => {
    providerMode = 'reject';
    const body = await jsonResponse(await post('/api/summarize', { paragraphs: ['Prova rifiuto.'] }), 502);
    assert.equal(body.code, 'UPSTREAM_401');
    assert.equal(observed.length, 1);
  });

  test('malformed AI output is reported as an API error', async () => {
    providerMode = 'malformed';
    await jsonResponse(await post('/api/explain', { selection: 'Termine' }), 502);
    assert.equal(observed.length, 1);
  });

  test('concurrent requests preserve their separate results', async () => {
    const sources = ['Richiesta uno.', 'Richiesta due.', 'Richiesta tre.'];
    const bodies = await Promise.all(sources.map(async (source) => (
      jsonResponse(await post('/api/summarize', { paragraphs: [source] }), 200)
    )));
    assert.deepEqual(bodies.map((body) => body.summaries[0].summary), sources);
    assert.equal(observed.length, 3);
  });

  test('a missing AI secret returns 503 on all three endpoints', async () => {
    try {
      await server.update({ workers: [{ ...workerOptions, secrets: { AI_API_KEY: '' } }] });
      for (const path of ['/api/summarize', '/api/explain', '/api/refine']) {
        const body = await jsonResponse(await post(path, {}), 503);
        assert.equal(body.code, 'AI_NOT_CONFIGURED');
      }
      assert.equal(observed.length, 0);
    } finally {
      await server.update({ workers: [workerOptions] });
    }
  });
});
