import handler from '../api/summarize.js';

process.env.AI_API_URL = 'https://provider.invalid/v1/chat/completions';
process.env.AI_API_KEY = 'test-key';
process.env.AI_MODEL = 'test-model';
process.env.AI_TIMEOUT_MS = '8000';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function makeResponseRecorder() {
  const state = { statusCode: 200, body: null, headers: {} };
  return {
    state,
    setHeader(name, value) { state.headers[name] = value; },
    status(code) { state.statusCode = code; return this; },
    json(payload) { state.body = payload; return payload; },
  };
}

function paragraphCountFromRequest(options) {
  const payload = JSON.parse(options.body);
  const source = payload.messages?.[1]?.content || '';
  return [...source.matchAll(/<PARAGRAFO id="\d+">/g)].length;
}

function successPayload(count) {
  return {
    choices: [{
      message: {
        content: JSON.stringify({
          summaries: Array.from({ length: count }, (_, index) => ({
            summary: `Sintesi ${index + 1}`,
            dsaSummary: `Sintesi DSA ${index + 1}`,
            keyPoints: [`Punto ${index + 1}`],
            remember: [`Ricorda ${index + 1}`],
            keywords: [`termine${index + 1}`],
            glossary: [],
          })),
        }),
      },
    }],
  };
}

async function callHandler(paragraphs) {
  const req = {
    method: 'POST',
    body: {
      paragraphs,
      contexts: paragraphs.map((_, index) => ({ chapterTitle: 'Capitolo test', page: `p. ${index + 1}` })),
      level: 'studio',
    },
  };
  const res = makeResponseRecorder();
  await handler(req, res);
  return res.state;
}

async function testTransientRetry() {
  let calls = 0;
  globalThis.fetch = async (_url, options) => {
    calls += 1;
    if (calls === 1) return new Response('temporaneamente non disponibile', { status: 503 });
    const count = paragraphCountFromRequest(options);
    return new Response(JSON.stringify(successPayload(count)), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  const result = await callHandler(['Primo paragrafo di prova.', 'Secondo paragrafo di prova.']);
  assert(result.statusCode === 200, `Retry: atteso 200, ricevuto ${result.statusCode}.`);
  assert(calls === 2, `Retry: attese 2 chiamate provider, ricevute ${calls}.`);
  assert(result.body?.summaries?.length === 2, 'Retry: numero sintesi errato.');
  assert(result.body?.resilience?.providerRetries === 1, 'Retry: metrica providerRetries errata.');
}

async function testSplitAfterMalformedBatch() {
  let calls = 0;
  globalThis.fetch = async (_url, options) => {
    calls += 1;
    const count = paragraphCountFromRequest(options);
    if (count === 4) {
      return new Response(JSON.stringify({
        choices: [{ message: { content: '{json non valido' } }],
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify(successPayload(count)), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  const result = await callHandler([
    'Paragrafo uno.',
    'Paragrafo due.',
    'Paragrafo tre.',
    'Paragrafo quattro.',
  ]);

  assert(result.statusCode === 200, `Split: atteso 200, ricevuto ${result.statusCode}.`);
  assert(result.body?.summaries?.length === 4, 'Split: devono tornare tutte e quattro le sintesi.');
  assert(result.body?.resilience?.providerRetries === 1, 'Split: il batch iniziale deve essere ritentato una volta.');
  assert(result.body?.resilience?.batchSplits === 1, 'Split: il batch deve essere diviso una volta.');
  assert(calls === 4, `Split: attese 4 chiamate provider, ricevute ${calls}.`);
}

async function testNonRetryableFailure() {
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return new Response('non autorizzato', { status: 401 });
  };

  const result = await callHandler(['Paragrafo singolo.']);
  assert(result.statusCode === 502, `Errore non ritentabile: atteso 502, ricevuto ${result.statusCode}.`);
  assert(calls === 1, `Errore non ritentabile: attesa una sola chiamata, ricevute ${calls}.`);
  assert(result.body?.resilience?.providerRetries === 0, 'Errore non ritentabile: non deve esserci retry.');
  assert(result.body?.resilience?.batchSplits === 0, 'Errore non ritentabile: non deve esserci split.');
}

await testTransientRetry();
await testSplitAfterMalformedBatch();
await testNonRetryableFailure();

console.log(JSON.stringify({
  ok: true,
  tests: 3,
  coverage: ['transient-retry', 'split-fallback', 'non-retryable-failure'],
}, null, 2));
