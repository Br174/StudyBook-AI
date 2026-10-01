import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const base = readFileSync('cloudflare-production-url.txt', 'utf8').trim();
assert.ok(base.startsWith('https://'));
async function get(path) {
  const response = await fetch(new URL(path, base), { signal: AbortSignal.timeout(45000) });
  assert.equal(response.status, 200, path);
  return response;
}
const home = await (await get('/')).text();
assert.match(home, /<div id="root"/);
const script = home.match(/<script\b[^>]*\bsrc="([^"]+)"/)?.[1];
assert.ok(script);
assert.match((await get(script)).headers.get('content-type'), /javascript/);
for (const path of ['/sw.js', '/manifest.webmanifest', '/studybook-icon.svg']) await get(path);
const missing = await fetch(new URL('/api/motorlab-not-found', base));
assert.equal(missing.status, 404);
assert.match((await missing.json()).error, /Endpoint non trovato/);

const source = 'La fotosintesi usa luce, acqua e anidride carbonica per produrre zuccheri e ossigeno. Gli zuccheri conservano energia chimica per la pianta.';
async function post(path, body) {
  const response = await fetch(new URL(path, base), {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body), signal: AbortSignal.timeout(90000),
  });
  assert.equal(response.status, 200, path + ': ' + response.status);
  return response.json();
}
const summary = await post('/api/summarize', { paragraphs: [source], level: 'studio' });
assert.equal(summary.summaries.length, 1);
assert.equal(summary.summaries[0].engine, 'ai');
assert.ok(summary.summaries[0].summary.trim());
const explanation = await post('/api/explain', { selection: 'energia chimica', sourceText: source, action: 'meaning' });
assert.ok(explanation.answer.trim());
const refined = await post('/api/refine', { original: source, summary: 'La pianta usa la luce.', level: 'studio' });
assert.ok(refined.result.summary.trim());
assert.ok(refined.result.dsaSummary.trim());
assert.ok(Array.isArray(refined.result.keyPoints));
console.log('Production verified: home, JS, PWA, API routing and all three real AI endpoints.');
